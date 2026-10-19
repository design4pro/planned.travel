/**
 * The registry of erasure outcomes: for every place in D1 that holds a user id, the one thing an
 * erasure does with it, the reason, and the module that owns the scrub.
 *
 * Data only. There is no SQL and no import beyond types here, on purpose: the registry is read by a
 * drift test, by the participation backfill (which asks it which columns name a user) and, in later
 * changes, by the erasure engine's verification sweep. Each repository module owns the scrub of its
 * own tables (`eraseUser…`, a later change) so the SQL stays behind the tenant filter in
 * `src/server/repos`; this file only says what that scrub must do.
 *
 * The contract is docs/adr/0043-erasure-outcomes.md, designed in
 * `.ai/specs/2026-10-08-erase-a-persons-data.md`. Three kinds of entry, and `origin` tells them apart:
 *
 * - `user-ref`: a `userRef('<column>')` column of `src/server/db/schema.ts`. Every one of them must be
 *   here, and `__tests__/registry-drift.test.ts` fails when the schema gains or loses one without the
 *   registry saying so. That test is the answer to "the next engineer who adds a `userRef()` column".
 * - `auth`: a column of `src/server/db/auth-schema.ts` that references `user.id`, so it goes with the
 *   `user` row, or the `user` row itself.
 * - `embedded`: a place that holds a user id (or an email) without being such a column: an entity id
 *   that happens to be a person's id, an invitation addressed to an email, a verification row, an
 *   impersonated session.
 *
 * **The registry covers D1 only.** The stores outside D1 (R2 key families, KV keys, the trip-room
 * Durable Object, logs, Resend, Polar) are inventoried in the spec's section 6, and several of them
 * are residuals, not outcomes. Their purges and the metadata rewrite are `./stores`, and the sweep
 * that checks both and every place below is `./verify`. This is what keeps `keep` honest: the
 * platform audit ledger is the only entry that has it.
 *
 * `Former member` ids: an `anonymise` replaces the person's id with the workspace's Former member id
 * (`erased_<nanoid>`, one per workspace per erasure, `workspace_participants.tombstone_id`).
 */

/** What an erasure does with one place. Meanings: docs/adr/0043-erasure-outcomes.md. */
export const ERASURE_OUTCOMES = [
  'remove',
  'anonymise',
  'null',
  'revoke',
  'keep',
] as const

export type ErasureOutcome = (typeof ERASURE_OUTCOMES)[number]

export const ERASURE_ORIGINS = ['user-ref', 'auth', 'embedded'] as const

export type ErasureOrigin = (typeof ERASURE_ORIGINS)[number]

/**
 * When in the engine's order the place is handled.
 *
 * - `scrub`: per workspace, through a `TenantScope` bound to it (engine step 4), or for the global
 *   tables through `src/server/catalog/erasure.ts` (phase 3: that module is read-only until an
 *   amendment to SPEC §5 admits the writes).
 * - `account`: removed with the `user` row (engine step 6), by Better Auth's own cascade or by the
 *   auth-table cleanup that precedes it.
 * - `finish`: removed after the verification sweep (engine step 8). The sweep runs first and would
 *   fail on the participation anchor itself, which is why this place has a step of its own.
 */
export const ERASURE_STEPS = ['scrub', 'account', 'finish'] as const

export type ErasureStep = (typeof ERASURE_STEPS)[number]

export interface ErasureEntry {
  /** The SQL table name, as `getTableConfig(table).name` spells it. */
  readonly table: string
  /** The SQL column name. */
  readonly column: string
  readonly origin: ErasureOrigin
  readonly outcome: ErasureOutcome
  /** A different outcome the same scrub applies to some rows of this column, and when. */
  readonly alternative?: {
    readonly outcome: ErasureOutcome
    readonly when: string
  }
  readonly reason: string
  /** The repo-relative module that owns the scrub. It must exist; a test checks. */
  readonly owner: string
  readonly step: ErasureStep
}

const TRIPS = 'src/server/repos/trips.ts'
const EXPENSES = 'src/server/repos/expenses.ts'
const LISTS = 'src/server/repos/lists.ts'
const COLLAB = 'src/server/repos/collab.ts'
const COLLECTIONS = 'src/server/repos/collections.ts'
const JOURNEY = 'src/server/repos/journey.ts'
const ATLAS = 'src/server/repos/atlas.ts'
const VACAY = 'src/server/repos/vacay.ts'
const NOTIFICATIONS = 'src/server/repos/notifications.ts'
const AUDIT = 'src/server/repos/audit.ts'
const PARTICIPANTS = 'src/server/repos/participants.ts'
/**
 * The global tables and the auth-table cleanup (spec phase 3). The module is the third catalog
 * member and read-only today; the pull request that adds these writes amends SPEC §5 first.
 */
const CATALOG_ERASURE = 'src/server/catalog/erasure.ts'

function userRef(
  table: string,
  column: string,
  owner: string,
  outcome: ErasureOutcome,
  reason: string,
  alternative?: ErasureEntry['alternative'],
): ErasureEntry {
  return {
    table,
    column,
    origin: 'user-ref',
    outcome,
    ...(alternative === undefined ? {} : { alternative }),
    reason,
    owner,
    step: 'scrub',
  }
}

function authPlace(
  table: string,
  column: string,
  origin: 'auth' | 'embedded',
  outcome: ErasureOutcome,
  reason: string,
  step: ErasureStep = 'account',
): ErasureEntry {
  return {
    table,
    column,
    origin,
    outcome,
    reason,
    owner: CATALOG_ERASURE,
    step,
  }
}

function embedded(
  table: string,
  column: string,
  owner: string,
  outcome: ErasureOutcome,
  reason: string,
): ErasureEntry {
  return {
    table,
    column,
    origin: 'embedded',
    outcome,
    reason,
    owner,
    step: 'scrub',
  }
}

export const ERASURE_REGISTRY: ReadonlyArray<ErasureEntry> = [
  /* ------------------------------------------------------------------ trips and money -- */
  userRef(
    'trips',
    'created_by',
    TRIPS,
    'anonymise',
    "The trip is the collaborators' record. A solo private trip is only the person's and is deleted as deleteTrip does, with its R2 keys.",
    {
      outcome: 'remove',
      when: 'solo private trip (no other trip member): the row goes with the trip',
    },
  ),
  userRef(
    'trip_members',
    'user_id',
    TRIPS,
    'remove',
    'Membership is the person.',
  ),
  userRef(
    'trip_members',
    'invited_by',
    TRIPS,
    'null',
    "Optional reference on other people's rows; nothing depends on it.",
  ),
  userRef(
    'trip_guests',
    'created_by',
    'src/server/repos/trip-guests.ts',
    'anonymise',
    'The guest is a companion of the trip, not of the person.',
  ),
  userRef(
    'trip_favourites',
    'user_id',
    'src/server/repos/trip-favourites.ts',
    'remove',
    'A private bookmark that only its owner ever saw.',
  ),
  userRef(
    'assignment_participants',
    'user_id',
    'src/server/repos/itinerary.ts',
    'remove',
    "A participant chip; other people's stops are unaffected.",
  ),
  userRef(
    'day_notes',
    'created_by',
    'src/server/repos/days.ts',
    'anonymise',
    'Plan content the collaborators rely on.',
  ),
  userRef(
    'expenses',
    'paid_by',
    EXPENSES,
    'anonymise',
    'Who owes whom must keep adding up; paid_by is never nulled.',
  ),
  userRef(
    'expenses',
    'created_by',
    EXPENSES,
    'anonymise',
    'Same record as paid_by.',
  ),
  userRef(
    'expense_shares',
    'user_id',
    EXPENSES,
    'anonymise',
    'A share is part of a split other people are in; balances must be equal before and after.',
  ),
  userRef(
    'settlements',
    'from_user_id',
    EXPENSES,
    'anonymise',
    'Money between people; balances must be equal before and after.',
  ),
  userRef(
    'settlements',
    'to_user_id',
    EXPENSES,
    'anonymise',
    'Money between people; balances must be equal before and after.',
  ),
  userRef(
    'settlements',
    'created_by',
    EXPENSES,
    'anonymise',
    'Same record as from_user_id and to_user_id.',
  ),
  userRef(
    'packing_lists',
    'owner_user_id',
    LISTS,
    'remove',
    "A personal list (owner set) is only the person's, and its items go with it. A shared list (owner null) is untouched.",
  ),
  userRef(
    'packing_items',
    'assigned_to',
    LISTS,
    'null',
    'The item stays, unassigned.',
  ),
  userRef(
    'packing_templates',
    'created_by',
    LISTS,
    'remove',
    "A template that is not shared is only the person's.",
    {
      outcome: 'anonymise',
      when: 'the template is shared: it is workspace content',
    },
  ),
  userRef(
    'trip_files',
    'uploaded_by',
    'src/server/repos/files.ts',
    'anonymise',
    'The file is trip content; the object stays and its uploadedBy R2 metadata is rewritten.',
  ),
  userRef(
    'share_links',
    'created_by',
    TRIPS,
    'revoke',
    'A session-less read link with no accountable creator must not stay valid; a trip owner can issue a new one.',
  ),
  userRef(
    'trip_invite_links',
    'created_by',
    'src/server/repos/invites.ts',
    'revoke',
    'The link is switched off (disabled_at) and its creator anonymised: a link that merely fails the creator check of ADR 0042 is a weaker promise than one that is off. A trip owner can switch it back on, which replaces the secret and the creator.',
  ),
  userRef(
    'calendar_feeds',
    'user_id',
    'src/server/repos/calendar-feeds.ts',
    'remove',
    'A bearer feed bound to its owner; a feed token for an erased person must not outlive them.',
  ),

  /* ------------------------------------------------------------------- collaboration -- */
  userRef(
    'collab_messages',
    'user_id',
    COLLAB,
    'anonymise',
    "The row stays so reply threads keep pointing at it; its body is cleared and deleted_at set. The person's words go.",
  ),
  userRef(
    'collab_message_reactions',
    'user_id',
    COLLAB,
    'remove',
    'A personal expression others do not rely on.',
  ),
  userRef(
    'collab_notes',
    'created_by',
    COLLAB,
    'anonymise',
    'Shared content stays; the author becomes the Former member.',
  ),
  userRef(
    'collab_polls',
    'created_by',
    COLLAB,
    'anonymise',
    'Shared content stays; the author becomes the Former member.',
  ),
  userRef(
    'collab_poll_votes',
    'user_id',
    COLLAB,
    'anonymise',
    'The result must not change; the Former member id is per workspace, so two erased people keep distinct votes.',
  ),
  userRef(
    'check_ins',
    'user_id',
    COLLAB,
    'remove',
    "A person's own location history.",
  ),

  /* ------------------------------------------------------ collections, journeys, atlas -- */
  userRef(
    'collections',
    'owner_user_id',
    COLLECTIONS,
    'remove',
    "A collection nobody else saved a place into is only the person's.",
    {
      outcome: 'anonymise',
      when: 'places saved by others remain: the owner becomes the Former member',
    },
  ),
  userRef(
    'collection_places',
    'saved_by',
    COLLECTIONS,
    'remove',
    "In the person's own collection the place goes with the collection.",
    {
      outcome: 'anonymise',
      when: "the place was saved into someone else's collection",
    },
  ),
  userRef(
    'journeys',
    'owner_user_id',
    JOURNEY,
    'anonymise',
    "A journey stays with its owner (ADR 0034): the Former member owns it and the read rule is unchanged, so no other author's entry is destroyed.",
    {
      outcome: 'remove',
      when: "no other author's entry remains in the journey: it is deleted",
    },
  ),
  userRef(
    'journey_entries',
    'author_user_id',
    JOURNEY,
    'remove',
    "The person's words and pictures, in every journey.",
  ),
  userRef(
    'journey_photos',
    'uploaded_by',
    JOURNEY,
    'remove',
    'storage_key and thumbnail_key are collected before the row goes and swept from R2.',
  ),
  userRef(
    'visited_countries',
    'user_id',
    ATLAS,
    'remove',
    "Atlas data is only the person's.",
  ),
  userRef(
    'visited_regions',
    'user_id',
    ATLAS,
    'remove',
    "Atlas data is only the person's.",
  ),
  userRef(
    'travel_stats',
    'user_id',
    ATLAS,
    'remove',
    "A roll-up of the person's own atlas.",
  ),
  userRef(
    'bucket_list_items',
    'user_id',
    ATLAS,
    'remove',
    "Atlas data is only the person's.",
  ),
  userRef(
    'vacay_plans',
    'owner_user_id',
    VACAY,
    'remove',
    "A plan with no invited member is only the person's.",
    {
      outcome: 'anonymise',
      when: 'the plan has invited members: their entries must survive',
    },
  ),
  userRef(
    'vacay_plan_members',
    'user_id',
    VACAY,
    'remove',
    "Only the person's own place in a plan.",
  ),
  userRef(
    'vacay_user_years',
    'user_id',
    VACAY,
    'remove',
    "Only the person's own allowance.",
  ),
  userRef(
    'vacay_entries',
    'user_id',
    VACAY,
    'remove',
    "Only the person's own days.",
  ),
  userRef(
    'vacay_user_colours',
    'user_id',
    VACAY,
    'remove',
    "Only the person's own colour.",
  ),

  /* ----------------------------------------------- notifications, settings, audit, anchor -- */
  userRef(
    'notifications',
    'recipient_user_id',
    NOTIFICATIONS,
    'remove',
    "The person's own inbox, meaningless without them.",
  ),
  userRef(
    'notifications',
    'sender_user_id',
    NOTIFICATIONS,
    'remove',
    'The notification row goes: its params carry actorName and a message preview that cannot be recovered any other way.',
  ),
  userRef(
    'notification_preferences',
    'user_id',
    NOTIFICATIONS,
    'remove',
    'Settings that only describe the person.',
  ),
  userRef(
    'user_settings',
    'user_id',
    'src/server/repos/settings.ts',
    'remove',
    'Settings that only describe the person.',
  ),
  userRef(
    'audit_log',
    'actor_user_id',
    AUDIT,
    'anonymise',
    'The trail stays useful; ip and user_agent are nulled and the email and name keys dropped from metadata. Filenames stay, the files stay.',
  ),
  {
    table: 'workspace_participants',
    column: 'user_id',
    origin: 'user-ref',
    outcome: 'remove',
    reason:
      'The participation anchor holds a user id until the erasure finishes. It is removed after the verification sweep, which would otherwise fail on it, and with it every tombstone_id.',
    owner: PARTICIPANTS,
    step: 'finish',
  },

  /* ------------------------------------------------------------------- global tables -- */
  userRef(
    'staff_api_tokens',
    'user_id',
    CATALOG_ERASURE,
    'revoke',
    'A hard delete is impossible: platform_audit_log.token_id points at the row ON DELETE RESTRICT. The token is revoked (revoked_at) and its holder anonymised.',
  ),
  userRef(
    'staff_api_tokens',
    'created_by',
    CATALOG_ERASURE,
    'anonymise',
    "Only the issuer is erased. The token belongs to its holder, so erasing whoever issued it must not revoke another person's credential.",
  ),
  userRef(
    'provider_registry',
    'updated_by',
    CATALOG_ERASURE,
    'anonymise',
    'A mutable configuration row; the ceiling stays.',
  ),
  userRef(
    'platform_audit_log',
    'actor_user_id',
    CATALOG_ERASURE,
    'keep',
    "Append-only security ledger (docs/ACCESS.md section 4.3) whose CHECKs forbid nulling an actor. Kept until the 400-day prune; the retention decision is the owner's (spec, owner confirms item 3).",
  ),

  /* ------------------------------------------------- auth tables (go with the user row) -- */
  authPlace(
    'user',
    'id',
    'auth',
    'remove',
    'The account row, with its email, name and image, is deleted last (engine step 6). The future avatars/<org>/<user> object is swept by key.',
  ),
  authPlace(
    'session',
    'user_id',
    'auth',
    'remove',
    'Cascades from user; the KV session blobs are purged before anything else.',
  ),
  authPlace(
    'account',
    'user_id',
    'auth',
    'remove',
    'Deleted by the cascade from the user row.',
  ),
  authPlace(
    'two_factor',
    'user_id',
    'auth',
    'remove',
    'Deleted by the cascade from the user row.',
  ),
  authPlace(
    'passkey',
    'user_id',
    'auth',
    'remove',
    'Deleted by the cascade from the user row.',
  ),
  authPlace(
    'member',
    'user_id',
    'auth',
    'remove',
    'Cascades from user. A workspace whose only member was the person is deleted in the same erasure.',
  ),
  authPlace(
    'invitation',
    'inviter_id',
    'auth',
    'remove',
    'Cascades from user, so every invitation the person sent disappears; changing that foreign key would be a table recreate and is not additive. The workspace owners are told how many pending invitations went.',
  ),

  /* --------------------------------------- places that hold an id without being a column -- */
  authPlace(
    'invitation',
    'email',
    'embedded',
    'remove',
    "Pending and accepted invitations addressed to the person's email are deleted.",
    'scrub',
  ),
  authPlace(
    'verification',
    'identifier',
    'embedded',
    'remove',
    "Rows keyed by the person's email, or holding their user id in the key (reset-password and OTP rows, passkey-challenge rows) are deleted.",
    'scrub',
  ),
  authPlace(
    'verification',
    'value',
    'embedded',
    'remove',
    'Rows holding the user id in the value (the passkey-challenge JSON carries userId) are deleted.',
    'scrub',
  ),
  authPlace(
    'session',
    'impersonated_by',
    'embedded',
    'revoke',
    'Sessions an operator opened as the person are ended; sessions the person opened as someone else are plain text, not a foreign key, and are ended too.',
    'scrub',
  ),
  embedded(
    'audit_log',
    'entity_id',
    AUDIT,
    'anonymise',
    "An entity id equal to the person's id is not a userRef column, so the verification sweep names it.",
  ),
  embedded(
    'notifications',
    'entity_id',
    NOTIFICATIONS,
    'anonymise',
    "An entity id equal to the person's id is not a userRef column, so the verification sweep names it.",
  ),
  embedded(
    'platform_audit_log',
    'entity_id',
    CATALOG_ERASURE,
    'keep',
    'The target of a platform.user.* row. Same ledger as actor_user_id, kept for the same reason.',
  ),
]
