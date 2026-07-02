/**
 * @planned/shared — types, zod schemas, and pure business logic shared by
 * the Astro web app and the future Expo mobile app. Keep this package free
 * of platform-specific (DOM / Node / Worker) imports so it runs anywhere.
 */

export const PACKAGE_NAME = "@planned/shared";

/* ----------------------------- Domain enums ----------------------------- */

export const TripVisibility = {
  private: "private",
  shared: "shared",
  public: "public",
} as const;
export type TripVisibility = (typeof TripVisibility)[keyof typeof TripVisibility];

export const TripRole = {
  owner: "owner",
  editor: "editor",
  viewer: "viewer",
} as const;
export type TripRole = (typeof TripRole)[keyof typeof TripRole];

export const PlanTier = {
  free: "free",
  pro: "pro",
  team: "team",
} as const;
export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier];

/* ------------------------------ Zod schemas ----------------------------- */
// These mirror the Drizzle tables in @planned/db and the API DTOs.
// Keep them as the single source of truth for request/response shapes.

import { z } from "zod";

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof latLngSchema>;

export const placeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: z.string().optional(),
  location: latLngSchema,
  address: z.string().optional(),
  provider: z.enum(["osm", "google", "custom"]).default("custom"),
  providerId: z.string().optional(),
});
export type Place = z.infer<typeof placeSchema>;

export const tripSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(120),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  visibility: z.nativeEnum(TripVisibility as any).default("private"),
  coverImageKey: z.string().optional(),
});
export type Trip = z.infer<typeof tripSchema>;

/* ------------------------------- Costs ----------------------------------- */

export * from "./costs";

/* --------------------------- Reservations -------------------------------- */

export * from "./reservations";

/* ----------------------------- Documents --------------------------------- */

export * from "./documents";

/* --------------------------- Collaboration ------------------------------- */

export * from "./collab";

/* ----------------------------- Notifications ----------------------------- */

export * from "./notifications";
