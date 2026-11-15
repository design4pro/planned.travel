#!/usr/bin/env node
// Cezar invokes --ref in an isolated staging directory and publishes under its reader lock.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = 'open-mercato/skills'
const manifestPath = 'scripts/agents/skills-upstream.json'
const skillName = /^om-[a-z0-9-]+$/
const versionMarker =
  /<!-- om-skills-version:start -->[\s\S]*?<!-- om-skills-version:end -->/
const git = (root, ...args) =>
  execFileSync('git', ['-C', root, ...args], {
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([name]) => !name.startsWith('GIT_'),
        ),
      ),
      GIT_TERMINAL_PROMPT: '0',
    },
  })

function safePath(root, relative) {
  if (
    !relative ||
    relative.startsWith('/') ||
    relative.split('/').some((part) => !part || part === '..' || part === '.')
  ) {
    throw new Error('Unsafe skill update path.')
  }
  let path = root
  for (const part of relative.split('/')) {
    path = join(path, part)
    if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Refusing a symlinked update path: ${relative}`)
    }
  }
  return path
}

const blobHash = (data) =>
  createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')

function installedFiles(root) {
  const files = []
  function walk(relative) {
    const path = safePath(root, relative)
    const stat = lstatSync(path)
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) walk(`${relative}/${name}`)
    } else if (stat.isFile()) {
      files.push({
        path: relative,
        sha: blobHash(readFileSync(path)),
        mode: stat.mode & 0o111 ? '100755' : '100644',
      })
    } else throw new Error('Unsupported installed skill file.')
  }
  for (const name of readdirSync(safePath(root, '.agents/skills'))
    .filter((name) => skillName.test(name))
    .sort()) {
    walk(`.agents/skills/${name}`)
  }
  return files
}

function verifyFiles(actual, expected) {
  const inventory = (files) =>
    files.map(({ path, sha, mode }) => `${path}\0${sha}\0${mode}`).sort()
  if (
    JSON.stringify(inventory(actual)) !== JSON.stringify(inventory(expected))
  ) {
    throw new Error(
      'Local skill files, permissions or inventory differ; automatic replacement refused.',
    )
  }
}

function readSnapshot(checkout, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new Error('A full upstream commit SHA is required.')
  const rows = git(checkout, 'ls-tree', '-rz', sha, '--', 'skills')
    .toString()
    .split('\0')
    .filter(Boolean)
  const entries = rows.map((row) => {
    const match =
      /^(100644|100755) blob ([a-f0-9]{40})\tskills\/(om-[a-z0-9-]+)\/(.+)$/.exec(
        row,
      )
    if (!match) throw new Error('Unsupported upstream skill entry.')
    const [, mode, blob, name, relative] = match
    if (
      relative.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new Error('Unsafe upstream skill path.')
    return {
      path: `.agents/skills/${name}/${relative}`,
      sha: blob,
      mode,
      name,
      relative,
    }
  })
  const names = [...new Set(entries.map((file) => file.name))].sort()
  if (
    !names.length ||
    names.some(
      (name) =>
        !entries.some(
          (file) => file.name === name && file.relative === 'SKILL.md',
        ),
    )
  ) {
    throw new Error('The upstream skill inventory is incomplete.')
  }
  const extracted = mkdtempSync(join(tmpdir(), 'planned-travel-skills-source-'))
  try {
    execFileSync('tar', ['-xf', '-', '-C', extracted], {
      input: git(checkout, 'archive', '--format=tar', sha, '--', 'skills'),
      timeout: 30_000,
    })
    const files = entries.map((entry) => {
      const data = readFileSync(
        safePath(extracted, `skills/${entry.name}/${entry.relative}`),
      )
      if (blobHash(data) !== entry.sha)
        throw new Error(
          'Upstream skill bytes differ from the selected Git object.',
        )
      return { ...entry, data }
    })
    return { sha, names, files }
  } finally {
    rmSync(extracted, { recursive: true, force: true })
  }
}

function metadata(root, snapshot) {
  const lock = JSON.parse(
    readFileSync(safePath(root, 'skills-lock.json'), 'utf8'),
  )
  if (
    ![1, 2].includes(lock.version) ||
    !lock.skills ||
    typeof lock.skills !== 'object' ||
    Array.isArray(lock.skills)
  ) {
    throw new Error('Unsupported project skills lock.')
  }
  for (const [name, entry] of Object.entries(lock.skills)) {
    if (skillName.test(name)) {
      if (entry?.source !== source)
        throw new Error(
          'An Open Mercato skill name belongs to a different source.',
        )
      delete lock.skills[name]
    }
  }
  for (const name of snapshot.names) {
    // Preserve the skills.sh hash contract for each supported lock version.
    const hash = createHash('sha256')
    for (const file of snapshot.files
      .filter((file) => file.name === name)
      .filter(
        (file) =>
          !file.relative
            .split('/')
            .some(
              (part, index, parts) =>
                part === 'metadata.json' ||
                (index < parts.length - 1 &&
                  ['.git', '__pycache__', '__pypackages__'].includes(part)),
            ),
      )
      .sort((a, b) =>
        lock.version === 2
          ? Buffer.compare(Buffer.from(a.relative), Buffer.from(b.relative))
          : a.relative.localeCompare(b.relative),
      )) {
      hash.update(file.relative)
      let data = file.data
      if (lock.version === 2) {
        if (!data.includes(0) && data.includes('\r\n')) {
          data = Buffer.from(
            data.toString('latin1').replaceAll('\r\n', '\n'),
            'latin1',
          )
        }
        hash.update('\0')
        hash.update(String(data.length))
        hash.update('\0')
      }
      hash.update(data)
    }
    lock.skills[name] = {
      source,
      sourceType: 'github',
      skillPath: `skills/${name}/SKILL.md`,
      computedHash: hash.digest('hex'),
      ...(lock.version === 2 ? { installMode: 'copy' } : {}),
    }
  }
  const docPath = safePath(root, 'docs/agents/cezar.md')
  const document = readFileSync(docPath, 'utf8')
  if (!versionMarker.test(document))
    throw new Error(
      'Missing Open Mercato version marker in Cezar documentation.',
    )
  const matched = versionMarker.exec(document)
  const version = `<!-- om-skills-version:start -->\n\nInstalled Open Mercato commit: \`${snapshot.sha}\` (${snapshot.names.length} skills).\n<!-- om-skills-version:end -->`
  const doc = (
    document.slice(0, matched.index) +
    version +
    document.slice(matched.index + matched[0].length)
  ).replace(/open-mercato\/skills@[a-f0-9]{40}/g, `${source}@${snapshot.sha}`)
  const manifest = {
    source,
    branch: 'main',
    sha: snapshot.sha,
    files: snapshot.files.map(({ path, sha, mode, localSha, reason }) => ({
      path,
      sha,
      mode,
      ...(localSha ? { localSha, reason } : {}),
    })),
  }
  return { lock, manifest, doc }
}

function writeMetadata(root, data) {
  const path = safePath(root, manifestPath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(data.manifest, null, 2)}\n`)
  writeFileSync(
    safePath(root, 'skills-lock.json'),
    `${JSON.stringify(data.lock, null, 2)}\n`,
  )
  writeFileSync(safePath(root, 'docs/agents/cezar.md'), data.doc)
}

/** Enroll existing bytes only after proving they match an exact upstream commit. */
export function adoptSnapshot(root, checkout, sha) {
  const snapshot = readSnapshot(checkout, sha)
  verifyFiles(installedFiles(root), snapshot.files)
  const data = metadata(root, snapshot)
  safePath(root, manifestPath)
  writeMetadata(root, data)
  return snapshot.names.length
}

/** Rebase only the repairs explicitly recorded by the reviewed installed manifest. */
function preserveRepairs(root, checkout, previous, snapshot) {
  const repairs = previous.files.filter((file) => file.localSha)
  if (!repairs.length) return
  const scratch = mkdtempSync(join(tmpdir(), 'planned-travel-skill-repairs-'))
  try {
    for (const file of snapshot.files) {
      const target = safePath(scratch, file.path)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, file.data)
    }
    for (const repair of repairs) {
      const target = snapshot.files.find((file) => file.path === repair.path)
      if (!target)
        throw new Error(`A reviewed repair needs migration: ${repair.path}`)
      const upstreamPath = repair.path.replace(/^\.agents\//, '')
      const base = git(checkout, 'show', `${previous.sha}:${upstreamPath}`)
      if (blobHash(base) !== repair.sha)
        throw new Error('Recorded repair base differs from upstream.')
      const before = join(scratch, 'repair-before')
      const after = join(scratch, 'repair-after')
      writeFileSync(before, base)
      writeFileSync(after, readFileSync(safePath(root, repair.path)))
      let patch
      try {
        patch = execFileSync(
          'git',
          ['diff', '--no-index', '--', before, after],
          { encoding: 'utf8' },
        )
      } catch (error) {
        if (error.status !== 1 || !error.stdout) throw error
        patch = String(error.stdout)
      }
      if (!patch) continue
      patch = patch
        .replace(
          /^diff --git .*$/m,
          `diff --git a/${repair.path} b/${repair.path}`,
        )
        .replace(/^--- .*$/m, `--- a/${repair.path}`)
        .replace(/^\+\+\+ .*$/m, `+++ b/${repair.path}`)
      const options = {
        cwd: scratch,
        input: patch,
        encoding: 'utf8',
        timeout: 30_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
      // --reverse detects a repair that upstream has already incorporated.
      let alreadyFixed = false
      try {
        execFileSync('git', ['apply', '--reverse', '--check', '-'], options)
        alreadyFixed = true
      } catch {}
      if (!alreadyFixed) {
        execFileSync('git', ['apply', '--check', '-'], options)
        execFileSync('git', ['apply', '-'], options)
      }
      const data = readFileSync(safePath(scratch, repair.path))
      target.data = data
      const localSha = blobHash(data)
      if (localSha !== target.sha)
        Object.assign(target, { localSha, reason: repair.reason })
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

/** Called on Cezar's staged copy, never on an actively used checkout. */
export function installSnapshot(root, checkout, sha) {
  const previous = JSON.parse(
    readFileSync(safePath(root, manifestPath), 'utf8'),
  )
  if (
    (previous.source !== undefined && previous.source !== source) ||
    !/^[a-f0-9]{40}$/.test(previous.sha)
  )
    throw new Error('Invalid installed skills manifest.')
  const actual = installedFiles(root)
  verifyFiles(
    actual,
    previous.files.map((file) => ({ ...file, sha: file.localSha ?? file.sha })),
  )
  const snapshot = readSnapshot(checkout, sha)
  preserveRepairs(root, checkout, previous, snapshot)
  const data = metadata(root, snapshot)
  for (const file of snapshot.files) safePath(root, file.path)
  for (const name of new Set(actual.map((file) => file.path.split('/')[2]))) {
    rmSync(safePath(root, `.agents/skills/${name}`), { recursive: true })
  }
  for (const file of snapshot.files) {
    const path = safePath(root, file.path)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, file.data)
    chmodSync(path, file.mode === '100755' ? 0o755 : 0o644)
  }
  writeMetadata(root, data)
  return snapshot.names.length
}

if (
  process.argv[1] &&
  lstatSync(process.argv[1], { throwIfNoEntry: false }) &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2)
  if (
    args.length !== 2 ||
    args[0] !== '--ref' ||
    !/^[a-f0-9]{40}$/.test(args[1])
  ) {
    throw new Error(
      'Expected --ref followed by a full upstream commit SHA; Cezar runs this command in staging.',
    )
  }
  const checkout = mkdtempSync(join(tmpdir(), 'planned-travel-skills-fetch-'))
  try {
    git(checkout, 'init', '--quiet')
    git(
      checkout,
      'fetch',
      '--quiet',
      '--depth=1',
      `https://github.com/${source}.git`,
      args[1],
    )
    const previous = JSON.parse(
      readFileSync(join(process.cwd(), manifestPath), 'utf8'),
    )
    if (previous.sha !== args[1])
      git(
        checkout,
        'fetch',
        '--quiet',
        '--depth=1',
        `https://github.com/${source}.git`,
        previous.sha,
      )
    const count = installSnapshot(process.cwd(), checkout, args[1])
    console.log(JSON.stringify({ source, sha: args[1], skills: count }))
  } finally {
    rmSync(checkout, { recursive: true, force: true })
  }
}
