CREATE TABLE `trip_favourites` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_favourites_trip_user_unq` ON `trip_favourites` (`trip_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `trip_favourites_org_user_idx` ON `trip_favourites` (`organization_id`,`user_id`);