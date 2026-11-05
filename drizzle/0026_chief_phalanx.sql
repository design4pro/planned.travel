PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`metric` text NOT NULL,
	`period` text DEFAULT 'all' NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "usage_records_metric_chk" CHECK(("metric" IS NULL OR "metric" IN ('trips', 'places', 'members', 'files', 'storage_bytes', 'exports', 'collections', 'journeys', 'taxonomy'))),
	CONSTRAINT "usage_records_value_chk" CHECK(("value" IS NULL OR "value" >= 0))
);
--> statement-breakpoint
INSERT INTO `__new_usage_records`("id", "organization_id", "metric", "period", "value", "created_at", "updated_at") SELECT "id", "organization_id", "metric", "period", "value", "created_at", "updated_at" FROM `usage_records`;--> statement-breakpoint
DROP TABLE `usage_records`;--> statement-breakpoint
ALTER TABLE `__new_usage_records` RENAME TO `usage_records`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `usage_records_org_metric_period_unq` ON `usage_records` (`organization_id`,`metric`,`period`);--> statement-breakpoint
CREATE INDEX `usage_records_org_period_idx` ON `usage_records` (`organization_id`,`period`);