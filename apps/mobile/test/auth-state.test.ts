import { describe, expect, it } from "vitest";
import { authStateFromSession, signedOutState } from "../src/auth/state";

describe("mobile authentication entry state", () => {
  it("starts signed out when the server has no session", () => {
    expect(authStateFromSession(null)).toEqual({ status: "signed-out" });
  });

  it("exposes the shared session user to the authenticated entry point", () => {
    expect(authStateFromSession({ user: { id: "u1", email: "traveler@example.com" } })).toEqual({
      status: "signed-in",
      user: { id: "u1", email: "traveler@example.com" },
    });
  });

  it("keeps an auth failure visible without treating it as authenticated", () => {
    expect(signedOutState("Session expired.")).toEqual({ status: "signed-out", error: "Session expired." });
  });
});
