DROP INDEX `airports_name_idx`;--> statement-breakpoint
DROP INDEX `airports_city_idx`;--> statement-breakpoint
CREATE INDEX `airports_iata_prefix_idx` ON `airports` ("iata_code" COLLATE NOCASE);--> statement-breakpoint
CREATE INDEX `airports_icao_prefix_idx` ON `airports` ("icao_code" COLLATE NOCASE);--> statement-breakpoint
CREATE INDEX `airports_name_idx` ON `airports` ("name" COLLATE NOCASE);--> statement-breakpoint
CREATE INDEX `airports_city_idx` ON `airports` ("city" COLLATE NOCASE);