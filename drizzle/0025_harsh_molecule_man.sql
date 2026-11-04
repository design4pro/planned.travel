CREATE TABLE `factor_budget` (
	`user_id` text NOT NULL,
	`domain` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`recovery_at` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `domain`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `factor_proposal` (
	`digest` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`operation_id`) REFERENCES `account_security_operation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `factor_proposal_operation_id_unique` ON `factor_proposal` (`operation_id`);--> statement-breakpoint
CREATE INDEX `factor_proposal_expiry_idx` ON `factor_proposal` (`expires_at`);--> statement-breakpoint
CREATE INDEX `factor_proposal_user_idx` ON `factor_proposal` (`user_id`);--> statement-breakpoint
CREATE TABLE `factor_replay` (
	`user_id` text NOT NULL,
	`secret_digest` text NOT NULL,
	`step` integer NOT NULL,
	PRIMARY KEY(`user_id`, `secret_digest`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `account_security_operation` ADD `kind` text DEFAULT 'revoke-others' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_security_operation` ADD `refused_at` integer;--> statement-breakpoint
ALTER TABLE `account_security_operation` ADD `factor_enabled` integer;