import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  invalid: string;
  revoked: string;
  expired: string;
  exhausted: string;
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
    } else if (res.status === 410) {
      const body = (await res.json().catch(() => ({}))) as { error?: Preview["reason"] };
      if (body.error === "revoked" || body.error === "expired" || body.error === "exhausted") {
        setPreview({ valid: false, reason: body.error });
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
    const reason = preview.reason === "revoked" ? labels.revoked : preview.reason === "expired" ? labels.expired : preview.reason === "exhausted" ? labels.exhausted : labels.invalid;
    return <Alert variant="destructive"><AlertTitle>{labels.error}</AlertTitle><AlertDescription>{reason}</AlertDescription></Alert>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{labels.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
      </div>

      {preview.tripTitle && (
        <Card><Card.Content><p className="text-lg font-semibold">{preview.tripTitle}</p></Card.Content></Card>
      )}
      <p className="text-sm text-muted-foreground">{labels.as(roleName(preview.role))}</p>

      {outcome === "accepted" && (
        <Alert className="border-emerald-500/50 text-emerald-700"><AlertTitle>{labels.accept} → {labels.open}…</AlertTitle></Alert>
      )}
      {outcome === "already" && tripId && (
        <Button variant="outline" onPress={() => window.location.assign(`/app/trips/${tripId}`)}>{labels.already} — {labels.open}</Button>
      )}
      {outcome === "error" && <Alert variant="destructive"><AlertTitle>{labels.generic}</AlertTitle></Alert>}

      {outcome === null &&
        (authed ? (
          <Button onPress={accept} isPending={busy}>
            {labels.accept}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button onPress={() => window.location.assign("/login")}>{labels.signin}</Button>
          </div>
        ))}
    </div>
  );
}
