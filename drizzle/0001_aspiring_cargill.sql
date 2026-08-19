PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text,
	`place_id` text,
	`budget_item_id` text,
	`category` text DEFAULT 'other' NOT NULL,
	`title` text NOT NULL,
	`amount_minor` integer DEFAULT 0 NOT NULL,
	`currency` text(3) DEFAULT 'EUR' NOT NULL,
	`original_amount_minor` integer,
	`original_currency` text(3),
	`exchange_rate` real,
	`spent_on` text NOT NULL,
	`paid_by` text,
	`split_method` text DEFAULT 'equal' NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`budget_item_id`) REFERENCES `budget_items`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "expenses_category_chk" CHECK(("category" IS NULL OR "category" IN ('accommodation', 'transport', 'food', 'activities', 'shopping', 'fees', 'insurance', 'other'))),
	CONSTRAINT "expenses_split_method_chk" CHECK(("split_method" IS NULL OR "split_method" IN ('equal', 'shares', 'exact', 'percentage'))),
	CONSTRAINT "expenses_amount_chk" CHECK(("amount_minor" IS NULL OR "amount_minor" >= 0)),
	CONSTRAINT "expenses_original_amount_chk" CHECK(("original_amount_minor" IS NULL OR "original_amount_minor" >= 0))
);
--> statement-breakpoint
INSERT INTO `__new_expenses`("id", "organization_id", "trip_id", "day_id", "place_id", "budget_item_id", "category", "title", "amount_minor", "currency", "original_amount_minor", "original_currency", "exchange_rate", "spent_on", "paid_by", "split_method", "notes", "created_by", "created_at", "updated_at") SELECT "id", "organization_id", "trip_id", "day_id", "place_id", "budget_item_id", "category", "title", "amount_minor", "currency", "original_amount_minor", "original_currency", "exchange_rate", "spent_on", "paid_by", "split_method", "notes", "created_by", "created_at", "updated_at" FROM `expenses`;--> statement-breakpoint
DROP TABLE `expenses`;--> statement-breakpoint
ALTER TABLE `__new_expenses` RENAME TO `expenses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `expenses_org_trip_idx` ON `expenses` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `expenses_trip_spent_on_idx` ON `expenses` (`trip_id`,`spent_on`);--> statement-breakpoint
CREATE INDEX `expenses_trip_category_idx` ON `expenses` (`trip_id`,`category`);--> statement-breakpoint
CREATE INDEX `expenses_org_paid_by_idx` ON `expenses` (`organization_id`,`paid_by`);--> statement-breakpoint
CREATE INDEX `expenses_day_idx` ON `expenses` (`day_id`);--> statement-breakpoint
CREATE INDEX `expenses_place_idx` ON `expenses` (`place_id`);--> statement-breakpoint
CREATE INDEX `expenses_budget_item_idx` ON `expenses` (`budget_item_id`);