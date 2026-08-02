import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { dayItems, days, notifications, places, subscriptions, trips, tripMembers } from "@planned/db";
import {
  createDayItemInputSchema,
  createPlaceInputSchema,
  createTripInputSchema,
  tripDtoSchema,
  tripPlanSchema,
} from "@planned/shared";
import { TRPCError } from "@trpc/server";
import { requireTripAccess } from "./authorization";
import { publicProcedure, protectedProcedure, router } from "./trpc";

const tripIdInput = z.object({ id: z.string().min(1) });
const createPlaceInput = createPlaceInputSchema;
const createDayItemInput = createDayItemInputSchema;

const FREE_TRIP_LIMIT = 3;

function toTripDto(trip: typeof trips.$inferSelect, role: "owner" | "editor" | "viewer") {
  return tripDtoSchema.parse({ ...trip, role });
}

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, service: "planned-travel" as const })),
  trips: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const [owned, memberships] = await Promise.all([
        ctx.db.select().from(trips).where(eq(trips.ownerId, ctx.user.id)).orderBy(desc(trips.updatedAt)).all(),
        ctx.db
          .select({ trip: trips, role: tripMembers.role })
          .from(tripMembers)
          .innerJoin(trips, eq(trips.id, tripMembers.tripId))
          .where(eq(tripMembers.userId, ctx.user.id))
          .all(),
      ]);
      return [
        ...owned.map((trip) => tripDtoSchema.parse({ ...trip, role: "owner" })),
        ...memberships
          .filter(({ trip }) => trip.ownerId !== ctx.user.id)
          .map(({ trip, role }) => tripDtoSchema.parse({ ...trip, role })),
      ];
    }),
    get: protectedProcedure.input(tripIdInput).query(async ({ ctx, input }) => {
      const access = await requireTripAccess(ctx, input.id);
      const [dayRows, placeRows] = await Promise.all([
        ctx.db.select().from(days).where(eq(days.tripId, access.trip.id)).orderBy(asc(days.dateIndex)).all(),
        ctx.db.select().from(places).where(eq(places.tripId, access.trip.id)).all(),
      ]);
      const itemRows = dayRows.length
        ? await ctx.db.select().from(dayItems)
          .where(inArray(dayItems.dayId, dayRows.map((day) => day.id)))
          .orderBy(asc(dayItems.orderIndex)).all()
        : [];
      return tripPlanSchema.parse({
        trip: toTripDto(access.trip, access.role),
        days: dayRows,
        places: placeRows,
        items: itemRows,
      });
    }),
    create: protectedProcedure.input(createTripInputSchema).mutation(async ({ ctx, input }) => {
      const [subscription] = await ctx.db.select().from(subscriptions)
        .where(eq(subscriptions.userId, ctx.user.id)).limit(1);
      const isPro = subscription?.plan === "pro" && ["active", "trialing"].includes(subscription.status ?? "");
      if (!isPro) {
        const ownedCount = (await ctx.db.select({ id: trips.id }).from(trips)
          .where(eq(trips.ownerId, ctx.user.id)).all()).length;
        if (ownedCount >= FREE_TRIP_LIMIT) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Free plan allows ${FREE_TRIP_LIMIT} trips` });
        }
      }
      const [created] = await ctx.db.insert(trips).values({ ownerId: ctx.user.id, title: input.title }).returning();
      if (!created) throw new Error("Trip creation did not return a row");
      await ctx.db.insert(tripMembers).values({ tripId: created.id, userId: ctx.user.id, role: "owner" });
      return tripDtoSchema.parse({ ...created, role: "owner" });
    }),
    addPlace: protectedProcedure.input(createPlaceInput).mutation(async ({ ctx, input }) => {
      const access = await requireTripAccess(ctx, input.tripId, ["owner", "editor"]);
      const [place] = await ctx.db.insert(places).values({ ...input, tripId: access.trip.id }).returning();
      return place;
    }),
    addDay: protectedProcedure.input(tripIdInput).mutation(async ({ ctx, input }) => {
      const access = await requireTripAccess(ctx, input.id, ["owner", "editor"]);
      const [last] = await ctx.db.select({ dateIndex: days.dateIndex }).from(days)
        .where(eq(days.tripId, access.trip.id)).orderBy(desc(days.dateIndex)).limit(1);
      const [day] = await ctx.db.insert(days)
        .values({ tripId: access.trip.id, dateIndex: (last?.dateIndex ?? -1) + 1 }).returning();
      return day;
    }),
    addItem: protectedProcedure.input(createDayItemInput).mutation(async ({ ctx, input }) => {
      const access = await requireTripAccess(ctx, input.tripId, ["owner", "editor"]);
      const requestedDay = input.dayId
        ? (await ctx.db.select().from(days).where(and(eq(days.id, input.dayId), eq(days.tripId, access.trip.id))).limit(1))[0]
        : undefined;
      if (input.dayId && !requestedDay) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Day does not belong to this trip" });
      }
      const day = requestedDay ?? (await ctx.db.select().from(days)
        .where(eq(days.tripId, access.trip.id)).orderBy(asc(days.dateIndex)).limit(1))[0];
      const targetDay = day ?? (await ctx.db.insert(days).values({ tripId: access.trip.id, dateIndex: 0 }).returning())[0];
      if (!targetDay) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create a planning day" });
      if (input.placeId) {
        const place = await ctx.db.select({ id: places.id }).from(places)
          .where(and(eq(places.id, input.placeId), eq(places.tripId, access.trip.id))).limit(1);
        if (!place[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Place does not belong to this trip" });
      }
      const count = (await ctx.db.select({ id: dayItems.id }).from(dayItems)
        .where(eq(dayItems.dayId, targetDay.id)).all()).length;
      const [item] = await ctx.db.insert(dayItems).values({
        dayId: targetDay.id, placeId: input.placeId ?? null, note: input.note ?? null, orderIndex: count,
        type: input.placeId ? "place" : "note",
      }).returning();
      return item;
    }),
  }),
  notifications: router({
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db.select({ id: notifications.id }).from(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt))).all();
      return { count: rows.length };
    }),
  }),
});

export type AppRouter = typeof appRouter;
