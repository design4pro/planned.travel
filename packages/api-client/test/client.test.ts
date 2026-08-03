import { describe, expect, it, vi } from "vitest";
import { ApiError, PlannedClient, createPlannedTrpcClient } from "../src";

describe("planned tRPC client transport", () => {
  it("provides authenticated collaboration methods for mobile", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("/api/trips/trip-1/members");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer mobile-token");
      return new Response(JSON.stringify([{ userId: "u1", role: "owner", name: "Ada", email: "ada@example.com" }]), { status: 200 });
    });
    const client = new PlannedClient({ baseUrl: "https://planned.travel", getToken: () => "mobile-token", fetch: fetchMock });
    await expect(client.trips().members("trip-1")).resolves.toMatchObject([{ userId: "u1", role: "owner" }]);
  });

  it("uses cookies for web requests and bearer tokens for mobile", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer mobile-token");
      return new Response(JSON.stringify([{ result: { data: { ok: true, service: "planned-travel" } } }]), {
        headers: { "content-type": "application/json" },
      });
    });

    const client = createPlannedTrpcClient({
      baseUrl: "https://planned.travel",
      getToken: () => "mobile-token",
      fetch: fetchMock,
    });

    await expect(client.health.query()).resolves.toEqual({ ok: true, service: "planned-travel" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not add a bearer header when web uses its session cookie", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      return new Response(JSON.stringify([{ result: { data: { ok: true, service: "planned-travel" } } }]), {
        headers: { "content-type": "application/json" },
      });
    });

    await createPlannedTrpcClient({ fetch: fetchMock }).health.query();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("preserves unauthorized responses as a stable client error", async () => {
    const fetchMock = vi.fn(async () => new Response("Authentication required", { status: 401 }));
    const client = new PlannedClient({ baseUrl: "https://planned.travel", getToken: () => "expired-token", fetch: fetchMock });

    await expect(client.trips().list()).rejects.toBeInstanceOf(ApiError);
    await expect(client.trips().list()).rejects.toMatchObject({ status: 401 });
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer expired-token");
  });

  it("notifies the mobile session when a bearer request is unauthorized", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn(async () => new Response("Authentication required", { status: 401 }));
    const client = new PlannedClient({
      baseUrl: "https://planned.travel",
      getToken: () => "expired-token",
      onUnauthorized,
      fetch: fetchMock,
    });

    await expect(client.trips().list()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("exposes the travel-management operations through the bearer client", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/reservations")) return new Response("[]", { status: 200 });
      if (path.includes("/expenses")) return new Response("[]", { status: 200 });
      if (path.includes("/documents")) return new Response("[]", { status: 200 });
      return new Response(JSON.stringify({ plan: "free", status: "active", interval: null, cancelAtPeriodEnd: false, currentPeriodEnd: null, stripeCustomerId: null, tripCount: 0, tripLimit: 3 }), { status: 200 });
    });
    const client = new PlannedClient({ baseUrl: "https://planned.travel", getToken: () => "token", fetch: fetchMock });

    await expect(client.reservations("trip/1").list()).resolves.toEqual([]);
    await expect(client.expenses("trip/1").list()).resolves.toEqual([]);
    await expect(client.documents("trip/1").list()).resolves.toEqual([]);
    await expect(client.billing().plan()).resolves.toMatchObject({ plan: "free" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("trip%2F1");
  });
});
