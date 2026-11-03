CREATE TABLE `account_security_room_cleanup` (
	`operation_id` text NOT NULL,
	`organization_id` text NOT NULL,
	PRIMARY KEY(`operation_id`, `organization_id`),
	FOREIGN KEY (`operation_id`) REFERENCES `account_security_operation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `account_security_operation` ADD `rooms_recorded` integer DEFAULT false NOT NULL;