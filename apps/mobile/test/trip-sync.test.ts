import { describe, expect, it } from "vitest";
import { tripSyncUrl } from "../src/collab/useTripSync";

describe("mobile trip realtime transport", () => {
  it("creates a secure token-authenticated websocket URL", () => {
    expect(tripSyncUrl("https://planned.travel/", "trip/1", "token with spaces")).toBe(
      "wss://planned.travel/api/trips/trip%2F1/sync?access_token=token%20with%20spaces",
    );
  });
});
