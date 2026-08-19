/**
 * MapLibre's tile worker, resolved by the bundler instead of by MapLibre.
 *
 * MapLibre derives its worker URL from its own `import.meta.url` at runtime:
 * `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. That assumption holds
 * for a plain `<script>` copy of the library and breaks under every bundler that
 * moves the entry file, which is both of ours:
 *
 * - In dev, Vite pre-bundles `maplibre-gl` to `/node_modules/.vite/deps/`, and
 *   esbuild does not copy the sibling worker there — the fetch 404s.
 * - In the build, the library lands in a hashed chunk under `assets/`, and the
 *   worker specifier is a template string that Rollup cannot statically analyse,
 *   so no worker asset is emitted — the fetch 404s there too.
 *
 * Without the worker MapLibre parses no vector tile, so the map paints its
 * background colour and nothing else: a blank rectangle where the cartography
 * should be. `?worker&url` hands the file to Vite instead, which bundles it with
 * its own dependency graph and returns a URL that is correct in both
 * environments. `MapCanvas` feeds it to `setWorkerUrl` before the first map is
 * constructed.
 */
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

export const MAPLIBRE_WORKER_URL: string = workerUrl
