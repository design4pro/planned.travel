import type { SSRManifest } from "astro";
import { createExports as astroCreateExports } from "@astrojs/cloudflare/entrypoints/server.js";
import { TripRoom } from "./server/trip-room";
import type { CloudflareEnv } from "./lib/env";
import type { NotificationJob } from "@planned/shared";
import { deliverNotification } from "./server/notifications-consumer";

/**
 * Worker entrypoint. Astro delegates SSR to this file (see astro.config.mjs
 * `workerEntryPoint`). We reuse the adapter's own `createExports` for the
 * default fetch handler and add:
 *   - `TripRoom` — the realtime-collab Durable Object class (wrangler
 *     `durable_objects` binding, see wrangler.jsonc).
 *   - `queue` — the JOBS queue consumer (notifications delivery). Cloudflare's
 *     runtime calls `queue` for queue messages and `default` (fetch) for HTTP;
 *     they coexist on the same exports object. The `queue` export only activates
 *     once the `queues.consumers` block is enabled in wrangler.jsonc.
 *
 * We only ever *augment* the adapter's exports (spread), never replace — so any
 * `scheduled`/`email` handlers the adapter emits in future versions are kept.
 */
export function createExports(manifest: SSRManifest) {
  const astro = astroCreateExports(manifest);

  // JOBS queue consumer — per-message try/catch + ack-all so a single bad
  // message never blocks the batch. Notifications are best-effort.
  async function queue(batch: MessageBatch<NotificationJob>, env: CloudflareEnv): Promise<void> {
    await Promise.all(
      batch.messages.map(async (msg) => {
        try {
          await deliverNotification(env, msg.body);
        } catch (err) {
          console.error("[queue] notification delivery failed", err);
        } finally {
          msg.ack();
        }
      }),
    );
  }

  return { ...astro, TripRoom, queue };
}
