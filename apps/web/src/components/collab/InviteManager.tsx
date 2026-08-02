import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle } from "@/components/ui/alert";

type Role = "editor" | "viewer";

interface Invitation {
  id: string;
  url: string;
  role: Role;
  open: boolean;
  status?: "open" | "revoked" | "expired" | "exhausted";
  revokedAt: number | null;
  expiresAt: number | null;
  maxUses: number | null;
  useCount: number;
}

interface Labels {
  title: string;
  role: string;
  roleEditor: string;
  roleViewer: string;
  expiry: string;
  expiryNever: string;
  expiryDays: (n: number) => string;
  maxUses: string;
  maxUsesAny: string;
  maxUsesN: (n: number) => string;
  create: string;
  empty: string;
  copy: string;
  copied: string;
  revoke: string;
  revoked: string;
  statusOpen: string;
  statusUsed: string;
  statusExpired: string;
  statusRevoked: string;
  uses: (used: number) => string;
}

interface Props {
  tripId: string;
  labels: Labels;
}

const EXPIRY_OPTIONS = [0, 1, 7, 30] as const;
const MAX_USES_OPTIONS = [0, 1, 5, 10] as const;

/** Owner-only: mint shareable invite links and manage existing ones. */
export default function InviteManager({ tripId, labels }: Props) {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [role, setRole] = useState<Role>("editor");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [maxUses, setMaxUses] = useState("0");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/invitations`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setInvites(rows as Invitation[]))
      .catch(() => setInvites([]));
  }, [tripId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role,
        ...(Number(expiresInDays) > 0 ? { expiresInDays: Number(expiresInDays) } : {}),
        ...(Number(maxUses) > 0 ? { maxUses: Number(maxUses) } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(labels.revoked);
      return;
    }
    const created = (await res.json()) as Invitation;
    setInvites((prev) => [{ ...created, open: true, revokedAt: null }, ...prev]);
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(labels.revoked);
      return;
    }
    setInvites((prev) => prev.map((i) => (i.id === id ? { ...i, open: false, status: "revoked", revokedAt: Date.now() } : i)));
  }

  async function copy(inv: Invitation) {
    try {
      await navigator.clipboard.writeText(inv.url);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId((c) => (c === inv.id ? null : c)), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <details className="rounded-lg border bg-card p-3" open={invites.length === 0}>
      <summary className="cursor-pointer text-sm font-medium">{labels.title}</summary>

      <form onSubmit={create} className="mt-3 flex flex-wrap items-end gap-3">
        <InviteSelect label={labels.role} value={role} onChange={(value) => setRole(value as Role)} options={[{ id: "editor", label: labels.roleEditor }, { id: "viewer", label: labels.roleViewer }]} />
        <InviteSelect label={labels.expiry} value={expiresInDays} onChange={setExpiresInDays} options={EXPIRY_OPTIONS.map((d) => ({ id: String(d), label: d === 0 ? labels.expiryNever : labels.expiryDays(d) }))} />
        <InviteSelect label={labels.maxUses} value={maxUses} onChange={setMaxUses} options={MAX_USES_OPTIONS.map((n) => ({ id: String(n), label: n === 0 ? labels.maxUsesAny : labels.maxUsesN(n) }))} />
        <Button type="submit" isPending={busy}>
          {labels.create}
        </Button>
      </form>

      {error && <Alert className="mt-3" variant="destructive"><AlertTitle>{error}</AlertTitle></Alert>}

      <ul className="mt-3 space-y-2">
        {invites.length === 0 && <li className="text-sm text-muted-foreground">{labels.empty}</li>}
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
          >
            <StatusBadge inv={inv} labels={labels} />
            <span className="text-xs text-muted-foreground">
              {inv.role === "editor" ? labels.roleEditor : labels.roleViewer} · {labels.uses(inv.useCount)}
            </span>
            <code className="max-w-[12rem] truncate text-xs">{inv.url}</code>
            <Button size="sm" variant="outline" className="ml-auto" onPress={() => copy(inv)}>
              {copiedId === inv.id ? labels.copied : labels.copy}
            </Button>
            {inv.open && <Button size="sm" variant="destructive" onPress={() => revoke(inv.id)}>
              {labels.revoke}
            </Button>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function InviteSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { id: string; label: string }[] }) {
  return <label className="flex w-36 flex-col gap-1 text-sm"><span className="font-medium">{label}</span><select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
}

function StatusBadge({ inv, labels }: { inv: Invitation; labels: Labels }) {
  let text = labels.statusOpen;
  let cls = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (inv.status === "revoked" || inv.revokedAt != null) {
    text = labels.statusRevoked;
    cls = "bg-muted text-muted-foreground";
  } else if (inv.status === "expired" || (inv.expiresAt != null && inv.expiresAt <= Date.now())) {
    text = labels.statusExpired;
    cls = "bg-muted text-muted-foreground";
  } else if (inv.status === "exhausted" || (inv.maxUses != null && inv.useCount >= inv.maxUses)) {
    text = labels.statusUsed;
    cls = "bg-muted text-muted-foreground";
  } else if (!inv.open) {
    text = labels.statusUsed;
    cls = "bg-muted text-muted-foreground";
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}
