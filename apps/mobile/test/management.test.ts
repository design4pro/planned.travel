import { describe, expect, it } from "vitest";
import { arrayBufferToBase64, safeFileName } from "../src/management";

describe("mobile management file handoff", () => {
  it("encodes PDF bytes for Expo's base64 file writer", () => {
    expect(arrayBufferToBase64(new TextEncoder().encode("PDF").buffer)).toBe("UERG");
    expect(arrayBufferToBase64(new Uint8Array([0, 1, 2, 253]).buffer)).toBe("AAEC/Q==");
  });

  it("sanitizes downloaded names and supplies a usable fallback", () => {
    expect(safeFileName("boarding pass/flight?.pdf")).toBe("boarding_pass_flight_.pdf");
    expect(safeFileName("...", "trip.pdf")).toBe("trip.pdf");
  });
});
