/**
 * Collaboration domain — real-time sync, presence, roles, and invite links.
 *
 * Platform-agnostic (no DOM/Worker/Node imports) so the WebSocket message
 * contract, role checks, and invite shapes are shared verbatim by the web
 * server (HTTP routes + the TripRoom Durable Object), React components, and
 * the future Expo app.
 *
 * Sync model (Phase 1): the Durable Object is a *presence + change-bus*. Data
 * still mutates through the REST API (DB is source of truth, last-write-wins);
 * after a successful mutation the server tells the DO to broadcast a `change`
 * event so every connected client refreshes. Richer CRDT/OT text sync is a
 * later phase (see PLANS.md §8).
 */
import { z } from "zod";

/* ------------------------------- Roles ----------------------------------- */
// `TripRole` is also exported (value+type) from the package barrel; this local
// alias is structurally identical and kept non-exported to avoid a clash.

type TripRole = "owner" | "editor" | "viewer";

/** Viewer+ can read a trip; owner/editor can read. */
export function canRead(role: TripRole | null | undefined): role is TripRole {
  return role === "owner" || role === "editor" || role === "viewer";
}

/** Owner + editor may mutate trip data. Viewers are read-only. */
export function canEdit(role: TripRole | null | undefined): boolean {
  return role === "owner" || role === "editor";
}

/** Owner-only actions: manage members & invite links, delete the trip. */
export function isOwner(role: TripRole | null | undefined): boolean {
  return role === "owner";
}

/* ------------------------------ Presence --------------------------------- */

export interface Presence {
  userId: string;
  name: string | null;
  role: TripRole;
}

/* --------------------------- Change resources ---------------------------- */
// Which slice of a trip changed. The client decides what to refetch per value.
export type ChangeResource =
  | "trip" // title/dates/visibility/cover
  | "plan" // days + day-items
  | "places"
  | "reservations"
  | "documents"
  | "expenses"
  | "members"; // membership/role changes affect access + presence

/* ------------------------- WebSocket protocol ---------------------------- */
// All messages are JSON. Tag presence as `p:<json>` so it survives DO
// hibernation (tags are strings recovered via state.getWebSockets()).

/** Client → server. */
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping") }),
  z.object({
    type: z.literal("activity"),
    // Free-form, short "what I'm doing" hint (e.g. "editing day 2"). Optional.
    activity: z.string().trim().max(60).optional(),
  }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** Server → client. */
export type ServerMessage =
  | { type: "hello"; you: Presence }
  | { type: "presence"; users: Presence[] }
  | { type: "change"; resource: ChangeResource; by: string | null }
  | { type: "pong" }
  | { type: "error"; message: string };

/** Encode/decode the per-connection presence tag (see Hibernation tags). */
export function encodePresenceTag(p: Presence): string {
  return `p:${JSON.stringify(p)}`;
}
export function decodePresenceTag(tag: string | undefined): Presence | null {
  if (!tag || !tag.startsWith("p:")) return null;
  try {
    const obj = JSON.parse(tag.slice(2)) as Partial<Presence>;
    if (typeof obj.userId === "string" && typeof obj.role === "string")
      return { userId: obj.userId, name: obj.name ?? null, role: obj.role as TripRole };
  } catch {
    /* ignore malformed */
  }
  return null;
}

/* ------------------------------ Invitations ------------------------------ */

export const invitationRoleSchema = z.enum(["editor", "viewer"]);

export const createInvitationSchema = z.object({
  role: invitationRoleSchema.default("editor"),
  /** Days until expiry. Omit for a link that never expires. */
  expiresInDays: z.number().int().positive().max(365).optional(),
  /** Max acceptances before the link is exhausted. Omit for unlimited. */
  maxUses: z.number().int().positive().max(1000).optional(),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/** Result of POST /api/trips/:id/invitations — the shareable URL + metadata. */
export interface InvitationCreated {
  id: string;
  token: string;
  url: string;
  role: "editor" | "viewer";
  expiresAt: number | null;
  maxUses: number | null;
}

/** Is an invitation still usable (not revoked/expired/exhausted)? */
export function isInvitationOpen(inv: {
  revokedAt: number | null;
  expiresAt: number | null;
  maxUses: number | null;
  useCount: number;
  now: number;
}): boolean {
  if (inv.revokedAt != null) return false;
  if (inv.expiresAt != null && inv.expiresAt <= inv.now) return false;
  if (inv.maxUses != null && inv.useCount >= inv.maxUses) return false;
  return true;
}

export type InvitationStatus = "open" | "revoked" | "expired" | "exhausted";

/** Return the stable lifecycle state used by both invitation APIs and UIs. */
export function invitationStatus(inv: {
  revokedAt: number | null;
  expiresAt: number | null;
  maxUses: number | null;
  useCount: number;
  now: number;
}): InvitationStatus {
  if (inv.revokedAt != null) return "revoked";
  if (inv.expiresAt != null && inv.expiresAt <= inv.now) return "expired";
  if (inv.maxUses != null && inv.useCount >= inv.maxUses) return "exhausted";
  return "open";
}
