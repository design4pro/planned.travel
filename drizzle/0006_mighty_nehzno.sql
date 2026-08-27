CREATE TABLE `trip_cost_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`colour_index` integer DEFAULT 0 NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trip_cost_categories_colour_index_chk" CHECK(("colour_index" IS NULL OR "colour_index" >= 0))
);
--> statement-breakpoint
CREATE INDEX `trip_cost_categories_org_trip_idx` ON `trip_cost_categories` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `trip_cost_categories_trip_sort_idx` ON `trip_cost_categories` (`trip_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `day_notes` ADD `detail` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `cost_category_id` text REFERENCES trip_cost_categories(id);--> statement-breakpoint
CREATE INDEX `expenses_cost_category_idx` ON `expenses` (`cost_category_id`);--> statement-breakpoint
ALTER TABLE `settlements` ADD `original_amount_minor` integer;--> statement-breakpoint
ALTER TABLE `settlements` ADD `original_currency` text(3);--> statement-breakpoint
ALTER TABLE `settlements` ADD `exchange_rate` real;--> statement-breakpoint
ALTER TABLE `transports` ADD `arrival_day_id` text REFERENCES days(id);--> statement-breakpoint
CREATE INDEX `transports_arrival_day_idx` ON `transports` (`arrival_day_id`);--> statement-breakpoint
ALTER TABLE `trips` ADD `copy_pending_at` integer;--> statement-breakpoint
ALTER TABLE `trips` ADD `collab_modules` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `display_currency` text(3);