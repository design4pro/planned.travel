import { describe, expect, it } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTripInputSchema, tripDtoSchema } from "@planned/shared";
import { appRouter } from "../src/router";

const caller = (user: { id: string } | null = null) =>
  appRouter.createCaller({
    request: new Request("https://planned.test/api/trpc"),
    env: { DB: undefined as never },
    db: undefined as never,
    user,
  });

describe("tRPC contract", () => {
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
});
