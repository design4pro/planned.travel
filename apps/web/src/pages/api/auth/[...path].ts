import type { APIRoute } from "astro";
import { createAuth } from "../../../lib/auth";

/**
 * Better Auth catch-all handler. Mounts the full auth API under /api/auth/*
 * (sign-up/in, social callbacks, session, passkey, organization, etc.).
 */
export const ALL: APIRoute = async ({ request, locals }) => {
  const auth = createAuth(locals.runtime.env);
  return auth.handler(request);
};
