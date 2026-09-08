PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_organization_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`currency` text(3) DEFAULT 'EUR' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`week_starts_on` integer DEFAULT 1 NOT NULL,
	`date_format` text DEFAULT 'dd MMM yyyy' NOT NULL,
	`distance_unit` text DEFAULT 'metric' NOT NULL,
	`map_style` text DEFAULT 'auto' NOT NULL,
	`features` text,
	`onboarded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "organization_settings_distance_unit_chk" CHECK(("distance_unit" IS NULL OR "distance_unit" IN ('metric', 'imperial'))),
	CONSTRAINT "organization_settings_week_start_chk" CHECK("week_starts_on" BETWEEN 0 AND 6)
);
--> statement-breakpoint
INSERT INTO `__new_organization_settings`("id", "organization_id", "currency", "locale", "timezone", "week_starts_on", "date_format", "distance_unit", "map_style", "features", "onboarded_at", "created_at", "updated_at") SELECT "id", "organization_id", "currency", "locale", "timezone", "week_starts_on", "date_format", "distance_unit", "map_style", "features", "onboarded_at", "created_at", "updated_at" FROM `organization_settings`;--> statement-breakpoint
DROP TABLE `organization_settings`;--> statement-breakpoint
ALTER TABLE `__new_organization_settings` RENAME TO `organization_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `organization_settings_org_unq` ON `organization_settings` (`organization_id`);--> statement-breakpoint
-- Point the workspace basemap default at the catalogue's neutral entry, and remap the rows written
-- under the old one (`src/lib/map/basemap.ts`).
--
-- Everything above this line is `pnpm db:generate --name basemap_default` output, unedited:
-- drizzle-kit's SQLite table-recreation idiom for the one thing SQLite cannot ALTER, a column
-- default (`organization_settings.map_style`, `'planned-light'` → `'auto'`). The same pairing as
-- `drizzle/0002_locale_normalisation.sql`, and checked the same way — the DDL half is re-derived
-- from `drizzle/meta/0009_snapshot.json` plus the live schema in
-- `src/server/repos/__tests__/settings-map-style.test.ts` and fails if it has drifted.
--
-- drizzle-kit emits DDL and never data, so the remap of the rows already in the column is appended
-- below by hand. The two halves are one migration because either without the other is a broken
-- state: a new default with legacy rows still pinned, or remapped rows that the next insert
-- re-pins.
--
-- Why the rows have to move at all. Until this round the column was written but never read — the
-- map derived its palette from the chrome theme alone — so `'planned-light'` sat in every
-- workspace as an inert default. Now that `resolveBasemap` reads it, that id means something it
-- never meant when it was stored: `BASEMAPS['planned-light'].palette` is the fixed literal
-- `'light'`, so the entry pins paper and ignores the theme. Left alone, every workspace whose
-- owner never opened `/settings/appearance` would render a permanently light map under a dark
-- chrome — a regression against the behaviour those rows were written beside.
--
-- Only `'planned-light'` moves. It is the value the old DDL default wrote, so a row holding it is
-- indistinguishable from a workspace that never expressed a preference, and `'auto'` is what such
-- a workspace saw before the column was read. `'planned-dark'` was never a default: a row holding
-- it was chosen deliberately on the appearance screen, so it is left to take effect as picked.
--
-- The member column moves too, and has to move first. `user_settings.map_style` does default to
-- NULL, but NULL was never the only way a member said "follow the workspace": until this round the
-- appearance screen stored a *snapshot* of the workspace value for that choice —
-- `mapStyle: next === WORKSPACE_MAP_STYLE ? data.workspaceMapStyle : next` — so a member on a
-- workspace still holding the old default stored `planned-light` by asking to follow it, not by
-- picking paper. The same screen read the row back through the same equality it wrote: a member
-- value equal to the workspace value was displayed as "Follow the workspace". Clearing exactly
-- those rows therefore makes the stored data agree with what the screen had been reporting all
-- along, and leaves every row that differs from its workspace alone — those are the overrides the
-- old screen showed as overrides, and they survive for the same reason `planned-dark` does above.
--
-- The order of the two statements is load-bearing: the comparison is against the workspace value
-- as it stood when the snapshot was taken, so it has to run before the remap below rewrites it.
UPDATE `user_settings` SET `map_style` = NULL WHERE `map_style` = (SELECT `os`.`map_style` FROM `organization_settings` AS `os` WHERE `os`.`organization_id` = `user_settings`.`organization_id`);--> statement-breakpoint
UPDATE `organization_settings` SET `map_style` = 'auto' WHERE `map_style` = 'planned-light';
