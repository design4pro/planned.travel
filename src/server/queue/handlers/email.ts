/**
 * `email` — transactional send through the configured provider REST API.
 *
 * Every user-visible email in the product goes through the queue, never inline
 * in a request: a provider hiccup then costs a retry instead of a failed signup.
 */

import { assertUpstreamOk } from '../http'
import { TaskConfigurationError } from '../types'
import type { EmailPayload, TaskContext, TaskMetrics } from '../types'

const DEFAULT_API_URL = 'https://api.resend.com/emails'

export async function handleEmail(
  payload: EmailPayload,
  context: TaskContext,
): Promise<TaskMetrics> {
  const apiKey = context.env.EMAIL_API_KEY
  if (apiKey === undefined || apiKey.length === 0) {
    throw new TaskConfigurationError(
      'EMAIL_API_KEY is not set; run `wrangler secret put EMAIL_API_KEY`',
    )
  }
  const from = context.env.EMAIL_FROM
  if (from === undefined || from.length === 0) {
    throw new TaskConfigurationError(
      'EMAIL_FROM var is not set in wrangler.jsonc',
    )
  }

  const response = await context.callProvider(
    { provider: 'resend', operation: 'email.send' },
    () =>
      fetch(context.env.EMAIL_API_URL ?? DEFAULT_API_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          // Provider-side idempotency: the email's own identity, so a queue redelivery
          // cannot double-send and two different envelopes never share a key.
          'idempotency-key': payload.eventId ?? context.taskId,
        },
        body: JSON.stringify({
          from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          ...(payload.text === undefined ? {} : { text: payload.text }),
          ...(payload.replyTo === undefined
            ? {}
            : { reply_to: payload.replyTo }),
          ...(payload.tag === undefined
            ? {}
            : { tags: [{ name: 'category', value: payload.tag }] }),
        }),
      }),
  )

  await assertUpstreamOk(response, 'Email provider send')

  context.logger.debug('email delivered to provider', {
    recipients: payload.to.length,
    tag: payload.tag,
    status: response.status,
  })

  return { recipients: payload.to.length, status: response.status }
}
