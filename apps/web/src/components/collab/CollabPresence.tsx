import { useRef } from "react";
import type { ChangeResource, Presence } from "@planned/shared";
import { useTripSync } from "./useTripSync";

interface Labels {
  online: string;
  alone: string;
}

interface Props {
  tripId: string;
  currentUserId: string;
  labels: Labels;
  /** Only refresh on these resources; omit to refresh on any change. */
  reloadOn?: ChangeResource[];
}

/** Live presence bar + LWW sync: when a collaborator edits, this tab refetches. */
export default function CollabPresence({ tripId, currentUserId, labels, reloadOn }: Props) {
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (resource: ChangeResource) => {
    if (reloadOn && !reloadOn.includes(resource)) return;
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    // Debounce bursts of edits, then reload to converge (last-write-wins).
    reloadTimer.current = setTimeout(() => window.location.reload(), 500);
  };

  const { connected, presence } = useTripSync({ tripId, onChange: handleChange });
  const others = presence.filter((p) => p.userId !== currentUserId);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
        title={connected ? "Realtime connected" : "Reconnecting…"}
      />
      {others.length === 0 ? (
        <span>{labels.alone}</span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="hidden sm:inline">{labels.online}:</span>
          <span className="flex -space-x-2">
            {others.slice(0, 5).map((p) => (
              <Avatar key={p.userId} p={p} />
            ))}
          </span>
          {others.length > 5 && <span className="ml-1 text-xs">+{others.length - 5}</span>}
        </span>
      )}
    </div>
  );
}

function Avatar({ p }: { p: Presence }) {
  const label = p.name ?? p.userId.slice(0, 6);
  const initials = label.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span
      title={`${label} · ${p.role}`}
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-xs font-semibold text-primary"
    >
      {initials}
    </span>
  );
}
