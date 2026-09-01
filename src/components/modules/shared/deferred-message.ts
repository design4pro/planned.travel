/**
 * A message a pure function decided on but cannot render.
 *
 * The module screens keep their rules in plain functions over plain data —
 * `booking-form.ts` says why a draft will not save, `connections.ts` says
 * whether a hand-over can be caught. Those functions have no provider and no
 * business having one, so they name the message and hand over its parts; the
 * screen that has `t` resolves it.
 *
 * This exists because three files had grown three slightly different shapes for
 * the same idea, and a fourth was about to.
 */
import type { MessageKey, Translate } from '#/lib/i18n'

export interface DeferredMessage {
  readonly key: MessageKey
  /** Values interpolated as they are — a name, a code, a formatted number. */
  readonly params?: Readonly<Record<string, string | number>>
  /**
   * Values that are themselves messages, so a stored token such as a transport
   * mode reaches the reader as a label rather than as `train`.
   */
  readonly keyParams?: Readonly<Record<string, MessageKey>>
}

/** Resolves a deferred message, including any parameter that is itself one. */
export function resolve(message: DeferredMessage, t: Translate): string {
  const keyed = Object.entries(message.keyParams ?? {}).map(
    ([name, key]) => [name, t(key)] as const,
  )
  return t(message.key, {
    ...message.params,
    ...Object.fromEntries(keyed),
  })
}
