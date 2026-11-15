#!/usr/bin/env node
/** Install the complete upstream collection, retain reviewed repairs and refresh its evidence. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { relative } from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const source = 'open-mercato/skills'
const api = (path) =>
  JSON.parse(execFileSync('gh', ['api', path], { cwd: root, encoding: 'utf8' }))
const sha = api(`repos/${source}/commits/main`).sha
const tree = api(`repos/${source}/git/trees/${sha}?recursive=1`)
if (tree.truncated)
  throw new Error(
    'Upstream tree was truncated; installation evidence is incomplete.',
  )
const upstream = tree.tree.filter(
  (entry) => entry.type === 'blob' && entry.path.startsWith('skills/'),
)
const names = upstream
  .filter((entry) => /^skills\/[^/]+\/SKILL\.md$/.test(entry.path))
  .map((entry) => entry.path.split('/')[1])
if (!names.length) throw new Error('No upstream skills were discovered.')

// Resolve main once and install that exact commit so manifest and download cannot race.
execFileSync(
  'npx',
  [
    '-y',
    'skills@latest',
    'add',
    `https://github.com/${source}/tree/${sha}`,
    '--skill',
    '*',
    '--agent',
    'codex',
    '--copy',
    '--yes',
  ],
  { cwd: root, stdio: 'inherit' },
)
const digest = (bytes) =>
  createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
const manifest = {
  sha,
  files: upstream.map((entry) => {
    const path = `.agents/${entry.path}`
    if (
      digest(readFileSync(new URL(`../../${path}`, import.meta.url))) !==
      entry.sha
    )
      throw new Error(`Upstream content mismatch: ${path}`)
    return { path, sha: entry.sha, mode: entry.mode }
  }),
}
const repairs = {
  'om-gap-analysis': 'Preserve strict unique sequential criterion IDs.',
  'om-share-this-session':
    'Preserve credential redaction, including structured and serialized secrets.',
  'om-ux-design': 'Preserve concurrent feedback tombstones and keyboard focus.',
}
for (const [name, reason] of Object.entries(repairs)) {
  const patch = `scripts/agents/skill-patches/${name}.patch`
  // Fail closed if an upstream change makes a reviewed patch inapplicable.
  execFileSync('git', ['apply', '--check', patch], {
    cwd: root,
    stdio: 'inherit',
  })
  execFileSync('git', ['apply', patch], { cwd: root, stdio: 'inherit' })
  for (const file of manifest.files.filter((entry) =>
    entry.path.startsWith(`.agents/skills/${name}/`),
  )) {
    const localSha = digest(
      readFileSync(new URL(`../../${file.path}`, import.meta.url)),
    )
    if (localSha !== file.sha) Object.assign(file, { localSha, reason })
  }
}
const lockPath = new URL('../../skills-lock.json', import.meta.url)
const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
if (lock.version !== 2)
  throw new Error(
    'Review the skills CLI hash format before updating this installer.',
  )
for (const name of names) {
  const dir = `.agents/skills/${name}`
  const files = readdirSync(`${root}/${dir}`, {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name !== 'metadata.json')
    .map((entry) =>
      relative(
        `${root}/${dir}`,
        `${entry.parentPath}/${entry.name}`,
      ).replaceAll('\\', '/'),
    )
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
  const hash = createHash('sha256')
  for (const file of files) {
    const raw = readFileSync(`${root}/${dir}/${file}`)
    const content = raw.includes(0)
      ? raw
      : Buffer.from(raw.toString('latin1').replaceAll('\r\n', '\n'), 'latin1')
    hash
      .update(file)
      .update('\0')
      .update(String(content.length))
      .update('\0')
      .update(content)
  }
  lock.skills[name].computedHash = hash.digest('hex')
}
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
writeFileSync(
  new URL('./skills-upstream.json', import.meta.url),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
const docs = new URL('../../docs/agents/cezar.md', import.meta.url)
writeFileSync(
  docs,
  readFileSync(docs, 'utf8').replace(
    /open-mercato\/skills@[a-f0-9]{40}/g,
    `${source}@${sha}`,
  ),
)
console.log(
  `Installed ${names.length} Open Mercato skills at ${sha}; retained ${Object.keys(repairs).length} reviewed repairs.`,
)
