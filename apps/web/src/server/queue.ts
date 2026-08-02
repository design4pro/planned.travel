import type { NotificationJob } from "@planned/shared";
import type { CloudflareEnv } from "../lib/env";
import { deliverNotification } from "./notifications-consumer";

/** Cloudflare Queue consumer exposed by the custom Worker entrypoint. */
export async function consumeJobs(
  batch: MessageBatch<NotificationJob>,
  env: CloudflareEnv,
): Promise<void> {
  await Promise.all(
    batch.messages.map(async (message) => {
      try {
        await deliverNotification(env, message.body);
      } catch (error) {
        console.error("[queue] notification delivery failed", error);
      } finally {
        message.ack();
      }
    }),
  );
}
