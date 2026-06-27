ALTER TABLE `document` ADD `reservation_id` text REFERENCES reservation(id);--> statement-breakpoint
ALTER TABLE `document` ADD `uploaded_by_user_id` text;--> statement-breakpoint
ALTER TABLE `reservation` ADD `title` text;--> statement-breakpoint
ALTER TABLE `reservation` ADD `notes` text;