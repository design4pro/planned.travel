CREATE TABLE `airports` (
	`id` text PRIMARY KEY NOT NULL,
	`iata_code` text(3),
	`icao_code` text(4),
	`name` text NOT NULL,
	`city` text,
	`country_code` text(2),
	`timezone` text,
	`lat` real,
	`lng` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "airports_lat_chk" CHECK(("lat" IS NULL OR ("lat" BETWEEN -90 AND 90))),
	CONSTRAINT "airports_lat_chk_lng" CHECK(("lng" IS NULL OR ("lng" BETWEEN -180 AND 180)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `airports_iata_unq` ON `airports` (`iata_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `airports_icao_unq` ON `airports` (`icao_code`);--> statement-breakpoint
CREATE INDEX `airports_name_idx` ON `airports` (`name`);--> statement-breakpoint
CREATE INDEX `airports_city_idx` ON `airports` (`city`);--> statement-breakpoint
CREATE TABLE `transport_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`transport_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`from_name` text NOT NULL,
	`from_code` text(8),
	`from_lat` real,
	`from_lng` real,
	`from_timezone` text,
	`to_name` text NOT NULL,
	`to_code` text(8),
	`to_lat` real,
	`to_lng` real,
	`to_timezone` text,
	`service_number` text,
	`platform` text,
	`seat` text,
	`departure_day_id` text,
	`arrival_day_id` text,
	`departure_date` text,
	`arrival_date` text,
	`departure_time` text,
	`arrival_time` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transport_id`) REFERENCES `transports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`departure_day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`arrival_day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transport_legs_position_chk" CHECK(("position" IS NULL OR "position" >= 0)),
	CONSTRAINT "transport_legs_from_lat_chk" CHECK(("from_lat" IS NULL OR ("from_lat" BETWEEN -90 AND 90))),
	CONSTRAINT "transport_legs_from_lat_chk_lng" CHECK(("from_lng" IS NULL OR ("from_lng" BETWEEN -180 AND 180))),
	CONSTRAINT "transport_legs_to_lat_chk" CHECK(("to_lat" IS NULL OR ("to_lat" BETWEEN -90 AND 90))),
	CONSTRAINT "transport_legs_to_lat_chk_lng" CHECK(("to_lng" IS NULL OR ("to_lng" BETWEEN -180 AND 180)))
);
--> statement-breakpoint
CREATE INDEX `transport_legs_org_trip_idx` ON `transport_legs` (`organization_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `transport_legs_transport_position_idx` ON `transport_legs` (`transport_id`,`position`);--> statement-breakpoint
CREATE INDEX `transport_legs_departure_day_idx` ON `transport_legs` (`departure_day_id`);--> statement-breakpoint
CREATE INDEX `transport_legs_arrival_day_idx` ON `transport_legs` (`arrival_day_id`);--> statement-breakpoint
CREATE INDEX `transports_org_arrival_day_idx` ON `transports` (`organization_id`,`arrival_day_id`);