import type { TripRole } from './trips'

/**
 * Trip roles that may change a trip's content: its plan, bookings, transports, money, files,
 * conversation and exports. A `viewer` reads the trip, and so does a workspace member who only sees
 * an organization-visible one (`CONTEXT.md`, "Trip member").
 *
 * The one place the "owner or editor may write" rule is spelled (`docs/SPEC.md` §8, one concept, one
 * owner); every writer hands it to {@link assertTripRole} and every write control reads it through
 * {@link isTripWriteRole}, so the plan and the ledger cannot disagree about who may write the day
 * the roles change. Owner-only verbs (lifecycle, guests, people) are a different rule and name
 * `['owner']` themselves.
 *
 * Public through `trips.ts`, which owns the guard. It is declared here, in a module with no runtime
 * imports, because `trips.ts` reaches `expenses.ts` through an import cycle: a constant that
 * `expenses.ts` aliases at module scope would still be uninitialised when that module evaluates if
 * it were declared in `trips.ts` itself.
 */
export const TRIP_WRITE_ROLES: ReadonlyArray<TripRole> = ['owner', 'editor']

/**
 * Whether a stored trip role is one of {@link TRIP_WRITE_ROLES}. Pure and role-only: it knows
 * nothing about archiving, which is the trip's property, not the role's. `null` is no membership and
 * an unknown string is no role; both are refused.
 */
export function isTripWriteRole(role: string | null): boolean {
  return TRIP_WRITE_ROLES.some((allowed) => allowed === role)
}
