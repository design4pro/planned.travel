import type { TripPlan } from "@planned/shared";

export type MapPercentage = `${number}%`;

/** Keep map presentation deterministic while the native map provider is loaded. */
export function projectPlace(place: TripPlan["places"][number]) {
  const normalizedLng = (place.lng + 180) / 360;
  const normalizedLat = (90 - place.lat) / 180;

  return {
    left: `${Math.min(92, Math.max(8, normalizedLng * 100))}%` as MapPercentage,
    top: `${Math.min(78, Math.max(12, normalizedLat * 100))}%` as MapPercentage,
  };
}
