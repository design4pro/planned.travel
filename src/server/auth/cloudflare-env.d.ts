/// <reference types="@cloudflare/workers-types" />

/**
 * Secrets the authentication layer reads from the Worker environment.
 *
 * Only secrets belong here. Bindings and `vars` (`DB`, `SESSIONS`, `TASKS`,
 * `APP_URL`, …) are generated authoritatively into `worker-configuration.d.ts`
 * by `wrangler types`, and re-declaring one in this augmentation *overrides* the
 * generated member rather than adding to it — which previously made the
 * guaranteed `TASKS` queue look optional to every consumer.
 */
declare namespace Cloudflare {
  interface Env {
    /** Signing key for session cookies and tokens. */
    BETTER_AUTH_SECRET: string

    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string

    APPLE_CLIENT_ID?: string
    APPLE_CLIENT_SECRET?: string
    /** Bundle identifier accepted alongside the web client id on Apple sign-in. */
    APPLE_APP_BUNDLE_IDENTIFIER?: string
  }
}
