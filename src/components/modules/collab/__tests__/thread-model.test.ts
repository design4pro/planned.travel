import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  RUN_WINDOW_MS,
  groupThread,
  isJumboGlyphs,
  startsRun,
} from '../thread-model'

interface Row {
  readonly userId: string
  readonly createdAt: string
  readonly replyToId: string | null
}

function row(
  createdAt: string,
  userId = 'ana',
  replyToId: string | null = null,
): Row {
  return { userId, createdAt, replyToId }
}

describe('startsRun', () => {
  it('starts a run for the first message', () => {
    expect(startsRun(row('2026-06-23T09:00:00Z'), null, 'UTC')).toBe(true)
  })

  it('starts a run when the author changes', () => {
    expect(
      startsRun(
        row('2026-06-23T09:00:30Z', 'ben'),
        row('2026-06-23T09:00:00Z'),
        'UTC',
      ),
    ).toBe(true)
  })

  it('starts a run after a gap of more than five minutes', () => {
    expect(
      startsRun(
        row('2026-06-23T09:05:01Z'),
        row('2026-06-23T09:00:00Z'),
        'UTC',
      ),
    ).toBe(true)
  })

  it('keeps the run for the same author at 4 min 59 s', () => {
    expect(
      startsRun(
        row('2026-06-23T09:04:59Z'),
        row('2026-06-23T09:00:00Z'),
        'UTC',
      ),
    ).toBe(false)
  })

  it('keeps the run at exactly the window, which is not over it', () => {
    const previous = row('2026-06-23T09:00:00Z')
    const at = new Date(Date.parse(previous.createdAt) + RUN_WINDOW_MS)
    expect(startsRun(row(at.toISOString()), previous, 'UTC')).toBe(false)
  })

  it('starts a run when the day changes in the trip zone, whatever the gap', () => {
    // 23:59 and 00:01 in Tokyo, two minutes apart.
    const previous = row('2026-06-23T14:59:00Z')
    const message = row('2026-06-23T15:01:00Z')
    expect(startsRun(message, previous, 'Asia/Tokyo')).toBe(true)
    expect(startsRun(message, previous, 'UTC')).toBe(false)
  })

  it('does not let a reply break a run', () => {
    expect(
      startsRun(
        row('2026-06-23T09:01:00Z', 'ana', 'msg-1'),
        row('2026-06-23T09:00:00Z'),
        'UTC',
      ),
    ).toBe(false)
  })

  it('does not let clock skew, a negative gap, break a run', () => {
    expect(
      startsRun(
        row('2026-06-23T09:00:00Z'),
        row('2026-06-23T09:00:03Z'),
        'UTC',
      ),
    ).toBe(false)
  })

  it('breaks a run on a gap that is not a number', () => {
    expect(
      startsRun(row('not a date'), row('2026-06-23T09:00:00Z'), 'UTC'),
    ).toBe(true)
    expect(
      startsRun(row('2026-06-23T09:00:00Z'), row('not a date'), 'UTC'),
    ).toBe(true)
  })
})

describe('groupThread', () => {
  it('returns nothing for an empty thread', () => {
    expect(groupThread([], 'UTC')).toEqual([])
  })

  it('emits one day divider per day, not one per message', () => {
    const grouped = groupThread(
      [
        row('2026-06-23T09:00:00Z'),
        row('2026-06-23T09:01:00Z'),
        row('2026-06-23T20:00:00Z'),
        row('2026-06-24T08:00:00Z'),
        row('2026-06-24T08:01:00Z'),
      ],
      'UTC',
    )
    expect(grouped.map((entry) => entry.startsDay)).toEqual([
      true,
      false,
      false,
      true,
      false,
    ])
  })

  it('reads the day in the trip zone', () => {
    const grouped = groupThread(
      [row('2026-06-23T14:59:00Z'), row('2026-06-23T15:01:00Z')],
      'Asia/Tokyo',
    )
    expect(grouped.map((entry) => entry.startsDay)).toEqual([true, true])
  })

  it('marks run starts from the neighbouring message, not the run head', () => {
    const grouped = groupThread(
      [
        row('2026-06-23T09:00:00Z'),
        row('2026-06-23T09:04:00Z'),
        row('2026-06-23T09:08:00Z'),
        row('2026-06-23T09:09:00Z', 'ben'),
        row('2026-06-23T09:10:00Z', 'ana'),
      ],
      'UTC',
    )
    expect(grouped.map((entry) => entry.startsRun)).toEqual([
      true,
      false,
      false,
      true,
      true,
    ])
  })

  it('hands back the very messages it was given', () => {
    const messages = [row('2026-06-23T09:00:00Z'), row('2026-06-23T09:01:00Z')]
    const grouped = groupThread(messages, 'UTC')
    expect(grouped[0].message).toBe(messages[0])
    expect(grouped[1].message).toBe(messages[1])
  })
})

describe('isJumboGlyphs', () => {
  it.each([
    ['one emoji', '😀'],
    ['two emoji', '😀😂'],
    ['three emoji', '😀😂🎉'],
    ['a skin-tone hand', '👍🏽'],
    ['a skin-tone hand on a text-presentation base', '✌🏽'],
    ['a ZWJ family', '👨‍👩‍👧‍👦'],
    ['a flag', '🇵🇱'],
    ['a keycap', '1️⃣'],
    ['a pictograph with a variation selector', '❤️'],
    ['emoji separated by spaces', '😀 😂 🎉'],
    ['emoji with surrounding whitespace', '  🎉\n'],
    [
      'three skin-toned ZWJ families, the longest allowed body',
      '👨🏽‍👩🏽‍👧🏽‍👦🏽 👨🏽‍👩🏽‍👧🏽‍👦🏽 👨🏽‍👩🏽‍👧🏽‍👦🏽',
    ],
  ])('is true for %s', (_name, body) => {
    expect(isJumboGlyphs(body)).toBe(true)
  })

  it.each([
    ['four emoji', '😀😂🎉👍'],
    ['four emoji and spaces', '😀 😂 🎉 👍'],
    ['an emoji plus a word', '🎉 party'],
    ['a word plus an emoji', 'hi 🎉'],
    ['a bare digit', '1'],
    ['a copyright sign', '©'],
    ['a trademark sign', '™'],
    ['a lone regional indicator', '🇵'],
    ['plain text', 'ok'],
    ['a body too long to be glyphs', `🎉${' '.repeat(200)}`],
    ['an empty body', ''],
    ['a whitespace body', '   '],
  ])('is false for %s', (_name, body) => {
    expect(isJumboGlyphs(body)).toBe(false)
  })

  it('never alters the text it is asked about', () => {
    const body = '  🎉 🎉  '
    const copy = String(body)
    expect(isJumboGlyphs(body)).toBe(true)
    expect(body).toBe(copy)
  })

  describe('on a platform without a grapheme segmenter', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('treats nothing as jumbo', () => {
      vi.stubGlobal(
        'Intl',
        Object.create(Intl, { Segmenter: { value: undefined } }),
      )
      expect(isJumboGlyphs('🎉')).toBe(false)
      expect(isJumboGlyphs('😀😂')).toBe(false)
    })
  })
})
