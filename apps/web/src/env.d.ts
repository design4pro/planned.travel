/// <reference types="@astrojs/cloudflare" />
/// <reference path="../.astro/types.d.ts" />

import type { CloudflareEnv } from "./lib/env";

declare namespace App {
  interface Locals {
    runtime: {
      env: CloudflareEnv;
      cf: IncomingRequestCfProperties;
      ctx: ExecutionContext;
    };
  }
}
