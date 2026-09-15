#!/usr/bin/env node

/**
 * Decides whether a pull request's diff can reach anything the e2e journeys exercise.
 *
 *   git diff --name-only HEAD^1 HEAD | node scripts/ci/change-scope.mjs >> "$GITHUB_OUTPUT"
 *
 * A spec, an ADR or a skill cannot change what a browser sees, yet every such pull request paid
 * two e2e shards - about 20 min of the self-hosted pool per event, on a pool that runs three CI
 * jobs at a time. PR #518 (a spec and the spec index, nothing else) went red twice on shards that
 * timed out under load, and a green run would have proven nothing about its diff either.
 *
 * Only the journeys are skipped. `verify` and the unit suite still run on every pull request,
 * because they are what guards documentation: `spec-registry.test.ts` reads `.ai/specs`, the hook
 * tests read `.claude`, and `verify` regenerates the spec index.
 *
 * The list below is what is provably documentation, not what is provably code, so a path nobody
 * thought about runs the journeys. That is the direction to be wrong in: a wasted run costs
 * minutes, a skipped one ships a broken screen.
 */

import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Paths no journey can observe. Markdown counts only outside the trees the app and the suite are
 * built from - nothing there imports a `.md` today, and this should not be what finds out.
 */
export const DOCUMENTATION = [
  /^docs\//,
  /^\.ai\//,
  /^\.claude\//,
  /^(?!src\/|e2e\/|public\/).*\.md$/,
]

/**
 * @param {string[]} paths repository-relative paths the pull request changes
 * @returns {{ e2e: boolean, reason: string }}
 */
export function scope(paths) {
  // Nothing to judge is not proof of nothing to test: an empty list is as likely a diff that
  // failed to compute as a pull request that changes no file.
  if (paths.length === 0)
    return { e2e: true, reason: 'the diff lists no files' }

  const reaching = paths.find(
    (path) => !DOCUMENTATION.some((pattern) => pattern.test(path)),
  )
  if (reaching !== undefined)
    return { e2e: true, reason: `${reaching} is not documentation` }

  return {
    e2e: false,
    reason: `all ${paths.length} changed files are documentation`,
  }
}

function main() {
  const paths = readFileSync(0, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const { e2e, reason } = scope(paths)
  // stdout is the step output; the reason goes to the log, where a skipped job gets asked about.
  console.error(`change-scope: e2e ${e2e ? 'runs' : 'is skipped'} - ${reason}.`)
  console.log(`e2e=${e2e}`)
}

// Importing this file for `scope` must not read stdin inside the test runner - the same guard, for
// the same reason, as `merge-gate.mjs`.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main()
