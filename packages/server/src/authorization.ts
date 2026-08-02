import { and, eq } from "drizzle-orm";
import { trips, tripMembers } from "@planned/db";
import type { AppContext } from "./context";
import { forbidden, notFound } from "./errors";

export type TripAccess = { trip: typeof trips.$inferSelect; role: "owner" | "editor" | "viewer" };

/** Resolve membership from the database, never from client-supplied role data. */
export async function requireTripAccess(
  ctx: AppContext & { user: NonNullable<AppContext["user"]> },
  tripId: string,
  allowedRoles: readonly TripAccess["role"][] = ["owner", "editor", "viewer"],
): Promise<TripAccess> {
  const [row] = await ctx.db
    .select({ trip: trips, role: tripMembers.role })
    .from(trips)
    .leftJoin(
      tripMembers,
      and(eq(tripMembers.tripId, trips.id), eq(tripMembers.userId, ctx.user.id)),
    )
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!row) notFound("Trip");

  const role = row.trip.ownerId === ctx.user.id ? "owner" : row.role;
  if (!role || !allowedRoles.includes(role)) forbidden();
  return { trip: row.trip, role };
}
