/**
 * The thread's reading decisions, with no React and no DOM.
 *
 * Which message opens a run (an avatar and a name), where a day divider falls,
 * and whether a body is a handful of emoji to render large. Kept apart from
 * `thread.tsx` so each rule is a function a test can drive directly and a later
 * rule (a tombstone, an older page) is a further clause rather than a reshaped
 * render.
 */
import type { MessageData } from './types'
import { dayKeyIn } from '#/lib/time'

/** A quick exchange stays one run; a longer silence starts a new one. */
export const RUN_WINDOW_MS = 5 * 60_000

/** The part of a message the grouping reads. */
export interface RunMessage {
  readonly userId: string
  /** ISO instant. */
  readonly createdAt: string
  readonly replyToId: string | null
}

export interface GroupedMessage<M extends RunMessage> {
  readonly message: M
  /** The row shows the author's avatar and name. */
  readonly startsRun: boolean
  /** A day divider is drawn above the row. */
  readonly startsDay: boolean
}

/**
 * Does `message` open a new run after `previous`?
 *
 * The window is measured between neighbours, not from the run's first message,
 * so a quick exchange is never cut in the middle by an arbitrary clock. A reply
 * does not break a run, and neither does a negative gap (clock skew between two
 * devices); a gap that is not a number does, because nothing can be said about it.
 */
export function startsRun(
  message: RunMessage,
  previous: RunMessage | null,
  timeZone: string,
): boolean {
  if (previous === null || previous.userId !== message.userId) {
    return true
  }
  const gap = Date.parse(message.createdAt) - Date.parse(previous.createdAt)
  if (!Number.isFinite(gap) || gap > RUN_WINDOW_MS) {
    return true
  }
  return (
    dayKeyIn(previous.createdAt, timeZone) !==
    dayKeyIn(message.createdAt, timeZone)
  )
}

/** Pairs every message with its run and day-divider decisions, in order. */
export function groupThread<M extends RunMessage>(
  messages: ReadonlyArray<M>,
  timeZone: string,
): ReadonlyArray<GroupedMessage<M>> {
  return messages.map((message, index) => {
    const previous = index === 0 ? null : messages[index - 1]
    return {
      message,
      startsRun: startsRun(message, previous, timeZone),
      startsDay:
        previous === null ||
        dayKeyIn(previous.createdAt, timeZone) !==
          dayKeyIn(message.createdAt, timeZone),
    }
  })
}

const MAX_JUMBO_GLYPHS = 3

/**
 * Three skin-toned ZWJ families with spaces are 62 UTF-16 units; anything past this
 * cannot be jumbo, so a long message is never segmented just to be refused.
 */
const MAX_JUMBO_LENGTH = 128

/**
 * One emoji element: an emoji-presentation character (not a lone regional
 * indicator) with an optional skin tone, a pictograph made emoji by `U+FE0F`, or
 * a text-presentation base with a skin tone; each may carry a tag sequence
 * (a subdivision flag).
 */
const EMOJI_ELEMENT =
  '(?:(?!\\p{Regional_Indicator})\\p{Emoji_Presentation}\\p{Emoji_Modifier}?|\\p{Extended_Pictographic}\\uFE0F|\\p{Emoji}\\p{Emoji_Modifier})[\\u{E0020}-\\u{E007F}]*'

const EMOJI_GRAPHEME = new RegExp(
  `^(?:${EMOJI_ELEMENT}(?:\\u200D${EMOJI_ELEMENT})*|\\p{Regional_Indicator}{2}|[0-9#*]\\uFE0F?\\u20E3)$`,
  'u',
)

const BLANK = /^\s+$/u

let segmenter: Intl.Segmenter | null = null

function graphemesOf(body: string): ReadonlyArray<string> | null {
  if (typeof Intl.Segmenter !== 'function') {
    return null
  }
  segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return Array.from(segmenter.segment(body), (part) => part.segment)
}

/**
 * Is this body one to three emoji and nothing else?
 *
 * A ZWJ family, a skin-tone hand, a flag and a keycap each count as one glyph; a
 * bare digit, `©` or `™` is text. Whitespace between glyphs is ignored. Where the
 * platform has no grapheme segmenter nothing is jumbo, so every message renders
 * as it always did. A render decision only: the stored text is never touched.
 */
export function isJumboGlyphs(body: string): boolean {
  if (body.length > MAX_JUMBO_LENGTH) {
    return false
  }
  const graphemes = graphemesOf(body.trim())
  if (graphemes === null) {
    return false
  }
  const glyphs = graphemes.filter((grapheme) => !BLANK.test(grapheme))
  return (
    glyphs.length >= 1 &&
    glyphs.length <= MAX_JUMBO_GLYPHS &&
    glyphs.every((glyph) => EMOJI_GRAPHEME.test(glyph))
  )
}

/** The loader owns its whole id range, including rows a peer removed. */
export function mergeThread(
  held: ReadonlyArray<MessageData>,
  window: ReadonlyArray<MessageData>,
): ReadonlyArray<MessageData> {
  const oldest = window[0]?.id
  if (oldest === undefined) return []
  const newestHeld = held.at(-1)?.id
  const contiguous = newestHeld !== undefined && oldest <= newestHeld
  const rows = new Map(
    held
      .filter((row) => contiguous && row.id < oldest)
      .map((row) => [row.id, row]),
  )
  for (const row of window) rows.set(row.id, row)
  return [...rows.values()].sort((a, b) =>
    a.id < b.id ? -1 : Number(a.id > b.id),
  )
}

export function removeMessage(
  held: ReadonlyArray<MessageData>,
  id: string,
): ReadonlyArray<MessageData> {
  return held.filter((row) => row.id !== id)
}

export function editMessage(
  held: ReadonlyArray<MessageData>,
  id: string,
  body: string,
  editedAt: string,
): ReadonlyArray<MessageData> {
  return held.map((row) => (row.id === id ? { ...row, body, editedAt } : row))
}

export function setViewerReaction(
  held: ReadonlyArray<MessageData>,
  id: string,
  viewer: string,
  emoji: string,
  added: boolean,
): ReadonlyArray<MessageData> {
  return held.map((row) => {
    if (row.id !== id) return row
    const previous = row.reactions.find((entry) => entry.emoji === emoji)
    const wasAdded = previous?.userIds.includes(viewer) ?? false
    if (wasAdded === added) return row
    const userIds = (previous?.userIds ?? []).filter(
      (userId) => userId !== viewer,
    )
    if (added) userIds.push(viewer)
    const count = (previous?.count ?? 0) + (added ? 1 : -1)
    const reactions = row.reactions.filter((entry) => entry.emoji !== emoji)
    if (count > 0) reactions.push({ emoji, count, userIds })
    return { ...row, reactions }
  })
}
