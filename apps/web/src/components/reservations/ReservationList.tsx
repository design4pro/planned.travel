import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RESERVATION_STATES, RESERVATION_TYPES } from "@planned/shared";

interface ReservationRow {
  id: string;
  type: string;
  status: string;
  title: string | null;
  confirmationCode: string | null;
  startsAt: number | null;
  endsAt: number | null;
  notes: string | null;
  docCount: number;
}

interface Labels {
  empty: string;
  type: string;
  fieldTitle: string;
  status: string;
  confirmation: string;
  starts: string;
  ends: string;
  notes: string;
  save: string;
  cancel: string;
  edit: string;
  delete: string;
  error: string;
  deleted: string;
  attached: string;
  types: Record<string, string>;
  states: Record<string, string>;
}

interface Props {
  reservations: ReservationRow[];
  labels: Labels;
}

/** epoch-ms → value for a <input type="datetime-local"> (local time). */
function toLocalInput(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** epoch-ms → short localized date/time string. */
function fmtDateTime(ms: number | null): string {
  if (ms == null) return "—";
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const STATUS_CLS: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  planned: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const inputCls =
  "rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Inline editor for one reservation (PATCH /api/reservations/:id → reload). */
function RowEditor({
  res,
  labels,
  onDone,
}: {
  res: ReservationRow;
  labels: Labels;
  onDone: () => void;
}) {
  const [type, setType] = useState(res.type);
  const [status, setStatus] = useState(res.status);
  const [titleVal, setTitleVal] = useState(res.title ?? "");
  const [confirmationCode, setConfirmationCode] = useState(res.confirmationCode ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(res.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(res.endsAt));
  const [notes, setNotes] = useState(res.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res2 = await fetch(`/api/reservations/${res.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        status,
        title: titleVal.trim() || null,
        confirmationCode: confirmationCode.trim() || null,
        startsAt: startsAt ? new Date(startsAt).getTime() : null,
        endsAt: endsAt ? new Date(endsAt).getTime() : null,
        notes: notes.trim() || null,
      }),
    });
    setBusy(false);
    if (res2.ok) onDone();
  }

  return (
    <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{labels.fieldTitle}</span>
        <input value={titleVal} onChange={(e) => setTitleVal(e.target.value)} maxLength={200} className={inputCls} />
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
        <input value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} maxLength={200} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{labels.starts}</span>
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{labels.ends}</span>
        <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-muted-foreground">{labels.notes}</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} className={inputCls} />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="button" onClick={save} disabled={busy}>
          {labels.save}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}

export default function ReservationList({ reservations, labels }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      setError(labels.deleted);
      return;
    }
    window.location.reload();
  }

  if (reservations.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {reservations.map((r) => (
          <li key={r.id} className="px-4 py-3">
            {editId === r.id ? (
              <RowEditor res={r} labels={labels} onDone={() => window.location.reload()} />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {r.title?.trim() || (labels.types[r.type] ?? r.type)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[r.status] ?? ""}`}>
                      {labels.states[r.status] ?? r.status}
                    </span>
                    {r.docCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {labels.attached.replace("{count}", String(r.docCount))}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDateTime(r.startsAt)} → {fmtDateTime(r.endsAt)}
                    {r.confirmationCode ? ` · ${labels.confirmation}: ${r.confirmationCode}` : ""}
                  </p>
                  {r.notes?.trim() && <p className="mt-1 text-sm text-muted-foreground">{r.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditId(r.id)}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {labels.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={busyId === r.id}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
                  >
                    {labels.delete}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
