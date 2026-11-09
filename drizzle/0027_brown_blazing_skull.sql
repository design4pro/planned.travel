CREATE TABLE `category_initializations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`initialized_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_initializations_org_unq` ON `category_initializations` (`organization_id`);