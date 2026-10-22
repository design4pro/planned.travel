/**
 * One shape for every mutation on a module screen.
 *
 * Each write on these screens has to do the same five things: hold a pending
 * state so the control that started it can show it, call the server function,
 * invalidate the router so the loader is the source of truth again, announce the
 * outcome with a toast, and keep the failure message where the form can render it
 * inline. Doing that by hand in twenty places is how twenty places end up
 * behaving slightly differently.
 */
import { useCallback, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

import { toast } from '#/components/ui'
import { readPublicFailure } from '#/lib/errors'
import { isWorkspaceChanged } from '#/lib/workspace-claim'

/**
 * Pulls a line the reader is allowed to see out of whatever the server threw.
 *
 * It used to return `error.message` verbatim, which meant a failed statement put the query in a
 * toast. The server now decides which messages are authored copy - a refusal, or a validation
 * message naming the field to fix - and only those are shown. A diagnostic becomes the caller's
 * fallback; the reference it was recorded under is on the error panel, which is where somebody
 * reporting a problem is looking.
 */
export function messageOf(error: unknown, fallback: string): string {
  // A catalogue key, not a sentence: printing it would show the key itself. The workspace notice
  // (`workspace-changed-notice.tsx`) is the surface that explains it.
  if (isWorkspaceChanged(error)) return fallback
  const failure = readPublicFailure(error)
  if (failure.kind !== 'unexpected' && failure.message !== undefined) {
    return failure.message
  }
  if (failure.reference !== undefined) {
    return fallback
  }

  // Not from a server function: a client-side throw never crosses the redaction boundary. Its
  // message is ours by construction - `use-action` is only ever given our own rejections here.
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  if (typeof error === 'string' && error.length > 0) {
    return error
  }
  return fallback
}

export interface ActionOptions<TResult> {
  /** Toast title on success. Omit, or return `undefined` from the function, for a silent success. */
  readonly success?: string | ((result: TResult) => string | undefined)
  /** Second line of the success toast. */
  readonly description?: string | ((result: TResult) => string)
  /** Toast title on failure. */
  readonly failure?: string
  /** Fallback body when the thrown error carries no message. */
  readonly fallback?: string
  /**
   * Re-run the route loaders after a successful call. On by default: the screens
   * are loader-driven, so skipping it would leave the optimistic overlay as the
   * only record of the change.
   */
  readonly invalidate?: boolean
  /** Runs after a successful call and after the invalidation settles. */
  readonly onSuccess?: (result: TResult) => void
  /** Runs on failure, before the toast — the place to roll an overlay back. */
  readonly onError?: (error: unknown) => void
}

export interface Action<TInput, TResult> {
  readonly run: (input: TInput) => Promise<TResult | null>
  readonly pending: boolean
  readonly error: string | null
  readonly reset: () => void
}

function resolve<TResult>(
  value: string | ((result: TResult) => string | undefined) | undefined,
  result: TResult,
): string | undefined {
  return typeof value === 'function' ? value(result) : value
}

/**
 * Wraps one server function.
 *
 * `run` resolves with the server's result, or `null` when the call failed — so a
 * caller can branch without a try/catch of its own, and a caller that does not
 * care can ignore it entirely. It never rejects, because an unhandled rejection
 * inside an `onClick` is a console error nobody sees.
 */
export function useAction<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  options: ActionOptions<TResult> = {},
): Action<TInput, TResult> {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (input: TInput): Promise<TResult | null> => {
      setPending(true)
      setError(null)
      try {
        const result = await fn(input)
        if (options.invalidate !== false) {
          await router.invalidate()
        }
        const title = resolve(options.success, result)
        if (title !== undefined) {
          toast.success(title, {
            description: resolve(options.description, result),
          })
        }
        options.onSuccess?.(result)
        return result
      } catch (cause) {
        // The tab's workspace is no longer the session's. The notice is the one surface for this:
        // a second "That did not save" toast over it would say the same thing worse. Nothing was
        // saved, so an optimistic overlay still rolls back.
        if (isWorkspaceChanged(cause)) {
          options.onError?.(cause)
          return null
        }
        const message = messageOf(
          cause,
          options.fallback ?? 'Try again in a moment.',
        )
        setError(message)
        options.onError?.(cause)
        toast.error(options.failure ?? 'That did not save', {
          description: message,
        })
        return null
      } finally {
        setPending(false)
      }
    },
    // `options` is a fresh object literal on most renders, so the individual
    // fields are the real dependencies.
    [
      fn,
      router,
      options.invalidate,
      options.success,
      options.description,
      options.failure,
      options.fallback,
      options.onSuccess,
      options.onError,
    ],
  )

  const reset = useCallback(() => {
    setError(null)
  }, [])

  return { run, pending, error, reset }
}
