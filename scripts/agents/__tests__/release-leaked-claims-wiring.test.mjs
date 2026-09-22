// The reconciler only fixes #551 if something calls it. It shipped unwired in PR #597, and the
// issue stayed open through four autofix runs for exactly that reason - the script was green, and
// no sweep ran it. The call lives in prompt prose (`.ai/skills/om-review-prs/SKILL.md`, the
// documented extension point for the vendored skill), so no test can prove the agent obeys it.
// What a test can hold shut is the mechanical half: that the override exists, that the path it
// tells the sweep to run is a file that is really there, and that it passes both of the bounds
// that keep a release from becoming #490. Rename or move the script and this fails here, instead
// of silently at 03:00 on the cezar host, where the symptom is a lock nobody releases.
//
// There are two entry points, and they have to agree. A sweep started from the cockpit is handed
// `docs/agents/cezar-prompt-templates.json` as its task text, which used to say in as many words to
// report a leaked claim "instead of repairing it" - the exact opposite of the override. One entry
// point fixed and the other left alone is a wiring that works only when launched the right way.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// A URL relative to this module rather than `import.meta.dirname`, which is what every other
// `.mjs` test here uses.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const OVERRIDE = '.ai/skills/om-review-prs/SKILL.md'
const TEMPLATES = 'docs/agents/cezar-prompt-templates.json'

// Read per test, not once in the describe body: deleting the override is the exact regression this
// file exists to catch, and a throw during collection reports it as a broken test file rather than
// as the wiring being gone.
const read = () => readFileSync(resolve(repoRoot, OVERRIDE), 'utf8')

const sweepTemplate = () =>
  JSON.parse(readFileSync(resolve(repoRoot, TEMPLATES), 'utf8')).find(
    (t) => t.id === 'om-review-prs',
  )

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

  // `planRelease` deliberately reports the review when one landed but the release comment did not,
  // and `releaseComment` names it. An override saying every released PR went unreviewed would
  // contradict the script and GitHub both.
  it('ties the no-review wording to what the script reported, not to the release itself', () => {
    const body = read()
    expect(body).toMatch(/every exit path/i)
    expect(body).toMatch(/no review submitted/)
    expect(body).toMatch(/review submitted at/)
  })

  it('has the cockpit prompt template agree with it', () => {
    const template = sweepTemplate()
    expect(
      template,
      `${TEMPLATES} must still define an om-review-prs entry`,
    ).toBeDefined()
    expect(template.text).toContain('scripts/agents/release-leaked-claims.mjs')
    // The wording that made a template-launched sweep skip the repair.
    expect(template.text).not.toMatch(/instead of repairing it/)
  })
})
