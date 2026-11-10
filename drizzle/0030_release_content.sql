CREATE TABLE `content_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`collection` text DEFAULT 'blog' NOT NULL,
	`category` text DEFAULT 'changelog' NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_version_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`published_version_id`) REFERENCES `content_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "content_entries_release_subset" CHECK("content_entries"."collection" = 'blog' and "content_entries"."category" = 'changelog'),
	CONSTRAINT "content_entries_status" CHECK("content_entries"."status" in ('draft', 'published', 'withdrawn'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_entries_collection_slug_uq` ON `content_entries` (`collection`,`slug`);--> statement-breakpoint
CREATE INDEX `content_entries_published_version_idx` ON `content_entries` (`published_version_id`);--> statement-breakpoint
CREATE TABLE `content_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`locale` text NOT NULL,
	`body` text NOT NULL,
	`review_audit_id` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `content_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "content_translations_review" CHECK(("content_translations"."review_audit_id" is null) = ("content_translations"."reviewed_at" is null) and "content_translations"."locale" != 'en' and json_valid("content_translations"."body"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_translations_version_locale_uq` ON `content_translations` (`version_id`,`locale`);--> statement-breakpoint
CREATE TABLE `content_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`revision` integer NOT NULL,
	`source_locale` text DEFAULT 'en' NOT NULL,
	`body` text NOT NULL,
	`source_commit` text NOT NULL,
	`source_hash` text NOT NULL,
	`cutoff_sha` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `content_entries`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "content_versions_revision" CHECK("content_versions"."revision" > 0 and "content_versions"."source_locale" = 'en' and json_valid("content_versions"."body"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_versions_revision_uq` ON `content_versions` (`entry_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_versions_source_uq` ON `content_versions` (`entry_id`,`source_commit`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_versions_hash_uq` ON `content_versions` (`entry_id`,`source_hash`);--> statement-breakpoint
CREATE TABLE `release_deployment_entries` (
	`deployment_id` text NOT NULL,
	`publication_id` text NOT NULL,
	`version_id` text NOT NULL,
	PRIMARY KEY(`deployment_id`, `publication_id`),
	FOREIGN KEY (`deployment_id`) REFERENCES `release_deployments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`publication_id`) REFERENCES `release_publications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`version_id`) REFERENCES `content_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `release_deployment_entries_publication_idx` ON `release_deployment_entries` (`publication_id`);--> statement-breakpoint
CREATE INDEX `release_deployment_entries_version_idx` ON `release_deployment_entries` (`version_id`);--> statement-breakpoint
CREATE TABLE `release_deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`run_id` text NOT NULL,
	`attempt` integer NOT NULL,
	`main_commit` text NOT NULL,
	`tree_sha` text NOT NULL,
	`target` text NOT NULL,
	`activated_at` integer NOT NULL,
	`outcome` text DEFAULT 'verified' NOT NULL,
	`receipt_digest` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "release_deployments_verified" CHECK("release_deployments"."outcome" = 'verified' and "release_deployments"."attempt" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `release_deployments_identity_uq` ON `release_deployments` (`provider_id`,`run_id`,`attempt`);--> statement-breakpoint
CREATE TABLE `release_production_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`active_deployment_id` text NOT NULL,
	`generation` integer NOT NULL,
	`operation_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`active_deployment_id`) REFERENCES `release_deployments`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "release_production_state_singleton" CHECK("release_production_state"."id" = 1 and "release_production_state"."generation" > 0)
);
--> statement-breakpoint
CREATE INDEX `release_production_state_active_idx` ON `release_production_state` (`active_deployment_id`);--> statement-breakpoint
CREATE TABLE `release_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`release_version` text NOT NULL,
	`entry_id` text NOT NULL,
	`heading_date` text NOT NULL,
	`cutoff_sha` text NOT NULL,
	`current_version_id` text NOT NULL,
	`approved_version_id` text,
	`approved_hash` text,
	`review_audit_id` text,
	`reviewed_at` integer,
	`visible_version_id` text,
	`visible_hash` text,
	`visible_reviewed_at` integer,
	`first_shipped_at` integer,
	`content_updated_at` integer,
	`withdrawn_at` integer,
	`withdrawal_reason` text,
	`generation` integer DEFAULT 0 NOT NULL,
	`operation_id` text NOT NULL,
	`claim_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `content_entries`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`current_version_id`) REFERENCES `content_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_version_id`) REFERENCES `content_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`visible_version_id`) REFERENCES `content_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "release_publications_environment" CHECK("release_publications"."environment" = 'production' and "release_publications"."generation" >= 0),
	CONSTRAINT "release_publications_approval" CHECK(("release_publications"."approved_version_id" is null and "release_publications"."approved_hash" is null and "release_publications"."review_audit_id" is null and "release_publications"."reviewed_at" is null) or ("release_publications"."approved_version_id" is not null and "release_publications"."approved_hash" is not null and "release_publications"."review_audit_id" is not null and "release_publications"."reviewed_at" is not null)),
	CONSTRAINT "release_publications_visibility" CHECK(("release_publications"."visible_version_id" is null and "release_publications"."visible_hash" is null and "release_publications"."visible_reviewed_at" is null and "release_publications"."first_shipped_at" is null) or ("release_publications"."visible_version_id" is not null and "release_publications"."visible_hash" is not null and "release_publications"."visible_reviewed_at" is not null and "release_publications"."first_shipped_at" is not null)),
	CONSTRAINT "release_publications_withdrawal" CHECK(("release_publications"."withdrawn_at" is null and "release_publications"."withdrawal_reason" is null) or ("release_publications"."withdrawn_at" is not null and "release_publications"."withdrawal_reason" in ('sensitive', 'inaccurate', 'other')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `release_publications_identity_uq` ON `release_publications` (`environment`,`release_version`);--> statement-breakpoint
CREATE UNIQUE INDEX `release_publications_entry_uq` ON `release_publications` (`entry_id`);--> statement-breakpoint
CREATE INDEX `release_publications_listing_idx` ON `release_publications` (`first_shipped_at`,`release_version`);--> statement-breakpoint
CREATE INDEX `release_publications_current_idx` ON `release_publications` (`current_version_id`);--> statement-breakpoint
CREATE INDEX `release_publications_approved_idx` ON `release_publications` (`approved_version_id`);--> statement-breakpoint
CREATE INDEX `release_publications_visible_idx` ON `release_publications` (`visible_version_id`);
--> statement-breakpoint
CREATE TRIGGER content_versions_no_update BEFORE UPDATE ON content_versions BEGIN SELECT RAISE(ABORT, 'Content versions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER content_versions_no_delete BEFORE DELETE ON content_versions BEGIN SELECT RAISE(ABORT, 'Content versions are immutable'); END;
