import { useState } from "react";
import { formatMoney as fmt } from "@planned/shared";

interface ExpenseRow {
  id: string;
  paidByUserId: string;
  paidByName: string | null;
  amountCents: number;
  currency: string;
  category: string | null;
  description: string | null;
}

interface Labels {
  paidBy: string;
  you: string;
  delete: string;
  deleted: string;
  empty: string;
  categories: Record<string, string>;
}

interface Props {
  expenses: ExpenseRow[];
  currentUserId: string;
  lang: "en" | "pl";
  labels: Labels;
}

/** Read-only expense list with a per-row delete (DELETE /api/expenses/:id → reload). */
export default function ExpenseList({ expenses, currentUserId, lang, labels }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      setError(labels.deleted);
      return;
    }
    window.location.reload();
  }

  if (expenses.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {expenses.map((e) => {
          const payer =
            e.paidByUserId === currentUserId
              ? labels.you
              : e.paidByName ?? e.paidByUserId.slice(0, 6);
          return (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {e.description?.trim() || e.category ? (labels.categories[e.category ?? ""] ?? e.category ?? "—") : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {labels.paidBy} {payer}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">
                  {fmt(e.amountCents, e.currency, lang)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  disabled={busyId === e.id}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
                >
                  {labels.delete}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
