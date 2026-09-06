// `systemPrompt` in .ai/cezar/config.json is appended to every agent step of every cezar run,
// and the cockpit's Settings → Agents writes the same key: clearing the field there deletes it,
// and from the next run on the agent silently answers the developer in English.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const config = JSON.parse(
  readFileSync(resolve(__dirname, '../../../.ai/cezar/config.json'), 'utf8'),
) as { systemPrompt?: string }

describe('.ai/cezar/config.json', () => {
  it('tells every run to talk to the developer in Polish and to write everything else in English', () => {
    expect(config.systemPrompt).toMatch(/in Polish/)
    expect(config.systemPrompt).toMatch(/in English/)
    expect(config.systemPrompt?.length ?? 0).toBeLessThanOrEqual(20_000)
  })
})
