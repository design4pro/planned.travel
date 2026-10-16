/**
 * The data-access barrel.
 *
 * Server functions (`src/server/fns/**`), Durable Objects, queue consumers and cron handlers import
 * from here and nowhere else in the data layer. Nothing outside `src/server/repos/**` builds a query:
 * a caller obtains a {@link createScope} from the authenticated session and passes it to the functions
 * below, every one of which filters on `organization_id` before it touches a row.
 *
 * Module map, one per domain area:
 *
 * | Module          | Tables |
 * |-----------------|--------|
 * | `trips`         | `trips`, `trip_members`, `share_links` |
 * | `trip-favourites` | `trip_favourites` |
 * | `trip-guests`   | `trip_guests` |
 * | `days`          | `days`, `day_notes` |
 * | `itinerary`     | `day_assignments`, `assignment_participants`, `day_accommodations` |
 * | `places`        | `places`, `place_tags` |
 * | `categories`    | `categories` |
 * | `tags`          | `tags` |
 * | `transports`    | `transports` |
 * | `reservations`  | `reservations` |
 * | `expenses`      | `budget_items`, `expenses`, `expense_shares`, `settlements` |
 * | `rates`         | — reads `expenses` and `settlements` for the newest frozen rate of a currency pair |
 * | `trip-currency` | — previews and commits re-basing a trip's budget currency; reads and, in one atomic batch, rewrites `expenses`, `expense_shares`, `settlements`, `budget_items`, `trips` and pins the priced rows of `places`, `reservations`, `transports`, `day_accommodations` |
 * | `lists`         | `packing_lists`, `packing_items`, `packing_templates`, `packing_template_items` |
 * | `files`         | `trip_files` |
 * | `collab`        | `collab_messages`, `collab_message_reactions`, `collab_notes`, `collab_polls`, `collab_poll_votes`, `check_ins` |
 * | `collections`   | `collections`, `collection_places`, `collection_labels`, `collection_place_labels` |
 * | `journey`       | `journeys`, `journey_entries`, `journey_photos`, `journey_moods` |
 * | `atlas`         | `visited_countries`, `visited_regions`, `travel_stats`, `bucket_list_items` |
 * | `vacay`         | `vacay_plans`, `vacay_plan_members`, `vacay_years`, `vacay_user_years`, `vacay_entries`, `vacay_company_holidays`, `vacay_holiday_calendars`, `vacay_user_colours` |
 * | `notifications` | `notifications`, `notification_preferences` |
 * | `settings`      | `organization_settings`, `user_settings`, `app_settings` |
 * | `audit`         | `audit_log` |
 * | `members`       | `organization`, `member`, `invitation` |
 * | `billing`       | `subscriptions`, `usage_records` |
 * | `calendar-feeds` | `calendar_feeds`; reads `trips`, `days`, `places`, `day_assignments`, `day_notes`, `day_accommodations`, `transports`, `transport_legs`, `reservations` (narrowed columns) for the trip calendar |
 * | `dashboard`     | — composition over the modules above |
 */

export * from './base'
export * from './batch'
export * from './context'
export * from './validation'

export * from './atlas'
export * from './audit'
export * from './billing'
export * from './calendar-feeds'
export * from './categories'
export * from './collab'
export * from './collections'
export * from './dashboard'
export * from './days'
export * from './expenses'
export * from './files'
export * from './itinerary'
export * from './journey'
export * from './lists'
export * from './members'
export * from './notifications'
export * from './places'
export * from './rates'
export * from './reservations'
export * from './settings'
export * from './tags'
export * from './transports'
export * from './trip-cards'
export * from './trip-currency'
export * from './trip-guests'
export * from './trip-favourites'
export * from './trips'
export * from './vacay'
