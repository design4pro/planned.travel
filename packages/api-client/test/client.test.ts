import { describe, expect, it, vi } from "vitest";
import { createPlannedTrpcClient } from "../src";

describe("planned tRPC client transport", () => {
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
});
