CREATE TABLE `place_photo_selections` (
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`place_id` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`mode` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`organization_id`, `place_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`trip_id`,`place_id`) REFERENCES `places`(`organization_id`,`trip_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "place_photo_selections_version_chk" CHECK(("version" IS NULL OR "version" >= 0)),
	CONSTRAINT "place_photo_selections_mode_chk" CHECK(("mode" IS NULL OR "mode" IN ('legacy', 'fallback')))
);
--> statement-breakpoint
CREATE INDEX `place_photo_selections_trip_idx` ON `place_photo_selections` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `places_photo_parent_idx` ON `places` (`organization_id`,`trip_id`,`id`);