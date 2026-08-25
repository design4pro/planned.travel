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
	`map_style` text DEFAULT 'planned-light' NOT NULL,
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
-- Normalise the locale columns onto the twenty-three tags the product ships (docs/SPEC.md §8).
--
-- The recreation above only changes what a *new* row defaults to. Every workspace created before
-- this migration still stores `en-GB`, and the regional-format control wrote `pl-PL`, `ja-JP` and
-- `de-DE` into the same column, so a membership test against the shipped set would answer "no" for
-- every row in production and drop each of those workspaces to `Accept-Language`.
--
-- The mapping below is the SQL of `resolveLocaleTag` in `src/lib/i18n/negotiate.ts`: match the
-- stored tag case-insensitively against the registry and the alias table, then against the longest
-- matching prefix on a subtag boundary — `en-GB` → `en`, `pt-PT` → `pt-BR`, `zh-Hant-TW` → `zh-Hant`.
-- `ORDER BY length(stored) DESC` is what makes it the *longest* prefix, so `zh-TW` reaches
-- `zh-Hant` rather than being swallowed by the bare `zh` row.
--
-- The tags are spelled out here rather than imported because a migration is a historical record: it
-- must keep meaning exactly this whatever the registry grows into later.
CREATE TABLE `__locale_normalisation` (
	`stored` text PRIMARY KEY NOT NULL,
	`shipped` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__locale_normalisation` (`stored`, `shipped`) VALUES
	('ar', 'ar'),
	('ca', 'ca'),
	('cs', 'cs'),
	('de', 'de'),
	('el', 'el'),
	('en', 'en'),
	('es', 'es'),
	('fr', 'fr'),
	('hu', 'hu'),
	('id', 'id'),
	('it', 'it'),
	('ja', 'ja'),
	('ko', 'ko'),
	('nl', 'nl'),
	('pl', 'pl'),
	('pt-br', 'pt-BR'),
	('ru', 'ru'),
	('sv', 'sv'),
	('tr', 'tr'),
	('uk', 'uk'),
	('vi', 'vi'),
	('zh-hans', 'zh-Hans'),
	('zh-hant', 'zh-Hant'),
	('in', 'id'),
	('pt', 'pt-BR'),
	('pt-pt', 'pt-BR'),
	('zh', 'zh-Hans'),
	('zh-chs', 'zh-Hans'),
	('zh-cn', 'zh-Hans'),
	('zh-my', 'zh-Hans'),
	('zh-sg', 'zh-Hans'),
	('zh-cht', 'zh-Hant'),
	('zh-hk', 'zh-Hant'),
	('zh-mo', 'zh-Hant'),
	('zh-tw', 'zh-Hant');
--> statement-breakpoint
-- A workspace default is NOT NULL, so a tag nothing can canonicalise becomes the source locale.
UPDATE `organization_settings` SET `locale` = COALESCE((
	SELECT `m`.`shipped` FROM `__locale_normalisation` `m`
	WHERE lower(`organization_settings`.`locale`) = `m`.`stored`
		OR lower(`organization_settings`.`locale`) LIKE `m`.`stored` || '-%'
	ORDER BY length(`m`.`stored`) DESC
	LIMIT 1
), 'en');
--> statement-breakpoint
-- A traveller's override is nullable, and NULL already means "follow the workspace" — which is
-- exactly what the negotiator does with an override it cannot resolve. So an unmappable personal
-- tag is cleared rather than guessed at.
UPDATE `user_settings` SET `locale` = (
	SELECT `m`.`shipped` FROM `__locale_normalisation` `m`
	WHERE lower(`user_settings`.`locale`) = `m`.`stored`
		OR lower(`user_settings`.`locale`) LIKE `m`.`stored` || '-%'
	ORDER BY length(`m`.`stored`) DESC
	LIMIT 1
) WHERE `locale` IS NOT NULL;
--> statement-breakpoint
DROP TABLE `__locale_normalisation`;
