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
});
