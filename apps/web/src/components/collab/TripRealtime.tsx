import { useEffect, useRef } from "react";
import type { ChangeResource, Presence } from "@planned/shared";
import { trpc } from "../../lib/trpc";
import { useTripSync } from "./useTripSync";

interface Props {
  tripId: string;
}

/**
 * TanStack Start trip collaboration boundary.
 *
 * The Durable Object carries presence and typed change notifications only.
 * D1 remains authoritative, so a change invalidates the trip query after a
 * short debounce rather than applying an event payload optimistically.
 */
export default function TripRealtime({ tripId }: Props) {
  const utils = trpc.useUtils();
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (resource: ChangeResource) => {
    if (!["trip", "plan", "places", "members"].includes(resource)) return;
    if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
    invalidateTimer.current = setTimeout(() => {
      void utils.trips.get.invalidate({ id: tripId });
      invalidateTimer.current = null;
    }, 300);
  };

  const { connected, presence } = useTripSync({ tripId, onChange: handleChange });

  useEffect(() => () => {
    if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
  }, []);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
      <span
        className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
        title={connected ? "Realtime connected" : "Reconnecting…"}
      />
      <span>{connected ? "Live" : "Reconnecting…"}</span>
      {presence.length > 0 && (
        <span className="flex items-center gap-2">
          {presence.slice(0, 5).map((person) => <PresenceAvatar key={person.userId} person={person} />)}
          {presence.length > 5 && <span>+{presence.length - 5}</span>}
        </span>
      )}
    </div>
  );
}

function PresenceAvatar({ person }: { person: Presence }) {
  const label = person.name?.trim() || person.userId.slice(0, 6);
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-xs font-semibold text-primary"
      title={`${label} · ${person.role}`}
      aria-label={`${label}, ${person.role}`}
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}
