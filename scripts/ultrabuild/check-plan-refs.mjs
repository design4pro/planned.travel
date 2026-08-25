#!/usr/bin/env node
/**
 * Check cross-file references and verification hygiene across docs/plans/.
 *
 * Two classes of finding kept recurring through rounds 8-12, and both are mechanically decidable:
 *
 *   1. A plan cites a stage id in a named sibling file, and that sibling does not contain it.
 *      Round 12: 09-account-and-settings attributed the wave-less `04-S2` to
 *      04-budget-and-currencies.md (the real source was a fenced example elsewhere), and
 *      04-budget-and-currencies attributed a cron-trigger disposition to `11-S3` that
 *      11-boundaries-and-blockers.md does not contain.
 *
 *   2. A plan asserts visual verification but never actually invokes Playwright — no
 *      PLAYWRIGHT_BASE_URL, no capture.mjs — while citing 12-verification-protocol.md, which
 *      requires it. Round 12 found 04-budget-and-currencies in exactly that state.
 *
 * Neither needs judgement, so neither should cost an audit round again.
 *
 * Usage:
 *   node scripts/ultrabuild/check-plan-refs.mjs         # whole plan set
 *   node scripts/ultrabuild/check-plan-refs.mjs 04      # only plan 04
 *
 * Exit 1 if any dangling reference or missing Playwright invocation is found.
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'docs/plans'
const only = process.argv[2] || null

const files = fs.readdirSync(DIR).filter((f) => /^\d\d-.*\.md$/.test(f)).sort()
const text = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(DIR, f), 'utf8')]))

/** Stage ids each file actually DEFINES, from its `## Stage <id>` headings. */
const defines = {}
for (const f of files) {
  defines[f] = new Set()
  for (const m of text[f].matchAll(/^## Stage\s+([A-Za-z0-9-]+)/gm)) defines[f].add(m[1])
}
const fileForPrefix = {}
for (const f of files) fileForPrefix[f.slice(0, 2)] = f

let dangling = 0
let noPlaywright = 0

for (const f of files) {
  if (only && !f.startsWith(only)) continue

  // Every `NN-Sn` token this file mentions must exist in the file that owns that prefix.
  const bad = new Map()
  for (const m of text[f].matchAll(/\b(\d\d)-(S\d+)\b/g)) {
    const [tok, prefix] = [m[0], m[1]]
    const owner = fileForPrefix[prefix]
    if (!owner) {
      bad.set(tok, `no plan file has prefix ${prefix}`)
      continue
    }
    if (!defines[owner].has(tok)) bad.set(tok, `${owner} does not define it`)
  }
  if (bad.size) {
    dangling += bad.size
    console.log(`\n${f} — ${bad.size} dangling stage reference(s):`)
    for (const [tok, why] of bad) console.log(`    ${tok}  →  ${why}`)
  }

  // A plan that ships screens must actually invoke the harness. Only the numbered AREA plans do:
  // 00-foundations is server-side write paths, 11-boundaries is a register and 12 is the protocol
  // itself, so requiring a Playwright invocation of those three is noise — and a noisy check gets
  // ignored, which is how the first draft of check-plan-collisions.mjs reported 31 for 2 real.
  const isAreaPlan = /^(0[1-9]|10)-/.test(f)
  const invokes = /PLAYWRIGHT_BASE_URL|capture\.mjs/.test(text[f])
  if (isAreaPlan && !invokes) {
    noPlaywright++
    console.log(`\n${f} — cites the verification protocol but never invokes Playwright`)
    console.log('    no PLAYWRIGHT_BASE_URL and no capture.mjs anywhere in the file')
  }
}

const scope = only ? `plan ${only}` : `${files.length} plans`
console.log(
  `\n${scope}: ${dangling} dangling stage reference(s), ${noPlaywright} plan(s) missing a Playwright invocation`,
)
process.exit(dangling || noPlaywright ? 1 : 0)
