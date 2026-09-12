PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_trip_favourites` (
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`trip_id`, `user_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_trip_favourites`("organization_id", "trip_id", "user_id", "created_at") SELECT "organization_id", "trip_id", "user_id", "created_at" FROM `trip_favourites`;--> statement-breakpoint
DROP TABLE `trip_favourites`;--> statement-breakpoint
ALTER TABLE `__new_trip_favourites` RENAME TO `trip_favourites`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `trip_favourites_org_user_idx` ON `trip_favourites` (`organization_id`,`user_id`);