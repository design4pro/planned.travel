CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_account_id_unique` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`inviter_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_organization_id_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE INDEX `invitation_status_idx` ON `invitation` (`status`);--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_organization_id_user_id_unique` ON `member` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `member_organization_id_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_user_id_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `passkey` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`algorithm` integer NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer DEFAULT false NOT NULL,
	`transports` text,
	`aaguid` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_credential_id_unique` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkey_user_id_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	`ip_address` text,
	`user_agent` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expires_at_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`verified` integer DEFAULT true NOT NULL,
	`failed_verification_count` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `two_factor_user_id_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE INDEX `two_factor_secret_idx` ON `two_factor` (`secret`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `verification_expires_at_idx` ON `verification` (`expires_at`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `app_settings_updated_at_idx` ON `app_settings` (`updated_at`);--> statement-breakpoint
CREATE TABLE `assignment_participants` (
	`organization_id` text NOT NULL,
	`assignment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`assignment_id`, `user_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignment_id`) REFERENCES `day_assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assignment_participants_org_idx` ON `assignment_participants` (`organization_id`);--> statement-breakpoint
CREATE INDEX `assignment_participants_user_idx` ON `assignment_participants` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`metadata` text,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_log_org_created_at_idx` ON `audit_log` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_org_actor_idx` ON `audit_log` (`organization_id`,`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_log_org_action_idx` ON `audit_log` (`organization_id`,`action`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `bucket_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text DEFAULT 'place' NOT NULL,
	`name` text NOT NULL,
	`country_code` text(2),
	`region_code` text,
	`lat` real,
	`lng` real,
	`note` text,
	`target_year` integer,
	`is_achieved` integer DEFAULT false NOT NULL,
	`achieved_on` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bucket_list_items_kind_chk" CHECK(("kind" IS NULL OR "kind" IN ('country', 'region', 'place'))),
	CONSTRAINT "bucket_list_items_lat_chk" CHECK(("lat" IS NULL OR ("lat" BETWEEN -90 AND 90))),
	CONSTRAINT "bucket_list_items_lat_chk_lng" CHECK(("lng" IS NULL OR ("lng" BETWEEN -180 AND 180)))
);
--> statement-breakpoint
CREATE INDEX `bucket_list_items_org_user_idx` ON `bucket_list_items` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `bucket_list_items_user_achieved_idx` ON `bucket_list_items` (`user_id`,`is_achieved`);--> statement-breakpoint
CREATE INDEX `bucket_list_items_org_country_idx` ON `bucket_list_items` (`organization_id`,`country_code`);--> statement-breakpoint
CREATE INDEX `bucket_list_items_user_sort_idx` ON `bucket_list_items` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `budget_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`name` text NOT NULL,
	`planned_amount_minor` integer DEFAULT 0 NOT NULL,
	`currency` text(3) DEFAULT 'EUR' NOT NULL,
	`persons` integer,
	`days` integer,
	`note` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "budget_items_category_chk" CHECK(("category" IS NULL OR "category" IN ('accommodation', 'transport', 'food', 'activities', 'shopping', 'fees', 'insurance', 'other'))),
	CONSTRAINT "budget_items_amount_chk" CHECK(("planned_amount_minor" IS NULL OR "planned_amount_minor" >= 0)),
	CONSTRAINT "budget_items_persons_chk" CHECK(("persons" IS NULL OR "persons" >= 0)),
	CONSTRAINT "budget_items_days_chk" CHECK(("days" IS NULL OR "days" >= 0))
);
--> statement-breakpoint
CREATE INDEX `budget_items_org_trip_idx` ON `budget_items` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `budget_items_trip_category_idx` ON `budget_items` (`trip_id`,`category`);--> statement-breakpoint
CREATE INDEX `budget_items_trip_sort_idx` ON `budget_items` (`trip_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`colour` text(9) DEFAULT '#2F6F5E' NOT NULL,
	`icon` text DEFAULT 'map-pin' NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_org_slug_unq` ON `categories` (`organization_id`,`slug`);--> statement-breakpoint
CREATE INDEX `categories_org_sort_idx` ON `categories` (`organization_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `check_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text,
	`place_id` text,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`lat` real,
	`lng` real,
	`address` text,
	`country_code` text(2),
	`note` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`checked_in_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_ins_source_chk" CHECK(("source" IS NULL OR "source" IN ('manual', 'gps', 'import', 'photo'))),
	CONSTRAINT "check_ins_lat_chk" CHECK(("lat" IS NULL OR ("lat" BETWEEN -90 AND 90))),
	CONSTRAINT "check_ins_lat_chk_lng" CHECK(("lng" IS NULL OR ("lng" BETWEEN -180 AND 180)))
);
--> statement-breakpoint
CREATE INDEX `check_ins_org_user_idx` ON `check_ins` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `check_ins_org_trip_idx` ON `check_ins` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `check_ins_user_checked_in_at_idx` ON `check_ins` (`user_id`,`checked_in_at`);--> statement-breakpoint
CREATE INDEX `check_ins_org_country_idx` ON `check_ins` (`organization_id`,`country_code`);--> statement-breakpoint
CREATE INDEX `check_ins_place_idx` ON `check_ins` (`place_id`);--> statement-breakpoint
CREATE TABLE `collab_message_reactions` (
	`organization_id` text NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`message_id`, `user_id`, `emoji`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `collab_messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collab_message_reactions_org_idx` ON `collab_message_reactions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `collab_message_reactions_user_idx` ON `collab_message_reactions` (`user_id`);--> statement-breakpoint
CREATE TABLE `collab_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`reply_to_id` text,
	`file_id` text,
	`edited_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reply_to_id`) REFERENCES `collab_messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`file_id`) REFERENCES `trip_files`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `collab_messages_org_trip_idx` ON `collab_messages` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `collab_messages_trip_created_at_idx` ON `collab_messages` (`trip_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `collab_messages_org_user_idx` ON `collab_messages` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `collab_messages_reply_to_idx` ON `collab_messages` (`reply_to_id`);--> statement-breakpoint
CREATE INDEX `collab_messages_file_idx` ON `collab_messages` (`file_id`);--> statement-breakpoint
CREATE TABLE `collab_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`created_by` text NOT NULL,
	`category` text,
	`title` text NOT NULL,
	`body` text,
	`colour` text(9),
	`is_pinned` integer DEFAULT false NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collab_notes_org_trip_idx` ON `collab_notes` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `collab_notes_trip_pinned_idx` ON `collab_notes` (`trip_id`,`is_pinned`);--> statement-breakpoint
CREATE INDEX `collab_notes_trip_sort_idx` ON `collab_notes` (`trip_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `collab_notes_created_by_idx` ON `collab_notes` (`created_by`);--> statement-breakpoint
CREATE TABLE `collab_poll_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`poll_id` text NOT NULL,
	`user_id` text NOT NULL,
	`option_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poll_id`) REFERENCES `collab_polls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collab_poll_votes_poll_user_option_unq` ON `collab_poll_votes` (`poll_id`,`user_id`,`option_id`);--> statement-breakpoint
CREATE INDEX `collab_poll_votes_org_poll_idx` ON `collab_poll_votes` (`organization_id`,`poll_id`);--> statement-breakpoint
CREATE INDEX `collab_poll_votes_user_idx` ON `collab_poll_votes` (`user_id`);--> statement-breakpoint
CREATE TABLE `collab_polls` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`created_by` text NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`allow_multiple` integer DEFAULT false NOT NULL,
	`is_closed` integer DEFAULT false NOT NULL,
	`closes_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collab_polls_org_trip_idx` ON `collab_polls` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `collab_polls_trip_closed_idx` ON `collab_polls` (`trip_id`,`is_closed`);--> statement-breakpoint
CREATE INDEX `collab_polls_created_by_idx` ON `collab_polls` (`created_by`);--> statement-breakpoint
CREATE INDEX `collab_polls_closes_at_idx` ON `collab_polls` (`closes_at`);--> statement-breakpoint
CREATE TABLE `collection_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`collection_id` text NOT NULL,
	`name` text NOT NULL,
	`colour` text(9) DEFAULT '#2F6F5E' NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_labels_collection_name_unq` ON `collection_labels` (`collection_id`,`name`);--> statement-breakpoint
CREATE INDEX `collection_labels_org_collection_idx` ON `collection_labels` (`organization_id`,`collection_id`);--> statement-breakpoint
CREATE INDEX `collection_labels_collection_sort_idx` ON `collection_labels` (`collection_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `collection_place_labels` (
	`organization_id` text NOT NULL,
	`collection_place_id` text NOT NULL,
	`label_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`collection_place_id`, `label_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_place_id`) REFERENCES `collection_places`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `collection_labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_place_labels_org_idx` ON `collection_place_labels` (`organization_id`);--> statement-breakpoint
CREATE INDEX `collection_place_labels_label_idx` ON `collection_place_labels` (`label_id`);--> statement-breakpoint
CREATE TABLE `collection_places` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`collection_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`description` text,
	`notes` text,
	`lat` real,
	`lng` real,
	`address` text,
	`city` text,
	`country_code` text(2),
	`website` text,
	`phone` text,
	`image_url` text,
	`price_minor` integer,
	`currency` text(3),
	`status` text DEFAULT 'idea' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`external_id` text,
	`source_trip_id` text,
	`source_place_id` text,
	`saved_by` text NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "collection_places_status_chk" CHECK(("status" IS NULL OR "status" IN ('idea', 'shortlisted', 'planned', 'visited', 'rejected'))),
	CONSTRAINT "collection_places_source_chk" CHECK(("source" IS NULL OR "source" IN ('manual', 'search', 'import', 'collection', 'osm'))),
	CONSTRAINT "collection_places_price_chk" CHECK(("price_minor" IS NULL OR "price_minor" >= 0)),
	CONSTRAINT "collection_places_lat_chk" CHECK(("lat" IS NULL OR ("lat" BETWEEN -90 AND 90))),
	CONSTRAINT "collection_places_lat_chk_lng" CHECK(("lng" IS NULL OR ("lng" BETWEEN -180 AND 180)))
);
--> statement-breakpoint
CREATE INDEX `collection_places_org_collection_idx` ON `collection_places` (`organization_id`,`collection_id`);--> statement-breakpoint
CREATE INDEX `collection_places_collection_sort_idx` ON `collection_places` (`collection_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `collection_places_org_status_idx` ON `collection_places` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `collection_places_org_country_idx` ON `collection_places` (`organization_id`,`country_code`);--> statement-breakpoint
CREATE INDEX `collection_places_category_idx` ON `collection_places` (`category_id`);--> statement-breakpoint
CREATE INDEX `collection_places_source_trip_idx` ON `collection_places` (`source_trip_id`);--> statement-breakpoint
CREATE INDEX `collection_places_source_place_idx` ON `collection_places` (`source_place_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`colour` text(9) DEFAULT '#2F6F5E' NOT NULL,
	`icon` text DEFAULT 'bookmark' NOT NULL,
	`cover_image_url` text,
	`visibility` text DEFAULT 'organization' NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "collections_visibility_chk" CHECK(("visibility" IS NULL OR "visibility" IN ('private', 'organization', 'public')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_org_slug_unq` ON `collections` (`organization_id`,`slug`);--> statement-breakpoint
CREATE INDEX `collections_org_owner_idx` ON `collections` (`organization_id`,`owner_user_id`);--> statement-breakpoint
CREATE INDEX `collections_org_sort_idx` ON `collections` (`organization_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `collections_org_updated_at_idx` ON `collections` (`organization_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `day_accommodations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`place_id` text,
	`start_day_id` text NOT NULL,
	`end_day_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`check_in_time` text,
	`check_in_end_time` text,
	`check_out_time` text,
	`confirmation_number` text,
	`price_minor` integer,
	`currency` text(3),
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`start_day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`end_day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "day_accommodations_price_chk" CHECK(("price_minor" IS NULL OR "price_minor" >= 0))
);
--> statement-breakpoint
CREATE INDEX `day_accommodations_org_trip_idx` ON `day_accommodations` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `day_accommodations_start_day_idx` ON `day_accommodations` (`start_day_id`);--> statement-breakpoint
CREATE INDEX `day_accommodations_end_day_idx` ON `day_accommodations` (`end_day_id`);--> statement-breakpoint
CREATE INDEX `day_accommodations_place_idx` ON `day_accommodations` (`place_id`);--> statement-breakpoint
CREATE TABLE `day_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text NOT NULL,
	`place_id` text NOT NULL,
	`order_index` real DEFAULT 0 NOT NULL,
	`start_time` text,
	`end_time` text,
	`duration_minutes` integer,
	`transport_mode` text,
	`notes` text,
	`reservation_status` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "day_assignments_transport_mode_chk" CHECK(("transport_mode" IS NULL OR "transport_mode" IN ('walk', 'bike', 'car', 'taxi', 'transit', 'bus', 'train', 'tram', 'metro', 'ferry', 'flight', 'other'))),
	CONSTRAINT "day_assignments_reservation_status_chk" CHECK(("reservation_status" IS NULL OR "reservation_status" IN ('none', 'pending', 'confirmed', 'cancelled', 'completed'))),
	CONSTRAINT "day_assignments_duration_chk" CHECK(("duration_minutes" IS NULL OR "duration_minutes" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_assignments_day_place_unq` ON `day_assignments` (`day_id`,`place_id`);--> statement-breakpoint
CREATE INDEX `day_assignments_org_trip_idx` ON `day_assignments` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `day_assignments_day_order_idx` ON `day_assignments` (`day_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `day_assignments_place_idx` ON `day_assignments` (`place_id`);--> statement-breakpoint
CREATE TABLE `day_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text NOT NULL,
	`body` text NOT NULL,
	`time` text,
	`icon` text DEFAULT 'sticky-note' NOT NULL,
	`created_by` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `day_notes_org_trip_idx` ON `day_notes` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `day_notes_day_sort_idx` ON `day_notes` (`day_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `days` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`day_number` integer NOT NULL,
	`date` text,
	`title` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "days_day_number_chk" CHECK("day_number" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `days_trip_number_unq` ON `days` (`trip_id`,`day_number`);--> statement-breakpoint
CREATE INDEX `days_org_trip_idx` ON `days` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `days_org_date_idx` ON `days` (`organization_id`,`date`);--> statement-breakpoint
CREATE TABLE `expense_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`expense_id` text NOT NULL,
	`user_id` text NOT NULL,
	`share_minor` integer DEFAULT 0 NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`is_settled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "expense_shares_share_chk" CHECK(("share_minor" IS NULL OR "share_minor" >= 0)),
	CONSTRAINT "expense_shares_weight_chk" CHECK(("weight" IS NULL OR "weight" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_shares_expense_user_unq` ON `expense_shares` (`expense_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `expense_shares_org_trip_idx` ON `expense_shares` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `expense_shares_org_user_idx` ON `expense_shares` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text,
	`place_id` text,
	`budget_item_id` text,
	`category` text DEFAULT 'other' NOT NULL,
	`title` text NOT NULL,
	`amount_minor` integer DEFAULT 0 NOT NULL,
	`currency` text(3),
	`original_amount_minor` integer,
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
CREATE INDEX `expenses_org_trip_idx` ON `expenses` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `expenses_trip_spent_on_idx` ON `expenses` (`trip_id`,`spent_on`);--> statement-breakpoint
CREATE INDEX `expenses_trip_category_idx` ON `expenses` (`trip_id`,`category`);--> statement-breakpoint
CREATE INDEX `expenses_org_paid_by_idx` ON `expenses` (`organization_id`,`paid_by`);--> statement-breakpoint
CREATE INDEX `expenses_day_idx` ON `expenses` (`day_id`);--> statement-breakpoint
CREATE INDEX `expenses_place_idx` ON `expenses` (`place_id`);--> statement-breakpoint
CREATE INDEX `expenses_budget_item_idx` ON `expenses` (`budget_item_id`);--> statement-breakpoint
CREATE TABLE `journey_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`journey_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`mood_id` text,
	`check_in_id` text,
	`source_trip_id` text,
	`source_place_id` text,
	`type` text DEFAULT 'note' NOT NULL,
	`title` text,
	`body` text,
	`entry_date` text NOT NULL,
	`entry_time` text,
	`location_name` text,
	`lat` real,
	`lng` real,
	`weather` text,
	`temperature_celsius` real,
	`tags` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`journey_id`) REFERENCES `journeys`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mood_id`) REFERENCES `journey_moods`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`check_in_id`) REFERENCES `check_ins`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "journey_entries_type_chk" CHECK(("type" IS NULL OR "type" IN ('note', 'photo', 'place', 'route', 'milestone', 'checkin'))),
	CONSTRAINT "journey_entries_lat_chk" CHECK(("lat" IS NULL OR ("lat" BETWEEN -90 AND 90))),
	CONSTRAINT "journey_entries_lat_chk_lng" CHECK(("lng" IS NULL OR ("lng" BETWEEN -180 AND 180)))
);
--> statement-breakpoint
CREATE INDEX `journey_entries_org_journey_idx` ON `journey_entries` (`organization_id`,`journey_id`);--> statement-breakpoint
CREATE INDEX `journey_entries_journey_date_idx` ON `journey_entries` (`journey_id`,`entry_date`);--> statement-breakpoint
CREATE INDEX `journey_entries_journey_sort_idx` ON `journey_entries` (`journey_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `journey_entries_org_author_idx` ON `journey_entries` (`organization_id`,`author_user_id`);--> statement-breakpoint
CREATE INDEX `journey_entries_mood_idx` ON `journey_entries` (`mood_id`);--> statement-breakpoint
CREATE INDEX `journey_entries_check_in_idx` ON `journey_entries` (`check_in_id`);--> statement-breakpoint
CREATE INDEX `journey_entries_source_trip_idx` ON `journey_entries` (`source_trip_id`);--> statement-breakpoint
CREATE INDEX `journey_entries_source_place_idx` ON `journey_entries` (`source_place_id`);--> statement-breakpoint
CREATE TABLE `journey_moods` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`emoji` text NOT NULL,
	`colour` text(9) DEFAULT '#2F6F5E' NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journey_moods_org_key_unq` ON `journey_moods` (`organization_id`,`key`);--> statement-breakpoint
CREATE INDEX `journey_moods_org_sort_idx` ON `journey_moods` (`organization_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `journey_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`journey_id` text NOT NULL,
	`entry_id` text,
	`storage_key` text NOT NULL,
	`thumbnail_key` text,
	`caption` text,
	`content_type` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`width` integer,
	`height` integer,
	`taken_at` integer,
	`lat` real,
	`lng` real,
	`uploaded_by` text NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`journey_id`) REFERENCES `journeys`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `journey_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "journey_photos_size_chk" CHECK(("size_bytes" IS NULL OR "size_bytes" >= 0)),
	CONSTRAINT "journey_photos_lat_chk" CHECK(("lat" IS NULL OR ("lat" BETWEEN -90 AND 90))),
	CONSTRAINT "journey_photos_lat_chk_lng" CHECK(("lng" IS NULL OR ("lng" BETWEEN -180 AND 180)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journey_photos_storage_key_unq` ON `journey_photos` (`storage_key`);--> statement-breakpoint
CREATE INDEX `journey_photos_org_journey_idx` ON `journey_photos` (`organization_id`,`journey_id`);--> statement-breakpoint
CREATE INDEX `journey_photos_entry_sort_idx` ON `journey_photos` (`entry_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `journey_photos_org_taken_at_idx` ON `journey_photos` (`organization_id`,`taken_at`);--> statement-breakpoint
CREATE TABLE `journeys` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text,
	`owner_user_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`subtitle` text,
	`description` text,
	`cover_image_url` text,
	`cover_gradient` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`public_token` text,
	`started_on` text,
	`ended_on` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "journeys_status_chk" CHECK(("status" IS NULL OR "status" IN ('draft', 'published', 'archived'))),
	CONSTRAINT "journeys_visibility_chk" CHECK(("visibility" IS NULL OR "visibility" IN ('private', 'organization', 'public')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journeys_org_slug_unq` ON `journeys` (`organization_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `journeys_public_token_unq` ON `journeys` (`public_token`);--> statement-breakpoint
CREATE INDEX `journeys_org_owner_idx` ON `journeys` (`organization_id`,`owner_user_id`);--> statement-breakpoint
CREATE INDEX `journeys_org_status_idx` ON `journeys` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `journeys_org_updated_at_idx` ON `journeys` (`organization_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `journeys_trip_idx` ON `journeys` (`trip_id`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`channel` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_preferences_channel_chk" CHECK(("channel" IS NULL OR "channel" IN ('in_app', 'email', 'push', 'webhook')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_org_user_event_channel_unq` ON `notification_preferences` (`organization_id`,`user_id`,`event_type`,`channel`);--> statement-breakpoint
CREATE INDEX `notification_preferences_org_user_idx` ON `notification_preferences` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`recipient_user_id` text NOT NULL,
	`sender_user_id` text,
	`type` text DEFAULT 'info' NOT NULL,
	`scope` text DEFAULT 'user' NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`title_key` text NOT NULL,
	`title_params` text,
	`body_key` text NOT NULL,
	`body_params` text,
	`action_url` text,
	`response` text,
	`responded_at` integer,
	`is_read` integer DEFAULT false NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notifications_type_chk" CHECK(("type" IS NULL OR "type" IN ('info', 'action', 'navigate'))),
	CONSTRAINT "notifications_scope_chk" CHECK(("scope" IS NULL OR "scope" IN ('trip', 'organization', 'user', 'system'))),
	CONSTRAINT "notifications_response_chk" CHECK(("response" IS NULL OR "response" IN ('accepted', 'declined')))
);
--> statement-breakpoint
CREATE INDEX `notifications_org_recipient_read_idx` ON `notifications` (`organization_id`,`recipient_user_id`,`is_read`);--> statement-breakpoint
CREATE INDEX `notifications_recipient_created_at_idx` ON `notifications` (`recipient_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_org_scope_idx` ON `notifications` (`organization_id`,`scope`);--> statement-breakpoint
CREATE INDEX `notifications_entity_idx` ON `notifications` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `organization_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`currency` text(3) DEFAULT 'EUR' NOT NULL,
	`locale` text DEFAULT 'en-GB' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`week_starts_on` integer DEFAULT 1 NOT NULL,
	`date_format` text DEFAULT 'dd MMM yyyy' NOT NULL,
	`distance_unit` text DEFAULT 'metric' NOT NULL,
	`map_style` text DEFAULT 'planned-light' NOT NULL,
	`features` text,
	`onboarded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "organization_settings_distance_unit_chk" CHECK(("distance_unit" IS NULL OR "distance_unit" IN ('metric', 'imperial'))),
	CONSTRAINT "organization_settings_week_start_chk" CHECK("week_starts_on" BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_settings_org_unq` ON `organization_settings` (`organization_id`);--> statement-breakpoint
CREATE TABLE `packing_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`list_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`weight_grams` integer,
	`is_done` integer DEFAULT false NOT NULL,
	`done_at` integer,
	`assigned_to` text,
	`due_date` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `packing_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "packing_items_priority_chk" CHECK(("priority" IS NULL OR "priority" IN ('low', 'normal', 'high'))),
	CONSTRAINT "packing_items_quantity_chk" CHECK(("quantity" IS NULL OR "quantity" >= 0)),
	CONSTRAINT "packing_items_weight_chk" CHECK(("weight_grams" IS NULL OR "weight_grams" >= 0))
);
--> statement-breakpoint
CREATE INDEX `packing_items_org_trip_idx` ON `packing_items` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `packing_items_list_sort_idx` ON `packing_items` (`list_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `packing_items_list_done_idx` ON `packing_items` (`list_id`,`is_done`);--> statement-breakpoint
CREATE INDEX `packing_items_org_assigned_idx` ON `packing_items` (`organization_id`,`assigned_to`);--> statement-breakpoint
CREATE INDEX `packing_items_due_date_idx` ON `packing_items` (`due_date`);--> statement-breakpoint
CREATE TABLE `packing_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'packing' NOT NULL,
	`colour` text(9),
	`icon` text,
	`owner_user_id` text,
	`weight_limit_grams` integer,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "packing_lists_kind_chk" CHECK(("kind" IS NULL OR "kind" IN ('packing', 'todo', 'shopping', 'documents'))),
	CONSTRAINT "packing_lists_weight_limit_chk" CHECK(("weight_limit_grams" IS NULL OR "weight_limit_grams" >= 0))
);
--> statement-breakpoint
CREATE INDEX `packing_lists_org_trip_idx` ON `packing_lists` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `packing_lists_trip_kind_idx` ON `packing_lists` (`trip_id`,`kind`);--> statement-breakpoint
CREATE INDEX `packing_lists_trip_sort_idx` ON `packing_lists` (`trip_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `packing_lists_owner_idx` ON `packing_lists` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `packing_template_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `packing_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "packing_template_items_quantity_chk" CHECK(("quantity" IS NULL OR "quantity" >= 0))
);
--> statement-breakpoint
CREATE INDEX `packing_template_items_org_idx` ON `packing_template_items` (`organization_id`);--> statement-breakpoint
CREATE INDEX `packing_template_items_template_sort_idx` ON `packing_template_items` (`template_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `packing_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'packing' NOT NULL,
	`icon` text,
	`is_shared` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "packing_templates_kind_chk" CHECK(("kind" IS NULL OR "kind" IN ('packing', 'todo', 'shopping', 'documents')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `packing_templates_org_name_unq` ON `packing_templates` (`organization_id`,`name`);--> statement-breakpoint
CREATE INDEX `packing_templates_org_kind_idx` ON `packing_templates` (`organization_id`,`kind`);--> statement-breakpoint
CREATE INDEX `packing_templates_created_by_idx` ON `packing_templates` (`created_by`);--> statement-breakpoint
CREATE TABLE `place_tags` (
	`organization_id` text NOT NULL,
	`place_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`place_id`, `tag_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `place_tags_org_idx` ON `place_tags` (`organization_id`);--> statement-breakpoint
CREATE INDEX `place_tags_tag_idx` ON `place_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`description` text,
	`notes` text,
	`lat` real,
	`lng` real,
	`address` text,
	`city` text,
	`country_code` text(2),
	`website` text,
	`phone` text,
	`image_url` text,
	`opening_hours` text,
	`price_minor` integer,
	`currency` text(3),
	`rating` integer,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`transport_mode` text DEFAULT 'walk' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`external_id` text,
	`is_visited` integer DEFAULT false NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "places_transport_mode_chk" CHECK(("transport_mode" IS NULL OR "transport_mode" IN ('walk', 'bike', 'car', 'taxi', 'transit', 'bus', 'train', 'tram', 'metro', 'ferry', 'flight', 'other'))),
	CONSTRAINT "places_source_chk" CHECK(("source" IS NULL OR "source" IN ('manual', 'search', 'import', 'collection', 'osm'))),
	CONSTRAINT "places_duration_chk" CHECK(("duration_minutes" IS NULL OR "duration_minutes" >= 0)),
	CONSTRAINT "places_price_chk" CHECK(("price_minor" IS NULL OR "price_minor" >= 0)),
	CONSTRAINT "places_rating_chk" CHECK(("rating" IS NULL OR ("rating" BETWEEN 1 AND 5))),
	CONSTRAINT "places_lat_chk" CHECK(("lat" IS NULL OR ("lat" BETWEEN -90 AND 90))),
	CONSTRAINT "places_lat_chk_lng" CHECK(("lng" IS NULL OR ("lng" BETWEEN -180 AND 180)))
);
--> statement-breakpoint
CREATE INDEX `places_org_trip_idx` ON `places` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `places_org_category_idx` ON `places` (`organization_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `places_org_country_idx` ON `places` (`organization_id`,`country_code`);--> statement-breakpoint
CREATE INDEX `places_trip_sort_idx` ON `places` (`trip_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `places_org_name_idx` ON `places` (`organization_id`,`name`);--> statement-breakpoint
CREATE INDEX `places_external_idx` ON `places` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text,
	`end_day_id` text,
	`place_id` text,
	`assignment_id` text,
	`transport_id` text,
	`type` text DEFAULT 'other' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`title` text NOT NULL,
	`provider` text,
	`location` text,
	`url` text,
	`confirmation_number` text,
	`start_date` text,
	`start_time` text,
	`end_date` text,
	`end_time` text,
	`guests` integer,
	`price_minor` integer,
	`currency` text(3),
	`notes` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`end_day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assignment_id`) REFERENCES `day_assignments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transport_id`) REFERENCES `transports`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "reservations_type_chk" CHECK(("type" IS NULL OR "type" IN ('accommodation', 'restaurant', 'activity', 'tour', 'ticket', 'transport', 'other'))),
	CONSTRAINT "reservations_status_chk" CHECK(("status" IS NULL OR "status" IN ('none', 'pending', 'confirmed', 'cancelled', 'completed'))),
	CONSTRAINT "reservations_price_chk" CHECK(("price_minor" IS NULL OR "price_minor" >= 0)),
	CONSTRAINT "reservations_guests_chk" CHECK(("guests" IS NULL OR "guests" >= 0))
);
--> statement-breakpoint
CREATE INDEX `reservations_org_trip_idx` ON `reservations` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `reservations_trip_start_idx` ON `reservations` (`trip_id`,`start_date`);--> statement-breakpoint
CREATE INDEX `reservations_org_status_idx` ON `reservations` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `reservations_org_type_idx` ON `reservations` (`organization_id`,`type`);--> statement-breakpoint
CREATE INDEX `reservations_day_idx` ON `reservations` (`day_id`);--> statement-breakpoint
CREATE INDEX `reservations_end_day_idx` ON `reservations` (`end_day_id`);--> statement-breakpoint
CREATE INDEX `reservations_place_idx` ON `reservations` (`place_id`);--> statement-breakpoint
CREATE INDEX `reservations_assignment_idx` ON `reservations` (`assignment_id`);--> statement-breakpoint
CREATE INDEX `reservations_transport_idx` ON `reservations` (`transport_id`);--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`amount_minor` integer DEFAULT 0 NOT NULL,
	`currency` text(3) DEFAULT 'EUR' NOT NULL,
	`method` text DEFAULT 'cash' NOT NULL,
	`settled_on` text NOT NULL,
	`note` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "settlements_method_chk" CHECK(("method" IS NULL OR "method" IN ('cash', 'bank_transfer', 'card', 'app', 'other'))),
	CONSTRAINT "settlements_amount_chk" CHECK(("amount_minor" IS NULL OR "amount_minor" >= 0)),
	CONSTRAINT "settlements_distinct_parties_chk" CHECK("from_user_id" <> "to_user_id")
);
--> statement-breakpoint
CREATE INDEX `settlements_org_trip_idx` ON `settlements` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `settlements_trip_settled_on_idx` ON `settlements` (`trip_id`,`settled_on`);--> statement-breakpoint
CREATE INDEX `settlements_org_from_idx` ON `settlements` (`organization_id`,`from_user_id`);--> statement-breakpoint
CREATE INDEX `settlements_org_to_idx` ON `settlements` (`organization_id`,`to_user_id`);--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`token` text NOT NULL,
	`scopes` text NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`view_count` integer DEFAULT 0 NOT NULL,
	`last_viewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "share_links_view_count_chk" CHECK(("view_count" IS NULL OR "view_count" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_unq` ON `share_links` (`token`);--> statement-breakpoint
CREATE INDEX `share_links_org_trip_idx` ON `share_links` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `share_links_expires_at_idx` ON `share_links` (`expires_at`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`stripe_price_id` text,
	`seats` integer DEFAULT 1 NOT NULL,
	`currency` text(3),
	`unit_amount_minor` integer,
	`current_period_start` integer,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`canceled_at` integer,
	`trial_ends_at` integer,
	`quota_overrides` text,
	`seat_limit` integer DEFAULT 10 NOT NULL,
	`storage_limit_bytes` integer DEFAULT 1073741824 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "subscriptions_plan_chk" CHECK(("plan" IS NULL OR "plan" IN ('free', 'starter', 'pro', 'business'))),
	CONSTRAINT "subscriptions_status_chk" CHECK(("status" IS NULL OR "status" IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'))),
	CONSTRAINT "subscriptions_seats_chk" CHECK(("seats" IS NULL OR "seats" >= 0)),
	CONSTRAINT "subscriptions_seat_limit_chk" CHECK(("seat_limit" IS NULL OR "seat_limit" >= 0)),
	CONSTRAINT "subscriptions_storage_limit_chk" CHECK(("storage_limit_bytes" IS NULL OR "storage_limit_bytes" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_org_unq` ON `subscriptions` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_stripe_subscription_unq` ON `subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_stripe_customer_idx` ON `subscriptions` (`stripe_customer_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_status_idx` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `subscriptions_current_period_end_idx` ON `subscriptions` (`current_period_end`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`colour` text(9) DEFAULT '#B26B08' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_org_slug_unq` ON `tags` (`organization_id`,`slug`);--> statement-breakpoint
CREATE INDEX `tags_org_name_idx` ON `tags` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `transports` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text,
	`mode` text DEFAULT 'flight' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`title` text NOT NULL,
	`carrier` text,
	`service_number` text,
	`booking_code` text,
	`seat` text,
	`departure_name` text,
	`departure_code` text(8),
	`departure_lat` real,
	`departure_lng` real,
	`departure_date` text,
	`departure_time` text,
	`departure_timezone` text,
	`arrival_name` text,
	`arrival_code` text(8),
	`arrival_lat` real,
	`arrival_lng` real,
	`arrival_date` text,
	`arrival_time` text,
	`arrival_timezone` text,
	`distance_metres` integer,
	`price_minor` integer,
	`currency` text(3),
	`notes` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transports_mode_chk" CHECK(("mode" IS NULL OR "mode" IN ('walk', 'bike', 'car', 'taxi', 'transit', 'bus', 'train', 'tram', 'metro', 'ferry', 'flight', 'other'))),
	CONSTRAINT "transports_status_chk" CHECK(("status" IS NULL OR "status" IN ('idea', 'pending', 'confirmed', 'cancelled', 'completed'))),
	CONSTRAINT "transports_price_chk" CHECK(("price_minor" IS NULL OR "price_minor" >= 0)),
	CONSTRAINT "transports_distance_chk" CHECK(("distance_metres" IS NULL OR "distance_metres" >= 0))
);
--> statement-breakpoint
CREATE INDEX `transports_org_trip_idx` ON `transports` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `transports_trip_departure_idx` ON `transports` (`trip_id`,`departure_date`);--> statement-breakpoint
CREATE INDEX `transports_org_status_idx` ON `transports` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `transports_org_mode_idx` ON `transports` (`organization_id`,`mode`);--> statement-breakpoint
CREATE INDEX `transports_day_idx` ON `transports` (`day_id`);--> statement-breakpoint
CREATE TABLE `travel_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`stat_year` integer DEFAULT 0 NOT NULL,
	`trip_count` integer DEFAULT 0 NOT NULL,
	`place_count` integer DEFAULT 0 NOT NULL,
	`city_count` integer DEFAULT 0 NOT NULL,
	`country_count` integer DEFAULT 0 NOT NULL,
	`region_count` integer DEFAULT 0 NOT NULL,
	`day_count` integer DEFAULT 0 NOT NULL,
	`distance_metres` integer DEFAULT 0 NOT NULL,
	`spend_minor` integer DEFAULT 0 NOT NULL,
	`currency` text(3) DEFAULT 'EUR' NOT NULL,
	`by_continent` text,
	`year_streak` integer DEFAULT 0 NOT NULL,
	`last_trip_id` text,
	`computed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "travel_stats_year_chk" CHECK(("stat_year" IS NULL OR "stat_year" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `travel_stats_org_user_year_unq` ON `travel_stats` (`organization_id`,`user_id`,`stat_year`);--> statement-breakpoint
CREATE INDEX `travel_stats_org_year_idx` ON `travel_stats` (`organization_id`,`stat_year`);--> statement-breakpoint
CREATE INDEX `travel_stats_last_trip_idx` ON `travel_stats` (`last_trip_id`);--> statement-breakpoint
CREATE TABLE `trip_files` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`place_id` text,
	`reservation_id` text,
	`transport_id` text,
	`expense_id` text,
	`storage_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`checksum` text,
	`kind` text DEFAULT 'document' NOT NULL,
	`description` text,
	`width` integer,
	`height` integer,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transport_id`) REFERENCES `transports`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "trip_files_kind_chk" CHECK(("kind" IS NULL OR "kind" IN ('document', 'image', 'ticket', 'receipt', 'map', 'other'))),
	CONSTRAINT "trip_files_size_chk" CHECK(("size_bytes" IS NULL OR "size_bytes" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_files_storage_key_unq` ON `trip_files` (`storage_key`);--> statement-breakpoint
CREATE INDEX `trip_files_org_trip_idx` ON `trip_files` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `trip_files_trip_kind_idx` ON `trip_files` (`trip_id`,`kind`);--> statement-breakpoint
CREATE INDEX `trip_files_place_idx` ON `trip_files` (`place_id`);--> statement-breakpoint
CREATE INDEX `trip_files_reservation_idx` ON `trip_files` (`reservation_id`);--> statement-breakpoint
CREATE INDEX `trip_files_transport_idx` ON `trip_files` (`transport_id`);--> statement-breakpoint
CREATE INDEX `trip_files_expense_idx` ON `trip_files` (`expense_id`);--> statement-breakpoint
CREATE INDEX `trip_files_org_created_at_idx` ON `trip_files` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `trip_members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`colour` text(9),
	`invited_by` text,
	`joined_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trip_members_role_chk" CHECK(("role" IS NULL OR "role" IN ('owner', 'editor', 'viewer')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_members_trip_user_unq` ON `trip_members` (`trip_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `trip_members_org_trip_idx` ON `trip_members` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `trip_members_org_user_idx` ON `trip_members` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text,
	`description` text,
	`destination` text,
	`country_codes` text,
	`start_date` text,
	`end_date` text,
	`timezone` text,
	`currency` text(3) DEFAULT 'EUR' NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`cover_image_key` text,
	`cover_image_url` text,
	`accent_colour` text(9),
	`budget_target_minor` integer,
	`reminder_days` integer DEFAULT 3 NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`is_favourite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trips_status_chk" CHECK(("status" IS NULL OR "status" IN ('draft', 'planning', 'booked', 'active', 'completed', 'archived'))),
	CONSTRAINT "trips_visibility_chk" CHECK(("visibility" IS NULL OR "visibility" IN ('private', 'organization', 'public'))),
	CONSTRAINT "trips_reminder_days_chk" CHECK(("reminder_days" IS NULL OR "reminder_days" >= 0)),
	CONSTRAINT "trips_date_order_chk" CHECK(("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trips_org_slug_unq` ON `trips` (`organization_id`,`slug`);--> statement-breakpoint
CREATE INDEX `trips_org_status_idx` ON `trips` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `trips_org_start_date_idx` ON `trips` (`organization_id`,`start_date`);--> statement-breakpoint
CREATE INDEX `trips_org_updated_at_idx` ON `trips` (`organization_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `trips_org_archived_idx` ON `trips` (`organization_id`,`is_archived`);--> statement-breakpoint
CREATE INDEX `trips_created_by_idx` ON `trips` (`created_by`);--> statement-breakpoint
CREATE TABLE `usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`metric` text NOT NULL,
	`period` text DEFAULT 'all' NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "usage_records_metric_chk" CHECK(("metric" IS NULL OR "metric" IN ('trips', 'places', 'members', 'files', 'storage_bytes', 'exports', 'collections', 'journeys'))),
	CONSTRAINT "usage_records_value_chk" CHECK(("value" IS NULL OR "value" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_records_org_metric_period_unq` ON `usage_records` (`organization_id`,`metric`,`period`);--> statement-breakpoint
CREATE INDEX `usage_records_org_period_idx` ON `usage_records` (`organization_id`,`period`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`locale` text,
	`timezone` text,
	`currency` text(3),
	`week_starts_on` integer,
	`date_format` text,
	`distance_unit` text,
	`map_style` text,
	`accent_colour` text(9),
	`reduce_motion` integer DEFAULT false NOT NULL,
	`onboarding_completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "user_settings_theme_chk" CHECK(("theme" IS NULL OR "theme" IN ('system', 'light', 'dark'))),
	CONSTRAINT "user_settings_distance_unit_chk" CHECK(("distance_unit" IS NULL OR "distance_unit" IN ('metric', 'imperial'))),
	CONSTRAINT "user_settings_week_start_chk" CHECK(("week_starts_on" IS NULL OR "week_starts_on" BETWEEN 0 AND 6))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_org_user_unq` ON `user_settings` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `user_settings_user_idx` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `vacay_company_holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`date` text NOT NULL,
	`label` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `vacay_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vacay_company_holidays_plan_date_unq` ON `vacay_company_holidays` (`plan_id`,`date`);--> statement-breakpoint
CREATE INDEX `vacay_company_holidays_org_plan_idx` ON `vacay_company_holidays` (`organization_id`,`plan_id`);--> statement-breakpoint
CREATE INDEX `vacay_company_holidays_plan_date_idx` ON `vacay_company_holidays` (`plan_id`,`date`);--> statement-breakpoint
CREATE TABLE `vacay_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text DEFAULT 'vacation' NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `vacay_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "vacay_entries_kind_chk" CHECK(("kind" IS NULL OR "kind" IN ('vacation', 'half_day', 'sick', 'remote', 'holiday', 'other')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vacay_entries_plan_user_date_unq` ON `vacay_entries` (`plan_id`,`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `vacay_entries_org_plan_idx` ON `vacay_entries` (`organization_id`,`plan_id`);--> statement-breakpoint
CREATE INDEX `vacay_entries_plan_date_idx` ON `vacay_entries` (`plan_id`,`date`);--> statement-breakpoint
CREATE INDEX `vacay_entries_org_user_idx` ON `vacay_entries` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `vacay_holiday_calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`region` text NOT NULL,
	`label` text,
	`colour` text(9) DEFAULT '#C0392B' NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `vacay_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vacay_holiday_calendars_plan_region_unq` ON `vacay_holiday_calendars` (`plan_id`,`region`);--> statement-breakpoint
CREATE INDEX `vacay_holiday_calendars_org_plan_idx` ON `vacay_holiday_calendars` (`organization_id`,`plan_id`);--> statement-breakpoint
CREATE INDEX `vacay_holiday_calendars_plan_sort_idx` ON `vacay_holiday_calendars` (`plan_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `vacay_plan_members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `vacay_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "vacay_plan_members_status_chk" CHECK(("status" IS NULL OR "status" IN ('pending', 'accepted', 'declined')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vacay_plan_members_plan_user_unq` ON `vacay_plan_members` (`plan_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `vacay_plan_members_org_plan_idx` ON `vacay_plan_members` (`organization_id`,`plan_id`);--> statement-breakpoint
CREATE INDEX `vacay_plan_members_org_user_idx` ON `vacay_plan_members` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `vacay_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text DEFAULT 'Vacay' NOT NULL,
	`block_weekends` integer DEFAULT true NOT NULL,
	`holidays_enabled` integer DEFAULT true NOT NULL,
	`company_holidays_enabled` integer DEFAULT true NOT NULL,
	`carry_over_enabled` integer DEFAULT true NOT NULL,
	`default_entitlement_days` integer DEFAULT 30 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "vacay_plans_entitlement_chk" CHECK(("default_entitlement_days" IS NULL OR "default_entitlement_days" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vacay_plans_org_owner_unq` ON `vacay_plans` (`organization_id`,`owner_user_id`);--> statement-breakpoint
CREATE INDEX `vacay_plans_org_idx` ON `vacay_plans` (`organization_id`);--> statement-breakpoint
CREATE TABLE `vacay_user_colours` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`colour` text(9) DEFAULT '#2F6F5E' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `vacay_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vacay_user_colours_plan_user_unq` ON `vacay_user_colours` (`plan_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `vacay_user_colours_org_plan_idx` ON `vacay_user_colours` (`organization_id`,`plan_id`);--> statement-breakpoint
CREATE TABLE `vacay_user_years` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`year` integer NOT NULL,
	`entitlement_days` integer DEFAULT 30 NOT NULL,
	`carried_over_days` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `vacay_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "vacay_user_years_entitlement_chk" CHECK(("entitlement_days" IS NULL OR "entitlement_days" >= 0)),
	CONSTRAINT "vacay_user_years_carried_over_chk" CHECK(("carried_over_days" IS NULL OR "carried_over_days" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vacay_user_years_plan_user_year_unq` ON `vacay_user_years` (`plan_id`,`user_id`,`year`);--> statement-breakpoint
CREATE INDEX `vacay_user_years_org_plan_idx` ON `vacay_user_years` (`organization_id`,`plan_id`);--> statement-breakpoint
CREATE INDEX `vacay_user_years_org_user_year_idx` ON `vacay_user_years` (`organization_id`,`user_id`,`year`);--> statement-breakpoint
CREATE TABLE `vacay_years` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`year` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `vacay_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vacay_years_plan_year_unq` ON `vacay_years` (`plan_id`,`year`);--> statement-breakpoint
CREATE INDEX `vacay_years_org_plan_idx` ON `vacay_years` (`organization_id`,`plan_id`);--> statement-breakpoint
CREATE TABLE `visited_countries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`country_code` text(2) NOT NULL,
	`continent` text,
	`first_visited_on` text,
	`last_visited_on` text,
	`visit_count` integer DEFAULT 1 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "visited_countries_visit_count_chk" CHECK(("visit_count" IS NULL OR "visit_count" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `visited_countries_org_user_country_unq` ON `visited_countries` (`organization_id`,`user_id`,`country_code`);--> statement-breakpoint
CREATE INDEX `visited_countries_org_user_idx` ON `visited_countries` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `visited_countries_org_continent_idx` ON `visited_countries` (`organization_id`,`continent`);--> statement-breakpoint
CREATE TABLE `visited_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`country_code` text(2) NOT NULL,
	`region_code` text NOT NULL,
	`region_name` text NOT NULL,
	`first_visited_on` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `visited_regions_org_user_region_unq` ON `visited_regions` (`organization_id`,`user_id`,`region_code`);--> statement-breakpoint
CREATE INDEX `visited_regions_org_user_idx` ON `visited_regions` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `visited_regions_org_country_idx` ON `visited_regions` (`organization_id`,`country_code`);