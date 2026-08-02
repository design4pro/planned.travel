import { z } from "zod";

export const createTripInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
});
export type CreateTripInput = z.infer<typeof createTripInputSchema>;

export const tripRoleSchema = z.enum(["owner", "editor", "viewer"]);

/** Public trip DTO. Database-only columns such as ownerId are intentionally omitted. */
export const tripDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  coverImageKey: z.string().nullable().optional(),
  visibility: z.enum(["private", "shared", "public"]),
  startAt: z.number().nullable().optional(),
  endAt: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  role: tripRoleSchema,
});
export type TripDto = z.infer<typeof tripDtoSchema>;

export const tripDaySchema = z.object({
  id: z.string(),
  dateIndex: z.number().int().nonnegative(),
  date: z.number().nullable().optional(),
});
export type TripDay = z.infer<typeof tripDaySchema>;

export const tripPlaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});
export type TripPlace = z.infer<typeof tripPlaceSchema>;

export const tripItemSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  placeId: z.string().nullable().optional(),
  orderIndex: z.number().int().nonnegative(),
  type: z.enum(["place", "note", "transport"]),
  note: z.string().nullable().optional(),
});
export type TripItem = z.infer<typeof tripItemSchema>;

export const tripPlanSchema = z.object({
  trip: tripDtoSchema,
  days: z.array(tripDaySchema),
  places: z.array(tripPlaceSchema),
  items: z.array(tripItemSchema),
});
export type TripPlan = z.infer<typeof tripPlanSchema>;

export const createPlaceInputSchema = z.object({
  tripId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createDayItemInputSchema = z.object({
  tripId: z.string().min(1),
  dayId: z.string().min(1).optional(),
  placeId: z.string().min(1).optional(),
  note: z.string().trim().min(1).max(1000).optional(),
}).refine((input) => input.placeId || input.note, "placeId or note required");

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
