import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { unstable_dev } from 'wrangler'
import type { Unstable_DevWorker } from 'wrangler'

/**
 * The formatter equivalence gate.
 *
 * `docs/SPEC.md` §8.5 makes this the hardest constraint on the build: every
 * date, amount, relative time and list is rendered first by the Worker and then
 * hydrated by the traveller's browser, and a single byte of disagreement is a
 * React hydration error on a screen that looked perfect in Chrome. §8.5 calls
 * that a defect, never a tolerance — so this file compares the two runtimes
 * field by field and fails the run on the first difference.
 *
 * ## Why it is built this way
 *
 * The two runtimes are the point, so the test has to reach both of them.
 *
 * - The **Worker** side is real workerd, not a Node stand-in: `src/lib/format.ts`
 *   is bundled in memory with Vite and served from a throwaway `wrangler`
 *   session, whose `navigator.userAgent` is `Cloudflare-Workers`. Node's V8 has
 *   its own ICU and agrees with workerd about nearly everything, which is
 *   exactly why it is not evidence.
 * - The **browser** side is whichever engine the Playwright project runs, and
 *   `mobile-safari` is the one that matters. Measured across all twenty-three
 *   locales: Chromium agreed with workerd on every single field, and WebKit
 *   26.5 disagreed about Greek month names, Arabic and Catalan and Russian
 *   weekdays, Catalan and Arabic date patterns, Russian and Chinese relative
 *   times, Arabic list separators, Indonesian currency spacing and the minor
 *   units of the forint. A Chromium-only check catches none of that.
 *
 * The harness is sensitive, and that was measured rather than assumed: adding
 * two raw `Intl` calls to the probe made it report exactly two failures — the
 * `en-GB` `Sept`/`Sep` split and WebKit's U+2068 isolates around Arabic list
 * items — while every field that goes through `src/lib/format.ts` stayed
 * identical.
 */

/** The probe module, bundled for both runtimes so both run the same code. */
const PROBE_SOURCE = `
import {
  formatDate, formatDateRange, formatDayMonth, formatDistance, formatList,
  formatMonthYear, formatMoneyMinor, formatMoneyMinorPlain, formatNumber,
  formatPercent, formatRelative, formatTimeRange, formatWeekday, formatWeight,
  monthName, pluralise, weekdayName,
} from '#/lib/format'
import { LOCALE_TAGS } from '#/lib/i18n'

/** One date in every month, so no abbreviation escapes the comparison. */
const DATES = [
  '2026-01-04', '2026-02-15', '2026-03-01', '2026-04-30',
  '2026-05-11', '2026-06-23', '2026-07-07', '2026-08-19',
  '2026-09-06', '2026-10-25', '2026-11-02', '2026-12-31',
]
const NOW = Date.parse('2026-06-23T12:00:00.000Z')
const AGO = [10e3, 60e3, 5 * 60e3, 61 * 60e3, 3 * 3600e3, 26 * 3600e3, 2 * 86400e3, 5 * 86400e3, 30 * 86400e3]
/** Two-, zero- and three-decimal currencies, and the two the runtimes fight over. */
const CODES = ['EUR', 'GBP', 'USD', 'JPY', 'SEK', 'PLN', 'HUF', 'IDR', 'KWD', 'CHF']
const AMOUNTS = [0, 1, 99, 123456, -123456, 987654321]
/** Counts that reach every CLDR plural category any of the locales has. */
const COUNTS = [0, 1, 2, 3, 5, 11, 21, 100, 101]
const FORMS = { zero: 'zero', one: 'one', two: 'two', few: 'few', many: 'many', other: 'other' }

export function probe() {
  const out = {}
  for (const tag of LOCALE_TAGS) {
    for (const iso of DATES) {
      out[tag + '|date|' + iso] = formatDate(iso, tag)
      out[tag + '|dayMonth|' + iso] = formatDayMonth(iso, tag)
      out[tag + '|weekday|' + iso] = formatWeekday(iso, tag)
      out[tag + '|monthYear|' + iso] = formatMonthYear(iso, tag)
    }
    out[tag + '|range|sameMonth'] = formatDateRange('2026-06-23', '2026-06-30', tag)
    out[tag + '|range|sameYear'] = formatDateRange('2026-06-23', '2026-09-03', tag)
    out[tag + '|range|crossYear'] = formatDateRange('2026-12-28', '2027-01-04', tag)
    out[tag + '|range|openStart'] = formatDateRange(null, '2026-09-06', tag)
    out[tag + '|range|openEnd'] = formatDateRange('2026-09-06', null, tag)
    out[tag + '|timeRange|both'] = formatTimeRange('10:00', '16:00', tag)
    out[tag + '|timeRange|open'] = formatTimeRange(null, '16:00', tag)
    for (let month = 0; month < 12; month += 1) {
      out[tag + '|monthShort|' + month] = monthName(month, tag, 'short')
      out[tag + '|monthLong|' + month] = monthName(month, tag, 'long')
    }
    for (let weekday = 0; weekday < 7; weekday += 1) {
      out[tag + '|weekdayShort|' + weekday] = weekdayName(weekday, tag, 'short')
      out[tag + '|weekdayLong|' + weekday] = weekdayName(weekday, tag, 'long')
    }
    for (const value of [0, 1, 999, 1000, 1234567, -1234.5, 0.5]) {
      out[tag + '|number|' + value] = formatNumber(value, tag)
    }
    for (const ratio of [0, 0.05, 0.425, 1]) {
      out[tag + '|percent|' + ratio] = formatPercent(ratio, tag)
    }
    out[tag + '|distance|metric'] = formatDistance(12500, 'metric', tag)
    out[tag + '|distance|imperial'] = formatDistance(12500, 'imperial', tag)
    out[tag + '|weight'] = formatWeight(2400, tag)
    for (const code of CODES) {
      for (const amount of AMOUNTS) {
        out[tag + '|money|' + code + '|' + amount] = formatMoneyMinor(amount, code, tag)
        out[tag + '|moneyPlain|' + code + '|' + amount] = formatMoneyMinorPlain(amount, code, tag)
      }
    }
    for (const elapsed of AGO) {
      out[tag + '|relative|' + elapsed] = formatRelative(new Date(NOW - elapsed).toISOString(), NOW, tag)
    }
    out[tag + '|list|1'] = formatList(['Anna'], tag)
    out[tag + '|list|2'] = formatList(['Anna', 'Iwo'], tag)
    out[tag + '|list|3'] = formatList(['Anna', 'Iwo', 'Marek'], tag)
    out[tag + '|list|4'] = formatList(['Anna', 'Iwo', 'Marek', 'Zofia'], tag)
    for (const count of COUNTS) {
      out[tag + '|plural|' + count] = pluralise(count, tag, FORMS)
    }
  }
  return out
}
`

/** The 23 tags, spelled here so a broken import cannot shrink the comparison. */
const LOCALE_COUNT = 23

/** Below this the probe has plainly not run: it produces thousands of fields. */
const MINIMUM_FIELDS = 5000

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

interface ProbeBundles {
  /** ES module, for the Worker. */
  readonly esm: string
  /** IIFE exposing `ptParity`, for `page.evaluate`. */
  readonly iife: string
}

type ProbeValues = Record<string, string | null>

/**
 * Bundles the probe twice from the same source, so neither runtime can be
 * accused of running different code from the other.
 *
 * `preserveEntrySignatures` is not optional here: an application build drops
 * entry exports and tree-shakes the whole module away, which produces a bundle
 * that throws `probe is not defined` on both sides and would otherwise look
 * like agreement.
 */
async function bundleProbe(): Promise<ProbeBundles> {
  const virtual = '\0pt-parity-probe'
  const result = await build({
    root: REPO_ROOT,
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: [
        { find: /^#\/(.*)$/, replacement: `${join(REPO_ROOT, 'src')}/$1` },
      ],
    },
    plugins: [
      {
        name: 'pt-parity-probe',
        resolveId: (id) => (id === 'pt-parity-probe' ? virtual : null),
        load: (id) => (id === virtual ? PROBE_SOURCE : null),
      },
    ],
    build: {
      write: false,
      minify: false,
      target: 'esnext',
      rollupOptions: {
        input: 'pt-parity-probe',
        preserveEntrySignatures: 'strict',
        output: [
          { format: 'es', entryFileNames: 'probe.mjs' },
          { format: 'iife', name: 'ptParity', entryFileNames: 'probe.iife.js' },
        ],
      },
    },
  })

  const outputs = Array.isArray(result) ? result : [result]
  const code = new Map<string, string>()
  for (const output of outputs) {
    if (!('output' in output)) {
      continue
    }
    for (const chunk of output.output) {
      if (chunk.type === 'chunk') {
        code.set(chunk.fileName, chunk.code)
      }
    }
  }
  const esm = code.get('probe.mjs')
  const iife = code.get('probe.iife.js')
  if (esm === undefined || iife === undefined) {
    throw new Error('the formatter probe did not bundle')
  }
  return { esm, iife }
}

/** Narrows a JSON body to the probe's shape without trusting it. */
function asProbeValues(body: unknown, source: string): ProbeValues {
  if (typeof body !== 'object' || body === null) {
    throw new Error(`${source} did not answer with a record of fields`)
  }
  const values: ProbeValues = {}
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string' && value !== null) {
      throw new Error(`${source} answered a non-string for ${key}`)
    }
    values[key] = value
  }
  return values
}

/** Runs the probe in real workerd and hands back what the Worker would render. */
async function readFromWorker(esm: string): Promise<ProbeValues> {
  const directory = mkdtempSync(join(tmpdir(), 'pt-i18n-parity-'))
  let worker: Unstable_DevWorker | undefined
  try {
    const entry = join(directory, 'worker.mjs')
    writeFileSync(
      entry,
      `${esm}\nexport default { fetch: () => Response.json(probe()) }\n`,
    )
    writeFileSync(
      join(directory, 'wrangler.json'),
      JSON.stringify({
        name: 'pt-i18n-parity',
        main: 'worker.mjs',
        compatibility_date: '2026-08-15',
      }),
    )
    worker = await unstable_dev(entry, {
      config: join(directory, 'wrangler.json'),
      experimental: {
        disableExperimentalWarning: true,
        disableDevRegistry: true,
      },
      logLevel: 'none',
      bundle: false,
    })
    const response = await worker.fetch('http://parity.invalid/')
    return asProbeValues(await response.json(), 'the Worker')
  } finally {
    await worker?.stop()
    rmSync(directory, { recursive: true, force: true })
  }
}

test.describe('locale formatting agrees between the Worker and the browser', () => {
  // The bundle, the workerd session and 5,700 comparisons; a cold `wrangler`
  // start alone can take a few seconds on a loaded machine.
  test.setTimeout(180_000)

  test('every formatted field is byte-identical in both runtimes', async ({
    page,
    browserName,
  }) => {
    const { esm, iife } = await bundleProbe()
    const server = await readFromWorker(esm)

    // A real document of ours rather than `about:blank`, so the comparison runs
    // in the same engine and the same context the product hydrates in.
    await page.goto('/', { waitUntil: 'commit' })
    const client = asProbeValues(
      await page.evaluate<unknown>(
        `(() => { ${iife}; return ptParity.probe() })()`,
      ),
      browserName,
    )

    const serverKeys = Object.keys(server)
    expect(
      serverKeys.length,
      'the probe produced far fewer fields than it should, so it did not run',
    ).toBeGreaterThan(MINIMUM_FIELDS)
    expect(Object.keys(client).sort()).toEqual([...serverKeys].sort())

    const locales = new Set(serverKeys.map((key) => key.split('|')[0]))
    expect(locales.size, 'every shipped locale is compared').toBe(LOCALE_COUNT)

    const divergences = serverKeys
      .filter((key) => server[key] !== client[key])
      .map(
        (key) =>
          `${key}: worker ${JSON.stringify(server[key])} vs ${browserName} ${JSON.stringify(client[key])}`,
      )

    expect(
      divergences,
      'a locale-dependent string differs between the runtime that renders it and the runtime that hydrates it. docs/SPEC.md §8.5: freeze the field in src/lib/format-tables.ts, never widen a tolerance.',
    ).toEqual([])
  })
})
