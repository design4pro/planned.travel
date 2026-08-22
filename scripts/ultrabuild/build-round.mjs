#!/usr/bin/env node
/**
 * Build the per-round wrapper around .claude/workflows/ultrabuild.js.
 *
 * A Workflow script runs in a sandbox with no filesystem, so every input has to arrive through
 * `args` — and `args` is a literal inside the tool call, which means the orchestrator has to
 * retype it every round. By round 2 that payload was ~108 KB: the item list with its acceptance
 * criteria, four cached recon readers, and the three knowledge files. Retyping the acceptance
 * criteria is the dangerous half, because they ARE the gate: a transcription slip silently
 * weakens what an item is judged against.
 *
 * So the bulk arrives through the script instead. This writes a copy of the workflow with exactly
 * one line changed — the line that reads `args` — so the big, file-backed half is spliced in from
 * the files the orchestrator already persists, and the small, per-round half (round number,
 * onlyItems, priorityItems, item hashes) still comes through `args` as usual.
 *
 * Everything else is byte-identical to the workflow. If the splice ever fails to find its anchor
 * this exits non-zero rather than emitting a script that quietly drops the payload.
 *
 * Usage: node scripts/ultrabuild/build-round.mjs
 * Writes: .claude/ultrabuild/round.js
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, '.claude/workflows/ultrabuild.js')
const UB = path.join(ROOT, '.claude/ultrabuild')
const OUT = path.join(UB, 'round.js')

const ANCHOR = 'const run = args || {}'

const readJson = (p, fallback) => {
  const full = path.join(UB, p)
  if (!fs.existsSync(full)) return fallback
  return JSON.parse(fs.readFileSync(full, 'utf8'))
}

const source = fs.readFileSync(SRC, 'utf8')
if (!source.includes(ANCHOR)) {
  console.error(`build-round: anchor ${JSON.stringify(ANCHOR)} not found in ${SRC}.`)
  console.error('The workflow changed shape. Fix this script rather than shipping a round that')
  console.error('silently ignores its carried payload.')
  process.exit(1)
}

// The recon cache is {hash, result} on disk; the workflow wants the reader result itself.
const recon = {}
const reconHashes = {}
for (const key of ['contract', 'codebase', 'reference', 'stack']) {
  const entry = readJson(`recon/${key}.json`, null)
  if (!entry) continue
  recon[key] = entry.result
  reconHashes[key] = entry.hash
}

const carried = {
  knownItems: readJson('items.json', []),
  facts: readJson('knowledge/facts.json', []),
  refuted: readJson('knowledge/refuted.json', []),
  backlog: readJson('knowledge/backlog.json', []),
  recon,
  reconHashes,
  task: readJson('run.json', {}).task,
  slug: readJson('run.json', {}).slug,
  maxItemRounds: readJson('run.json', {}).maxItemRounds,
}

const preamble = `
/* ---------------------------------------------------------------------------
 * Carried payload, spliced in by scripts/ultrabuild/build-round.mjs from the
 * files the orchestrator persists. Anything passed through \`args\` wins over
 * this, so a round can still override any single field inline.
 * ------------------------------------------------------------------------- */
const __CARRIED = ${JSON.stringify(carried)}
const run = Object.assign({}, __CARRIED, args || {})
`.trimStart()

fs.writeFileSync(OUT, source.replace(ANCHOR, preamble))

const sizes = Object.entries(carried).map(
  ([k, v]) => `${k}=${Array.isArray(v) ? v.length : typeof v === 'object' && v ? Object.keys(v).length : 1}`,
)
console.log(`wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`)
console.log(`carried: ${sizes.join(' · ')}`)
