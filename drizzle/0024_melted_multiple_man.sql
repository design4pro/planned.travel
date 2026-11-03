ALTER TABLE `account_security` ADD `deletion_id` text;--> statement-breakpoint
ALTER TABLE `account_security` ADD `deletion_started_at` integer;--> statement-breakpoint
CREATE INDEX `account_security_deletion_idx` ON `account_security` (`deletion_started_at`);