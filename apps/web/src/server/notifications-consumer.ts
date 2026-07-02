/**
 * Notification delivery — the consumer side of the JOBS queue (and the
 * direct-delivery fallback for local dev / preview without the queue).
 *
 * `deliverNotification(env, job)`:
 *   1. validates the job shape (notificationJobSchema),
 *   2. always writes the in-app row (so the notification center works even when
 *      email is disabled / not provisioned),
 *   3. sends the email only when the job explicitly requests it AND
 *      `env.EMAIL_ENABLED === "true"`.
 *
 * Per-message error isolation is the queue handler's job (see worker.ts) — this
 * function throws on DB/email failures so the handler can log + ack. DB +
 * EmailSender are instantiated from `env` (runtime-only bindings, per CLAUDE.md).
 */
import { createDb } from "@planned/db";
import { createNotification } from "../lib/notifications";
import { createEmailSender } from "../lib/email";
import { renderNotificationEmail } from "../lib/email-templates";
import { notificationJobSchema } from "@planned/shared";
import type { CloudflareEnv } from "../lib/env";

export async function deliverNotification(env: CloudflareEnv, raw: unknown): Promise<void> {
  const parsed = notificationJobSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[notifications] bad job shape", parsed.error.flatten());
    return;
  }
  const job = parsed.data;
  const database = createDb(env.DB);

  // 1. In-app row — always.
  await createNotification(database, { userId: job.userId, type: job.type, payload: job.payload });

  // 2. Email — only when explicitly requested AND email is enabled.
  if (job.email && env.EMAIL_ENABLED === "true") {
    const sender = createEmailSender(env);
    const rendered = renderNotificationEmail(job.email.template, job.payload, job.email.locale, env.APP_URL);
    if (rendered) {
      await sender.send({ to: job.email.to, ...rendered });
    }
  }
}
