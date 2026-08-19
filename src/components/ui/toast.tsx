import * as React from 'react'
import { toast as sonner } from 'sonner'
import {
  CheckCircle2,
  Info,
  OctagonAlert,
  TriangleAlert,
  Undo2,
} from 'lucide-react'

import type { ExternalToast } from 'sonner'

/**
 * The imperative toast API. `sonner` does the stacking, swipe-to-dismiss and
 * timer pausing; this module owns the vocabulary and the icons so every toast
 * in the product speaks with one voice.
 *
 * The singleton mount point lives in `src/components/layout/app-toaster.tsx` —
 * there is exactly one `<Toaster />` in the tree, repainted with our tokens.
 */

export type ToastOptions = ExternalToast

const glyphs = {
  success: <CheckCircle2 className="size-4 text-success" aria-hidden="true" />,
  error: <OctagonAlert className="size-4 text-danger" aria-hidden="true" />,
  warning: <TriangleAlert className="size-4 text-warning" aria-hidden="true" />,
  info: <Info className="size-4 text-info" aria-hidden="true" />,
} as const

function withGlyph(
  kind: keyof typeof glyphs,
  options?: ToastOptions,
): ToastOptions {
  return { icon: glyphs[kind], ...options }
}

export const toast = {
  /** A neutral note. Use it when nothing succeeded or failed — just happened. */
  message: (message: React.ReactNode, options?: ToastOptions) =>
    sonner(message, options),

  success: (message: React.ReactNode, options?: ToastOptions) =>
    sonner.success(message, withGlyph('success', options)),

  error: (message: React.ReactNode, options?: ToastOptions) =>
    sonner.error(message, withGlyph('error', options)),

  warning: (message: React.ReactNode, options?: ToastOptions) =>
    sonner.warning(message, withGlyph('warning', options)),

  info: (message: React.ReactNode, options?: ToastOptions) =>
    sonner.info(message, withGlyph('info', options)),

  /** Sticks until dismissed or replaced — pair it with `toast.dismiss(id)`. */
  loading: (message: React.ReactNode, options?: ToastOptions) =>
    sonner.loading(message, options),

  /**
   * Binds one toast to the whole lifecycle of a request, so a save shows
   * "Saving…" then becomes "Saved" in place rather than stacking two toasts.
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: React.ReactNode
      success: React.ReactNode | ((data: T) => React.ReactNode)
      error: React.ReactNode | ((error: unknown) => React.ReactNode)
    },
    options?: ToastOptions,
  ) => sonner.promise(promise, { ...messages, ...options }),

  /**
   * The destructive-action companion: confirm by doing, then offer the way back.
   * Far kinder than an "are you sure?" dialog on an action we can reverse.
   */
  undo: (
    message: React.ReactNode,
    onUndo: () => void,
    options?: ToastOptions & { undoLabel?: string },
  ) => {
    const { undoLabel = 'Undo', ...rest } = options ?? {}
    return sonner(message, {
      icon: <Undo2 className="size-4 text-ink-3" aria-hidden="true" />,
      duration: 8000,
      action: { label: undoLabel, onClick: onUndo },
      ...rest,
    })
  },

  dismiss: (id?: string | number) => sonner.dismiss(id),
}
