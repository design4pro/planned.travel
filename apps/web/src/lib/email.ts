/**
 * Transactional email — a swappable `EmailSender` adapter.
 *
 * - `NoopEmailSender` (default): logs + returns `{ id: "noop" }`. Used whenever
 *   `env.EMAIL_ENABLED !== "true"` (the default), so the pipeline is fully
 *   functional in local dev and before Resend is provisioned: notifications
 *   land in D1, emails are silently dropped.
 * - `ResendEmailSender`: calls Resend's REST API via `fetch` (`POST
 *   https://api.resend.com/emails`, `Authorization: Bearer <key>`). Resend has
 *   no official Workers SDK, but the REST surface is trivial and `fetch` is
 *   first-class on Workers (`nodejs_compat` is already on).
 * - `CloudflareEmailSender` (alternative, NOT built now): would wrap the
 *   `send_email` binding. To switch later: uncomment the `send_email` block in
 *   `wrangler.jsonc`, add `NOTIFICATIONS: SendEmail` to `CloudflareEnv`, and
 *   return it from `createEmailSender` when `env.NOTIFICATIONS` is present.
 *
 * Always instantiated per-request from `env` — never cached at module scope
 * (same rule as Better Auth / Drizzle, see CLAUDE.md).
 */
import type { CloudflareEnv } from "./env";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailSender {
  send(input: SendEmailInput): Promise<{ id?: string }>;
}

/** Default sender — drops email silently, returns a stable pseudo-id. */
export class NoopEmailSender implements EmailSender {
  async send(input: SendEmailInput): Promise<{ id?: string }> {
    console.debug("[email] noop send", input.to, input.subject);
    return { id: "noop" };
  }
}

/** Resend REST API sender. Throws on non-2xx so callers can log + move on. */
export class ResendEmailSender implements EmailSender {
  constructor(private apiKey: string, private from: string) {}

  async send(input: SendEmailInput): Promise<{ id?: string }> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`resend ${res.status}: ${detail}`);
    }
    const data = (await res.json()) as { id?: string };
    return { id: data.id };
  }
}

/*
// CloudflareEmailSender (alternative — built only when the send_email binding
// is provisioned). Sketch kept as a comment so the swap is mechanical:
//
// export class CloudflareEmailSender implements EmailSender {
//   constructor(private binding: SendEmail) {}
//   async send(input: SendEmailInput) {
//     await this.binding.send({
//       from: input.from, to: [input.to], subject: input.subject,
//       html: input.html, text: input.text, replyTo: input.replyTo,
//     } as any);
//     return { id: undefined };
//   }
// }
*/

/**
 * Pick a sender from env. Resend only when explicitly enabled AND a key is
 * present; otherwise the no-op (notifications still land in D1).
 */
export function createEmailSender(env: CloudflareEnv): EmailSender {
  if (env.EMAIL_ENABLED === "true" && env.RESEND_API_KEY) {
    return new ResendEmailSender(
      env.RESEND_API_KEY,
      env.EMAIL_FROM ?? "planned.travel <noreply@planned.travel>",
    );
  }
  return new NoopEmailSender();
}
