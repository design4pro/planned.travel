import { useState } from 'react'

import { Button, Textarea } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'

/**
 * "Tell us what happened", on the error panel and nowhere else.
 *
 * A reference tells us *which* failure somebody hit; it does not tell us what they were trying to
 * do, and that sentence is usually the difference between a stack trace and a reproduction. This
 * attaches theirs to the exact Sentry event, so it arrives beside the error rather than in a
 * separate inbox nobody reads.
 *
 * Deliberately not the SDK's floating widget: this is offered at the moment something broke, to the
 * person it broke for, and a permanent tab on every screen is a different product decision that
 * nobody has taken.
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
      <Button variant="secondary" shape="pill" onClick={() => setOpen(true)}>
        {t('shell.error.feedback.open')}
      </Button>
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
      <Button
        shape="pill"
        onClick={() => void send()}
        disabled={status === 'sending' || message.trim().length === 0}
      >
        {t('shell.error.feedback.send')}
      </Button>
    </div>
  )
}
