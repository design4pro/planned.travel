/**
 * Reservation domain logic — manual booking entries (flight/hotel/restaurant/…)
 * with type, status, confirmation #, dates, and optional linked files.
 *
 * Platform-agnostic (no DOM/Worker/Node imports) so it runs in the web server,
 * React components, API handlers, and the future Expo app alike.
 *
 * Auto-parsing of booking emails/PDFs (KDE Itinerary-style → `parsedData`) is a
 * Phase 2 concern; here we only model the user-managed shape.
 */
import { z } from "zod";

/* ------------------------------ Domain enums ----------------------------- */

export const RESERVATION_TYPES = [
  "flight",
  "hotel",
  "restaurant",
  "rental",
  "transport",
  "other",
] as const;
export type ReservationType = (typeof RESERVATION_TYPES)[number];

export const RESERVATION_STATES = ["planned", "confirmed", "cancelled"] as const;
export type ReservationState = (typeof RESERVATION_STATES)[number];

export const reservationTypeSchema = z.enum(RESERVATION_TYPES);
export const reservationStateSchema = z.enum(RESERVATION_STATES);

/* ------------------------------- DTO shapes ------------------------------ */
// Mirror the @planned/db `reservation` table; single source of truth for the
// API contract shared with the typed client + Expo app.

export const createReservationSchema = z.object({
  type: reservationTypeSchema.optional(),
  status: reservationStateSchema.optional(),
  title: z.string().trim().max(200).optional(),
  confirmationCode: z.string().trim().max(200).optional(),
  /** epoch-ms; both optional so a planned/placeholder booking is valid. */
  startsAt: z.number().int().nonnegative().optional(),
  endsAt: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(4000).optional(),
}).superRefine(validateReservationDates);
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export const createReservationInputSchema = createReservationSchema.and(z.object({ tripId: z.string().min(1) }));

export const updateReservationSchema = z.object({
  type: reservationTypeSchema.optional(),
  status: reservationStateSchema.optional(),
  title: z.string().trim().max(200).nullable().optional(),
  confirmationCode: z.string().trim().max(200).nullable().optional(),
  startsAt: z.number().int().nonnegative().nullable().optional(),
  endsAt: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
}).superRefine(validateReservationDates);
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;

export const reservationDtoSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  type: reservationTypeSchema,
  status: reservationStateSchema,
  title: z.string().nullable(),
  confirmationCode: z.string().nullable(),
  startsAt: z.number().int().nullable(),
  endsAt: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.number().int(),
});
export type ReservationDto = z.infer<typeof reservationDtoSchema>;

export const reservationTripIdSchema = z.object({ tripId: z.string().min(1) });

function validateReservationDates(
  value: { startsAt?: number | null; endsAt?: number | null },
  ctx: z.RefinementCtx,
) {
  if (value.startsAt != null && value.endsAt != null && value.endsAt < value.startsAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "ends_before_starts" });
  }
}

export interface Reservation {
  id: string;
  tripId: string;
  type: ReservationType;
  status: ReservationState;
  title: string | null;
  confirmationCode: string | null;
  startsAt: number | null;
  endsAt: number | null;
  notes: string | null;
  createdAt: number;
}

/* ------------------------------- Ordering -------------------------------- */

/**
 * Sort reservations by start date ascending with undated (null) entries pushed
 * to the end — gives a chronological trip itinerary in the UI.
 */
export function sortReservations<T extends { startsAt: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.startsAt == null && b.startsAt == null) return 0;
    if (a.startsAt == null) return 1;
    if (b.startsAt == null) return -1;
    return a.startsAt - b.startsAt;
  });
}
