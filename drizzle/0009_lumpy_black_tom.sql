ALTER TABLE `reservations` ADD `expense_id` text REFERENCES expenses(id);--> statement-breakpoint
ALTER TABLE `reservations` ADD `imported_at` integer;--> statement-breakpoint
CREATE INDEX `reservations_expense_idx` ON `reservations` (`expense_id`);--> statement-breakpoint
CREATE INDEX `reservations_org_imported_at_idx` ON `reservations` (`organization_id`,`imported_at`);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `mask_confirmation_codes` integer DEFAULT false NOT NULL;