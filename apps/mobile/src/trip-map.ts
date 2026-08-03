import type { TripPlan } from "@planned/shared";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";

/** OSM raster style shared with the web map; use a production tile provider at scale. */
export const mobileMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function mapInitialView(places: TripPlan["places"]) {
  if (places.length === 0) return { center: [0, 0] as [number, number], zoom: 2 };
  const first = places[0];
  if (places.length === 1 && first) {
    return { center: [first.lng, first.lat] as [number, number], zoom: 10 };
  }

  const longitudes = places.map((place) => place.lng);
  const latitudes = places.map((place) => place.lat);
  return {
    bounds: [
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes),
    ] as [number, number, number, number],
  };
}
