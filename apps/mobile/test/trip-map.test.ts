import { describe, expect, it } from "vitest";
import { mapInitialView } from "../src/trip-map";

describe("mobile map projection", () => {
  it("centers a single place at a useful zoom level", () => {
    expect(mapInitialView([{ id: "p1", name: "Lisbon", lat: 38.7223, lng: -9.1393 }])).toEqual({
      center: [-9.1393, 38.7223],
      zoom: 10,
    });
  });

  it("fits all places into the initial native viewport", () => {
    expect(mapInitialView([
      { id: "p1", name: "West", lat: 38, lng: -10 },
      { id: "p2", name: "East", lat: 42, lng: 4 },
    ])).toEqual({
      bounds: [-10, 38, 4, 42],
    });
  });
});
