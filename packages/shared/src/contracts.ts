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

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
