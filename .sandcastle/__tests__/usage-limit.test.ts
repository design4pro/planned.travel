import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BLIND_WAIT_MS,
  WAKE_MARGIN_MS,
  parseUsageLimit,
  resetUsageLimitGate,
  withUsageLimit,
} from '../usage-limit'

/**
 * The message that actually ended a run, copied from the operator's terminal. Every other case here
 * is a variation on it; this one is the reason the module exists, so it is the one that must never
 * silently stop matching.
 */
const OBSERVED = [
  'claude-code exited with code 1:',
  "You've hit your session limit · resets 12:20am (UTC)",
].join('\n')

const NOON = new Date('2026-08-30T12:00:00.000Z')

describe('parseUsageLimit', () => {
  it('reads the reset clock out of the message that ended run 20260830-4', () => {
    const limit = parseUsageLimit(new Error(OBSERVED), NOON)
    expect(limit).toEqual({
      resetsAt: new Date('2026-08-31T00:20:00.000Z'),
      precise: true,
    })
  })

  it('reads 12:xxpm as noon, not midnight', () => {
    const limit = parseUsageLimit(
      new Error(
        'claude-code exited with code 1:\nusage limit reached, resets 12:20pm (UTC)',
      ),
      new Date('2026-08-30T06:00:00.000Z'),
    )
    expect(limit?.resetsAt).toEqual(new Date('2026-08-30T12:20:00.000Z'))
  })

  it('reads an afternoon clock', () => {
    const limit = parseUsageLimit(
      new Error(
        "claude-code exited with code 1:\nYou've hit your session limit · resets 3:05pm (UTC)",
      ),
      new Date('2026-08-30T06:00:00.000Z'),
    )
    expect(limit?.resetsAt).toEqual(new Date('2026-08-30T15:05:00.000Z'))
  })

  it('rolls a reset time that has already passed today into tomorrow', () => {
    const limit = parseUsageLimit(
      new Error(
        "claude-code exited with code 1:\nYou've hit your session limit · resets 9:00am (UTC)",
      ),
      new Date('2026-08-30T14:00:00.000Z'),
    )
    expect(limit?.resetsAt).toEqual(new Date('2026-08-31T09:00:00.000Z'))
  })

  it('reads the older epoch form', () => {
    const limit = parseUsageLimit(
      new Error(
        'claude-code exited with code 1:\nClaude AI usage limit reached|1756612800',
      ),
      NOON,
    )
    expect(limit).toEqual({
      resetsAt: new Date(1756612800 * 1000),
      precise: true,
    })
  })

  it('falls back to a blind wait when the limit carries no reset time', () => {
    const limit = parseUsageLimit(
      new Error('claude-code exited with code 1:\nrate limit exceeded'),
      NOON,
    )
    expect(limit).toEqual({
      resetsAt: new Date(NOON.getTime() + BLIND_WAIT_MS),
      precise: false,
    })
  })

  it('matches a limit reported only as a 429', () => {
    expect(
      parseUsageLimit(
        new Error('claude-code exited with code 1:\nHTTP 429'),
        NOON,
      ),
    ).toBeDefined()
  })

  it('reads the message through a wrapper error, as Effect delivers it', () => {
    const wrapped = new Error(`(FiberFailure) AgentError: ${OBSERVED}`)
    expect(parseUsageLimit(wrapped, NOON)?.precise).toBe(true)
  })

  describe('is not a limit', () => {
    it('an agent that exited because the build broke', () => {
      expect(
        parseUsageLimit(
          new Error('claude-code exited with code 1:\ntsc: 3 errors'),
          NOON,
        ),
      ).toBeUndefined()
    })

    it('a limit-shaped string that did not come from an agent exiting', () => {
      expect(
        parseUsageLimit(
          new Error(
            'CoordinatorError: 429 Too Many Requests from the registry',
          ),
          NOON,
        ),
      ).toBeUndefined()
    })

    it('anything that is not an error at all', () => {
      expect(parseUsageLimit(undefined, NOON)).toBeUndefined()
      expect(parseUsageLimit('exited with code 1', NOON)).toBeUndefined()
    })
  })
})

describe('withUsageLimit', () => {
  /**
   * A clock that never really waits, so the tests state the schedule rather than live through it.
   * It sits an hour and twenty minutes before the observed message's reset — the shape a real
   * limit has, where the window is hours rather than the half-day a midday `now` would imply.
   */
  const LATE = new Date('2026-08-30T23:00:00.000Z')
  const RESETS_AT = new Date('2026-08-31T00:20:00.000Z')

  function fakeClock(slept: Array<number> = []) {
    return {
      slept,
      clock: {
        now: () => LATE,
        sleep: async (ms: number) => {
          slept.push(ms)
        },
      },
    }
  }

  beforeEach(() => {
    resetUsageLimitGate()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    resetUsageLimitGate()
  })

  it('passes a result straight through', async () => {
    const { clock, slept } = fakeClock()
    await expect(
      withUsageLimit('planner', async () => 'ok', { clock }),
    ).resolves.toBe('ok')
    expect(slept).toEqual([])
  })

  it('waits until the reset, plus a margin, then runs the stage again', async () => {
    const { clock, slept } = fakeClock()
    let calls = 0
    const result = await withUsageLimit(
      'implementer',
      async () => {
        calls++
        if (calls === 1) throw new Error(OBSERVED)
        return 'second time'
      },
      { clock },
    )
    expect(result).toBe('second time')
    expect(calls).toBe(2)
    expect(slept).toEqual([
      RESETS_AT.getTime() - LATE.getTime() + WAKE_MARGIN_MS,
    ])
  })

  it('rethrows anything that is not a usage limit, without waiting', async () => {
    const { clock, slept } = fakeClock()
    let calls = 0
    await expect(
      withUsageLimit(
        'reviewer',
        async () => {
          calls++
          throw new Error('claude-code exited with code 1:\ntsc: 3 errors')
        },
        { clock },
      ),
    ).rejects.toThrow('tsc: 3 errors')
    expect(calls).toBe(1)
    expect(slept).toEqual([])
  })

  it('makes two concurrent stages share one wait rather than each starting its own', async () => {
    const { clock, slept } = fakeClock()
    const stage = (label: string) => {
      let calls = 0
      return withUsageLimit(
        label,
        async () => {
          calls++
          if (calls === 1) throw new Error(OBSERVED)
          return label
        },
        { clock },
      )
    }
    await expect(
      Promise.all([stage('issue-a'), stage('issue-b')]),
    ).resolves.toEqual(['issue-a', 'issue-b'])
    // One timer, not two: the second caller joined the first one's wait.
    expect(slept).toHaveLength(1)
  })

  it('gives up rather than looping when the limit never lifts', async () => {
    const { clock, slept } = fakeClock()
    let calls = 0
    await expect(
      withUsageLimit(
        'auditor',
        async () => {
          calls++
          throw new Error(OBSERVED)
        },
        { clock },
      ),
    ).rejects.toThrow(/session limit/)
    expect(calls).toBe(4)
    expect(slept).toHaveLength(3)
  })

  it('refuses a wait longer than the ceiling and says how to resume', async () => {
    const { clock } = fakeClock()
    await expect(
      withUsageLimit(
        'planner',
        async () => {
          throw new Error(
            'claude-code exited with code 1:\nClaude AI usage limit reached|9999999999',
          )
        },
        { clock },
      ),
    ).rejects.toThrow(/SANDCASTLE_LIMIT_WAIT_MAX_MS[\s\S]*--run/)
  })
})
