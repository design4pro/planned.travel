/**
 * The staging unlock pool's seeding script. What matters is that it can never reach production,
 * that it tops the pool up rather than doubling it, and that it never prints a code a tester may
 * already hold. `run()` takes its I/O injected, so the whole flow runs here with no network.
 */

import { describe, expect, it } from 'vitest'

import {
  CODE_ALPHABET,
  DISCOUNTS_PATH,
  POOL_TAG,
  SANDBOX_ORIGIN,
  codesToPrint,
  discountBody,
  generateCode,
  isUnusedPoolCode,
  parseOptions,
  resolveSandboxOrigin,
  run,
  shortfall,
} from '../seed-sandbox-discounts.mjs'

const PRODUCTS = ['p-solo-m', 'p-solo-y', 'p-crew-m', 'p-crew-y']
const ENV = {
  POLAR_SERVER: 'sandbox',
  POLAR_ADMIN_TOKEN: 'polar_oat_test',
  VITE_POLAR_PRODUCT_SOLO_MONTHLY: PRODUCTS[0],
  VITE_POLAR_PRODUCT_SOLO_YEARLY: PRODUCTS[1],
  VITE_POLAR_PRODUCT_CREW_MONTHLY: PRODUCTS[2],
  VITE_POLAR_PRODUCT_CREW_YEARLY: PRODUCTS[3],
}

function poolCode(code, redemptions = 0) {
  return { code, redemptions_count: redemptions, metadata: { pool: POOL_TAG } }
}

/** A Polar double answering the list with `existing` and recording every request. */
function fakePolar(existing, total = existing.length) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({
      url,
      method: init.method,
      body: init.body ? JSON.parse(init.body) : undefined,
    })
    const body =
      init.method === 'GET'
        ? { items: existing, pagination: { total_count: total, max_page: 1 } }
        : { id: 'created' }
    return new Response(JSON.stringify(body), { status: 200 })
  }
  return { fetch, calls }
}

async function drive(argv, { env = ENV, existing = [], total } = {}) {
  const polar = fakePolar(existing, total)
  const out = []
  const err = []
  let next = 0
  const code = await run({
    argv,
    env,
    fetch: polar.fetch,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    random: () => `STAGENEW0000${(next += 1)}`.slice(0, 13),
  })
  return { code, out, err, calls: polar.calls }
}

describe('resolveSandboxOrigin', () => {
  it('accepts exactly sandbox', () => {
    expect(resolveSandboxOrigin('sandbox')).toBe(SANDBOX_ORIGIN)
  })

  it.each(['production', '', undefined, 'Sandbox', ' sandbox'])(
    'refuses %j',
    (server) => {
      expect(() => resolveSandboxOrigin(server)).toThrow(
        /only runs against the Polar sandbox/,
      )
    },
  )
})

describe('parseOptions', () => {
  it('reads the four product variables by default', () => {
    expect(parseOptions([], ENV)).toMatchObject({
      count: 20,
      products: PRODUCTS,
      dryRun: false,
    })
  })

  it('refuses a missing admin token', () => {
    expect(() => parseOptions([], { ...ENV, POLAR_ADMIN_TOKEN: '' })).toThrow(
      /POLAR_ADMIN_TOKEN/,
    )
  })

  it('refuses when a product variable is missing and --products is absent', () => {
    expect(() =>
      parseOptions([], { ...ENV, VITE_POLAR_PRODUCT_CREW_YEARLY: undefined }),
    ).toThrow(/--products/)
  })

  it('takes --count, --products, --dry-run and --list-unused', () => {
    expect(
      parseOptions(
        ['--count', '5', '--products', 'a, b', '--dry-run', '--list-unused'],
        ENV,
      ),
    ).toMatchObject({
      count: 5,
      products: ['a', 'b'],
      dryRun: true,
      listUnused: true,
    })
  })

  it('refuses an unknown argument and a bad count', () => {
    expect(() => parseOptions(['--force'], ENV)).toThrow(/Unknown argument/)
    expect(() => parseOptions(['--count', '-1'], ENV)).toThrow(/--count/)
  })
})

describe('the pool arithmetic', () => {
  it('counts only unredeemed codes tagged for the pool', () => {
    expect(isUnusedPoolCode(poolCode('STAGEAAAAAAAA'))).toBe(true)
    expect(isUnusedPoolCode(poolCode('STAGEAAAAAAAA', 1))).toBe(false)
    expect(
      isUnusedPoolCode({ code: 'SUMMER', redemptions_count: 0, metadata: {} }),
    ).toBe(false)
  })

  it('creates the target minus the unused pool, never a negative number', () => {
    expect(shortfall(20, 7)).toBe(13)
    expect(shortfall(20, 25)).toBe(0)
  })

  it('generates STAGE and eight characters from the alphabet', () => {
    const code = generateCode(
      Uint8Array.from([0, 25, 26, 35, 36, 71, 200, 255]),
    )
    expect(code).toMatch(/^STAGE[A-Z0-9]{8}$/)
    expect(code.slice(5)).toBe(
      [0, 25, 26, 35, 36, 71, 200, 255]
        .map((b) => CODE_ALPHABET[b % 36])
        .join(''),
    )
  })

  it('builds a single-use, 100%-off, forever discount on the given products', () => {
    expect(discountBody('STAGEABCDEFGH', PRODUCTS)).toEqual({
      type: 'percentage',
      basis_points: 10_000,
      duration: 'forever',
      max_redemptions: 1,
      products: PRODUCTS,
      name: 'Staging unlock',
      code: 'STAGEABCDEFGH',
      metadata: { pool: POOL_TAG },
    })
  })

  it('prints only the new codes unless the whole pool is asked for', () => {
    expect(codesToPrint(['NEW'], ['OLD'], false)).toEqual(['NEW'])
    expect(codesToPrint(['NEW'], ['OLD'], true)).toEqual(['OLD', 'NEW'])
  })
})

describe('run', () => {
  it('refuses production before any request', async () => {
    const result = await drive([], {
      env: { ...ENV, POLAR_SERVER: 'production' },
    })
    expect(result.code).toBe(1)
    expect(result.calls).toEqual([])
  })

  it('tops the pool up and prints only the codes it created', async () => {
    const result = await drive(['--count', '3'], {
      existing: [poolCode('STAGEOLD00001')],
    })

    expect(result.code).toBe(0)
    const posts = result.calls.filter((call) => call.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(
      posts.every((call) => call.url === `${SANDBOX_ORIGIN}${DISCOUNTS_PATH}`),
    ).toBe(true)
    expect(result.out).toHaveLength(2)
    expect(result.out).not.toContain('STAGEOLD00001')
  })

  it('creates nothing on a dry run', async () => {
    const result = await drive(['--count', '2', '--dry-run'])
    expect(result.calls.filter((call) => call.method === 'POST')).toEqual([])
    expect(result.out).toHaveLength(2)
  })

  it('only ever calls the sandbox origin', async () => {
    const result = await drive(['--count', '1'])
    expect(
      result.calls.every((call) => call.url.startsWith(SANDBOX_ORIGIN)),
    ).toBe(true)
  })

  it('warns when the catalogue grows toward the lookup cap', async () => {
    const result = await drive(['--count', '0'], { total: 801 })
    expect(result.err.join('\n')).toMatch(/holds 801 discounts/)
  })
})
