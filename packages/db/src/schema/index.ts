/**
 * Domain schema for planned.travel (Cloudflare D1 / SQLite via Drizzle).
 *
 * Auth tables (user, session, account, verification, organization, member,
 * passkey, twoFactor) are OWNED by Better Auth and generated via
 * `@better-auth/cli generate`. Do not redefine them here. Domain tables below
 * reference `user.id` (text) as a foreign key.
 *
 * Portability: types are kept Postgres-friendly (text PKs, epoch-ms integer
 * timestamps) so a later move to Postgres + Hyperdrive is mechanical.
 */
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const now = () => integer("created_at").notNull().$defaultFn(() => Date.now());

/* --------------------------------- Trips --------------------------------- */

export const trips = sqliteTable("trip", {
  id: id(),
  ownerId: text("owner_id").notNull(), // -> better_auth user.id
  title: text("title").notNull(),
  description: text("description"),
  coverImageKey: text("cover_image_key"), // R2 object key
  visibility: text("visibility", { enum: ["private", "shared", "public"] })
    .notNull()
    .default("private"),
  startAt: integer("start_at"),
  endAt: integer("end_at"),
  createdAt: now(),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

export const tripMembers = sqliteTable("trip_member", {
  id: id(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id),
  userId: text("user_id").notNull(), // -> better_auth user.id
  role: text("role", { enum: ["owner", "editor", "viewer"] }).notNull().default("viewer"),
  createdAt: now(),
});

/* ----------------------------- Places & plan ----------------------------- */

export const places = sqliteTable("place", {
  id: id(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id),
  name: text("name").notNull(),
  category: text("category"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  address: text("address"),
  provider: text("provider", { enum: ["osm", "google", "custom"] }).notNull().default("custom"),
  providerId: text("provider_id"),
  createdAt: now(),
});

export const days = sqliteTable("day", {
  id: id(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id),
  dateIndex: integer("date_index").notNull(), // 0-based day offset
  date: integer("date"), // epoch ms for the calendar date (optional)
  createdAt: now(),
});

export const dayItems = sqliteTable("day_item", {
  id: id(),
  dayId: text("day_id")
    .notNull()
    .references(() => days.id),
  placeId: text("place_id").references(() => places.id),
  orderIndex: integer("order_index").notNull().default(0),
  type: text("type", { enum: ["place", "note", "transport"] }).notNull().default("place"),
  note: text("note"),
  createdAt: now(),
});

/* ------------------------------ Reservations ----------------------------- */

export const reservations = sqliteTable("reservation", {
  id: id(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id),
  type: text("type", { enum: ["flight", "hotel", "restaurant", "rental", "transport", "other"] })
    .notNull()
    .default("other"),
  status: text("status", { enum: ["planned", "confirmed", "cancelled"] })
    .notNull()
    .default("planned"),
  title: text("title"),
  confirmationCode: text("confirmation_code"),
  startsAt: integer("starts_at"),
  endsAt: integer("ends_at"),
  notes: text("notes"),
  // Structured parsed booking data (KDE Itinerary-style), from email/PDF ingestion (Phase 2).
  parsedData: text("parsed_data", { mode: "json" }),
  createdAt: now(),
});

/* ----------------------------- Costs / splits ---------------------------- */

export const expenses = sqliteTable("expense", {
  id: id(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id),
  paidByUserId: text("paid_by_user_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  category: text("category"),
  description: text("description"),
  date: integer("date"),
  createdAt: now(),
});

export const expenseSplits = sqliteTable("expense_split", {
  id: id(),
  expenseId: text("expense_id")
    .notNull()
    .references(() => expenses.id),
  userId: text("user_id").notNull(),
  shareCents: integer("share_cents").notNull(),
});

/* ------------------------- Documents & notifications --------------------- */

export const documents = sqliteTable("document", {
  id: id(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id),
  // Optional link to a reservation (the e-ticket / booking PDF for it).
  reservationId: text("reservation_id").references(() => reservations.id),
  uploadedByUserId: text("uploaded_by_user_id"), // -> better_auth user.id
  r2Key: text("r2_key").notNull(),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: now(),
});

export const notifications = sqliteTable("notification", {
  id: id(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  payload: text("payload", { mode: "json" }),
  readAt: integer("read_at"),
  createdAt: now(),
});

/* ------------------------------ Billing ---------------------------------- */

// One row per better_auth user (1:1 via userId). Created lazily with plan=free
// on first contact; flipped by Stripe webhook events. Owns stripeCustomerId so
// the same Customer is reused across Checkout sessions + Customer Portal.
export const subscriptions = sqliteTable("subscription", {
  id: id(),
  userId: text("user_id").notNull().unique(), // -> better_auth user.id
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  priceId: text("price_id"),
  plan: text("plan", { enum: ["free", "pro"] }).notNull().default("free"),
  status: text("status", { enum: ["active", "trialing", "past_due", "canceled", "incomplete"] })
    .notNull()
    .default("active"),
  interval: text("interval", { enum: ["month", "year"] }),
  currentPeriodEnd: integer("current_period_end"), // epoch-ms
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).default(false),
  createdAt: now(),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

export const schema = {
  trips,
  tripMembers,
  places,
  days,
  dayItems,
  reservations,
  expenses,
  expenseSplits,
  documents,
  notifications,
  subscriptions,
};

export type Schema = typeof schema;

/* ------------------------------ Auth tables ------------------------------ */
// Owned by Better Auth (user/session/account/verification/organization/member/
// invitation/twoFactor). Generated via @better-auth/cli generate against
// apps/web/src/lib/auth.cli.ts → merged here so drizzle-kit emits the SQL
// migration alongside the domain tables. Regenerate after changing auth plugins.
export * from "./auth";
