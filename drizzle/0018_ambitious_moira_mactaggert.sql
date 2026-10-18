CREATE TABLE `trip_invite_links` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`token` text NOT NULL,
	`rotation` integer DEFAULT 0 NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_by` text NOT NULL,
	`rotated_at` integer NOT NULL,
	`disabled_at` integer,
	`last_used_at` integer,
	`use_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trip_invite_links_rotation_chk" CHECK(("rotation" IS NULL OR "rotation" >= 0)),
	CONSTRAINT "trip_invite_links_use_count_chk" CHECK(("use_count" IS NULL OR "use_count" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_invite_links_token_unq` ON `trip_invite_links` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `trip_invite_links_trip_unq` ON `trip_invite_links` (`trip_id`);--> statement-breakpoint
CREATE INDEX `trip_invite_links_org_trip_idx` ON `trip_invite_links` (`organization_id`,`trip_id`);