import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { createDb, type Database } from "@planned/db";
import { appRouter } from "../src/router";

const migrationPath = fileURLToPath(
  new URL("../../../apps/web/migrations/0000_melted_guardsmen.sql", import.meta.url),
);

describe("trip place planning flow", () => {
  let miniflare: Miniflare;
  let binding: D1Database;
  let db: Database;

  beforeEach(async () => {
    miniflare = new Miniflare({
      compatibilityDate: "2026-07-02",
      d1Databases: { DB: "planned-travel-test" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    });
    binding = await miniflare.getD1Database("DB");
    db = createDb(binding);

    const migration = await readFile(migrationPath, "utf8");
    const statements = new Map(
      migration.split("--> statement-breakpoint").map((statement) => [
        statement.match(/CREATE TABLE `([^`]+)`/)?.[1],
        statement,
      ]),
    );
    for (const table of ["trip", "trip_member", "place", "day", "day_item"]) {
      const statement = statements.get(table);
      if (!statement) throw new Error(`Missing ${table} migration`);
      await binding.prepare(statement).run();
    }
  });

  afterEach(async () => {
    await miniflare.dispose();
  });

  const caller = (userId: string) =>
    appRouter.createCaller({
      request: new Request("https://planned.test/api/trpc"),
      env: { DB: binding },
      db,
      user: { id: userId },
    });

  async function seedTrip(id: string, ownerId: string) {
    await binding.prepare(
      "INSERT INTO trip (id, owner_id, title, visibility, created_at, updated_at) VALUES (?, ?, ?, 'private', 1, 1)",
    ).bind(id, ownerId, `Trip ${id}`).run();
  }

  async function addMember(tripId: string, userId: string, role: "editor" | "viewer") {
    await binding.prepare(
      "INSERT INTO trip_member (id, trip_id, user_id, role, created_at) VALUES (?, ?, ?, ?, 1)",
    ).bind(`${tripId}-${userId}`, tripId, userId, role).run();
  }

  it("creates the first day, place, and plan item and returns them on the next read", async () => {
    await seedTrip("trip-1", "owner");

    const created = await caller("owner").trips.addPlace({
      tripId: "trip-1",
      name: "  Belém Tower  ",
      lat: 38.6916,
      lng: -9.216,
    });
    const plan = await caller("owner").trips.get({ id: "trip-1" });

    expect(created.day).toMatchObject({ dateIndex: 0 });
    expect(created.place).toMatchObject({ name: "Belém Tower", lat: 38.6916, lng: -9.216 });
    expect(created.item).toMatchObject({ dayId: created.day.id, placeId: created.place.id, type: "place" });
    expect(plan.days).toEqual([expect.objectContaining({ id: created.day.id, dateIndex: 0 })]);
    expect(plan.places).toEqual([expect.objectContaining({ id: created.place.id, name: "Belém Tower" })]);
    expect(plan.items).toEqual([expect.objectContaining({ id: created.item.id, placeId: created.place.id })]);
  });

  it("allows an editor to add a place to an existing day", async () => {
    await seedTrip("trip-1", "owner");
    await addMember("trip-1", "editor", "editor");
    await binding.prepare(
      "INSERT INTO day (id, trip_id, date_index, created_at) VALUES ('day-2', 'trip-1', 2, 1)",
    ).run();

    const created = await caller("editor").trips.addPlace({
      tripId: "trip-1",
      dayId: "day-2",
      name: "Alfama",
      lat: 38.711,
      lng: -9.13,
    });

    expect(created.day.id).toBe("day-2");
    expect(created.item.dayId).toBe("day-2");
  });

  it.each([
    ["viewer", "viewer"],
    ["outsider", "outsider"],
  ])("rejects %s access without a partial write", async (_label, userId) => {
    await seedTrip("trip-1", "owner");
    await addMember("trip-1", "viewer", "viewer");

    await expect(caller(userId).trips.addPlace({
      tripId: "trip-1",
      name: "Sintra",
      lat: 38.8,
      lng: -9.4,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(binding.prepare("SELECT COUNT(*) AS count FROM place").first<{ count: number }>("count"))
      .resolves.toBe(0);
    await expect(binding.prepare("SELECT COUNT(*) AS count FROM day_item").first<{ count: number }>("count"))
      .resolves.toBe(0);
  });

  it("rejects a day from another trip without writing the place", async () => {
    await seedTrip("trip-1", "owner");
    await seedTrip("trip-2", "other");
    await binding.prepare(
      "INSERT INTO day (id, trip_id, date_index, created_at) VALUES ('other-day', 'trip-2', 0, 1)",
    ).run();

    await expect(caller("owner").trips.addPlace({
      tripId: "trip-1",
      dayId: "other-day",
      name: "Sintra",
      lat: 38.8,
      lng: -9.4,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(binding.prepare("SELECT COUNT(*) AS count FROM place").first<{ count: number }>("count"))
      .resolves.toBe(0);
  });

  it("rejects a place from another trip when adding an existing place item", async () => {
    await seedTrip("trip-1", "owner");
    await seedTrip("trip-2", "other");
    await binding.prepare(
      "INSERT INTO day (id, trip_id, date_index, created_at) VALUES ('day-1', 'trip-1', 0, 1)",
    ).run();
    await binding.prepare(
      "INSERT INTO place (id, trip_id, name, lat, lng, provider, created_at) VALUES ('other-place', 'trip-2', 'Porto', 41.1, -8.6, 'custom', 1)",
    ).run();

    await expect(caller("owner").trips.addItem({
      tripId: "trip-1",
      dayId: "day-1",
      placeId: "other-place",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(binding.prepare("SELECT COUNT(*) AS count FROM day_item").first<{ count: number }>("count"))
      .resolves.toBe(0);
  });

  it("rolls back the place and implicit day when the item insert fails", async () => {
    await seedTrip("trip-1", "owner");
    await binding.exec(
      "CREATE TRIGGER fail_day_item BEFORE INSERT ON day_item BEGIN SELECT RAISE(FAIL, 'forced item failure'); END",
    );

    await expect(caller("owner").trips.addPlace({
      tripId: "trip-1",
      name: "Sintra",
      lat: 38.8,
      lng: -9.4,
    })).rejects.toThrow("forced item failure");

    await expect(binding.prepare("SELECT COUNT(*) AS count FROM place").first<{ count: number }>("count"))
      .resolves.toBe(0);
    await expect(binding.prepare("SELECT COUNT(*) AS count FROM day").first<{ count: number }>("count"))
      .resolves.toBe(0);
  });
});
