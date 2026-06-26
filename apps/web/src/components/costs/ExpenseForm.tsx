import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EXPENSE_CATEGORIES } from "@planned/shared";

export interface MemberOption {
  userId: string;
  name: string | null;
  email: string | null;
}

interface Labels {
  title: string;
  amount: string;
  currency: string;
  category: string;
  description: string;
  participants: string;
  all: string;
  you: string;
  add: string;
  error: string;
  categories: Record<string, string>;
}

interface Props {
  tripId: string;
  members: MemberOption[];
  currentUserId: string;
  labels: Labels;
}

const CURRENCIES = ["USD", "EUR", "PLN", "GBP", "CHF", "JPY", "CZK", "NOK", "SEK", "DKK"];

/** Add an expense (POST /api/trips/:id/expenses) with an equal split, then reload. */
export default function ExpenseForm({ tripId, members, currentUserId, labels }: Props) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [participants, setParticipants] = useState<Set<string>>(
    () => new Set(members.map((m) => m.userId)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const displayName = (m: MemberOption) =>
    m.userId === currentUserId ? labels.you : m.name ?? m.email ?? m.userId.slice(0, 6);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError(labels.error);
      return;
    }
    setBusy(true);
    setError(null);
    const participantIds = [...participants];
    const res = await fetch(`/api/trips/${tripId}/expenses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: cents,
        currency,
        category: category || undefined,
        description: description.trim() || undefined,
        participantIds: participantIds.length ? participantIds : undefined,
      }),
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
      <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.amount}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.currency}</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.category}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">—</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {labels.categories[c] ?? c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.description}</span>
          <input
            type="text"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <fieldset className="sm:col-span-2 flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{labels.participants}</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {members.map((m) => (
              <label key={m.userId} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={participants.has(m.userId)}
                  onChange={() => toggle(m.userId)}
                  className="h-4 w-4 accent-primary"
                />
                <span>{displayName(m)}</span>
              </label>
            ))}
          </div>
        </fieldset>

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
