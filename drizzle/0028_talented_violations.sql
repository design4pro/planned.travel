CREATE TABLE `gallery_previews` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`document` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "gallery_previews_bytes_chk" CHECK(length(cast("gallery_previews"."document" as blob)) <= 524288)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_previews_actor_trip_unq` ON `gallery_previews` (`organization_id`,`actor_user_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `gallery_previews_expiry_idx` ON `gallery_previews` (`expires_at`,`id`);--> statement-breakpoint
CREATE INDEX `gallery_previews_org_trip_idx` ON `gallery_previews` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `gallery_previews_org_expiry_idx` ON `gallery_previews` (`organization_id`,`expires_at`,`id`);