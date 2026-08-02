import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { notifications, trips, tripMembers } from "@planned/db";
import { createTripInputSchema, tripDtoSchema } from "@planned/shared";
import { requireTripAccess } from "./authorization";
import { publicProcedure, protectedProcedure, router } from "./trpc";

const tripIdInput = z.object({ id: z.string().min(1) });

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
      return tripDtoSchema.parse({ ...access.trip, role: access.role });
    }),
    create: protectedProcedure.input(createTripInputSchema).mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db.insert(trips).values({ ownerId: ctx.user.id, title: input.title }).returning();
      if (!created) throw new Error("Trip creation did not return a row");
      await ctx.db.insert(tripMembers).values({ tripId: created.id, userId: ctx.user.id, role: "owner" });
      return tripDtoSchema.parse({ ...created, role: "owner" });
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
