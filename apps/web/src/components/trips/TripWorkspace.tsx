import { useCallback, useState } from "react";
import { Button } from "@/components/ui/heroui";
import TripMap from "./TripMap";

export interface WorkspacePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface WorkspaceItem {
  id: string;
  placeId: string | null;
  note: string | null;
}

export interface WorkspaceDay {
  id: string;
  dateIndex: number;
  items: WorkspaceItem[];
}

interface Props {
  places: WorkspacePlace[];
  days: WorkspaceDay[];
  labels: {
    map: string;
    itinerary: string;
    showItinerary: string;
    hideItinerary: string;
    day: string;
    empty: string;
    emptyMap: string;
    place: string;
  };
}

/**
 * The application boundary for the map-first trip workspace.
 *
 * The itinerary is a projection of server data. It does not duplicate map
 * state: selecting an itinerary item sends a typed focus request to MapLibre,
 * while marker focus and map-local popovers remain inside TripMap.
 */
export default function TripWorkspace({ places, days, labels }: Props) {
  const [itineraryOpen, setItineraryOpen] = useState(true);
  // Let MapLibre fit the complete trip on first render. A focus request only
  // happens after the user chooses a marker or itinerary item.
  const [focusPlaceId, setFocusPlaceId] = useState<string | null>(null);

  const focusPlace = useCallback((placeId: string) => setFocusPlaceId(placeId), []);

  return (
    <section className="mt-6" aria-label={labels.map}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {labels.map}
        </h2>
        <Button
          className="lg:hidden"
          size="sm"
          variant="outline"
          aria-expanded={itineraryOpen}
          onPress={() => setItineraryOpen((open) => !open)}
        >
          {itineraryOpen ? labels.hideItinerary : labels.showItinerary}
        </Button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {places.length > 0 ? (
            <TripMap
              places={places}
              focusPlaceId={focusPlaceId}
              onPlaceFocus={focusPlace}
            />
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              {labels.emptyMap}
            </div>
          )}
        </div>

        <aside
          className={`${itineraryOpen ? "block" : "hidden"} rounded-lg border bg-card p-4 lg:block`}
          aria-label={labels.itinerary}
        >
          <h3 className="mb-4 font-semibold">{labels.itinerary}</h3>
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <div className="space-y-5">
              {days.map((tripDay) => (
                <section key={tripDay.id} aria-labelledby={`trip-day-${tripDay.id}`}>
                  <h4
                    id={`trip-day-${tripDay.id}`}
                    className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {labels.day} {tripDay.dateIndex + 1}
                  </h4>
                  {tripDay.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{labels.empty}</p>
                  ) : (
                    <ol className="space-y-1">
                      {tripDay.items.map((item) => {
                        const place = places.find((candidate) => candidate.id === item.placeId);
                        return (
                          <li key={item.id}>
                            {place ? (
                              <button
                                type="button"
                                className={`flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${focusPlaceId === place.id ? "bg-primary/10 font-medium" : ""}`}
                                aria-label={`${labels.place}: ${place.name}`}
                                aria-current={focusPlaceId === place.id ? "true" : undefined}
                                onClick={() => focusPlace(place.id)}
                              >
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                  {tripDay.items.indexOf(item) + 1}
                                </span>
                                <span className="truncate">{place.name}</span>
                              </button>
                            ) : (
                              <p className="px-2 py-2 text-sm text-muted-foreground">
                                {item.note ?? labels.empty}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
