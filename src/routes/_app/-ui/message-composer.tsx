/**
 * The composer under the trip transcript.
 *
 * A thread you can read but not answer is a screenshot of a product, not a
 * product — so the conversation panel ends where every messaging surface ends:
 * in a field, with the send action beside it and the shortcut spelled out. It
 * writes through the same repository the loader reads and then invalidates the
 * route, so what appears in the transcript is what the server actually stored.
 */

import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'

import { IconButton, Kbd, Textarea } from '#/components/ui'
import { postMessageFn } from '../-server/trip'

const MAX_LENGTH = 4000

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return 'The message could not be sent. Try again in a moment.'
}

export function MessageComposer({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const trimmed = body.trim()
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !sending

  async function send(): Promise<void> {
    if (!canSend) return
    setSending(true)
    try {
      await postMessageFn({ data: { tripId, body: trimmed } })
      setBody('')
      await router.invalidate()
    } catch (cause) {
      toast.error('Not sent', { description: messageOf(cause) })
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          // Enter sends and Shift+Enter breaks the line, which is what every
          // reader's fingers already expect from a thread like this one.
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
          rows={2}
          autoResize
          maxRows={6}
          maxLength={MAX_LENGTH}
          size="sm"
          aria-label="Message the trip"
          placeholder="Say something to the group…"
          className="min-w-0 flex-1"
        />
        <IconButton
          type="submit"
          variant="brand"
          size="md"
          shape="pill"
          icon={<SendHorizontal aria-hidden />}
          label="Send message"
          disabled={!canSend}
          loading={sending}
        />
      </div>
      <p className="text-caption text-ink-4">
        <Kbd>Enter</Kbd> sends · <Kbd>Shift</Kbd>
        <Kbd>Enter</Kbd> adds a line
      </p>
    </form>
  )
}
