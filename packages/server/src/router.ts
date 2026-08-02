import { and, asc, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { dayItems, days, documents, expenseSplits, expenses, notifications, places, reservations, subscriptions, trips, tripMembers } from "@planned/db";
import {
  createDayItemInputSchema,
  createPlaceInputSchema,
  createTripInputSchema,
  createReservationInputSchema,
  createExpenseInputSchema,
  expenseDtoSchema,
  expensePlanSchema,
  equalSplit,
  summarizeByCurrency,
  reservationDtoSchema,
  reservationTripIdSchema,
  sortReservations,
  updateReservationSchema,
  tripDtoSchema,
  tripPlanSchema,
  notificationListInputSchema,
  notificationPageSchema,
  notificationRowSchema,
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
    expenses: router({
      list: protectedProcedure.input(z.object({ tripId: z.string().min(1) })).query(async ({ ctx, input }) => {
        const access = await requireTripAccess(ctx, input.tripId);
        const rows = await ctx.db.select().from(expenses).where(eq(expenses.tripId, access.trip.id)).orderBy(desc(expenses.createdAt)).all();
        const splits = rows.length ? await ctx.db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, rows.map((row) => row.id))).all() : [];
        const splitMap = new Map<string, typeof splits>();
        for (const split of splits) splitMap.set(split.expenseId, [...(splitMap.get(split.expenseId) ?? []), split]);
        const expenseDtos = rows.map((row) => expenseDtoSchema.parse({ ...row, splits: (splitMap.get(row.id) ?? []).map(({ userId, shareCents }) => ({ userId, shareCents })) }));
        const memberRows = await ctx.db.select({ userId: tripMembers.userId }).from(tripMembers).where(eq(tripMembers.tripId, access.trip.id)).all();
        const members = [{ userId: access.trip.ownerId }, ...memberRows.filter(({ userId }) => userId !== access.trip.ownerId)];
        return expensePlanSchema.parse({ expenses: expenseDtos, summaries: summarizeByCurrency(members, expenseDtos) });
      }),
      create: protectedProcedure.input(createExpenseInputSchema).mutation(async ({ ctx, input }) => {
        const access = await requireTripAccess(ctx, input.tripId, ["owner", "editor"]);
        const memberRows = await ctx.db.select({ userId: tripMembers.userId }).from(tripMembers).where(eq(tripMembers.tripId, access.trip.id)).all();
        const memberIds = new Set([access.trip.ownerId, ...memberRows.map(({ userId }) => userId)]);
        const participantIds = input.participantIds?.length ? [...new Set(input.participantIds)] : [...memberIds];
        if (participantIds.length === 0) participantIds.push(ctx.user.id);
        if (participantIds.some((userId) => !memberIds.has(userId) && userId !== ctx.user.id)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Participants must belong to this trip" });
        }
        const splits = equalSplit(input.amountCents, participantIds);
        const [created] = await ctx.db.insert(expenses).values({
          tripId: access.trip.id, paidByUserId: ctx.user.id, amountCents: input.amountCents, currency: input.currency,
          category: input.category ?? null, description: input.description || null, date: input.date ?? null,
        }).returning();
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Expense was not created" });
        if (splits.length) await ctx.db.insert(expenseSplits).values(splits.map((split) => ({ expenseId: created.id, ...split })));
        await ctx.broadcastChange?.(access.trip.id, "expenses", ctx.user.id);
        await ctx.onExpenseChange?.({ tripId: access.trip.id, tripName: access.trip.title, expenseId: created.id, amountCents: created.amountCents, currency: created.currency, description: created.description, participantIds, actorUserId: ctx.user.id, actorName: ctx.user.name });
        return expenseDtoSchema.parse({ ...created, splits });
      }),
      remove: protectedProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
        const [existing] = await ctx.db.select().from(expenses).where(eq(expenses.id, input.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
        const access = await requireTripAccess(ctx, existing.tripId, ["owner", "editor"]);
        await ctx.db.delete(expenseSplits).where(eq(expenseSplits.expenseId, input.id));
        await ctx.db.delete(expenses).where(eq(expenses.id, input.id));
        await ctx.broadcastChange?.(access.trip.id, "expenses", ctx.user.id);
        return { ok: true as const };
      }),
    }),
    reservations: router({
      list: protectedProcedure.input(reservationTripIdSchema).query(async ({ ctx, input }) => {
        const access = await requireTripAccess(ctx, input.tripId);
        const rows = await ctx.db
          .select()
          .from(reservations)
          .where(eq(reservations.tripId, access.trip.id))
          .orderBy(asc(reservations.startsAt))
          .all();
        return sortReservations(rows).map((row) => reservationDtoSchema.parse(row));
      }),
      create: protectedProcedure.input(createReservationInputSchema).mutation(async ({ ctx, input }) => {
        const access = await requireTripAccess(ctx, input.tripId, ["owner", "editor"]);
        const { tripId: _tripId, ...values } = input;
        const [created] = await ctx.db.insert(reservations).values({ tripId: access.trip.id, ...values }).returning();
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Reservation was not created" });
        await ctx.broadcastChange?.(access.trip.id, "reservations", ctx.user.id);
        await ctx.onReservationChange?.({
          kind: "added",
          tripId: access.trip.id,
          tripName: access.trip.title,
          reservationId: created.id,
          type: created.type,
          title: created.title,
          actorUserId: ctx.user.id,
          actorName: ctx.user.name,
        });
        return reservationDtoSchema.parse(created);
      }),
      update: protectedProcedure.input(z.object({ id: z.string().min(1), data: updateReservationSchema })).mutation(async ({ ctx, input }) => {
        const [existing] = await ctx.db.select().from(reservations).where(eq(reservations.id, input.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Reservation not found" });
        const access = await requireTripAccess(ctx, existing.tripId, ["owner", "editor"]);
        const merged = { startsAt: input.data.startsAt === undefined ? existing.startsAt : input.data.startsAt, endsAt: input.data.endsAt === undefined ? existing.endsAt : input.data.endsAt };
        if (merged.startsAt != null && merged.endsAt != null && merged.endsAt < merged.startsAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ends_before_starts" });
        }
        const [updated] = await ctx.db.update(reservations).set(input.data).where(eq(reservations.id, input.id)).returning();
        if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Reservation was not updated" });
        await ctx.broadcastChange?.(access.trip.id, "reservations", ctx.user.id);
        if (existing.status !== "confirmed" && updated.status === "confirmed") {
          await ctx.onReservationChange?.({ kind: "confirmed", tripId: access.trip.id, tripName: access.trip.title, reservationId: updated.id, type: updated.type, title: updated.title });
        }
        return reservationDtoSchema.parse(updated);
      }),
      remove: protectedProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
        const [existing] = await ctx.db.select().from(reservations).where(eq(reservations.id, input.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Reservation not found" });
        const access = await requireTripAccess(ctx, existing.tripId, ["owner", "editor"]);
        await ctx.db.update(documents).set({ reservationId: null }).where(eq(documents.reservationId, input.id));
        await ctx.db.delete(reservations).where(eq(reservations.id, input.id));
        await ctx.broadcastChange?.(access.trip.id, "reservations", ctx.user.id);
        return { ok: true as const };
      }),
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
      await ctx.broadcastChange?.(access.trip.id, "places", ctx.user.id);
      return place;
    }),
    addDay: protectedProcedure.input(tripIdInput).mutation(async ({ ctx, input }) => {
      const access = await requireTripAccess(ctx, input.id, ["owner", "editor"]);
      const [last] = await ctx.db.select({ dateIndex: days.dateIndex }).from(days)
        .where(eq(days.tripId, access.trip.id)).orderBy(desc(days.dateIndex)).limit(1);
      const [day] = await ctx.db.insert(days)
        .values({ tripId: access.trip.id, dateIndex: (last?.dateIndex ?? -1) + 1 }).returning();
      await ctx.broadcastChange?.(access.trip.id, "plan", ctx.user.id);
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
      await ctx.broadcastChange?.(access.trip.id, "plan", ctx.user.id);
      return item;
    }),
  }),
  notifications: router({
    list: protectedProcedure.input(notificationListInputSchema).query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(notifications)
        .where(and(
          eq(notifications.userId, ctx.user.id),
          input.cursor ? lt(notifications.createdAt, input.cursor) : undefined,
        ))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit + 1)
        .all();
      const hasMore = rows.length > input.limit;
      const items = rows.slice(0, input.limit).map((row) => notificationRowSchema.parse(row));
      return notificationPageSchema.parse({
        items,
        nextCursor: hasMore ? items.at(-1)?.createdAt ?? null : null,
      });
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db.select({ id: notifications.id }).from(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt))).all();
      return { count: rows.length };
    }),
    markRead: protectedProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(notifications)
        .set({ readAt: Date.now() })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)))
        .returning({ id: notifications.id });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      return { ok: true as const };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const updated = await ctx.db.update(notifications)
        .set({ readAt: Date.now() })
        .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)))
        .returning({ id: notifications.id });
      return { ok: true as const, count: updated.length };
    }),
  }),
});

export type AppRouter = typeof appRouter;
