import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Labels {
  title: string;
  name: string;
  lat: string;
  lng: string;
  add: string;
  error: string;
}

interface Props {
  tripId: string;
  labels: Labels;
}

/** Adds a place (POST /api/trips/:id/places) then pins it to the first day
 *  (POST /api/trips/:id/items), then reloads. React island. */
export default function AddPlace({ tripId, labels }: Props) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const pRes = await fetch(`/api/trips/${tripId}/places`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), lat: Number(lat), lng: Number(lng) }),
    });
    if (!pRes.ok) {
      setBusy(false);
      setError(labels.error);
      return;
    }
    const place = await pRes.json();
    const iRes = await fetch(`/api/trips/${tripId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ placeId: place.id }),
    });
    setBusy(false);
    if (!iRes.ok) {
      setError(labels.error);
      return;
    }
    window.location.reload();
  }

  return (
    <details className="rounded-lg border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium">{labels.title}</summary>
      <form onSubmit={add} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="text"
          required
          maxLength={120}
          placeholder={labels.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          type="number"
          step="any"
          required
          placeholder={labels.lat}
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          type="number"
          step="any"
          required
          placeholder={labels.lng}
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={busy}>
          {labels.add}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </details>
  );
}
