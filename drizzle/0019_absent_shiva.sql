CREATE TABLE `workspace_participants` (
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`erasure_id` text,
	`tombstone_id` text,
	`scrubbed_at` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`organization_id`, `user_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_participants_user_idx` ON `workspace_participants` (`user_id`);