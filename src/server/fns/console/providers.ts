/**
 * The provider screen's server surface: what each vendor has been called for, and what stops it.
 *
 * Plain `async function`s, never `createServerFn` — a nested one compiles to an RPC stub the build
 * never registers and throws `Server function info not found` in the deployed Worker. The single
 * `createServerFn` on this path lives in `src/routes/_app/console/-server/providers.ts`.
 *
 * Both halves go through `openConsoleCall`, which is `requirePermission` and nothing else: the read
 * asks for `provider:read`, the write for `provider:configure`, and neither re-tests a role name.
 * The write also appends a `platform_audit_log` row in the same call, which is what docs/SPEC.md §5
 * requires of every mutation against a global table — the meter tick is the one exception, and §5's
 * amendment argues it rather than extending it here.
 */

import { z } from 'zod'
import { PLATFORM_ACTIONS } from '#/server/catalog/audit'
import {
  UNBLOCKABLE_PROVIDERS,
  readProviderLimit,
  readProviderUsage,
  updateProviderLimit,
} from '#/server/catalog/provider-usage'
import {
  METERED_PROVIDERS,
  PLANNED_PROVIDERS,
  PROVIDER_LIMIT_POLICIES,
  PROVIDER_LIMIT_WINDOWS,
} from '#/server/db/schema'
import { openConsoleCall, recordConsoleAction } from './context'
import { platformDb } from './bindings'
import type { ProviderUsageReport } from '#/server/catalog/provider-usage'
import type {
  MeteredProvider,
  ProviderLimitPolicy,
  ProviderLimitWindow,
} from '#/server/db/types'

/** How much history the screen draws. Thirty days of hourly points. */
const WINDOW_HOURS = 720

/**
 * A provider row as the screen renders it.
 *
 * `integrated: false` is the whole reason this type is not just {@link ProviderUsageReport}. A
 * provider with no client behind it has no counts, and `0` would say it was called zero times —
 * the opposite fact. The flag lets the screen draw an empty state that names what is missing.
 */
export interface ProviderPanel {
  readonly slug: string
  readonly integrated: boolean
  readonly label: string | null
  readonly callLimit: number | null
  readonly limitWindow: ProviderLimitWindow
  readonly policy: ProviderLimitPolicy
  readonly warnPercent: number
  readonly criticalPercent: number
  /** False forbids `block`; the console explains rather than hides the control. */
  readonly blockable: boolean
  readonly monthToDate: number
  readonly series: ReadonlyArray<{
    readonly bucket: string
    readonly calls: number
  }>
  readonly errors: number
  readonly blocked: number
  readonly workspaces: ReadonlyArray<{
    readonly organizationId: string | null
    readonly calls: number
  }>
  readonly measuringSince: string | null
}

export interface ProvidersView {
  /** The instant every derived number on the screen is computed against. */
  readonly asOf: number
  readonly providers: ReadonlyArray<ProviderPanel>
  readonly canConfigure: boolean
}

function plannedPanel(slug: string): ProviderPanel {
  return {
    slug,
    integrated: false,
    label: null,
    callLimit: null,
    limitWindow: 'month',
    policy: 'allow',
    warnPercent: 70,
    criticalPercent: 90,
    blockable: !UNBLOCKABLE_PROVIDERS.has(slug),
    monthToDate: 0,
    series: [],
    errors: 0,
    blocked: 0,
    workspaces: [],
    measuringSince: null,
  }
}

function meteredPanel(
  provider: MeteredProvider,
  report: ProviderUsageReport,
): ProviderPanel {
  const limit = report.limit
  return {
    slug: provider,
    integrated: true,
    label: limit?.label ?? null,
    callLimit: limit?.callLimit ?? null,
    limitWindow: limit?.limitWindow ?? 'month',
    policy: limit?.policy ?? 'allow',
    warnPercent: limit?.warnPercent ?? 70,
    criticalPercent: limit?.criticalPercent ?? 90,
    blockable: limit?.blockable ?? !UNBLOCKABLE_PROVIDERS.has(provider),
    monthToDate: report.monthToDate,
    series: report.series.map((point) => ({
      bucket: point.bucket,
      calls: point.calls,
    })),
    errors: report.series.reduce((total, point) => total + point.errors, 0),
    blocked: report.series.reduce((total, point) => total + point.blocked, 0),
    workspaces: report.workspaces,
    measuringSince: report.measuringSince,
  }
}

/**
 * Every provider the console lists, integrated or not, with its counters and ceiling.
 *
 * `asOf` is returned rather than read from the browser's clock, and that is a hard requirement
 * rather than tidiness: `auditServerClock` in `e2e/visual.spec.ts` runs over every console route
 * and fails a screen whose output depends on when it was rendered.
 */
export async function readProviders(): Promise<ProvidersView> {
  const call = await openConsoleCall({ provider: ['read'] })
  const now = new Date()
  const since = new Date(now.getTime() - WINDOW_HOURS * 60 * 60 * 1000)
  const db = platformDb()

  const reports = await Promise.all(
    METERED_PROVIDERS.map(async (provider) =>
      meteredPanel(
        provider,
        await readProviderUsage(db, call.session, { provider, since, now }),
      ),
    ),
  )

  return {
    asOf: now.getTime(),
    providers: [...reports, ...PLANNED_PROVIDERS.map(plannedPanel)],
    // Asked as a question here so the screen renders the controls the caller may actually use;
    // every save re-asks it as an assertion, which is the boundary.
    canConfigure: await openConsoleCall({ provider: ['configure'] })
      .then(() => true)
      .catch(() => false),
  }
}

export const saveProviderLimitInput = z.object({
  slug: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  limitWindow: z.enum(PROVIDER_LIMIT_WINDOWS),
  callLimit: z.number().int().nonnegative().nullable(),
  policy: z.enum(PROVIDER_LIMIT_POLICIES),
  warnPercent: z.number().int().min(1).max(100),
  criticalPercent: z.number().int().min(1).max(100),
  notes: z.string().max(500).nullable(),
})

export type SaveProviderLimitInput = z.infer<typeof saveProviderLimitInput>

/**
 * Creates or moves one provider's ceiling, and records what changed.
 *
 * Two audit rows are possible from one save and both are written when both facts changed, because
 * they answer different questions a year later: `provider.limit_changed` is a number moving, and
 * `provider.policy_changed` is the difference between billing through a ceiling and refusing calls
 * at it. Collapsing them would make the second invisible inside the first.
 */
export async function saveProviderLimit(
  input: SaveProviderLimitInput,
): Promise<ProviderPanel> {
  const call = await openConsoleCall({ provider: ['configure'] })
  const values = saveProviderLimitInput.parse(input)
  const db = platformDb()

  const before = await readProviderLimit(db, values.slug as MeteredProvider)
  const { after } = await updateProviderLimit(db, call.session, values)

  // A first-ever configuration counts as the limit moving: going from "no ceiling agreed" to a
  // number is the change most worth being able to find in the log a year later.
  const limitMoved =
    before === null ||
    before.callLimit !== after.callLimit ||
    before.limitWindow !== after.limitWindow

  if (limitMoved) {
    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.PROVIDER_LIMIT_CHANGED,
      // No `entityType`: `entityTypeForAction` derives it from the prefix, which is what makes
      // "the prefix names the entity" true of the rows rather than only of docs/ACCESS.md §4.2.
      entityId: after.slug,
      changes: {
        callLimit: { from: before?.callLimit ?? null, to: after.callLimit },
        limitWindow: {
          from: before?.limitWindow ?? null,
          to: after.limitWindow,
        },
      },
    })
  }

  if ((before?.policy ?? 'allow') !== after.policy) {
    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.PROVIDER_POLICY_CHANGED,
      entityId: after.slug,
      changes: {
        policy: { from: before?.policy ?? 'allow', to: after.policy },
      },
    })
  }

  const report = await readProviderUsage(db, call.session, {
    provider: values.slug as MeteredProvider,
    since: new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000),
  })

  return meteredPanel(values.slug as MeteredProvider, report)
}
