ALTER TABLE `subscriptions` RENAME COLUMN "stripe_customer_id" TO "provider_customer_id";--> statement-breakpoint
ALTER TABLE `subscriptions` RENAME COLUMN "stripe_subscription_id" TO "provider_subscription_id";--> statement-breakpoint
ALTER TABLE `subscriptions` RENAME COLUMN "stripe_price_id" TO "provider_product_id";--> statement-breakpoint
DROP INDEX `subscriptions_stripe_subscription_unq`;--> statement-breakpoint
DROP INDEX `subscriptions_stripe_customer_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_provider_subscription_unq` ON `subscriptions` (`provider_subscription_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_provider_customer_idx` ON `subscriptions` (`provider_customer_id`);