// The reconciler only fixes #551 if something calls it. It shipped unwired in PR #597, and the
// issue stayed open through four autofix runs for exactly that reason - the script was green, and
// no sweep ran it. The call lives in prompt prose (`.ai/skills/om-review-prs/SKILL.md`, the
// documented extension point for the vendored skill), so no test can prove the agent obeys it.
// What a test can hold shut is the mechanical half: that the override exists, that the path it
// tells the sweep to run is a file that is really there, and that it passes both of the bounds
// that keep a release from becoming #490. Rename or move the script and this fails here, instead
// of silently at 03:00 on the cezar host, where the symptom is a lock nobody releases.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../../..')
const override = resolve(repoRoot, '.ai/skills/om-review-prs/SKILL.md')

describe('.ai/skills/om-review-prs/SKILL.md wires the reconciler into the sweep', () => {
  const body = readFileSync(override, 'utf8')

  it('extends the installed skill rather than replacing it', () => {
    expect(body).toMatch(/^name: om-review-prs$/m)
    expect(body).toContain('.claude/skills/om-review-prs/SKILL.md')
  })

  // The one link that can rot without anyone noticing.
  it('names a reconciler script that exists', () => {
    const invoked = /node (scripts\/agents\/[\w-]+\.mjs)/.exec(body)
    expect(
      invoked,
      'the override must tell the sweep which script to run',
    ).not.toBeNull()
    expect(existsSync(resolve(repoRoot, invoked[1]))).toBe(true)
  })

  // Both bounds are the safety. An unbounded release is #490, the mirror-image defect, which #551
  // says explicitly must not be traded for this one.
  it('passes both bounds, and says an empty dispatch list skips the call', () => {
    expect(body).toContain('--since')
    expect(body).toContain('--prs')
    expect(body).toMatch(/empty/i)
  })

  it('requires the call on every exit path and forbids reporting a released PR as reviewed', () => {
    expect(body).toMatch(/every exit path/i)
    expect(body).toMatch(/[Nn]ever report it as reviewed/)
  })
})
