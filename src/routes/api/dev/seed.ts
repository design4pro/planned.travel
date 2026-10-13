import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
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
 * The response also reports the weather cache it wrote (`weather`), see `./-seed/weather-cache`.
 *
 * Optional JSON body:
 * - `password` — the password the owner's account should have, so the seeded workspace can be signed
 *   into. Read from the body rather than the query string so it does not end up in a request log.
 *   Creates the account when there is none, and otherwise reconciles the existing password — which is
 *   the case that matters, since an account registered by hand has a password nobody recorded. A
 *   password that already works is left untouched.
 * - `keepPassword` — never overwrite a password that is already set, even when it is not the one
 *   supplied. Use it when you chose your own local password and want to keep it.
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
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * Reads the credential options out of an optional JSON body. A missing, empty or unparseable body is
 * not an error — it simply means "seed the data and leave the account alone".
 */
async function ownerCredentialFrom(
  request: Request,
): Promise<{ password: string | null; keepPassword: boolean }> {
  const none = { password: null, keepPassword: false }
  try {
    const raw = await request.text()
    if (raw.length === 0) {
      return none
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return none
    }
    const body = parsed as { password?: unknown; keepPassword?: unknown }
    return {
      password:
        typeof body.password === 'string' && body.password.length > 0
          ? body.password
          : null,
      keepPassword: body.keepPassword === true,
    }
  } catch {
    return none
  }
}

async function post({ request }: { request: Request }): Promise<Response> {
  if (!import.meta.env.DEV) {
    return notFound()
  }

  const { SeedBootstrapError, applySeed, seedWeatherCache } =
    await import('./-seed')
  const url = new URL(request.url)
  const email = url.searchParams.get('email')
  const force = url.searchParams.get('force')
  const { password, keepPassword } = await ownerCredentialFrom(request)

  try {
    const report = await applySeed(getDb(), {
      ...(email === null || email.length === 0 ? {} : { ownerEmail: email }),
      ...(password === null ? {} : { ownerPassword: password }),
      keepExistingPassword: keepPassword,
      force: force === '1' || force === 'true',
    })
    // After the seed and on every run, a warm one included: the weather journey reads this cache
    // and allowance, and a rebuild mints a new organization that the allowance is keyed on.
    const weather = await seedWeatherCache(env.KV, report.organizationId)
    return json({ ok: true, ...report, weather })
  } catch (error) {
    if (error instanceof SeedBootstrapError) {
      return json({ ok: false, error: error.message }, 409)
    }
    if (error instanceof RepositoryError) {
      return json({ ok: false, error: error.message, code: error.code }, 422)
    }
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'The seed failed.',
      },
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
