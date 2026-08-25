#!/usr/bin/env node
/**
 * Find owned-path collisions across the plan set in docs/plans/.
 *
 * Two stages in the SAME WAVE that both take exclusive ownership of one file will clobber each
 * other, because the runs that execute them go in parallel. docs/plans/00-foundations.md states the
 * rule and every area plan carries an acceptance criterion about it — and round 8 still produced
 * two real collisions (01-S2 vs 07-S1 on `-server/plan.ts`, 04-S2 vs 07-S10 on `do/protocol.ts`),
 * because the plans were written concurrently and each could only read the siblings that already
 * existed. One of them checked a single sibling and asserted it had checked them all.
 *
 * A judgement that must be re-made by hand every round will eventually be made wrong. This makes it
 * a measurement.
 *
 * `append` is NOT a collision. Several stages deliberately append a case to
 * src/server/repos/__tests__/tenant-isolation.test.ts and to a module's own visual spec; that is the
 * documented pattern, and flagging it would bury the two findings that matter.
 *
 * Usage:
 *   node scripts/ultrabuild/check-plan-collisions.mjs          # whole plan set
 *   node scripts/ultrabuild/check-plan-collisions.mjs 07       # only rows involving plan 07
 *
 * Exit 1 if a same-wave exclusive collision exists, so a stage can gate on it.
 *
 * Parses the shape TEMPLATE.md fixes:
 *   ## Stage <id> — <title>
 *   ### Stage id
 *   `<id>` · Wave <n> · effort **M**.
 *   ### Owned paths
 *   - `path/to/file.ts` — edit|new|create|append|delete. <prose>
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'docs/plans'
const only = process.argv[2] || null
const EXCLUSIVE = new Set(['edit', 'new', 'create', 'delete', 'replace', 'rewrite'])

const files = fs.readdirSync(DIR).filter((f) => /^\d\d-.*\.md$/.test(f)).sort()

const stages = []
for (const file of files) {
  const text = fs.readFileSync(path.join(DIR, file), 'utf8')
  for (const chunk of text.split(/^## (?=Stage )/m).slice(1)) {
    const id = (chunk.match(/^Stage\s+([A-Za-z0-9-]+)/) || [])[1]
    if (!id) continue

    // `07-S3` · Wave 2 · effort **M**.
    const wave = Number((chunk.match(/`[A-Za-z0-9-]+`\s*[·|]\s*Wave\s+(\d+)/i) || [])[1] ?? NaN)

    const ownedBlock = (chunk.match(/###\s*Owned paths\s*\n([\s\S]*?)(?=\n###\s|\n## |$)/) || [])[1] || ''
    const owned = []
    for (const line of ownedBlock.split('\n')) {
      const m = line.match(/^\s*[-*]\s*`([^`]+)`\s*[—–-]+\s*([A-Za-z]+)/)
      if (!m) continue
      const p = m[1].trim().replace(/^\.\//, '')
      if (/\s/.test(p)) continue
      owned.push({ path: p, how: m[2].toLowerCase() })
    }
    stages.push({ file, id, wave: Number.isFinite(wave) ? wave : null, owned })
  }
}

const byPath = new Map()
for (const s of stages) {
  for (const o of s.owned) {
    if (!byPath.has(o.path)) byPath.set(o.path, [])
    byPath.get(o.path).push({ ...s, how: o.how })
  }
}

const collisions = []
const shared = []
for (const [p, owners] of byPath) {
  const exclusive = owners.filter((o) => EXCLUSIVE.has(o.how))
  const waves = new Map()
  for (const o of exclusive) {
    const k = o.wave ?? 'unstated'
    if (!waves.has(k)) waves.set(k, [])
    waves.get(k).push(o)
  }
  for (const [wave, group] of waves) if (group.length > 1) collisions.push({ path: p, wave, owners: group })
  if (new Set(owners.map((o) => o.file)).size > 1 && exclusive.length) shared.push({ path: p, owners })
}

const relevant = (r) => !only || r.owners.some((o) => o.file.startsWith(only))
const hits = collisions.filter(relevant)
const cross = shared.filter(relevant).filter((r) => !hits.some((h) => h.path === r.path))

const noWave = stages.filter((s) => s.wave === null)
console.log(`plans ${files.length} · stages ${stages.length} · owned paths ${byPath.size}`)
if (noWave.length) {
  console.log(`\n${noWave.length} stage(s) state no parseable wave and cannot be checked: ${noWave.map((s) => s.id).join(' ')}`)
}

if (hits.length) {
  console.log(`\nSAME-WAVE EXCLUSIVE COLLISIONS (${hits.length}) — these clobber each other:`)
  for (const c of hits) {
    console.log(`  ${c.path}   [wave ${c.wave}]`)
    for (const o of c.owners) console.log(`      ${o.file}  ${o.id}  (${o.how})`)
  }
} else {
  console.log('\nno same-wave exclusive collisions')
}

if (cross.length) {
  console.log(`\ntouched by more than one plan in different waves (${cross.length}) — legal; each plan must name the other:`)
  for (const c of cross) {
    console.log(`  ${c.path}`)
    for (const o of c.owners) console.log(`      ${o.file}  ${o.id}  wave ${o.wave ?? '?'}  (${o.how})`)
  }
}

process.exit(hits.length ? 1 : 0)
