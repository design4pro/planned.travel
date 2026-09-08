// `systemPrompt` in .ai/cezar/config.json is appended to every agent step of every cezar run,
// and the cockpit's Settings → Agents writes the same key: clearing the field there deletes it,
// and from the next run on the agent silently answers the developer in English.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const config = JSON.parse(
  readFileSync(resolve(__dirname, '../../cezar/config.json'), 'utf8'),
) as { systemPrompt?: string; reviewGate?: boolean; skillsRepos?: unknown[] }

describe('.ai/cezar/config.json', () => {
  it('tells every run to talk to the developer in Polish and to write everything else in English', () => {
    expect(config.systemPrompt).toMatch(/in Polish/)
    expect(config.systemPrompt).toMatch(/in English/)
    expect(config.systemPrompt?.length ?? 0).toBeLessThanOrEqual(20_000)
  })

  // With the gate off a successful non-autonomous run settles at `done` instead of parking at
  // `review`, which is what lets a run started from the cockpit finish on its own. Settings
  // deletes the key when the toggle is cleared, and cezar then falls back to `CEZ_REVIEW_GATE`.
  it('leaves the review gate off so a cockpit run finishes without a human stop', () => {
    expect(config.reviewGate).toBe(false)
  })

  // The vendored .claude/skills/om-* copies are the only source; a non-empty list makes cezar
  // clone open-mercato/skills at run time. The upstream SHA they match lives in docs/agents/cezar.md.
  it('keeps skillsRepos empty so nothing is cloned at run time', () => {
    expect(config.skillsRepos).toEqual([])
  })
})
