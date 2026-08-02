import { describe, expect, it } from "vitest";
import {
  canEdit,
  canRead,
  createInvitationSchema,
  decodePresenceTag,
  encodePresenceTag,
  isInvitationOpen,
  invitationStatus,
  isOwner,
  clientMessageSchema,
} from "@planned/shared";

describe("roles", () => {
  it("lets viewer+ read but only owner/editor edit", () => {
    expect(canRead("owner")).toBe(true);
    expect(canRead("editor")).toBe(true);
    expect(canRead("viewer")).toBe(true);
    expect(canRead(null)).toBe(false);
    expect(canRead(undefined)).toBe(false);

    expect(canEdit("owner")).toBe(true);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit(null)).toBe(false);
  });

  it("only owner is owner", () => {
    expect(isOwner("owner")).toBe(true);
    expect(isOwner("editor")).toBe(false);
    expect(isOwner("viewer")).toBe(false);
  });
});

describe("presence tag codec (hibernation-safe)", () => {
  it("round-trips presence through the string tag", () => {
    const p = { userId: "u_1", name: "Ada", role: "editor" as const };
    const tag = encodePresenceTag(p);
    expect(typeof tag).toBe("string");
    expect(tag.startsWith("p:")).toBe(true);
    expect(decodePresenceTag(tag)).toEqual(p);
  });

  it("survives a missing name", () => {
    const tag = encodePresenceTag({ userId: "u_2", name: null, role: "viewer" });
    expect(decodePresenceTag(tag)).toEqual({ userId: "u_2", name: null, role: "viewer" });
  });

  it("rejects malformed / foreign tags", () => {
    expect(decodePresenceTag(undefined)).toBeNull();
    expect(decodePresenceTag("p:not-json")).toBeNull();
    expect(decodePresenceTag("p:{}")).toBeNull(); // missing userId/role
    expect(decodePresenceTag("garbage")).toBeNull();
  });
});

describe("createInvitationSchema", () => {
  it("defaults to an editor link with no expiry or use cap", () => {
    const parsed = createInvitationSchema.parse({});
    expect(parsed.role).toBe("editor");
    expect(parsed.expiresInDays).toBeUndefined();
    expect(parsed.maxUses).toBeUndefined();
  });

  it("accepts viewer + expiry + maxUses", () => {
    const parsed = createInvitationSchema.parse({ role: "viewer", expiresInDays: 7, maxUses: 5 });
    expect(parsed).toEqual({ role: "viewer", expiresInDays: 7, maxUses: 5 });
  });

  it("rejects owner role (invites can only grant editor/viewer)", () => {
    expect(() => createInvitationSchema.parse({ role: "owner" })).toThrow();
  });

  it("rejects nonsensical expiry / use caps", () => {
    expect(() => createInvitationSchema.parse({ expiresInDays: 0 })).toThrow();
    expect(() => createInvitationSchema.parse({ expiresInDays: 999 })).toThrow();
    expect(() => createInvitationSchema.parse({ maxUses: -1 })).toThrow();
  });
});

describe("isInvitationOpen", () => {
  const base = { revokedAt: null, expiresAt: null, maxUses: null, useCount: 0 };
  const now = 1_700_000_000_000;

  it("is open by default", () => {
    expect(isInvitationOpen({ ...base, now })).toBe(true);
  });

  it("a revoked link is closed", () => {
    expect(isInvitationOpen({ ...base, revokedAt: now - 1, now })).toBe(false);
  });

  it("an expired link is closed", () => {
    expect(isInvitationOpen({ ...base, expiresAt: now - 1, now })).toBe(false);
    expect(isInvitationOpen({ ...base, expiresAt: now + 1, now })).toBe(true); // not yet
  });

  it("an exhausted link is closed exactly at the cap", () => {
    expect(isInvitationOpen({ ...base, maxUses: 3, useCount: 3, now })).toBe(false);
    expect(isInvitationOpen({ ...base, maxUses: 3, useCount: 2, now })).toBe(true);
  });
});

describe("invitationStatus", () => {
  const now = 1_700_000_000_000;
  const base = { revokedAt: null, expiresAt: null, maxUses: null, useCount: 0, now };

  it.each([
    ["revoked", { revokedAt: now - 1 }],
    ["expired", { expiresAt: now - 1 }],
    ["exhausted", { maxUses: 2, useCount: 2 }],
  ] as const)("reports %s invitations distinctly", (status, overrides) => {
    expect(invitationStatus({ ...base, ...overrides })).toBe(status);
  });

  it("reports an invitation as open before its expiry and use cap", () => {
    expect(invitationStatus({ ...base, expiresAt: now + 1, maxUses: 2, useCount: 1 })).toBe("open");
  });
});

describe("clientMessageSchema", () => {
  it("accepts ping and activity", () => {
    expect(clientMessageSchema.safeParse({ type: "ping" }).success).toBe(true);
    const a = clientMessageSchema.safeParse({ type: "activity", activity: "editing day 2" });
    expect(a.success).toBe(true);
  });

  it("rejects unknown / malformed messages", () => {
    expect(clientMessageSchema.safeParse({ type: "nope" }).success).toBe(false);
    expect(clientMessageSchema.safeParse("not an object").success).toBe(false);
    expect(
      clientMessageSchema.safeParse({ type: "activity", activity: "x".repeat(100) }).success,
    ).toBe(false); // activity capped at 60 chars
  });
});
