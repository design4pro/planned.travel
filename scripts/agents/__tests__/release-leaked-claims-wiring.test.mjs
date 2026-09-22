// The reconciler only fixes #551 if something calls it. It shipped unwired in PR #597, and the
// issue stayed open through four autofix runs for exactly that reason - the script was green, and
// no sweep ran it. The call lives in prompt prose (`.ai/skills/om-review-prs/SKILL.md`, the
// documented extension point for the vendored skill), so no test can prove the agent obeys it.
// What a test can hold shut is the mechanical half: that the override exists, that the path it
// tells the sweep to run is a file that is really there, and that it passes both of the bounds
// that keep a release from becoming #490. Rename or move the script and this fails here, instead
// of silently at 03:00 on the cezar host, where the symptom is a lock nobody releases.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// A URL relative to this module rather than `import.meta.dirname`, which is what every other
// `.mjs` test here uses.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const OVERRIDE = '.ai/skills/om-review-prs/SKILL.md'

// Read per test, not once in the describe body: deleting the override is the exact regression this
// file exists to catch, and a throw during collection reports it as a broken test file rather than
// as the wiring being gone.
const read = () => readFileSync(resolve(repoRoot, OVERRIDE), 'utf8')

describe(`${OVERRIDE} wires the reconciler into the sweep`, () => {
  it('exists, because nothing else calls the reconciler', () => {
    expect(existsSync(resolve(repoRoot, OVERRIDE))).toBe(true)
  })

  it('extends the installed skill rather than replacing it', () => {
    const body = read()
    expect(body).toMatch(/^name: om-review-prs$/m)
    expect(body).toContain('.claude/skills/om-review-prs/SKILL.md')
  })

  // The one link that can rot without anyone noticing.
  it('names a reconciler script that exists', () => {
    const invoked = /node (scripts\/agents\/[\w-]+\.mjs)/.exec(read())
    expect(
      invoked,
      'the override must tell the sweep which script to run',
    ).not.toBeNull()
    expect(existsSync(resolve(repoRoot, invoked[1]))).toBe(true)
  })

  // Both bounds are the safety. An unbounded release is #490, the mirror-image defect, which #551
  // says explicitly must not be traded for this one, so the call must carry them and the override
  // must say what goes in them.
  it('passes both bounds and says what limits each', () => {
    const body = read()
    expect(body).toMatch(/--since "\$SWEEP_START"/)
    expect(body).toMatch(/--prs <comma-separated dispatched PRs>/)
    expect(body).toMatch(/#490/)
  })

  // An empty `--prs` fails the script's own argument check and exits 2, by design: neither bound
  // may widen. A sweep that dispatched nothing must therefore skip the call, not pass an empty one.
  it('tells a sweep that dispatched nothing to skip the call rather than pass an empty list', () => {
    expect(read()).toMatch(/[Ss]kip the call only when the list is empty/)
  })

  it('requires the call on every exit path and forbids reporting a released PR as reviewed', () => {
    const body = read()
    expect(body).toMatch(/every exit path/i)
    expect(body).toMatch(/[Nn]ever report it as reviewed/)
  })
})
