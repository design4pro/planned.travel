/**
 * Cost-splitting domain logic — Splitwise-style expense sharing.
 *
 * Platform-agnostic (no DOM/Worker/Node imports) so it runs in the Astro SSR
 * page, the React islands, the Hono API, and the future Expo app alike.
 *
 * Money is stored as integer cents and settled per-currency: you can't net a
 * USD debt against an EUR one, so balances and settlements are grouped by
 * currency and never converted (FX conversion is a later enhancement).
 */
import { z } from "zod";

/* ------------------------------ Domain enums ----------------------------- */

export const EXPENSE_CATEGORIES = [
  "food",
  "lodging",
  "transport",
  "activities",
  "shopping",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);

/** ISO-4217-ish: we don't ship a full currency list, just enforce the shape. */
export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3);

/* ------------------------------- DTO shapes ------------------------------ */
// Mirror the @planned/db tables; these are the single source of truth for the
// API contract shared with the typed client + Expo app.

export const createExpenseSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  currency: currencySchema,
  category: expenseCategorySchema.optional(),
  description: z.string().trim().max(200).optional(),
  date: z.number().int().nonnegative().optional(),
  /** User IDs to split across. Defaults to all trip members (equal split). */
  participantIds: z.array(z.string().min(1)).optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export interface Member {
  userId: string;
}

export interface ExpenseSplit {
  userId: string;
  shareCents: number;
}

export interface Expense {
  id: string;
  paidByUserId: string;
  amountCents: number;
  currency: string;
  category?: string | null;
  description?: string | null;
  date?: number | null;
  splits: ExpenseSplit[];
}

/* ------------------------------ Splitting -------------------------------- */

/**
 * Equal split with cent-level rounding. The remainder cents (amount mod n) are
 * distributed one each to the first members, so the shares always sum exactly
 * to amountCents.
 */
export function equalSplit(amountCents: number, memberIds: string[]): ExpenseSplit[] {
  const amount = Math.max(0, Math.floor(amountCents));
  const ids = memberIds.filter(Boolean);
  if (ids.length === 0) return [];
  const base = Math.floor(amount / ids.length);
  const remainder = amount - base * ids.length;
  return ids.map((userId, i) => ({
    userId,
    shareCents: base + (i < remainder ? 1 : 0),
  }));
}

/* ------------------------------ Balances --------------------------------- */

export interface BalanceRow {
  userId: string;
  paidCents: number;
  shareCents: number;
  /** Positive = is owed money (creditor); negative = owes money (debtor). */
  netCents: number;
}

/**
 * Net balance per member for a single currency group. Members not present in
 * any expense still get a zero row so the UI can show everyone.
 */
export function computeBalances(members: Member[], expenses: Expense[]): BalanceRow[] {
  const rows = new Map<string, BalanceRow>();
  for (const m of members) {
    rows.set(m.userId, { userId: m.userId, paidCents: 0, shareCents: 0, netCents: 0 });
  }
  for (const e of expenses) {
    const payer = rows.get(e.paidByUserId);
    if (payer) payer.paidCents += e.amountCents;
    for (const s of e.splits) {
      const row = rows.get(s.userId);
      if (row) row.shareCents += s.shareCents;
    }
  }
  for (const row of rows.values()) row.netCents = row.paidCents - row.shareCents;
  return [...rows.values()];
}

/* ----------------------------- Settle-up --------------------------------- */

export interface Settlement {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

/**
 * Greedy minimal-transactions settle-up for one currency group: always settle
 * the largest debt against the largest credit. Produces at most n-1 payments.
 */
export function settleUp(balances: BalanceRow[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ userId: b.userId, amount: -b.netCents }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ userId: b.userId, amount: b.netCents }))
    .sort((a, b) => b.amount - a.amount);

  const out: Settlement[] = [];
  // Greedy: settle the largest debt (front, sorted desc) against the largest
  // credit. Shift each side once its balance hits zero.
  while (debtors.length && creditors.length) {
    const d = debtors[0];
    const c = creditors[0];
    if (!d || !c) break;
    const pay = Math.min(d.amount, c.amount);
    if (pay > 0) out.push({ fromUserId: d.userId, toUserId: c.userId, amountCents: pay });
    d.amount -= pay;
    c.amount -= pay;
    if (d.amount === 0) debtors.shift();
    if (c.amount === 0) creditors.shift();
  }
  return out;
}

/* --------------------------- Currency summary ---------------------------- */

export interface CurrencySummary {
  currency: string;
  totalCents: number;
  balances: BalanceRow[];
  settlements: Settlement[];
}

/** Group expenses by currency and compute balances + settlements per group. */
export function summarizeByCurrency(members: Member[], expenses: Expense[]): CurrencySummary[] {
  const byCurrency = new Map<string, Expense[]>();
  for (const e of expenses) {
    const list = byCurrency.get(e.currency);
    if (list) list.push(e);
    else byCurrency.set(e.currency, [e]);
  }
  return [...byCurrency.entries()]
    .map(([currency, list]) => {
      const balances = computeBalances(members, list);
      return {
        currency,
        totalCents: list.reduce((sum, e) => sum + e.amountCents, 0),
        balances,
        settlements: settleUp(balances),
      };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/* ----------------------------- Formatting -------------------------------- */

/** Format integer cents as a localized currency string. */
export function formatMoney(cents: number, currency: string, lang: "en" | "pl" = "en"): string {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat(lang === "pl" ? "pl-PL" : "en-US", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Replace `{from}` / `{to}` placeholders in a translated settle-up string. */
export function fillSettlement(
  template: string,
  from: string,
  to: string,
): string {
  return template.replace("{from}", from).replace("{to}", to);
}
