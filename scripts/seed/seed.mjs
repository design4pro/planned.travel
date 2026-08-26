#!/usr/bin/env node

/**
 * Demo-data seeder.
 *
 *   node scripts/seed/seed.mjs [--force] [--email <address>] [--url <origin>] [--today <day>] [--status]
 *
 * The seed itself runs *inside* the Worker, at `POST /api/dev/seed`, because that is the only place
 * the D1 binding, the Drizzle client and the tenant repositories all exist at once. This script is
 * only the trigger: it finds the running dev server, posts to the endpoint, and prints the report.
 *
 * See ./README.md for what gets written and how to verify it.
 */

/**
 * Origins probed when neither `--url` nor `$SEED_URL` says where the server is.
 *
 * Two ranges, in this order and for two different readers. 3000-3005 is where `vite dev` lands for a
 * person working on the project, and it is tried first because that person did not pass a flag.
 * 3010-3020 is the range `playwright.config.ts` reserves for an automated round and refuses to run
 * outside of; a round that seeds without `--url` should still find its own server rather than
 * silently rebuild somebody else's workspace, which is the accident the port guard exists to stop.
 *
 * Neither range is safe to guess at when two checkouts are up at once. Pass `--url` — the reserved
 * range in particular is shared between worktrees, and this script has no way to tell one from
 * another.
 */
const DEFAULT_PORTS = [3000, 3001, 3002, 3003, 3004, 3005, 3010, 3011, 3012, 3013, 3014, 3015]

/**
 * Password for the demo owner's account, used only when that account does not exist yet.
 *
 * This is a fixture credential for a local database, not a secret: it is committed on purpose so
 * that a fresh clone can reach the authenticated screens with one command, and so the e2e suite has
 * a deterministic account to sign in as. Override it with DEMO_PASSWORD (or E2E_PASSWORD) if you
 * would rather it were not written down. Nothing reachable from a production build reads it —
 * `/api/dev/seed` is compiled out by `import.meta.env.DEV`.
 */
const DEFAULT_DEMO_PASSWORD = 'planned-demo-2026'

function demoPassword(explicit) {
  return explicit ?? process.env.DEMO_PASSWORD ?? process.env.E2E_PASSWORD ?? DEFAULT_DEMO_PASSWORD
}
const ENDPOINT = '/api/dev/seed'

/**
 * The header `serverToday()` reads on a development request, and the whole of `--today`.
 *
 * The seeded rows must not depend on what day the Worker thinks it is: every date the fixture writes
 * is an offset from the anchor in `src/routes/api/dev/-seed/dataset/anchor.ts`, and nothing in the
 * seed path reads a clock. `--today` is how that claim is falsifiable rather than merely asserted —
 * seed under three widely separated days, run the visual gate against the same baselines after each,
 * and a fixture that had smuggled a clock in shows up as a red frame.
 */
const SERVER_TODAY_HEADER = 'x-pt-server-today'
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/
const PROBE_TIMEOUT_MS = 1500
const SEED_TIMEOUT_MS = 300_000

function out(text) {
  process.stdout.write(`${text}\n`)
}

function fail(text) {
  process.stderr.write(`${text}\n`)
  process.exitCode = 1
}

function parseArgs(argv) {
  const options = {
    force: false,
    status: false,
    email: null,
    url: null,
    password: null,
    keepPassword: false,
    today: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--force' || arg === '-f') {
      options.force = true
    } else if (arg === '--status' || arg === '-s') {
      options.status = true
    } else if (arg === '--email' || arg === '-e') {
      index += 1
      options.email = argv[index] ?? null
    } else if (arg === '--today' || arg === '-t') {
      index += 1
      options.today = argv[index] ?? null
      if (options.today === null || !CALENDAR_DAY.test(options.today)) {
        throw new Error('--today needs a calendar day, as YYYY-MM-DD.')
      }
    } else if (arg === '--keep-password') {
      options.keepPassword = true
    } else if (arg === '--password' || arg === '-p') {
      index += 1
      options.password = argv[index] ?? null
    } else if (arg === '--url' || arg === '-u') {
      index += 1
      options.url = argv[index] ?? null
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

/** True when this origin answers the seed endpoint's GET probe. */
async function responds(origin) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const response = await fetch(`${origin}${ENDPOINT}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) return false
    const body = await response.json()
    return body?.ok === true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Locates the dev server. An explicit `--url` or `SEED_URL` wins; otherwise the usual Vite ports are
 * probed in order, because `vite dev` silently moves to the next free port when 3000 is taken.
 */
async function findOrigin(explicit) {
  const configured = explicit ?? process.env.SEED_URL ?? null
  if (configured !== null) {
    const origin = configured.replace(/\/+$/, '')
    if (await responds(origin)) return origin
    throw new Error(
      `${origin}${ENDPOINT} did not answer. Is the dev server running there, and is it a dev build?`,
    )
  }

  for (const port of DEFAULT_PORTS) {
    const origin = `http://localhost:${port}`
    if (await responds(origin)) return origin
  }
  throw new Error(
    `No dev server answered ${ENDPOINT} on ports ${DEFAULT_PORTS.join(', ')}.\n` +
      'Start one with `pnpm exec vite dev --port 3010 --strictPort`, or pass\n' +
      '--url http://localhost:<port>. Note that `pnpm dev` hardcodes --port 3000, which\n' +
      'playwright.config.ts refuses to run the visual gate against.',
  )
}

function formatCounts(counts) {
  const rows = Object.entries(counts).filter(([key]) => key !== 'tripId')
  return rows.map(([key, value]) => `${key} ${value}`).join(' · ')
}

/** Plain English for what the seed did to the owner's password. */
function describeCredential(report) {
  if (report.createdOwner === true) return 'account created — sign in with the seed password'
  switch (report.credential) {
    case 'created':
      return 'credential added to an existing account — sign in with the seed password'
    case 'reset':
      return 'reset to the seed password'
    case 'unchanged':
      return 'already the seed password'
    default:
      return 'left as it was (--keep-password, or no password supplied)'
  }
}

/**
 * The platform standing the fixture writes, printed so the console's claims can be checked by hand.
 *
 * A hint, not a source of truth: `PLATFORM_STANDING` in `src/routes/api/dev/-seed/bootstrap.ts` is
 * what actually writes these, and the addresses come from the dataset beside it. It is repeated here
 * because the seed report is the only place anybody is told the fixture exists, and a console that
 * ships three roles has two of them that can only be *observed* by signing in as them — a curator
 * seeing the catalogue and no accounts tab, and a plain user being turned away from `/console`
 * altogether. All four share the password above.
 */
const PLATFORM_FIXTURE = [
  ['rafal@planned.travel', 'admin — opens /console and every account action'],
  ['mika@planned.travel', 'curator — the catalogue only, no accounts tab'],
  ['jonas@planned.travel', 'user — /console redirects to /dashboard'],
  ['priya@planned.travel', 'user, suspended — sign-in is refused with the repo copy'],
]

function printPlatformFixture() {
  out('')
  out('  Platform console')
  for (const [email, standing] of PLATFORM_FIXTURE) {
    out(`    ${email.padEnd(22)} ${standing}`)
  }
  out('    Every one of them signs in with the seed password.')
}

function printReport(report) {
  if (report.skipped) {
    out('Already seeded — nothing to do.')
    out(`  dataset version  ${report.datasetVersion}`)
    out(`  organization     ${report.organizationId}`)
    // The password is reconciled before the marker check, so it is up to date even
    // on a run that wrote no data — which is the run people make most often.
    out(`  owner            ${report.ownerEmail}`)
    out(`  password         ${describeCredential(report)}`)
    printPlatformFixture()
    out('')
    out('Re-run with --force to rebuild the demo workspace from the dataset.')
    return
  }

  out('Seeded.')
  out('')
  out(`  workspace        ${report.organizationId}`)
  out(`  owner            ${report.ownerEmail} (${report.ownerUserId})`)
  out(`  password         ${describeCredential(report)}`)
  out(`  members          ${report.members} (${report.usersCreated} user rows created)`)
  out(`  categories       ${report.categories}`)
  out(`  moods            ${report.moods}`)
  printPlatformFixture()
  out('')
  out('  Trips')
  for (const trip of report.trips) {
    out(`    ${trip.slug}`)
    // The id is printed rather than hidden: it is fixed by the dataset, and a run that prints a
    // different one from the last has repainted every cover in the product. See ./README.md.
    out(`      id  ${trip.counts.tripId}`)
    out(`      ${formatCounts(trip.counts)}`)
  }
  out('')
  out('  Totals')
  for (const [key, value] of Object.entries(report.totals)) {
    out(`    ${key.padEnd(16)} ${value}`)
  }
  out('')
  out('  Workspace')
  for (const key of [
    'journeys',
    'journeyEntries',
    'journeyPhotos',
    'collections',
    'collectionPlaces',
    'visitedCountries',
    'visitedRegions',
    'bucketListItems',
    'vacayEntries',
    'companyHolidays',
    'notifications',
    'auditEntries',
  ]) {
    out(`    ${key.padEnd(18)} ${report[key]}`)
  }
  out('')
  out(`  done in ${report.durationMs}ms`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help === true) {
    out(
      'Usage: node scripts/seed/seed.mjs [--force] [--email <address>] [--password <secret>]',
    )
    out('                [--keep-password] [--url <origin>] [--today <YYYY-MM-DD>] [--status]')
    out('')
    out('  --force     Rebuild the demo workspace even if it has already been seeded.')
    out('  --email     Workspace owner to seed. Defaults to rafal@planned.travel.')
    out('  --password  Password the owner account should have. Created when the account does not')
    out('              exist, reconciled when it does, left alone when it already works. Defaults')
    out('              to $DEMO_PASSWORD, then $E2E_PASSWORD, then the committed fixture.')
    out('  --keep-password  Never overwrite a password that is already set.')
    out('  --url       Dev-server origin. Defaults to $SEED_URL, then localhost:3000-3005 and')
    out('              the reserved automation range, localhost:3010-3015.')
    out('  --today     Tell the Worker what day it is for the duration of the seed request, as')
    out('              YYYY-MM-DD. The fixture is anchored, so the rows written must not change;')
    out('              this exists so that claim can be tested rather than trusted.')
    out('  --status    Report whether the workspace is seeded, and write nothing.')
    return
  }

  const origin = await findOrigin(options.url)
  const url = new URL(`${origin}${ENDPOINT}`)
  if (options.email !== null) url.searchParams.set('email', options.email)
  if (options.force) url.searchParams.set('force', '1')

  const clockPin = options.today === null ? {} : { [SERVER_TODAY_HEADER]: options.today }

  if (options.status) {
    const response = await fetch(url, { headers: { accept: 'application/json' } })
    const body = await response.json()
    out(body.seeded ? 'Seeded.' : 'Not seeded.')
    if (body.marker !== null) out(JSON.stringify(body.marker, null, 2))
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEED_TIMEOUT_MS)
  let body
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', ...clockPin },
      // In the body, not the query string, so it stays out of request logs.
      body: JSON.stringify({
        password: demoPassword(options.password),
        keepPassword: options.keepPassword,
      }),
      signal: controller.signal,
    })
    body = await response.json()
    if (!response.ok || body?.ok !== true) {
      fail(`Seed failed (HTTP ${response.status}): ${body?.error ?? 'unknown error'}`)
      return
    }
  } finally {
    clearTimeout(timer)
  }

  await dropCachedVisualSession()
  printReport(body)
}

/**
 * A rebuild mints a new organization id, so any session cached from the previous dataset now
 * points at a membership that no longer exists. Playwright caches exactly one such session in
 * `e2e/.auth/demo.json`, and a run that inherits it does not skip - it renders a 500 on the first
 * authenticated route and reports it as a failing route.
 *
 * That cost a full round: two items were rejected on a visual gate that was measuring a stale
 * cookie rather than the code under test. Deleting the file here, rather than asking every caller
 * to remember, is the mechanical version of the instruction.
 *
 * It runs on **every** seed rather than only on `--force`, which it did not used to. The seed now
 * writes the demo owner's platform role (`applyPlatformStanding` in
 * `src/routes/api/dev/-seed/bootstrap.ts`), and a role is not only a column: Better Auth's
 * secondary storage keeps a copy of the whole `user` row inside each cached session blob, and
 * `findSession` answers from that blob in preference to D1. A direct role write leaves every
 * already-minted session carrying the role the account held *before* it, for up to the session's
 * thirty-day lifetime - so a warm reseed followed by a run that reuses the cached cookie would
 * photograph `/console` redirecting to `/dashboard` and report it as a broken guard. Dropping the
 * file forces one fresh sign-in, which reads the row and writes a blob that agrees with it.
 */
async function dropCachedVisualSession() {
  const { rm } = await import('node:fs/promises')
  await rm('e2e/.auth/demo.json', { force: true })
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
