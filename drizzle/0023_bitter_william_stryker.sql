ALTER TABLE `account_security_fence` ADD `anchor_backfill_run_id` text;--> statement-breakpoint
ALTER TABLE `account_security_fence` ADD `anchor_backfill_at` integer;--> statement-breakpoint
ALTER TABLE `account_security_room_cleanup` ADD `attempted_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `verification_authority` ADD `factor_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `account_security_last_fence_idx` ON `account_security` (`last_fence`);