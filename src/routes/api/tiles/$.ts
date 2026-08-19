import { createFileRoute } from '@tanstack/react-router'
// Loads the Start module augmentation that adds `server` to route options.
import type {} from '@tanstack/react-start'
import { env, waitUntil } from 'cloudflare:workers'
import { loggerFromEnv, serializeError } from '#/server/observability'
import { serveTiles } from './-lib/serve'
import type { Logger } from '#/server/observability'
import type { TilesRuntime } from './-lib/serve'

declare global {
  /**
   * `caches.default` is Cloudflare's zone cache. It is absent from the DOM
   * `CacheStorage` lib types this project also compiles against, so the property
   * is declared here rather than reached for with a cast.
   */
  interface CacheStorage {
    readonly default: Cache
  }
}

/**
 * Memoised per isolate. This is the highest-volume route in the app — a single
 * map session issues hundreds of range requests — so it allocates nothing it
 * does not have to, and the logger holds no request state.
 */
let logger: Logger | undefined

function tilesRuntime(): TilesRuntime {
  logger ??= loggerFromEnv(env, {
    context: { route: '/api/tiles/$', component: 'worker' },
  })
  const log = logger
  return {
    store: env.TILES,
    cache: caches.default,
    defaultArchiveKey: env.TILES_ARCHIVE_KEY,
    waitUntil,
    onError: (context, error) => {
      // A cache fault degrades the read to an R2 round trip; the request still
      // succeeds, so this is a warning rather than an error.
      log.warn('tile cache operation failed', {
        operation: context,
        ...serializeError(error),
      })
    },
  }
}

const handler = ({ request }: { request: Request }): Promise<Response> =>
  serveTiles(request, tilesRuntime())

/**
 * Protomaps archives, styles, sprites and glyphs out of the `TILES` R2 bucket.
 *
 * Declaring only `server` keeps the handler — and the bucket binding — out of
 * the client bundle.
 */
export const Route = createFileRoute('/api/tiles/$')({
  server: {
    handlers: {
      GET: handler,
      HEAD: handler,
      OPTIONS: handler,
    },
  },
})
