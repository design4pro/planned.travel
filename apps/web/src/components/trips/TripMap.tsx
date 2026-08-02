import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  places: MapPlace[];
  focusPlaceId?: string | null;
  onPlaceFocus?: (placeId: string) => void;
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string
  );
}

/**
 * Renders the trip's places as pins on a MapLibre map (key-free OSM raster tiles).
 * client:only — MapLibre touches the DOM and must not run during SSR.
 *
 * NOTE: tile.openstreetmap.org is fine for dev/demo; for production use a proper
 * tile provider (self-hosted, MapTiler, etc.) per OSM tile usage policy.
 */
export default function TripMap({ places, focusPlaceId, onPlaceFocus }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());

  useEffect(() => {
    if (!ref.current || places.length === 0) return;

    const first = places[0];
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [first.lng, first.lat],
      zoom: 6,
    });
    mapRef.current = map;

    places.forEach((p) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className =
        "size-7 rounded-full border-2 border-white bg-primary shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
      markerElement.setAttribute("aria-label", `Focus ${p.name}`);
      markerElement.addEventListener("click", () => onPlaceFocus?.(p.id));
      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<strong>${escapeHtml(p.name)}</strong>`
      );
      const marker = new maplibregl.Marker({ element: markerElement })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.set(p.id, marker);
    });

    if (places.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      places.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 48 });
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      mapRef.current = null;
      map.remove();
    };
  }, [places, onPlaceFocus]);

  useEffect(() => {
    if (!focusPlaceId) return;
    const place = places.find((candidate) => candidate.id === focusPlaceId);
    const marker = markersRef.current.get(focusPlaceId);
    const map = mapRef.current;
    if (!place || !marker || !map) return;

    map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 10) });
    marker.getPopup()?.addTo(map);
  }, [focusPlaceId, places]);

  return (
    <div
      ref={ref}
      className="h-[min(70vh,640px)] min-h-[360px] w-full rounded-lg border"
      aria-label="Trip map"
      role="application"
    />
  );
}
