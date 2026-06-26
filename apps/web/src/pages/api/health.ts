import type { APIRoute } from "astro";

/** Smoke endpoint: confirms the Worker booted and bindings are wired. */
export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime?.env;
  return new Response(
    JSON.stringify({
      ok: true,
      service: "planned-travel-web",
      bindings: {
        db: Boolean(env?.DB),
        kv: Boolean(env?.KV),
        media: Boolean(env?.MEDIA),
        ai: Boolean(env?.AI),
        vectorize: Boolean(env?.VECTORIZE),
        images: Boolean(env?.IMAGES),
      },
    }),
    { headers: { "content-type": "application/json" } }
  );
};
