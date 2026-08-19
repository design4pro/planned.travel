import { createFileRoute } from '@tanstack/react-router'
// Loads the Start module augmentation that adds `server` to route options.
import type {} from '@tanstack/react-start'

import { getDb } from '#/server/db/client'
import { RepositoryError, appSettingsStore } from '#/server/repos'

/**
 * `POST /api/dev/seed` — writes the demo dataset into the local database.
 *
 * **Development only.** Both handlers check `import.meta.env.DEV` before anything else and answer 404
 * when it is false — the same 404 an unmatched URL gets, so a production deployment does not even
 * admit the endpoint exists. Vite replaces the flag with a literal at build time, which makes the
 * guard `if (true) return notFound()` in the production bundle; the seed itself is behind a dynamic
 * `import()` inside the other branch, so the dataset and the applier are never pulled into the
 * deployed Worker at all. There is no configuration a production request can reach a write path
 * through.
 *
 * Query parameters:
 * - `email` — the workspace owner to seed. Defaults to `rafal@planned.travel`.
 * - `force=1` — re-seed even though the `demo.seed` marker says this dataset version is applied.
 *
 * `GET` reports whether the marker is present, and writes nothing.
 */

/** Byte for byte what an unmatched route returns. */
function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

async function post({ request }: { request: Request }): Promise<Response> {
  if (!import.meta.env.DEV) {
    return notFound()
  }

  const { SeedBootstrapError, applySeed } = await import('./-seed')
  const url = new URL(request.url)
  const email = url.searchParams.get('email')
  const force = url.searchParams.get('force')

  try {
    const report = await applySeed(getDb(), {
      ...(email === null || email.length === 0 ? {} : { ownerEmail: email }),
      force: force === '1' || force === 'true',
    })
    return json({ ok: true, ...report })
  } catch (error) {
    if (error instanceof SeedBootstrapError) {
      return json({ ok: false, error: error.message }, 409)
    }
    if (error instanceof RepositoryError) {
      return json({ ok: false, error: error.message, code: error.code }, 422)
    }
    return json(
      { ok: false, error: error instanceof Error ? error.message : 'The seed failed.' },
      500,
    )
  }
}

async function get(): Promise<Response> {
  if (!import.meta.env.DEV) {
    return notFound()
  }
  const marker = await appSettingsStore.get(getDb(), 'demo.seed')
  return json({
    ok: true,
    seeded: marker !== null,
    marker: marker?.value ?? null,
    hint: 'POST to this URL to seed. Add ?force=1 to rebuild an existing demo workspace.',
  })
}

export const Route = createFileRoute('/api/dev/seed')({
  server: {
    handlers: {
      GET: get,
      POST: post,
    },
  },
})
