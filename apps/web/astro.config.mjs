// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// SSR Astro app deployed as a Cloudflare Worker + Static Assets.
// Bindings (D1, KV, R2, AI, Vectorize, Images, ...) are read at runtime via
// `Astro.locals.runtime.env` (see src/lib/env.ts).
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: { enabled: true },
    // Custom worker entry: reuses the adapter's fetch handler and additionally
    // exports the TripRoom Durable Object class + the JOBS queue consumer (see
    // src/worker.ts). The adapter forwards exactly: ["default", ...namedExports],
    // so any non-fetch handler (queue/scheduled/email) MUST be listed here or the
    // platform rejects the consumer with "handler is missing" [code 11001].
    workerEntryPoint: {
      path: "src/worker.ts",
      namedExports: ["TripRoom", "queue"],
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },

  // i18n: English (default, no prefix) + Polish (/pl).
  // Messages live in src/i18n/ui.ts; Paraglide can replace it later without
  // changing call sites (identical key structure).
  i18n: {
    defaultLocale: "en",
    locales: ["en", "pl"],
    routing: { prefixDefaultLocale: false },
  },
});
