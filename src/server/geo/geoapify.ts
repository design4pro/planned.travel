/**
 * The Geoapify client: one request, one response, parsed into our own shape.
 *
 * It knows nothing about tenants, caches or allowances, and it is named for the vendor on purpose —
 * when the provider changes, the file to replace is the one with the vendor's name on it, and a
 * search through the codebase is not part of the job. Everything that decides *whether* a call is
 * made — the cache, the workspace's allowance, the shared key — lives in `./geocode`, and nothing
 * outside this directory imports this module.
 *
 * **The provider is Geoapify, behind our own proxy** (ADR 0013). That argument is the ADR's and is
 * not restated here.
 *
 * **The credential is a `wrangler secret`.** It is handed in as a string; this module never reads an
 * environment, and a per-tenant provider credential is neither offered nor accepted — one deployment
 * serves every workspace, so a tenant-supplied third-party key is a cross-tenant leak rather than a
 * feature. It rides in the query string because that is the only form the vendor accepts, which is
 * why no failure below ever quotes the request: the status and the vendor's own text, never the URL.
 *
 * **`fetch` is a parameter.** No test in this repository calls Geoapify, and none can: the transport
 * arrives as an argument, so the seam is the module boundary rather than a global somebody
 * remembered to intercept.
 */

import { z } from 'zod'

import { GEOCODE_CANDIDATES, GeoProviderError } from './geocode'

import type { Locale } from '#/lib/i18n'
import type {
  ForwardQuery,
  GeocodeCandidate,
  GeocodeProvider,
  GeocodeVendor,
  ReverseQuery,
} from './geocode'

/** Where the geocoder lives. Overridable so a test can name a URL that answers. */
export const GEOAPIFY_FORWARD_ENDPOINT =
  'https://api.geoapify.com/v1/geocode/search'

/** The same service asked the other way round. */
export const GEOAPIFY_REVERSE_ENDPOINT =
  'https://api.geoapify.com/v1/geocode/reverse'

/** Long enough for a slow lookup, short enough that a form is never hung on one. */
export const GEOAPIFY_TIMEOUT_MS = 10_000

/* ---------------------------------------------------------------- the wire */

/**
 * The answer Geoapify promises under `format=json`, as much of it as we read.
 *
 * Unknown keys are ignored rather than refused — a vendor adding a field is not a reason to stop
 * working — but a field we *do* read arriving in the wrong shape is refused outright. A response
 * that half-parses is an address half-known, pinned to a coordinate nobody can account for.
 */
const wireResult = z.object({
  place_id: z.string().optional(),
  name: z.string().optional(),
  formatted: z.string().optional(),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  country_code: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
})

const wireResponse = z.object({ results: z.array(wireResult).optional() })

/* ------------------------------------------------------------- vocabulary */

/**
 * Our BCP-47 tags onto the vendor's `lang` parameter.
 *
 * Twenty of the twenty-three are already the bare ISO 639-1 code the vendor wants, so only the three
 * that are not appear here. Both `zh` readers therefore receive the same script: that is a quality
 * loss owned by the vendor's parameter, not by this design, and it is recorded here so nothing
 * downstream rediscovers it. The tag itself stays in the cache key — the key is vendor-neutral, and
 * collapsing it would let a Traditional reader be served a Simplified answer.
 */
const GEOAPIFY_LANGUAGE: Readonly<Partial<Record<Locale, string>>> = {
  'pt-BR': 'pt',
  'zh-Hans': 'zh',
  'zh-Hant': 'zh',
}

function languageOf(locale: Locale): string {
  return GEOAPIFY_LANGUAGE[locale] ?? locale
}

/* ------------------------------------------------------------------ parse */

/**
 * One vendor feature into one candidate, or nothing.
 *
 * A result with no id is dropped rather than given one of ours: the id is what a caller writes to
 * `places.external_id`, and a synthesised one would name a place the vendor cannot be asked about
 * again. The country code is upper-cased to the shape `places.country_code` stores, and anything
 * that is not two letters is `null` rather than a value that would fail the column's own rule.
 */
function candidateOf(
  result: z.infer<typeof wireResult>,
): GeocodeCandidate | null {
  const id = result.place_id?.trim() ?? ''
  if (id === '') {
    return null
  }
  const country = result.country_code?.trim().toUpperCase() ?? ''
  return {
    id,
    name: result.name ?? result.address_line1 ?? result.formatted ?? '',
    address: result.formatted ?? null,
    city: result.city ?? null,
    countryCode: /^[A-Z]{2}$/.test(country) ? country : null,
    lat: result.lat,
    lng: result.lon,
  }
}

/* ----------------------------------------------------------------- client */

/**
 * The declared retention right, and the credits that ride with every answer.
 *
 * A module-level constant precisely because it must outlive the credential: a deployment with no key
 * still has a slug to key the cache with and credits to render beside a cached answer, so
 * {@link createGeoapifyClient} may refuse while this does not. `permanent` is what ADR 0013 read the
 * vendor's terms to allow, and the proxy refuses to write a cache entry for any vendor declaring
 * otherwise — the flag is the enforcement point, not a note.
 *
 * The credits are proper nouns and URLs, never sentences: the sentence beside them is copy, and copy
 * lives in the 23-locale catalogue rather than in a server module.
 */
export const geoapifyVendor: GeocodeVendor = {
  slug: 'geoapify',
  retention: 'permanent',
  attribution: [
    { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
    { name: 'Geoapify', url: 'https://www.geoapify.com/' },
  ],
}

export interface GeoapifyClientOptions {
  /** From `wrangler secret put GEOAPIFY_API_KEY`. Never a value a tenant supplies. */
  readonly apiKey: string
  readonly fetch: typeof fetch
  readonly forwardEndpoint?: string
  readonly reverseEndpoint?: string
}

/**
 * A client bound to one credential and one transport.
 *
 * Built rather than called, so the composition root wires the secret in once and every caller
 * afterwards holds a {@link GeocodeProvider} that cannot be handed the wrong key. An empty key is
 * refused *here*, at construction, so `./bindings` can hand the proxy a `null` provider rather than
 * a client that fails after the meter has already spent a lookup.
 */
export function createGeoapifyClient(
  options: GeoapifyClientOptions,
): GeocodeProvider {
  const apiKey = options.apiKey.trim()
  if (apiKey === '') {
    throw new GeoProviderError(
      'unconfigured',
      'Geocoding is not configured on this deployment. Set GEOAPIFY_API_KEY with `wrangler secret put GEOAPIFY_API_KEY`.',
    )
  }

  async function ask(url: URL): Promise<ReadonlyArray<GeocodeCandidate>> {
    url.searchParams.set('format', 'json')
    url.searchParams.set('apiKey', apiKey)

    let response: Response
    try {
      response = await options.fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(GEOAPIFY_TIMEOUT_MS),
      })
    } catch (cause) {
      throw new GeoProviderError(
        'unreachable',
        'The geocoding service could not be reached. Try again in a moment.',
        null,
        { cause },
      )
    }

    if (!response.ok) {
      throw new GeoProviderError(
        'refused',
        `The geocoding service refused the lookup (${response.status}).`,
        response.status,
      )
    }

    let body: unknown
    try {
      body = await response.json()
    } catch (cause) {
      throw new GeoProviderError(
        'malformed',
        'The geocoding service answered something this product cannot read.',
        response.status,
        { cause },
      )
    }

    const parsed = wireResponse.safeParse(body)
    if (!parsed.success) {
      throw new GeoProviderError(
        'malformed',
        'The geocoding service answered something this product cannot read.',
        response.status,
      )
    }

    return (parsed.data.results ?? []).flatMap((result) => {
      const candidate = candidateOf(result)
      return candidate === null ? [] : [candidate]
    })
  }

  return {
    ...geoapifyVendor,

    async forward(
      query: ForwardQuery,
    ): Promise<ReadonlyArray<GeocodeCandidate>> {
      const url = new URL(options.forwardEndpoint ?? GEOAPIFY_FORWARD_ENDPOINT)
      url.searchParams.set('text', query.query)
      url.searchParams.set('lang', languageOf(query.language))
      url.searchParams.set('limit', String(GEOCODE_CANDIDATES))
      return ask(url)
    },

    async reverse(
      query: ReverseQuery,
    ): Promise<ReadonlyArray<GeocodeCandidate>> {
      const url = new URL(options.reverseEndpoint ?? GEOAPIFY_REVERSE_ENDPOINT)
      url.searchParams.set('lat', String(query.lat))
      url.searchParams.set('lon', String(query.lng))
      url.searchParams.set('lang', languageOf(query.language))
      // One coordinate is one place. Asking for five would return the same address five ways.
      url.searchParams.set('limit', '1')
      return ask(url)
    },
  }
}
