import { and, eq } from "drizzle-orm";
import { trips, tripMembers, type Database } from "@planned/db";

export type TripRole = "owner" | "editor" | "viewer";

export interface TripAccess {
  trip: typeof trips.$inferSelect;
  role: TripRole;
}

/**
 * Resolve a trip a user may SEE on the server side: owner, or an explicit
 * trip_member row (editor/viewer). Mirrors the Hono `getAccessibleTrip` so SSR
 * pages and the API agree on who can open a shared trip. Returns null when the
 * trip doesn't exist or the user has no access (caller should redirect away).
 */
export async function resolveTripAccess(
  database: Database,
  tripId: string,
  userId: string,
): Promise<TripAccess | null> {
  const [tripRow, memberRow] = await Promise.all([
    database.select().from(trips).where(eq(trips.id, tripId)).limit(1),
    database
      .select({ role: tripMembers.role })
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))
      .limit(1),
  ]);
  const trip = tripRow[0];
  if (!trip) return null;
  const role: TripRole | null =
    trip.ownerId === userId ? "owner" : (memberRow[0]?.role as TripRole | undefined) ?? null;
  if (!role) return null;
  return { trip, role };
}

/** Owner or editor may mutate trip data (used to gate mutation UI server-side). */
export function canEditTrip(role: TripRole | null | undefined): boolean {
  return role === "owner" || role === "editor";
}
