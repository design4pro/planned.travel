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
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
