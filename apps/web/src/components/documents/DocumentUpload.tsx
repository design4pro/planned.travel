import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "@planned/shared";

interface ReservationOption {
  id: string;
  label: string;
}

interface Labels {
  title: string;
  file: string;
  pick: string;
  attach: string;
  none: string;
  upload: string;
  uploading: string;
  error: string;
  tooLarge: string;
}

interface Props {
  tripId: string;
  reservations: ReservationOption[];
  labels: Labels;
}

const accept = ACCEPTED_DOCUMENT_TYPES.join(",");

/** Upload a document (POST multipart /api/trips/:id/documents) then reload. */
export default function DocumentUpload({ tripId, reservations, labels }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [reservationId, setReservationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError(labels.tooLarge);
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (reservationId) fd.append("reservationId", reservationId);
    const res = await fetch(`/api/trips/${tripId}/documents`, { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error === "file_too_large" ? labels.tooLarge : labels.error);
      return;
    }
    window.location.reload();
  }

  return (
    <details className="rounded-lg border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium">{labels.title}</summary>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.file}</span>
          <input
            type="file"
            accept={accept}
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground hover:file:bg-primary/90"
          />
        </label>
        {reservations.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{labels.attach}</span>
            <select
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{labels.none}</option>
              {reservations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit" disabled={busy || !file}>
          {busy ? labels.uploading : labels.upload}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </details>
  );
}
