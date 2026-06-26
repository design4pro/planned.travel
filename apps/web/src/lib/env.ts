/**
 * Typed access to Cloudflare runtime bindings for the Astro app.
 *
 * Bindings are attached by the @astrojs/cloudflare adapter to
 * `Astro.locals.runtime.env` at request time. They are NOT available at module
 * init — always read them inside a request handler.
 */

export interface CloudflareEnv {
  // Static assets + compute
  ASSETS: Fetcher;

  // Data
  DB: D1Database;
  KV: KVNamespace;
  MEDIA: R2Bucket;
  VECTORIZE: VectorizeIndex;

  // AI / media
  AI: Ai;
  IMAGES: ImagesBinding;

  // Added in later phases:
  // TRIP_ROOM: DurableObjectNamespace;
  // JOBS: Queue<JobMessage>;
  // ITINERARY_GEN: Workflow;
  // BOOKING_INGEST: Workflow;

  // Public vars
  APP_URL: string;

  // Secrets (set via `wrangler secret put`)
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export type Runtime = {
  env: CloudflareEnv;
  cf: IncomingRequestCfProperties;
  ctx: ExecutionContext;
};

/** Pull the typed env off Astro locals inside any endpoint/page. */
export function getEnv(locals: App.Locals): CloudflareEnv {
  return locals.runtime.env;
}
