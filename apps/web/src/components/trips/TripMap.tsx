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
export default function TripMap({ places }: Props) {
  const ref = useRef<HTMLDivElement>(null);

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

    const markers: maplibregl.Marker[] = [];
    places.forEach((p) => {
      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<strong>${escapeHtml(p.name)}</strong>`
      );
      const marker = new maplibregl.Marker().setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
      markers.push(marker);
    });

    if (places.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      places.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 48 });
    }

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
    };
  }, [places]);

  return <div ref={ref} className="h-[420px] w-full rounded-lg border" />;
}
