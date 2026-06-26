import { createAuth } from "./auth";

/** Resolve the signed-in user (or null) from the request cookie/bearer, server-side. */
export async function getSessionUser(locals: App.Locals, request: Request) {
  const auth = createAuth(locals.runtime.env);
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
