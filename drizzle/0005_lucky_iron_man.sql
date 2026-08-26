CREATE TABLE `platform_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`actor_kind` text NOT NULL,
	`actor_role` text,
	`token_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`changes` text,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `staff_api_tokens`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "platform_audit_log_actor_kind_chk" CHECK(("actor_kind" IS NULL OR "actor_kind" IN ('human', 'agent', 'system'))),
	CONSTRAINT "platform_audit_log_agent_token_chk" CHECK(("actor_kind" <> 'agent' OR "token_id" IS NOT NULL)),
	CONSTRAINT "platform_audit_log_system_actor_chk" CHECK(("actor_kind" <> 'system' OR ("actor_user_id" IS NULL AND "actor_role" IS NULL AND "token_id" IS NULL))),
	CONSTRAINT "platform_audit_log_token_agent_only_chk" CHECK(("token_id" IS NULL OR "actor_kind" = 'agent')),
	CONSTRAINT "platform_audit_log_actor_identity_chk" CHECK(("actor_kind" = 'system' OR ("actor_user_id" IS NOT NULL AND "actor_role" IS NOT NULL)))
);
--> statement-breakpoint
CREATE INDEX `platform_audit_log_entity_idx` ON `platform_audit_log` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `platform_audit_log_actor_idx` ON `platform_audit_log` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `platform_audit_log_action_idx` ON `platform_audit_log` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `platform_audit_log_token_idx` ON `platform_audit_log` (`token_id`);--> statement-breakpoint
CREATE INDEX `platform_audit_log_created_at_idx` ON `platform_audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `staff_api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`last_used_at` integer,
	`last_used_ip` text,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_api_tokens_token_hash_unq` ON `staff_api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `staff_api_tokens_user_revoked_idx` ON `staff_api_tokens` (`user_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `staff_api_tokens_expires_at_idx` ON `staff_api_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `staff_api_tokens_created_by_idx` ON `staff_api_tokens` (`created_by`);--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `user` (`role`);