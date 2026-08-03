import { describe, expect, it, vi } from "vitest";
import { buildTripHtml, renderTripPdf } from "../src/server/trip-pdf";

const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]); // %PDF-1.7
const setContent = vi.fn(async () => undefined);
const closeBrowser = vi.fn(async () => undefined);
const pagePdf = vi.fn(async () => pdf);

vi.mock("@cloudflare/puppeteer", () => ({
  default: {
    launch: vi.fn(async () => ({
      newPage: async () => ({ setContent, pdf: pagePdf }),
      close: closeBrowser,
    })),
  },
}));

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

  it("returns the valid PDF bytes produced by Browser Rendering and closes the browser", async () => {
    const result = await renderTripPdf({} as NonNullable<Parameters<typeof renderTripPdf>[0]>, "<html>trip</html>");

    expect(result.slice(0, 5)).toEqual(new Uint8Array([37, 80, 68, 70, 45]));
    expect(setContent).toHaveBeenCalledWith("<html>trip</html>", { waitUntil: "networkidle0" });
    expect(pagePdf).toHaveBeenCalledWith({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
    });
    expect(closeBrowser).toHaveBeenCalledOnce();
  });
});
