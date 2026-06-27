import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RESERVATION_STATES, RESERVATION_TYPES } from "@planned/shared";

interface Labels {
  title: string;
  type: string;
  fieldTitle: string;
  status: string;
  confirmation: string;
  starts: string;
  ends: string;
  notes: string;
  add: string;
  error: string;
  types: Record<string, string>;
  states: Record<string, string>;
}

interface Props {
  tripId: string;
  labels: Labels;
}

/**
 * Create a reservation (POST /api/trips/:id/reservations) then reload.
 * Dates use <input type="datetime-local"> and are sent as epoch-ms.
 */
export default function ReservationForm({ tripId, labels }: Props) {
  const [type, setType] = useState<string>("other");
  const [status, setStatus] = useState<string>("planned");
  const [titleVal, setTitleVal] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/reservations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        status,
        title: titleVal.trim() || undefined,
        confirmationCode: confirmationCode.trim() || undefined,
        startsAt: startsAt ? new Date(startsAt).getTime() : undefined,
        endsAt: endsAt ? new Date(endsAt).getTime() : undefined,
        notes: notes.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(labels.error);
      return;
    }
    window.location.reload();
  }

  const inputCls =
    "rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <details className="rounded-lg border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium">{labels.title}</summary>
      <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.fieldTitle}</span>
          <input
            type="text"
            maxLength={200}
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.type}</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {RESERVATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {labels.types[t] ?? t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.status}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {RESERVATION_STATES.map((s) => (
              <option key={s} value={s}>
                {labels.states[s] ?? s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.confirmation}</span>
          <input
            type="text"
            maxLength={200}
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.starts}</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.ends}</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">{labels.notes}</span>
          <textarea
            rows={2}
            maxLength={4000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {labels.add}
          </Button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </details>
  );
}
