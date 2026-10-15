/** Monthly accepted export requests. Access and role precede every reservation. */
import { UNLIMITED } from '#/server/db/types'
import { assertQuota, resolveQuotas } from './base'
import { bumpUsage, getMonthlyUsage } from './billing'
import { isUniqueConstraintViolation } from './context'
import { assertTripRole, requireTrip } from './trips'
import type { TenantScope } from './base'

export async function reserveExport(
  scope: TenantScope,
  tripId: string,
  { month }: { month: string },
) {
  await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, ['owner', 'editor'])
  const bump = () => bumpUsage(scope, 'exports', 1, month)
  const row = await bump().catch((cause: unknown) => {
    if (!isUniqueConstraintViolation(cause)) throw cause
    return bump()
  })
  try {
    await assertQuota(scope, 'exports', row.value - 1)
  } catch (cause) {
    // Any failure after a successful bump owns one unit, including a failed quota lookup.
    await releaseExport(scope, { month }).catch(() => undefined)
    throw cause
  }
  return { used: row.value, month }
}

export function releaseExport(
  scope: TenantScope,
  { month }: { month: string },
) {
  return bumpUsage(scope, 'exports', -1, month)
}

export async function exportAllowance(
  scope: TenantScope,
  { month }: { month: string },
) {
  const [usage, quotas] = await Promise.all([
    getMonthlyUsage(scope, month),
    resolveQuotas(scope),
  ])
  return {
    used: usage.get('exports') ?? 0,
    limit: quotas.limits.exports === UNLIMITED ? null : quotas.limits.exports,
  }
}
