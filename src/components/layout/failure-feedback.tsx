import { useState } from 'react'

import { Textarea } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { ActionButton } from './kit'

/**
 * "Tell us what happened", on the error panel and nowhere else.
 *
 * A reference tells us *which* failure somebody hit; it does not tell us what they were trying to
 * do, and that sentence is usually the difference between a stack trace and a reproduction. This
 * attaches theirs to the exact Sentry event, so it arrives beside the error rather than in a
 * separate inbox nobody reads.
 *
 * Not the SDK's floating widget, which is now mounted separately in
 * `src/components/layout/feedback-widget.tsx`. The two answer different questions and neither
 * replaces the other: the widget is offered on every screen, before anything has gone wrong, and
 * carries a screenshot; this is offered at the moment something broke, to the person it broke for,
 * and its whole value is `associatedEventId` - the sentence lands on the exact Sentry event rather
 * than in a separate inbox somebody has to match up by hand.
 *
 * The SDK is loaded on submit rather than imported at the top. Importing it here would put the
 * feedback bundle in the graph of the error boundary, which the root route mounts on every page -
 * paid for by every visitor, to serve the few who write something. The same reasoning as the
 * dynamic `import()` in `src/server/email/render.ts`.
 */
export function FailureFeedback({ reference }: { readonly reference: string }) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<
    'editing' | 'sending' | 'sent' | 'failed'
  >('editing')

  async function send(): Promise<void> {
    setStatus('sending')
    try {
      const { sendFeedback } = await import('@sentry/react')
      await sendFeedback({ message, associatedEventId: reference })
      setStatus('sent')
    } catch {
      // The reference is still on screen, so the reader is not left with nothing to quote.
      setStatus('failed')
    }
  }

  if (status === 'sent') {
    return (
      <p className="text-caption text-ink-3">
        {t('shell.error.feedback.sent')}
      </p>
    )
  }

  if (!open) {
    return (
      <ActionButton variant="secondary" onClick={() => setOpen(true)}>
        {t('shell.error.feedback.open')}
      </ActionButton>
    )
  }

  return (
    <div className="w-full max-w-md space-y-2 text-start">
      <label
        className="block text-caption text-ink-2"
        htmlFor="failure-feedback"
      >
        {t('shell.error.feedback.label')}
      </label>
      <Textarea
        id="failure-feedback"
        rows={3}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      {status === 'failed' ? (
        <p className="text-caption text-danger">
          {t('shell.error.feedback.failed')}
        </p>
      ) : null}
      <ActionButton
        onClick={() => void send()}
        disabled={status === 'sending' || message.trim().length === 0}
      >
        {t('shell.error.feedback.send')}
      </ActionButton>
    </div>
  )
}
