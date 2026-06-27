import type { SSRManifest } from "astro";
import { createExports as astroCreateExports } from "@astrojs/cloudflare/entrypoints/server.js";
import { TripRoom } from "./server/trip-room";

/**
 * Worker entrypoint. Astro delegates SSR to this file (see astro.config.mjs
 * `workerEntryPoint`). We reuse the adapter's own `createExports` for the
 * default fetch handler and add the `TripRoom` Durable Object class as a named
 * export so wrangler's `durable_objects` binding can find it.
 *
 * Keep the default export identical to the adapter's — we only *add* the DO.
 */
export function createExports(manifest: SSRManifest) {
  return { ...astroCreateExports(manifest), TripRoom };
}
