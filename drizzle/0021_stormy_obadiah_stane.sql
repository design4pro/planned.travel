CREATE TABLE `workspace_deletions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`requested_by` text,
	`initiator` text NOT NULL,
	`erasure_id` text,
	`erasure_consumer` text,
	`state` text DEFAULT 'requested' NOT NULL,
	`lease_until` integer,
	`lease_token` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`snapshot` text DEFAULT '{}' NOT NULL,
	`receipt_to` text,
	`receipt_name` text,
	`requested_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`swept_at` integer,
	`done_at` integer,
	CONSTRAINT "workspace_deletions_state_chk" CHECK(("state" IS NULL OR "state" IN ('requested', 'drained', 'rows_deleted', 'audited', 'swept', 'done', 'refused'))),
	CONSTRAINT "workspace_deletions_initiator_chk" CHECK(("initiator" IS NULL OR "initiator" IN ('owner', 'erasure'))),
	CONSTRAINT "workspace_deletions_attribution_chk" CHECK(("workspace_deletions"."initiator" = 'owner' and "workspace_deletions"."requested_by" is not null and "workspace_deletions"."erasure_id" is null and "workspace_deletions"."erasure_consumer" is null) or ("workspace_deletions"."initiator" = 'erasure' and "workspace_deletions"."requested_by" is null and "workspace_deletions"."erasure_id" is not null and "workspace_deletions"."receipt_to" is null and "workspace_deletions"."receipt_name" is null)),
	CONSTRAINT "workspace_deletions_attempts_chk" CHECK("workspace_deletions"."attempts" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_deletions_live_org_idx` ON `workspace_deletions` (`organization_id`) WHERE "workspace_deletions"."state" <> 'refused';--> statement-breakpoint
CREATE INDEX `workspace_deletions_stale_idx` ON `workspace_deletions` (`state`,`updated_at`);