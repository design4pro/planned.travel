#!/usr/bin/env node
/**
 * Persist one /ultrabuild round's result into .claude/ultrabuild/.
 *
 * Step 5 of the command: items.json holds STATE, findings.jsonl holds the evidence, and the two
 * never carry each other's payload — that is what took items.json to 188 KB in an earlier run, all
 * of which then travelled back into the workflow's args every round.
 *
 * Usage: node scripts/ultrabuild/persist-round.mjs <workflow-output-file>
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const UB = '.claude/ultrabuild/'
const out = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const r = out.result

/** Combined git hash-object over an item's owned paths, skipping what does not exist. */
const hashOf = (paths) => {
  const present = paths.filter((p) => fs.existsSync(p))
  if (!present.length) return undefined
  return execFileSync('git', ['hash-object', ...present], { encoding: 'utf8' }).replace(/\n/g, '')
}

// --- items.json: merge over what is already stored, by id -------------------
const stored = fs.existsSync(UB + 'items.json') ? JSON.parse(fs.readFileSync(UB + 'items.json', 'utf8')) : []
const byId = Object.fromEntries(stored.map((i) => [i.id, i]))

// Findings the round closed stop being carried. A finding used to stay on an item's list until a
// round happened not to mention it, so builders were handed problems they had already solved.
const resolved = new Set((r.resolvedFindings || []).map((f) => (typeof f === 'string' ? f : f.fingerprint)))

const judged = new Set((r.items || []).filter((i) => i.round === r.round).map((i) => i.id))

for (const item of r.items || []) {
  const { allFindings, contractExtensions, ...rest } = item
  const prev = byId[item.id] || {}
  rest.findings = (item.findings || [])
    .filter((f) => !resolved.has(f.fingerprint))
    .map((f) => ({
      fingerprint: f.fingerprint,
      severity: f.severity,
      file: f.file,
      line: f.line,
      summary: f.summary,
    }))
  // Only re-hash what this round actually judged; everything else keeps the hash it had.
  rest.hashAtVerdict = judged.has(item.id) ? hashOf(item.ownedPaths || []) : prev.hashAtVerdict
  byId[item.id] = { ...prev, ...rest }
}
fs.writeFileSync(UB + 'items.json', JSON.stringify(Object.values(byId), null, 2))

// --- findings.jsonl --------------------------------------------------------
if ((r.newFindings || []).length) {
  fs.appendFileSync(UB + 'findings.jsonl', r.newFindings.map((f) => JSON.stringify(f)).join('\n') + '\n')
}

// --- extensions.json: append, never overwrite ------------------------------
const exts = fs.existsSync(UB + 'extensions.json') ? JSON.parse(fs.readFileSync(UB + 'extensions.json', 'utf8')) : []
const seen = new Set(exts.map((e) => e.work))
for (const e of r.extensions || []) if (!seen.has(e.work)) exts.push({ ...e, round: r.round })
fs.writeFileSync(UB + 'extensions.json', JSON.stringify(exts, null, 2))

// --- recon: persist whatever ran fresh -------------------------------------
for (const key of Object.keys(r.recon || {})) {
  const e = r.recon[key]
  fs.writeFileSync(UB + `recon/${key}.json`, JSON.stringify({ hash: e.hash ?? null, result: e.result ?? e }, null, 2))
  console.log('recon cached:', key)
}

// --- run.json --------------------------------------------------------------
const run = JSON.parse(fs.readFileSync(UB + 'run.json', 'utf8'))
run.round = r.round
run.dryRounds = (r.newFindings || []).length === 0 ? (run.dryRounds || 0) + 1 : 0
fs.writeFileSync(UB + 'run.json', JSON.stringify(run, null, 2))

const tally = {}
for (const i of Object.values(byId)) tally[i.status] = (tally[i.status] || 0) + 1
console.log(
  `round ${r.round} persisted · ${JSON.stringify(tally)} · +${(r.newFindings || []).length} findings` +
    ` · -${resolved.size} resolved · dryRounds=${run.dryRounds}`,
)
