import { describe, expect, it } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createDayItemInputSchema, createExpenseInputSchema, createReservationInputSchema, createTripInputSchema, equalSplit, sortReservations, tripDtoSchema, tripPlanSchema, updateReservationSchema } from "@planned/shared";
import { appRouter } from "../src/router";
import { createContext } from "../src/context";

const caller = (user: { id: string } | null = null) =>
  appRouter.createCaller({
    request: new Request("https://planned.test/api/trpc"),
    env: { DB: undefined as never },
    db: undefined as never,
    user,
  });

describe("tRPC contract", () => {
  it("preserves the realtime publisher in request context", async () => {
    const broadcastChange = async () => {};
    const context = await createContext({
      request: new Request("https://planned.test/api/trpc"),
      env: { DB: undefined as never },
      resolveUser: async () => ({ id: "u1" }),
      broadcastChange,
    });

    expect(context.broadcastChange).toBe(broadcastChange);
  });

  it("exposes a stable public health response", async () => {
    await expect(caller().health()).resolves.toEqual({ ok: true, service: "planned-travel" });
  });

  it("rejects unauthenticated protected procedures", async () => {
    await expect(caller().trips.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("serializes unauthorized transport errors with a stable tRPC envelope", async () => {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request(
        `https://planned.test/api/trpc/trips.list?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: { json: {} } }))}`,
      ),
      router: appRouter,
      createContext: () => ({
        request: new Request("https://planned.test/api/trpc"),
        env: { DB: undefined as never },
        db: undefined as never,
        user: null,
      }),
    });
    const [body] = (await response.json()) as Array<{ error: { message: string; data: { code: string } } }>;
    expect(response.status).toBe(401);
    expect(body?.error).toMatchObject({ message: "Authentication required", data: { code: "UNAUTHORIZED" } });
  });

  it("validates shared mutation input before reaching infrastructure", async () => {
    await expect(caller({ id: "u1" }).trips.create({ title: "  " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(createTripInputSchema.safeParse({ title: "  " }).success).toBe(false);
  });

  it("keeps response DTOs free of database ownership fields", () => {
    const result = tripDtoSchema.safeParse({
      id: "t1",
      title: "Lisbon",
      visibility: "private",
      createdAt: 1,
      updatedAt: 1,
      role: "owner",
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected a valid trip DTO");
    expect(result.data).not.toHaveProperty("ownerId");
  });

  it("models an empty itinerary without making days or places mandatory", () => {
    const result = tripPlanSchema.safeParse({
      trip: { id: "t1", title: "Lisbon", visibility: "private", createdAt: 1, updatedAt: 1, role: "viewer" },
      days: [],
      places: [],
      items: [],
    });
    expect(result.success).toBe(true);
  });

  it("requires a place or note when adding a day item", () => {
    expect(createDayItemInputSchema.safeParse({ tripId: "t1" }).success).toBe(false);
    expect(createDayItemInputSchema.safeParse({ tripId: "t1", note: "Dinner" }).success).toBe(true);
  });

  it("rejects reservation dates when the end precedes the start", () => {
    const result = createReservationInputSchema.safeParse({
      tripId: "t1",
      type: "hotel",
      startsAt: 2_000,
      endsAt: 1_000,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endsAt"]);
    expect(updateReservationSchema.safeParse({ startsAt: 2_000, endsAt: 1_000 }).success).toBe(false);
  });

  it("requires authentication for reservation reads", async () => {
    await expect(caller().trips.reservations.list({ tripId: "t1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("validates reservation dates before an authenticated mutation reaches the database", async () => {
    await expect(caller({ id: "u1" }).trips.reservations.create({ tripId: "t1", startsAt: 2_000, endsAt: 1_000 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("orders dated reservations first and keeps placeholders at the end", () => {
    expect(sortReservations([{ startsAt: null, id: "undated" }, { startsAt: 2_000, id: "late" }, { startsAt: 1_000, id: "early" }]).map((row) => row.id)).toEqual(["early", "late", "undated"]);
  });

  it("validates expense inputs as integer cents with normalized currencies", () => {
    const parsed = createExpenseInputSchema.parse({ tripId: "t1", amountCents: 1_005, currency: " eur " });
    expect(parsed).toMatchObject({ amountCents: 1_005, currency: "EUR" });
    expect(createExpenseInputSchema.safeParse({ tripId: "t1", amountCents: 10.5, currency: "USD" }).success).toBe(false);
    expect(createExpenseInputSchema.safeParse({ tripId: "t1", amountCents: 100, currency: "US" }).success).toBe(false);
  });

  it("rounds equal splits without losing a cent", () => {
    expect(equalSplit(100, ["ada", "bea", "cy"])).toEqual([
      { userId: "ada", shareCents: 34 },
      { userId: "bea", shareCents: 33 },
      { userId: "cy", shareCents: 33 },
    ]);
  });

  it("requires authentication for expense reads and mutations", async () => {
    await expect(caller().trips.expenses.list({ tripId: "t1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().trips.expenses.create({ tripId: "t1", amountCents: 100, currency: "USD" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().trips.expenses.remove({ id: "e1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication for every notification operation", async () => {
    await expect(caller().notifications.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().notifications.unreadCount()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().notifications.markRead({ id: "n1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().notifications.markAllRead()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("validates notification pagination before reaching the database", async () => {
    await expect(caller({ id: "u1" }).notifications.list({ limit: 51 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller({ id: "u1" }).notifications.markRead({ id: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
