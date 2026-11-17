#!/usr/bin/env node
// Restore the reviewed pin, or explicitly update it while retaining reviewed local repairs.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const manifestPath = 'scripts/agents/skills-upstream.json'
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const args = process.argv.slice(2).filter((arg) => arg !== '--')
if (args.length && (args.length !== 2 || args[0] !== '--ref')) {
  throw new Error('Usage: pnpm install-skills [-- --ref <full-reviewed-SHA>]')
}
const ref = args[1] ?? manifest.sha
if (!/^[a-f0-9]{40}$/.test(ref))
  throw new Error('A full commit SHA is required')
const blobHash = (bytes) =>
  createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
const expected = new Set(manifest.files.map((file) => file.path))
const expectedDirectories = new Set()
for (const path of expected) {
  const parts = path.split('/')
  while (parts.length > 2) {
    parts.pop()
    expectedDirectories.add(parts.join('/'))
  }
}
// Impeccable is the sole user-approved addon; it is never owned by this updater.
const addonPath = '.agents/skills/impeccable'
function verifyAddon(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = `${root}/${entry.name}`
    if (entry.isDirectory()) verifyAddon(path)
    else if (!entry.isFile())
      throw new Error(`Refusing to preserve a non-regular addon entry: ${path}`)
  }
}
function verifyInventory(root) {
  if (lstatSync(root).isSymbolicLink())
    throw new Error(`Refusing a symlinked skill path: ${root}`)
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = `${root}/${entry.name}`
    if (path === addonPath && entry.isDirectory()) {
      const skill = `${path}/SKILL.md`
      if (!lstatSync(skill).isFile())
        throw new Error(`Refusing to preserve an invalid addon: ${skill}`)
      verifyAddon(path)
    } else if (entry.isDirectory() && expectedDirectories.has(path))
      verifyInventory(path)
    else if (!entry.isFile() || !expected.has(path))
      throw new Error(`Refusing to delete an unreviewed skill entry: ${path}`)
  }
}
verifyInventory('.agents/skills')
for (const file of manifest.files) {
  if (
    !['100644', '100755'].includes(file.mode) ||
    Boolean(lstatSync(file.path).mode & 0o111) !== (file.mode === '100755')
  )
    throw new Error(
      `Refusing to overwrite local skill permissions: ${file.path}`,
    )
  if (blobHash(readFileSync(file.path)) !== (file.localSha ?? file.sha)) {
    throw new Error(`Refusing to overwrite a local skill edit: ${file.path}`)
  }
}
const repairs = new Map(
  manifest.files
    .filter((file) => file.localSha)
    .map((file) => {
      const bytes = readFileSync(file.path)
      if (blobHash(bytes) !== file.localSha)
        throw new Error(`Unreviewed local repair: ${file.path}`)
      return [file.path, { ...file, bytes }]
    }),
)
const temporary = mkdtempSync(join(tmpdir(), 'planned-travel-skills-'))
const checkout = join(temporary, 'upstream')
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', timeout: 120_000 })
try {
  git('init', '-q', checkout)
  git(
    '-C',
    checkout,
    'remote',
    'add',
    'origin',
    'https://github.com/open-mercato/skills.git',
  )
  git('-C', checkout, 'fetch', '--quiet', '--depth=1', 'origin', ref)
  git('-C', checkout, 'checkout', '--quiet', '--detach', 'FETCH_HEAD')
  if (git('-C', checkout, 'rev-parse', 'HEAD').trim() !== ref)
    throw new Error('Pin mismatch')
  const records = git('-C', checkout, 'ls-tree', '-rz', 'HEAD', 'skills')
    .split('\0')
    .filter(Boolean)
  const files = []
  const names = new Set()
  for (const record of records) {
    const match =
      /^(100644|100755) blob ([a-f0-9]{40})\tskills\/(om-[a-z0-9-]+)\/(.+)$/.exec(
        record,
      )
    if (!match) throw new Error(`Unsupported upstream entry: ${record}`)
    const [, mode, sha, name, relative] = match
    const path = `.agents/skills/${name}/${relative}`
    const source = join(checkout, 'skills', name, relative)
    const bytes = readFileSync(source)
    if (blobHash(bytes) !== sha) throw new Error(`Blob mismatch: ${path}`)
    const entry = { path, sha, mode }
    const repair = repairs.get(path)
    if (repair) {
      if (repair.sha !== sha)
        throw new Error(
          `Review the changed repair base before updating: ${path}`,
        )
      writeFileSync(source, repair.bytes)
      Object.assign(entry, { localSha: repair.localSha, reason: repair.reason })
    }
    names.add(name)
    files.push(entry)
  }
  for (const path of repairs.keys()) {
    if (!files.some((file) => file.path === path))
      throw new Error(`Upstream removed a repaired file: ${path}`)
  }
  if (!names.size) throw new Error('Empty upstream collection')
  const lock = { version: 1, skills: {} }
  for (const name of [...names].sort()) {
    const root = join(checkout, 'skills', name)
    const paths = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((file) => file.isFile())
      .map((file) => join(file.parentPath, file.name).slice(root.length + 1))
      .sort((a, b) => a.localeCompare(b))
    const hash = createHash('sha256')
    for (const path of paths) {
      hash.update(path)
      hash.update(readFileSync(join(root, path)))
    }
    lock.skills[name] = {
      source: 'open-mercato/skills',
      sourceType: 'github',
      computedHash: hash.digest('hex'),
    }
  }
  // All upstream and repair validation precedes mutation of the installed collection.
  for (const entry of readdirSync('.agents/skills', { withFileTypes: true })) {
    if (entry.name !== 'impeccable' && !entry.name.startsWith('om-'))
      throw new Error(`Unexpected project skill: ${entry.name}`)
  }
  for (const entry of readdirSync('.agents/skills').filter(
    (name) => name !== 'impeccable',
  ))
    rmSync(join('.agents/skills', entry), { recursive: true })
  for (const name of names)
    cpSync(join(checkout, 'skills', name), join('.agents/skills', name), {
      recursive: true,
    })
  writeFileSync(
    manifestPath,
    JSON.stringify({ sha: ref, files }, null, 2) + '\n',
  )
  writeFileSync('skills-lock.json', JSON.stringify(lock, null, 2) + '\n')
  const guide = 'docs/agents/cezar.md'
  writeFileSync(
    guide,
    readFileSync(guide, 'utf8').replace(
      /open-mercato\/skills@[a-f0-9]{40}/g,
      `open-mercato/skills@${ref}`,
    ),
  )
  console.log(
    `Installed ${names.size} Open Mercato skills at ${ref}. Review upgrade notes and tracker compatibility before running agents.`,
  )
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
