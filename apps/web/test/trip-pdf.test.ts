import { describe, expect, it } from "vitest";
import { buildTripHtml } from "../src/server/trip-pdf";

describe("trip PDF document", () => {
  it("builds a self-contained printable document and escapes trip content", () => {
    const html = buildTripHtml({
      trip: { title: '<Tokyo & "friends">', startAt: null, endAt: null, description: "<script>alert(1)</script>" },
      days: [{ id: "day-1", dateIndex: 0 }],
      items: [{ dayId: "day-1", type: "note", note: "Dinner & drinks" }],
      places: new Map(),
      reservations: [],
      summaries: [],
      userNames: new Map(),
      currentUserId: "u1",
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Tokyo &amp; &quot;friends&quot;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("Dinner &amp; drinks");
    expect(html).toContain("@page");
  });
});
