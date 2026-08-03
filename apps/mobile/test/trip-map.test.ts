import { describe, expect, it } from "vitest";
import { projectPlace } from "../src/trip-map";

describe("mobile map projection", () => {
  it("projects real coordinates into a stable marker position", () => {
    expect(projectPlace({ id: "p1", name: "Lisbon", lat: 38.7223, lng: -9.1393 })).toEqual({
      left: "47.461305555555555%",
      top: "28.48761111111111%",
    });
  });

  it("keeps extreme coordinates inside the touchable map area", () => {
    expect(projectPlace({ id: "p1", name: "North", lat: 90, lng: -180 })).toMatchObject({
      left: "8%",
      top: "12%",
    });
  });
});
