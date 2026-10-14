ALTER TABLE `budget_items` ADD `original_amount_minor` integer;--> statement-breakpoint
ALTER TABLE `budget_items` ADD `original_currency` text(3);--> statement-breakpoint
ALTER TABLE `budget_items` ADD `exchange_rate` real;