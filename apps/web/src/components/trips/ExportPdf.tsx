import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  tripId: string;
  label: string;
  upgrade: string;
  unavailable: string;
}

/**
 * Export the trip to PDF (GET /api/trips/:id/export.pdf). The endpoint is
 * Pro-gated (402) and needs the Browser Rendering binding (503 if absent); we
 * surface both as a friendly inline message instead of a JSON blob.
 */
export default function ExportPdf({ tripId, label, upgrade, unavailable }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportPdf() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/export.pdf`);
      if (res.status === 402) {
        setError(upgrade);
        return;
      }
      if (res.status === 503) {
        setError(unavailable);
        return;
      }
      if (!res.ok) {
        setError(unavailable);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] ?? "trip.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(unavailable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" onClick={exportPdf} disabled={busy}>
        {busy ? "…" : label}
      </Button>
      {error && <span className="text-xs text-muted-foreground">{error}</span>}
    </div>
  );
}
