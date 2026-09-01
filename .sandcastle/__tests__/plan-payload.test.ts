/**
 * What survives the trim, and - more to the point - what must never be cut out of it. A body that
 * loses its `Owned paths` list costs the run a plan that schedules two colliding slices at once,
 * which is a whole iteration of merge conflicts for a few hundred saved characters.
 */
import { describe, expect, it } from 'vitest'

import { abridgeBody, planPayload } from '../plan-payload'

const SLICE = `01-S9a — The planner as a workspace.

## Owned paths

- \`src/routes/_app/-ui/planner.tsx\` — edit
- \`e2e/planner.visual.spec.ts\` — append

## Tenant isolation test

Every list is scoped by organization; assert the neighbour cannot read it.

## Blockers

- \`01-S8a\` (the form)

## Verification

\`pnpm typecheck && pnpm lint && pnpm test\`
`

const BRIEF = `Since #143 the e2e rung retries once, so a flaky spec is invisible.

**Category:** maintenance

**Owned paths:** \`.sandcastle/validate.sh\`, \`.sandcastle/__tests__/validate-sh.test.ts\`

**Verification:** \`pnpm test -- validate-sh\`
`

describe('abridgeBody', () => {
  it('keeps what a dependency graph is built from', () => {
    const out = abridgeBody(SLICE)
    expect(out).toContain('## Owned paths')
    expect(out).toContain('src/routes/_app/-ui/planner.tsx')
    expect(out).toContain('## Blockers')
    expect(out).toContain('01-S8a')
  })

  it('drops what it is not', () => {
    const out = abridgeBody(SLICE)
    expect(out).not.toContain('Tenant isolation test')
    expect(out).not.toContain('pnpm typecheck')
  })

  it('keeps the paragraph the ticket opens with', () => {
    // The "B requires what A introduces" judgement is made from this sentence and nowhere else.
    expect(abridgeBody(SLICE)).toContain('The planner as a workspace')
    expect(abridgeBody(BRIEF)).toContain('the e2e rung retries once')
  })

  it('keeps the opening even when it sits under a heading of its own', () => {
    // Which is how every PRD-derived slice is written: the title is an `##` line and the paragraph
    // naming the PRD it belongs to sits under it, where a "everything before the first heading"
    // rule would have thrown both away.
    const titled = `## 01-S1d — Copy a trip\n\nFourth slice of \`01-S1\`; PRD #104 decision 4.\n\n## Verification\n\n\`pnpm test\`\n`
    const out = abridgeBody(titled)
    expect(out).toContain('01-S1d')
    expect(out).toContain('PRD #104 decision 4')
    expect(out).not.toContain('pnpm test')
  })

  it('reads a bold label as a section, which is how the Agent Briefs are written', () => {
    // An extractor that knew only `##` headings would return the lead paragraph alone for every
    // maintenance ticket in the backlog, and with it no owned paths at all.
    const out = abridgeBody(BRIEF)
    expect(out).toContain('**Owned paths:**')
    expect(out).toContain('.sandcastle/validate.sh')
    expect(out).not.toContain('Verification')
  })

  it('keeps a kept section whole rather than truncating it', () => {
    // Half an owned-paths list is worse than none: the path it cut is the collision nobody sees.
    const out = abridgeBody(SLICE)
    expect(out).toContain('e2e/planner.visual.spec.ts')
  })

  it('handles a body with no sections, and an empty one', () => {
    expect(abridgeBody('Just a sentence.')).toBe('Just a sentence.')
    expect(abridgeBody('')).toBe('')
  })
})

describe('planPayload', () => {
  it('carries id, title and labels through untouched', () => {
    expect(
      planPayload([
        { id: '111', title: 'Copy a trip', labels: ['type: feature'], body: SLICE },
      ]),
    ).toEqual([
      {
        id: '111',
        title: 'Copy a trip',
        labels: ['type: feature'],
        body: abridgeBody(SLICE),
      },
    ])
  })

  it('reads a missing body as an empty one', () => {
    expect(planPayload([{ id: '1', title: 't', labels: [], body: null }])[0]?.body).toBe('')
  })
})
