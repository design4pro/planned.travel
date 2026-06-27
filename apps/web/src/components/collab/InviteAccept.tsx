import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface Preview {
  valid: boolean;
  reason?: "invalid" | "revoked" | "expired" | "exhausted";
  tripId?: string;
  tripTitle?: string | null;
  role?: "editor" | "viewer";
}

interface Labels {
  title: string;
  subtitle: string;
  as: (role: string) => string;
  accept: string;
  open: string;
  already: string;
  signin: string;
  error: string;
  generic: string;
  roleEditor: string;
  roleViewer: string;
}

interface Props {
  token: string;
  authed: boolean;
  labels: Labels;
}

/** Shows invite details, then accepts (if signed in) or prompts sign-in. */
export default function InviteAccept({ token, authed, labels }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"accepted" | "already" | "error" | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invitations/${token}`)
      .then((r) => r.json())
      .then((p) => setPreview(p as Preview))
      .catch(() => setPreview({ valid: false, reason: "invalid" }));
  }, [token]);

  async function accept() {
    setBusy(true);
    const res = await fetch(`/api/invitations/${token}/accept`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const body = (await res.json()) as { tripId: string };
      setTripId(body.tripId);
      setOutcome("accepted");
      setTimeout(() => window.location.assign(`/app/trips/${body.tripId}`), 600);
    } else if (res.status === 409 || res.status === 400) {
      // Already a member (or owner) — open the trip.
      const body = preview?.tripId ?? null;
      if (body) {
        setTripId(body);
        setOutcome("already");
      } else {
        setOutcome("error");
      }
    } else {
      setOutcome("error");
    }
  }

  const roleName = (role?: string) =>
    role === "viewer" ? labels.roleViewer : labels.roleEditor;

  if (!preview) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }

  if (!preview.valid) {
    return <p className="text-sm text-destructive">{labels.error}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{labels.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
      </div>

      {preview.tripTitle && (
        <p className="rounded-lg border bg-card px-4 py-3 text-lg font-semibold">
          {preview.tripTitle}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{labels.as(roleName(preview.role))}</p>

      {outcome === "accepted" && (
        <p className="text-sm text-emerald-600">
          {labels.accept} → {labels.open}…
        </p>
      )}
      {outcome === "already" && tripId && (
        <a className="text-sm text-primary underline" href={`/app/trips/${tripId}`}>
          {labels.already} — {labels.open}
        </a>
      )}
      {outcome === "error" && <p className="text-sm text-destructive">{labels.generic}</p>}

      {outcome === null &&
        (authed ? (
          <Button onClick={accept} disabled={busy}>
            {labels.accept}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button asChild>
              <a href="/login">{labels.signin}</a>
            </Button>
          </div>
        ))}
    </div>
  );
}
