import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Role = "editor" | "viewer";

interface Invitation {
  id: string;
  url: string;
  role: Role;
  open: boolean;
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
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [maxUses, setMaxUses] = useState<number>(0);
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
        ...(expiresInDays > 0 ? { expiresInDays } : {}),
        ...(maxUses > 0 ? { maxUses } : {}),
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
    setInvites((prev) => prev.filter((i) => i.id !== id));
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

      <form onSubmit={create} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          {labels.role}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="editor">{labels.roleEditor}</option>
            <option value="viewer">{labels.roleViewer}</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          {labels.expiry}
          <select
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {EXPIRY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d === 0 ? labels.expiryNever : labels.expiryDays(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          {labels.maxUses}
          <select
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {MAX_USES_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? labels.maxUsesAny : labels.maxUsesN(n)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={busy}>
          {labels.create}
        </Button>
      </form>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

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
            <button
              type="button"
              onClick={() => copy(inv)}
              className="ml-auto rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
            >
              {copiedId === inv.id ? labels.copied : labels.copy}
            </button>
            <button
              type="button"
              onClick={() => revoke(inv.id)}
              className="rounded-md border border-input px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
            >
              {labels.revoke}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function StatusBadge({ inv, labels }: { inv: Invitation; labels: Labels }) {
  let text = labels.statusOpen;
  let cls = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (inv.revokedAt != null) {
    text = labels.statusRevoked;
    cls = "bg-muted text-muted-foreground";
  } else if (inv.expiresAt != null && inv.expiresAt <= Date.now()) {
    text = labels.statusExpired;
    cls = "bg-muted text-muted-foreground";
  } else if (inv.maxUses != null && inv.useCount >= inv.maxUses) {
    text = labels.statusUsed;
    cls = "bg-muted text-muted-foreground";
  } else if (!inv.open) {
    text = labels.statusUsed;
    cls = "bg-muted text-muted-foreground";
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}
