#!/usr/bin/env node
/**
 * Seeds the staging unlock pool: single-use, 100%-off Polar discount codes in the **sandbox**
 * organization, so a tester can put a staging workspace on Solo or Crew without a card.
 *
 * Runbook: docs/DEPLOY.md §9.12. Spec: .ai/specs/2026-09-19-polar-discount-codes.md.
 *
 * Three rules hold whatever the arguments say:
 *
 * 1. **Sandbox only.** `POLAR_SERVER` must be exactly `sandbox`, and the only origin this script
 *    can reach is `https://sandbox-api.polar.sh`. A 100%-off code in production is revenue, so the
 *    guard runs before any request and has no override.
 * 2. **An operator's token, never the Worker's.** It reads `POLAR_ADMIN_TOKEN`, which carries
 *    `discounts:write`; the Worker's `POLAR_ACCESS_TOKEN` never gets that scope.
 * 3. **A code is handed out once.** The run tops the unredeemed pool up to `--count` and prints only
 *    the codes it just created, so a code already given to one tester is never printed for a second.
 *    `--list-unused` prints the whole unredeemed pool, for an operator who lost the list. Codes are
 *    never written to the repository.
 *
 * Usage:
 *   POLAR_SERVER=sandbox POLAR_ADMIN_TOKEN=… node scripts/billing/seed-sandbox-discounts.mjs \
 *     [--count 20] [--products <uuid,uuid,…>] [--dry-run] [--list-unused]
 *
 * Without `--products` the four `VITE_POLAR_PRODUCT_*` variables of DEPLOY.md §10 name the paid
 * products, and all four must be set.
 */

import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'

/**
 * Only the sandbox origin exists here. `src/server/billing/polar.ts` has the same rule for the
 * Worker (`resolvePolarOrigin()`); a `.mjs` script cannot import TS source, so it is restated, and
 * narrower: production is not a value this script knows.
 */
export const SANDBOX_ORIGIN = 'https://sandbox-api.polar.sh'
export const DISCOUNTS_PATH = '/v1/discounts/'
export const POOL_TAG = 'staging-unlock'
export const POOL_NAME = 'Staging unlock'
export const CODE_PREFIX = 'STAGE'
export const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const CODE_RANDOM_LENGTH = 8
export const DEFAULT_COUNT = 20
/** The Worker's lookup reads at most ten pages of 100, so the catalogue is warned about at eight. */
export const CATALOGUE_WARNING_AT = 800
const PAGE_SIZE = 100

const PRODUCT_VARIABLES = [
  'VITE_POLAR_PRODUCT_SOLO_MONTHLY',
  'VITE_POLAR_PRODUCT_SOLO_YEARLY',
  'VITE_POLAR_PRODUCT_CREW_MONTHLY',
  'VITE_POLAR_PRODUCT_CREW_YEARLY',
]

/** Refuses everything but exactly `sandbox`, before any request is made. */
export function resolveSandboxOrigin(server) {
  if (server === 'sandbox') return SANDBOX_ORIGIN
  const shown = server === undefined || server === '' ? 'unset' : `'${server}'`
  throw new Error(
    `POLAR_SERVER is ${shown}. This script only runs against the Polar sandbox: set POLAR_SERVER=sandbox.`,
  )
}

/** The command line and the environment, validated. Throws with the reason on anything wrong. */
export function parseOptions(argv, env) {
  const options = {
    count: DEFAULT_COUNT,
    products: null,
    dryRun: false,
    listUnused: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--list-unused') options.listUnused = true
    else if (arg === '--count') {
      const count = Number(argv[(index += 1)])
      if (!Number.isInteger(count) || count < 0 || count > 500) {
        throw new Error('--count takes a whole number from 0 to 500.')
      }
      options.count = count
    } else if (arg === '--products') {
      options.products = (argv[(index += 1)] ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== '')
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  const origin = resolveSandboxOrigin(env.POLAR_SERVER)

  const token = env.POLAR_ADMIN_TOKEN ?? ''
  if (token === '') {
    throw new Error(
      'POLAR_ADMIN_TOKEN is not set. Use your own sandbox token with discounts:read and discounts:write.',
    )
  }

  const products =
    options.products ??
    PRODUCT_VARIABLES.map((name) => (env[name] ?? '').trim())
  if (products.length === 0 || products.some((id) => id === '')) {
    throw new Error(
      `Name the paid sandbox products with --products or set all of ${PRODUCT_VARIABLES.join(', ')}.`,
    )
  }

  return { ...options, products, origin, token }
}

/** A pool code nobody has redeemed yet. The list endpoint has no metadata filter, so this is ours. */
export function isUnusedPoolCode(discount) {
  return (
    discount?.metadata?.pool === POOL_TAG &&
    (discount.redemptions_count ?? 0) < 1
  )
}

/** How many codes to create so the unredeemed pool reaches the target. Never negative. */
export function shortfall(target, unused) {
  return Math.max(0, target - unused)
}

/** `STAGE` and eight uppercase alphanumerics, drawn from the injected bytes. */
export function generateCode(bytes = randomBytes(CODE_RANDOM_LENGTH)) {
  let suffix = ''
  for (let index = 0; index < CODE_RANDOM_LENGTH; index += 1) {
    suffix += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length]
  }
  return `${CODE_PREFIX}${suffix}`
}

/** The body of one `POST /v1/discounts/`. */
export function discountBody(code, products) {
  return {
    type: 'percentage',
    basis_points: 10_000,
    duration: 'forever',
    max_redemptions: 1,
    products,
    name: POOL_NAME,
    code,
    metadata: { pool: POOL_TAG },
  }
}

/**
 * The codes a run prints. By default only the ones it just created, so a code handed to one tester
 * is not handed to a second; `--list-unused` asks for the whole unredeemed pool on purpose.
 */
export function codesToPrint(created, unused, listUnused) {
  return listUnused ? [...unused, ...created] : [...created]
}

async function polar(
  fetchImpl,
  origin,
  token,
  method,
  path,
  { query, body } = {},
) {
  const search = query === undefined ? '' : `?${new URLSearchParams(query)}`
  const response = await fetchImpl(`${origin}${path}${search}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300)
    throw new Error(
      `Polar ${method} ${path} failed with ${response.status}: ${detail}`,
    )
  }
  return await response.json()
}

/** Every discount in the organization, and the total Polar reports. */
async function listDiscounts(fetchImpl, origin, token) {
  const items = []
  let total = 0
  for (let page = 1; ; page += 1) {
    const answer = await polar(
      fetchImpl,
      origin,
      token,
      'GET',
      DISCOUNTS_PATH,
      {
        query: { limit: String(PAGE_SIZE), page: String(page) },
      },
    )
    items.push(...answer.items)
    total = answer.pagination?.total_count ?? items.length
    const maxPage = answer.pagination?.max_page ?? page
    if (page >= maxPage || answer.items.length === 0) break
  }
  return { items, total }
}

/**
 * The whole run, with its I/O injected so the tests drive it without a network.
 * Returns the process exit code.
 */
export async function run({
  argv,
  env,
  fetch: fetchImpl,
  out,
  err,
  random = generateCode,
}) {
  let options
  try {
    options = parseOptions(argv, env)
  } catch (cause) {
    err(cause.message)
    return 1
  }

  const { origin, token } = options
  const { items, total } = await listDiscounts(fetchImpl, origin, token)
  const unused = items.filter(isUnusedPoolCode).map((discount) => discount.code)
  const missing = shortfall(options.count, unused.length)

  err(
    `Sandbox pool: ${unused.length} unredeemed of target ${options.count}; creating ${missing}${options.dryRun ? ' (dry run)' : ''}.`,
  )
  if (total > CATALOGUE_WARNING_AT) {
    err(
      `Warning: the sandbox organization holds ${total} discounts. The app's lookup reads at most 1,000; delete redeemed staging codes (DEPLOY.md §9.12).`,
    )
  }

  const created = []
  for (let index = 0; index < missing; index += 1) {
    const code = random()
    if (!options.dryRun) {
      await polar(fetchImpl, origin, token, 'POST', DISCOUNTS_PATH, {
        body: discountBody(code, options.products),
      })
    }
    created.push(code)
  }

  for (const code of codesToPrint(created, unused, options.listUnused))
    out(code)
  return 0
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run({
    argv: process.argv.slice(2),
    env: process.env,
    fetch: globalThis.fetch,
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  }).then(
    (code) => {
      process.exitCode = code
    },
    (cause) => {
      process.stderr.write(
        `${cause instanceof Error ? cause.message : String(cause)}\n`,
      )
      process.exitCode = 1
    },
  )
}
