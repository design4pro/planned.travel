CREATE TABLE `trip_invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`token` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`max_uses` integer,
	`use_count` integer DEFAULT 0 NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`trip_id`) REFERENCES `trip`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_invitation_token_unique` ON `trip_invitation` (`token`);