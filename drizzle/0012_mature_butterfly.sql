CREATE INDEX `transport_legs_org_trip_departure_day_idx` ON `transport_legs` (`organization_id`,`trip_id`,`departure_day_id`);--> statement-breakpoint
CREATE INDEX `transport_legs_org_transport_idx` ON `transport_legs` (`organization_id`,`transport_id`);--> statement-breakpoint
CREATE INDEX `transports_org_trip_day_idx` ON `transports` (`organization_id`,`trip_id`,`day_id`);