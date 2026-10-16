CREATE TABLE `calendar_feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`trip_id` text,
	`scope` text NOT NULL,
	`token_digest` text NOT NULL,
	`revoked_at` integer,
	`rotated_at` integer,
	`last_served_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "calendar_feeds_scope_chk" CHECK("calendar_feeds"."scope" IN ('trip', 'workspace')),
	CONSTRAINT "calendar_feeds_scope_trip_chk" CHECK(("calendar_feeds"."scope" = 'trip' AND "calendar_feeds"."trip_id" IS NOT NULL) OR ("calendar_feeds"."scope" = 'workspace' AND "calendar_feeds"."trip_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feeds_token_unq` ON `calendar_feeds` (`token_digest`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feeds_workspace_unq` ON `calendar_feeds` (`organization_id`,`user_id`) WHERE "calendar_feeds"."scope" = 'workspace';--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feeds_trip_unq` ON `calendar_feeds` (`organization_id`,`user_id`,`trip_id`) WHERE "calendar_feeds"."scope" = 'trip';--> statement-breakpoint
CREATE INDEX `calendar_feeds_trip_idx` ON `calendar_feeds` (`trip_id`);