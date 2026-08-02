import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatMoney, EXPENSE_CATEGORIES, type ExpenseCategory } from "@planned/shared";
import { trpc } from "../../../lib/trpc";

export const Route = createFileRoute("/app/trips/$id/expenses")({ component: ExpensesPage });

function ExpensesPage() {
  const { id } = Route.useParams();
  const plan = trpc.trips.get.useQuery({ id });
  const expenses = trpc.trips.expenses.list.useQuery({ tripId: id });
  const utils = trpc.useUtils();
  const create = trpc.trips.expenses.create.useMutation({ onSuccess: () => expenses.refetch() });
  const remove = trpc.trips.expenses.remove.useMutation({ onSuccess: () => utils.trips.expenses.list.invalidate({ tripId: id }) });
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "">("");

  if (plan.isPending || expenses.isPending) return <main className="mx-auto max-w-4xl px-6 py-12" role="status">Loading costs…</main>;
  if (plan.isError || expenses.isError) return <main className="mx-auto max-w-3xl px-6 py-20"><h1 className="text-2xl font-semibold">Costs unavailable</h1><p className="mt-2 text-muted-foreground">You may not have access to this trip.</p><Link to="/app" className="mt-6 inline-block text-primary underline">Back to trips</Link></main>;

  const canEdit = plan.data.trip.role !== "viewer";
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amountCents = Math.round(Number(amount) * 100);
    if (!Number.isInteger(amountCents) || amountCents <= 0) return;
    create.mutate({ tripId: id, amountCents, currency, description: description.trim() || undefined, category: category || undefined }, { onSuccess: () => { setAmount(""); setDescription(""); setCategory(""); } });
  }
  return <main className="mx-auto max-w-4xl px-6 py-10">
    <Link to="/app/trips/$id" params={{ id }} className="text-sm text-muted-foreground underline">← {plan.data.trip.title}</Link>
    <header className="mb-8 mt-4"><h1 className="text-4xl font-bold">Costs</h1><p className="mt-2 text-muted-foreground">Track shared expenses and settle balances by currency.</p></header>
    {!canEdit && <p className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">You’re viewing this trip. Editing is disabled.</p>}
    {canEdit && <Card><Card.Header><Card.Title>Add an expense</Card.Title><Card.Description>Splits are shared equally across trip members.</Card.Description></Card.Header><Card.Content><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-sm"><span className="font-medium">Amount</span><Input aria-label="Amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label><label className="flex flex-col gap-1 text-sm"><span className="font-medium">Currency</span><select className="rounded-lg border border-border bg-background px-3 py-2" value={currency} onChange={(e) => setCurrency(e.target.value)}><option>USD</option><option>EUR</option></select></label><label className="flex flex-col gap-1 text-sm"><span className="font-medium">Description</span><Input aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} /></label><label className="flex flex-col gap-1 text-sm"><span className="font-medium">Category</span><select className="rounded-lg border border-border bg-background px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory | "")}><option value="">Other</option>{EXPENSE_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{create.isError && <p role="alert" className="text-sm text-danger sm:col-span-2">{create.error.message}</p>}<Button type="submit" isPending={create.isPending} className="sm:col-span-2">Add expense</Button></form></Card.Content></Card>}
    <section className="mt-8" aria-labelledby="expenses-heading"><h2 id="expenses-heading" className="mb-4 text-2xl font-semibold">Expenses</h2>{expenses.data.expenses.length === 0 ? <Card><Card.Content><p className="py-8 text-center text-muted-foreground">No expenses yet.</p></Card.Content></Card> : <div className="space-y-3">{expenses.data.expenses.map((expense) => <Card key={expense.id}><Card.Content><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{expense.description || expense.category || "Expense"}</h3><p className="mt-1 text-sm text-muted-foreground">Paid by {expense.paidByUserId.slice(0, 6)} · split across {expense.splits.length}</p></div><div className="flex items-center gap-3"><span className="font-semibold tabular-nums">{formatMoney(expense.amountCents, expense.currency)}</span>{canEdit && <Button size="sm" variant="ghost" onPress={() => remove.mutate({ id: expense.id })} isPending={remove.isPending}>Delete</Button>}</div></div></Card.Content></Card>)}</div>}</section>
    {expenses.data.summaries.map((summary) => <section key={summary.currency} className="mt-8" aria-labelledby={`balance-${summary.currency}`}><h2 id={`balance-${summary.currency}`} className="mb-4 text-2xl font-semibold">{summary.currency} balances</h2><Card><Card.Content><ul className="space-y-2">{summary.balances.filter((balance) => balance.paidCents || balance.shareCents).map((balance) => <li key={balance.userId} className="flex justify-between text-sm"><span>{balance.userId.slice(0, 6)}</span><span className={balance.netCents >= 0 ? "text-success" : "text-danger"}>{formatMoney(balance.netCents, summary.currency)}</span></li>)}</ul></Card.Content></Card></section>)}
  </main>;
}
