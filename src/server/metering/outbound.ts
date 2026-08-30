/**
 * `callProvider` — the one wrapper every outbound third-party call goes through.
 *
 * It exists so that "an outbound call is a counted call" is a property of the code rather than a
 * habit. A call site hands it a label and a thunk; it consults the provider's gate, runs the thunk,
 * and records the attempt. Forgetting to count is not available, because there is nothing to
 * forget: the counting is on the path the call already takes.
 *
 * ## Why not `src/server/queue/http.ts`
 *
 * Three reasons, and each is checkable. That module classifies a *response* and never sees the
 * request, so it cannot count a call that threw before a response existed — and a timeout is a
 * real, billable call at most vendors. `src/server/billing/polar.ts` does not import it at all and
 * runs its own retry loop, so wrapping it would leave a third of the traffic uncounted. And it is a
 * pure function library with no database and no `waitUntil`, which is most of its value.
 *
 * ## The cost, which is the point
 *
 * **A provider with no agreed ceiling, or one whose policy is `allow`, never touches
 * `provider_usage` on the caller's path.** The expensive read is the live `SUM` over usage rows,
 * and it is paid only where an operator has explicitly asked for a hard stop. What such a provider
 * does cost is one small indexed read of its own registry row — including the read that discovers
 * there is no row — and that result, being configuration rather than a counter, is memoised per
 * isolate for {@link LIMIT_MEMO_TTL_MS}. So the steady-state cost of metering an uncapped provider
 * is one row read per provider per minute per isolate, and the counter write.
 *
 * That split is exactly the one `docs/ARCHITECTURE.md` §4 already draws between plan state and
 * usage, and its rule 1 is why the *counter* is never memoised: "A cached count would let a tenant
 * burst past a quota inside the cache window, which is the one thing the quota system exists to
 * prevent."
 *
 * ## Two postures, and they are opposite on purpose
 *
 * **Recording fails open and silent.** A counter that throws would turn a metering fault into a
 * failed signup email, so every recording failure is swallowed and logged
 * (`src/server/catalog/provider-usage.ts` owns that posture).
 *
 * **The gate fails open too.** Only a *successful* read saying the ceiling is spent closes it. A D1
 * hiccup must not stop transactional email, and a metering layer that can take the product down is
 * worse than no metering layer.
 *
 * ## Where a Durable Object would go
 *
 * Nowhere yet: today's outbound traffic is queue-paced, at most a handful of writes an hour. The
 * per-keystroke path is scheduled rather than hypothetical — ADR 0013 buys geocoding from Geoapify
 * and names address completion as its real consumer, on a **daily** allowance — so this is a note
 * with a date on it. When that lands, the change is confined to the two helpers below.
 * `record` becomes a call to a Durable Object that accumulates in memory and flushes to
 * `provider_usage` on an alarm, and the gate reads that object's running total instead of D1.
 * {@link callProvider}'s signature, every call site and both tables are unchanged, which is why
 * this can wait until there is traffic that needs it.
 */

import {
  PLATFORM_SYSTEM_ACTOR,
  readProviderGate,
  readProviderLimit,
  recordProviderCall,
} from '#/server/catalog/provider-usage'
import { ProviderBlockedError } from './errors'
import type { ProviderCallOutcome } from '#/server/catalog/provider-usage'
import type {
  Database,
  MeteredProvider,
  ProviderRegistryRow,
} from '#/server/db/types'
import type { Logger } from '#/server/observability'

/**
 * How long a provider's ceiling and policy are trusted without re-reading.
 *
 * The same sixty seconds `docs/ARCHITECTURE.md` §4 gives the plan-state key, and for the same
 * reason: only an operator changes it, and the window bounds how long a newly-set ceiling takes to
 * bite. It is a bound on *configuration* staleness, never on a count.
 */
export const LIMIT_MEMO_TTL_MS = 60_000

/**
 * Everything {@link callProvider} needs from the outside world, injected rather than imported.
 *
 * `cloudflare:workers` cannot be imported in the `server` Vitest project at all, so a module that
 * reached for a binding itself could not be driven with a fake one — the same constraint that makes
 * `src/server/fns/console/bindings.ts` a single seam, and the same shape `TilesRuntime` uses in
 * `src/routes/api/tiles/-lib/serve.ts`. `./bindings` is where the real values come from.
 */
export interface OutboundRuntime {
  /**
   * `null` when the caller has no database handle — a queue handler running without the `DB`
   * binding, or a unit test. The meter then no-ops and the gate stays open: metering is never a
   * reason a call does not happen.
   */
  readonly db: Database | null
  readonly waitUntil: (promise: Promise<unknown>) => void
  readonly logger: Logger
  readonly now: () => Date
}

export interface ProviderCallLabel {
  readonly provider: MeteredProvider
  /** What was asked of the vendor: `email.send`, `pdf.render`, `api.request`. */
  readonly operation: string
  /** The workspace the call was made for, or `null`/absent for the platform itself. */
  readonly organizationId?: string | null
}

/**
 * Whether a *returned* result counts as a failed call.
 *
 * It has to be asked, because `fetch` does not throw on a 4xx or a 5xx: without this, a provider
 * answering 401 all day would be recorded as a day of successful calls, and the console's "failed
 * calls" tile would read zero while nothing worked. That is the one failure mode a meter must not
 * have — a wrong number that looks like a healthy one.
 *
 * The default recognises a `Response` by shape rather than by `instanceof`, so a call site cannot
 * forget to classify one. `instanceof Response` is unreliable here: the `server` Vitest project and
 * workerd do not always share a constructor, and a mismatch would silently disable the check in
 * exactly the place the tests run. A call site whose result is not a `Response` can pass its own
 * predicate; one that returns something with no notion of failure gets `false`, and only a throw
 * counts.
 */
type FailureCheck<T> = (result: T) => boolean

function looksFailed(result: unknown): boolean {
  // No casts anywhere below: each `in` narrows the value for the clauses after it, which is also
  // what makes the order load-bearing — read as a chain, not as a set of independent conditions.
  return (
    typeof result === 'object' &&
    result !== null &&
    'ok' in result &&
    typeof result.ok === 'boolean' &&
    'status' in result &&
    typeof result.status === 'number' &&
    !result.ok
  )
}

interface MemoEntry {
  readonly row: ProviderRegistryRow | null
  readonly readAt: number
}

const limitMemo = new Map<MeteredProvider, MemoEntry>()

/** Test seam: the memo is isolate-global, so a test that sets a ceiling must be able to clear it. */
export function resetProviderLimitMemo(): void {
  limitMemo.clear()
}

async function memoisedLimit(
  db: Database,
  provider: MeteredProvider,
  nowMs: number,
): Promise<ProviderRegistryRow | null> {
  const cached = limitMemo.get(provider)
  if (cached !== undefined && nowMs - cached.readAt < LIMIT_MEMO_TTL_MS) {
    return cached.row
  }
  const row = await readProviderLimit(db, provider)
  limitMemo.set(provider, { row, readAt: nowMs })
  return row
}

/**
 * The gate, or `null` when there is nothing to enforce and therefore nothing to read.
 *
 * Returning early on `policy === 'allow'` and on a `null` ceiling is what keeps the common path
 * free. It is also why a provider is never blocked by accident: the only way to reach the usage
 * query is a row that names a number *and* says to refuse.
 */
async function shutGate(
  runtime: OutboundRuntime,
  label: ProviderCallLabel,
  at: Date,
): Promise<ProviderBlockedError | null> {
  const db = runtime.db
  if (db === null) {
    return null
  }

  try {
    const limit = await memoisedLimit(db, label.provider, at.getTime())
    if (
      limit === null ||
      limit.policy !== 'block' ||
      limit.callLimit === null
    ) {
      return null
    }

    const gate = await readProviderGate(db, label.provider, at, limit)
    if (gate.allowed) {
      return null
    }

    return new ProviderBlockedError({
      provider: label.provider,
      operation: label.operation,
      callLimit: gate.callLimit ?? 0,
      used: gate.used,
      limitWindow: gate.limitWindow,
    })
  } catch (cause) {
    // Fails open, deliberately and loudly. A metering read that cannot answer must not be the
    // reason a customer's email does not send.
    runtime.logger.warn('provider gate unavailable; allowing the call', {
      provider: label.provider,
      operation: label.operation,
      errorMessage: cause instanceof Error ? cause.message : String(cause),
    })
    return null
  }
}

function record(
  runtime: OutboundRuntime,
  label: ProviderCallLabel,
  outcome: ProviderCallOutcome,
  at: Date,
): void {
  const db = runtime.db
  if (db === null) {
    return
  }

  // Handed to `waitUntil` with its own terminal `.catch()`: the promise must never surface as an
  // unhandled rejection, and it must never be awaited on the caller's path.
  runtime.waitUntil(
    recordProviderCall(
      db,
      PLATFORM_SYSTEM_ACTOR,
      {
        provider: label.provider,
        operation: label.operation,
        organizationId: label.organizationId ?? null,
        outcome,
        at,
      },
      runtime.logger,
    ).catch(() => undefined),
  )
}

/**
 * Runs `send` behind the provider's gate and counts the attempt.
 *
 * Generic in `T` rather than fixed to `Response`, so the same function wraps a bare `fetch` and one
 * attempt of a client that retries internally. Wrapping a single *attempt* is the correct unit for
 * a bill: the vendor's own meter sees three attempts, so ours must too.
 *
 * Throws {@link ProviderBlockedError} before `send` is called when a blocking ceiling is spent —
 * before, so a refused call costs the vendor nothing and is recorded as demand rather than usage.
 * It never throws for any metering reason of its own.
 *
 * A returned `Response` with a non-2xx status is counted as a failed call as well as a call, which
 * is why {@link FailureCheck} exists: `fetch` resolves such a response rather than throwing.
 */
export async function callProvider<T>(
  runtime: OutboundRuntime,
  label: ProviderCallLabel,
  send: () => Promise<T>,
  isFailure: FailureCheck<T> = looksFailed,
): Promise<T> {
  const at = runtime.now()

  const blocked = await shutGate(runtime, label, at)
  if (blocked !== null) {
    record(runtime, label, 'blocked', at)
    throw blocked
  }

  try {
    const result = await send()
    // Either way it is a call the vendor received and will bill for; `errors` narrows `calls`, it
    // never replaces it.
    record(runtime, label, isFailure(result) ? 'error' : 'ok', at)
    return result
  } catch (cause) {
    // A throw still reached the vendor often enough to be billable — a timeout is the ordinary
    // case — so it counts as a call, and as an error beside it.
    record(runtime, label, 'error', at)
    throw cause
  }
}
