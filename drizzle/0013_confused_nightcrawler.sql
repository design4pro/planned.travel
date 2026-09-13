CREATE TABLE `trip_guests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`display_name` text NOT NULL,
	`colour` text(9),
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trip_guests_org_trip_idx` ON `trip_guests` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `trip_guests_trip_name_unq` ON `trip_guests` (`trip_id`,`display_name`);