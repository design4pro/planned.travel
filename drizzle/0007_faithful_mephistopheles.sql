CREATE TABLE `provider_registry` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`limit_window` text DEFAULT 'month' NOT NULL,
	`call_limit` integer,
	`policy` text DEFAULT 'allow' NOT NULL,
	`warn_percent` integer DEFAULT 70 NOT NULL,
	`critical_percent` integer DEFAULT 90 NOT NULL,
	`blockable` integer DEFAULT true NOT NULL,
	`notes` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "provider_registry_policy_chk" CHECK(("policy" IS NULL OR "policy" IN ('allow', 'block'))),
	CONSTRAINT "provider_registry_window_chk" CHECK(("limit_window" IS NULL OR "limit_window" IN ('day', 'month'))),
	CONSTRAINT "provider_registry_call_limit_chk" CHECK(("call_limit" IS NULL OR "call_limit" >= 0)),
	CONSTRAINT "provider_registry_thresholds_chk" CHECK(("warn_percent" BETWEEN 1 AND 100 AND "critical_percent" BETWEEN 1 AND 100 AND "warn_percent" <= "critical_percent"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_registry_slug_unq` ON `provider_registry` (`slug`);--> statement-breakpoint
CREATE TABLE `provider_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`operation` text NOT NULL,
	`grain` text DEFAULT 'hour' NOT NULL,
	`bucket` text NOT NULL,
	`organization_id` text,
	`calls` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`blocked` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "provider_usage_grain_chk" CHECK(("grain" IS NULL OR "grain" IN ('hour', 'month'))),
	CONSTRAINT "provider_usage_bucket_grain_chk" CHECK((("grain" = 'hour' AND length("bucket") = 13) OR ("grain" = 'month' AND length("bucket") = 7))),
	CONSTRAINT "provider_usage_calls_chk" CHECK(("calls" IS NULL OR "calls" >= 0)),
	CONSTRAINT "provider_usage_errors_chk" CHECK(("errors" IS NULL OR "errors" >= 0)),
	CONSTRAINT "provider_usage_blocked_chk" CHECK(("blocked" IS NULL OR "blocked" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_usage_tenant_unq` ON `provider_usage` (`grain`,`provider`,`operation`,`bucket`,`organization_id`) WHERE "organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `provider_usage_platform_unq` ON `provider_usage` (`grain`,`provider`,`operation`,`bucket`) WHERE "organization_id" IS NULL;--> statement-breakpoint
CREATE INDEX `provider_usage_window_idx` ON `provider_usage` (`grain`,`provider`,`bucket`);--> statement-breakpoint
CREATE INDEX `provider_usage_org_idx` ON `provider_usage` (`organization_id`,`grain`,`bucket`);