import type { APIRoute } from "astro";
import { createApp } from "../../server/app";

/**
 * Single typed API entrypoint. Delegates every /api/* request to the Hono app,
 * which mounts Better Auth (/api/auth/*), health, and app routes.
 */
export const ALL: APIRoute = ({ request, locals }) =>
  createApp(locals.runtime.env).fetch(request);
