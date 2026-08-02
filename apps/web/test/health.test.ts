import { describe, expect, it } from "vitest";
import { healthResponse } from "../src/server/health";

describe("Worker health endpoint", () => {
  it("returns the public runtime health contract", async () => {
    const response = healthResponse();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      ok: true,
      service: "planned-travel-web",
    });
  });
});
