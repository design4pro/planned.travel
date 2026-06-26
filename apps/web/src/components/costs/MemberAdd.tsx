import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Labels {
  title: string;
  email: string;
  add: string;
  error: string;
}

interface Props {
  tripId: string;
  labels: Labels;
}

/** Add a participant by email (POST /api/trips/:id/members), then reload. */
export default function MemberAdd({ tripId, labels }: Props) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(labels.error);
      return;
    }
    window.location.reload();
  }

  return (
    <details className="rounded-lg border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium">{labels.title}</summary>
      <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          required
          placeholder={labels.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-[12rem] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={busy}>
          {labels.add}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </details>
  );
}
