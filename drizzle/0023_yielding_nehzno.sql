CREATE TABLE `storage_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_id` text,
	`size_bytes` integer NOT NULL,
	`kind` text DEFAULT 'document' NOT NULL,
	`state` text NOT NULL,
	`needs_fence` integer DEFAULT true NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "storage_objects_state_chk" CHECK(("state" IS NULL OR "state" IN ('reserved', 'writing', 'retained', 'garbage', 'deleted'))),
	CONSTRAINT "storage_objects_kind_chk" CHECK(("kind" IS NULL OR "kind" IN ('document', 'image', 'ticket', 'receipt', 'map', 'other'))),
	CONSTRAINT "storage_objects_size_chk" CHECK(("size_bytes" IS NULL OR "size_bytes" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_objects_key_unq` ON `storage_objects` (`storage_key`);--> statement-breakpoint
CREATE INDEX `storage_objects_org_trip_idx` ON `storage_objects` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `storage_objects_org_state_expiry_idx` ON `storage_objects` (`organization_id`,`state`,`expires_at`);