/// <reference types="@astrojs/cloudflare" />
/// <reference path="../.astro/types.d.ts" />

import type { CloudflareEnv } from "./lib/env";

// NOTE: the top-level `import` above turns this file into a module, so the
// augmentation MUST be wrapped in `declare global` — a bare `declare namespace
// App` would be module-scoped and silently fail to merge with Astro's Locals
// (which surfaces as "Property 'runtime' does not exist on type 'Locals'").
declare global {
  namespace App {
    interface Locals {
      runtime: {
        env: CloudflareEnv;
        cf: IncomingRequestCfProperties;
        ctx: ExecutionContext;
      };
    }
  }
}
