import { useState } from "react";
import { formatBytes } from "@planned/shared";

interface DocumentRow {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  reservationLabel: string | null;
  uploadedByName: string | null;
  createdAt: number;
}

interface Labels {
  empty: string;
  download: string;
  delete: string;
  deleted: string;
  by: string;
}

interface Props {
  documents: DocumentRow[];
  labels: Labels;
}

function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/** Read-only document list with download (anchor) + per-row delete → reload. */
export default function DocumentList({ documents, labels }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      setError(labels.deleted);
      return;
    }
    window.location.reload();
  }

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {documents.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <a
                href={`/api/documents/${d.id}/download`}
                className="block truncate text-sm font-medium hover:text-primary hover:underline"
                title={d.name}
              >
                {d.name}
              </a>
              <p className="text-xs text-muted-foreground">
                {formatBytes(d.sizeBytes)} · {d.mimeType || "file"} · {fmtDate(d.createdAt)}
                {d.reservationLabel ? ` · ${d.reservationLabel}` : ""}
                {d.uploadedByName ? ` ${labels.by.replace("{name}", d.uploadedByName)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <a
                href={`/api/documents/${d.id}/download`}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {labels.download}
              </a>
              <button
                type="button"
                onClick={() => remove(d.id)}
                disabled={busyId === d.id}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
              >
                {labels.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
