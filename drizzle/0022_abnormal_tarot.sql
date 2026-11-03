CREATE TABLE `account_security` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`trust_revision` integer NOT NULL,
	`last_fence` integer NOT NULL,
	`deletion_id` text,
	`deletion_started_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_security_last_fence_idx` ON `account_security` (`last_fence`);--> statement-breakpoint
CREATE INDEX `account_security_deletion_idx` ON `account_security` (`deletion_started_at`);--> statement-breakpoint
CREATE TABLE `account_security_cleanup` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`encrypted_token` text NOT NULL,
	`attempted_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`operation_id`) REFERENCES `account_security_operation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `security_cleanup_operation_idx` ON `account_security_cleanup` (`operation_id`);--> statement-breakpoint
CREATE TABLE `account_security_fence` (
	`id` integer PRIMARY KEY NOT NULL,
	`value` integer NOT NULL,
	`ready` integer DEFAULT false NOT NULL,
	`cutover` integer DEFAULT false NOT NULL,
	`anchor_backfill_run_id` text,
	`anchor_backfill_at` integer
);
--> statement-breakpoint
CREATE TABLE `account_security_operation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`intent` text NOT NULL,
	`receipt_digest` text NOT NULL,
	`revision` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`committed_at` integer,
	`claim` text,
	`attempted_at` integer DEFAULT 0 NOT NULL,
	`cleanup_pending` integer NOT NULL,
	`rooms_pending` integer NOT NULL,
	`rooms_recorded` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `security_operation_user_idx` ON `account_security_operation` (`user_id`);--> statement-breakpoint
CREATE INDEX `security_operation_pending_idx` ON `account_security_operation` (`cleanup_pending`);--> statement-breakpoint
CREATE TABLE `account_security_room_cleanup` (
	`operation_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`attempted_at` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`operation_id`, `organization_id`),
	FOREIGN KEY (`operation_id`) REFERENCES `account_security_operation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_authority` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`method` text NOT NULL,
	`proof_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_authority_user_idx` ON `session_authority` (`user_id`);--> statement-breakpoint
CREATE TABLE `verification_authority` (
	`identifier` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`trust_revision` integer NOT NULL,
	`factor_verified` integer DEFAULT false NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `verification_authority_user_idx` ON `verification_authority` (`user_id`);