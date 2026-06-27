import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  label: string;
  placeholder: string;
  btn: string;
  /** Shown when the Free-tier trip limit is hit (HTTP 402). */
  quotaError?: string;
  upgradeLabel?: string;
  pricingHref?: string;
}

/** Creates a trip via POST /api/trips, then opens it. React island.
 *  Surfaces the Free 3-trip limit (402) as an upgrade prompt. */
export default function CreateTrip({
  label,
  placeholder,
  btn,
  quotaError,
  upgradeLabel,
  pricingHref = "/pricing",
}: Props) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    setQuota(false);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setBusy(false);
    if (res.status === 402) {
      setQuota(true);
      return;
    }
    if (!res.ok) {
      setError("Failed to create trip");
      return;
    }
    const trip = await res.json();
    window.location.href = `/app/trips/${trip.id}`;
  }

  return (
    <div>
      <form onSubmit={create} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          required
          maxLength={120}
          aria-label={label}
          placeholder={placeholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={busy}>
          {btn}
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </form>
      {quota && (
        <p className="mt-2 text-sm text-destructive">
          {quotaError}{" "}
          <a href={pricingHref} className="font-medium underline">
            {upgradeLabel}
          </a>
        </p>
      )}
    </div>
  );
}
