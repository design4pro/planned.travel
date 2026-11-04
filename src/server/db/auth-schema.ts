/**
 * Drizzle table definitions required by Better Auth.
 *
 * Column names are snake_case in SQLite; the TypeScript property names stay
 * camelCase because the Better Auth Drizzle adapter addresses columns by the
 * schema's property key (its internal `fieldName`), never by the SQL name.
 *
 * Conventions (see docs/SPEC.md §6):
 * - text primary keys generated in the application layer
 * - all timestamps stored as millisecond epoch integers
 * - every foreign key indexed, every lookup column indexed
 */
import {
  index,
  primaryKey,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const id = () => text('id').primaryKey()
const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' }).notNull()
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' }).notNull()

/** Roles recognised by the organization plugin, most privileged first. */
export const ORGANIZATION_ROLES = ['owner', 'admin', 'member'] as const

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number]

/** Invitation lifecycle states used by the organization plugin. */
export const INVITATION_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'canceled',
] as const

export type InvitationStatus = (typeof INVITATION_STATUSES)[number]

/**
 * `user` carries four columns owned by Better Auth's `admin` plugin: `role`, `banned`,
 * `banReason` and `banExpires` (docs/SPEC.md §5).
 *
 * The plugin addresses them by the property keys spelled here — `banReason`, never `ban_reason` —
 * because `initGetFieldName()` returns a declared field name unchanged and the Drizzle adapter
 * then reads `schemaModel[fieldName]`. There is no case transform anywhere on that path, so a
 * snake_case property key typechecks cleanly and throws `BetterAuthError` on the first ban. The
 * SQL names stay snake_case, which is the whole of the difference.
 *
 * `role` carries no `CHECK` and no default on purpose. Platform roles are resolved in the
 * permission guard, where `NULL` and an unrecognised value both resolve to `user`
 * (docs/ACCESS.md §1.3); a database constraint would additionally make the plugin's own
 * comma-joined multi-role form unstorable.
 */
export const user = sqliteTable(
  'user',
  {
    id: id(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .notNull()
      .default(false),
    image: text('image'),
    twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' })
      .notNull()
      .default(false),
    role: text('role'),
    banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
    banReason: text('ban_reason'),
    banExpires: integer('ban_expires', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('user_email_unique').on(table.email),
    index('user_role_idx').on(table.role),
  ],
)

export const session = sqliteTable(
  'session',
  {
    id: id(),
    token: text('token').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Tenant the session is currently acting inside. */
    activeOrganizationId: text('active_organization_id').references(
      () => organization.id,
      { onDelete: 'set null' },
    ),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    /**
     * The `admin` plugin's impersonation marker: the id of the operator acting as this session's
     * user. Set only on a session minted by `impersonateUser`, and the signal the shell's warning
     * bar renders on (docs/ACCESS.md §6.1). Property key camelCase, SQL name snake_case, for the
     * reason spelled out above `user`.
     */
    impersonatedBy: text('impersonated_by'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('session_token_unique').on(table.token),
    index('session_user_id_idx').on(table.userId),
    index('session_expires_at_idx').on(table.expiresAt),
  ],
)

export const account = sqliteTable(
  'account',
  {
    id: id(),
    /** Stable provider-side namespace, e.g. `https://accounts.google.com`. */
    issuer: text('issuer').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    /** Scrypt hash for the credential provider; never returned to a client. */
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('account_issuer_account_id_unique').on(
      table.issuer,
      table.accountId,
    ),
    index('account_user_id_idx').on(table.userId),
  ],
)

export const verification = sqliteTable(
  'verification',
  {
    id: id(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('verification_identifier_idx').on(table.identifier),
    index('verification_expires_at_idx').on(table.expiresAt),
  ],
)

export const twoFactor = sqliteTable(
  'two_factor',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Base32 TOTP secret; never returned to a client. */
    secret: text('secret').notNull(),
    /** Encrypted, newline-joined single-use recovery codes. */
    backupCodes: text('backup_codes').notNull(),
    verified: integer('verified', { mode: 'boolean' }).notNull().default(true),
    failedVerificationCount: integer('failed_verification_count')
      .notNull()
      .default(0),
    lockedUntil: integer('locked_until', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('two_factor_user_id_idx').on(table.userId),
    index('two_factor_secret_idx').on(table.secret),
  ],
)

export const passkey = sqliteTable(
  'passkey',
  {
    id: id(),
    /** Human label shown in the credential list, e.g. "MacBook Pro". */
    name: text('name'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** base64url WebAuthn credential id. */
    credentialId: text('credential_id').notNull(),
    /** base64url COSE_Key of the credential's public key. */
    publicKey: text('public_key').notNull(),
    /** COSE algorithm identifier, e.g. -7 for ES256. */
    algorithm: integer('algorithm').notNull(),
    /** Authenticator signature counter, for clone detection. */
    counter: integer('counter').notNull().default(0),
    /** `singleDevice` or `multiDevice`, derived from the backup-eligible flag. */
    deviceType: text('device_type').notNull(),
    backedUp: integer('backed_up', { mode: 'boolean' })
      .notNull()
      .default(false),
    /** Comma-joined authenticator transports reported at registration. */
    transports: text('transports'),
    aaguid: text('aaguid'),
    createdAt: createdAt(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('passkey_credential_id_unique').on(table.credentialId),
    index('passkey_user_id_idx').on(table.userId),
  ],
)

export const organization = sqliteTable(
  'organization',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logo: text('logo'),
    /** JSON blob owned by the organization plugin. */
    metadata: text('metadata'),
    createdAt: createdAt(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  },
  (table) => [uniqueIndex('organization_slug_unique').on(table.slug)],
)

export const member = sqliteTable(
  'member',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('member_organization_id_user_id_unique').on(
      table.organizationId,
      table.userId,
    ),
    index('member_organization_id_idx').on(table.organizationId),
    index('member_user_id_idx').on(table.userId),
  ],
)

export const invitation = sqliteTable(
  'invitation',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').notNull().default('pending'),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('invitation_organization_id_idx').on(table.organizationId),
    index('invitation_email_idx').on(table.email),
    index('invitation_status_idx').on(table.status),
  ],
)

/** Global ordering scalar; enforcement requires the provisioned singleton after cutover. */
export const securityFence = sqliteTable('account_security_fence', {
  id: integer('id').primaryKey(),
  value: integer('value').notNull(),
  ready: integer('ready', { mode: 'boolean' }).notNull().default(false),
  cutover: integer('cutover', { mode: 'boolean' }).notNull().default(false),
  anchorBackfillRunId: text('anchor_backfill_run_id'),
  anchorBackfillAt: integer('anchor_backfill_at'),
})

export const accountSecurity = sqliteTable(
  'account_security',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    trustRevision: integer('trust_revision').notNull(),
    lastFence: integer('last_fence').notNull(),
    deletionId: text('deletion_id'),
    deletionStartedAt: integer('deletion_started_at'),
  },
  (table) => [
    index('account_security_last_fence_idx').on(table.lastFence),
    index('account_security_deletion_idx').on(table.deletionStartedAt),
  ],
)

export const sessionAuthority = sqliteTable(
  'session_authority',
  {
    sessionId: text('session_id')
      .primaryKey()
      .references(() => session.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    method: text('method').notNull(),
    proofAt: integer('proof_at').notNull(),
  },
  (table) => [index('session_authority_user_idx').on(table.userId)],
)

export const verificationAuthority = sqliteTable(
  'verification_authority',
  {
    identifier: text('identifier').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    trustRevision: integer('trust_revision').notNull(),
    factorVerified: integer('factor_verified', { mode: 'boolean' })
      .notNull()
      .default(false),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [index('verification_authority_user_idx').on(table.userId)],
)

export const securityOperation = sqliteTable(
  'account_security_operation',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    intent: text('intent').notNull(),
    kind: text('kind').notNull().default('revoke-others'),
    refusedAt: integer('refused_at'),
    factorEnabled: integer('factor_enabled', { mode: 'boolean' }),
    receiptDigest: text('receipt_digest').notNull(),
    revision: integer('revision').notNull(),
    expiresAt: integer('expires_at').notNull(),
    committedAt: integer('committed_at'),
    claim: text('claim'),
    attemptedAt: integer('attempted_at').notNull().default(0),
    cleanupPending: integer('cleanup_pending', { mode: 'boolean' }).notNull(),
    roomsPending: integer('rooms_pending', { mode: 'boolean' }).notNull(),
    roomsRecorded: integer('rooms_recorded', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (table) => [
    index('security_operation_user_idx').on(table.userId),
    index('security_operation_pending_idx').on(table.cleanupPending),
  ],
)

/** Encrypted setup material has no authority until its operation commits. */
export const factorProposal = sqliteTable(
  'factor_proposal',
  {
    digest: text('digest').primaryKey(),
    operationId: text('operation_id')
      .notNull()
      .unique()
      .references(() => securityOperation.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    payload: text('payload').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    index('factor_proposal_expiry_idx').on(table.expiresAt),
    index('factor_proposal_user_idx').on(table.userId),
  ],
)

/** Reservations spend an attempt before verification; versions never reset with the count. */
export const factorBudget = sqliteTable(
  'factor_budget',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    version: integer('version').notNull().default(0),
    attempts: integer('attempts').notNull().default(0),
    recoveryAt: integer('recovery_at').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.domain] })],
)

/** Plaintext-secret digests keep replay history stable across ciphertext/set rotations. */
export const factorReplay = sqliteTable(
  'factor_replay',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    secretDigest: text('secret_digest').notNull(),
    step: integer('step').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.secretDigest] })],
)

export const securityCleanup = sqliteTable(
  'account_security_cleanup',
  {
    id: text('id').primaryKey(),
    operationId: text('operation_id')
      .notNull()
      .references(() => securityOperation.id, { onDelete: 'cascade' }),
    encryptedToken: text('encrypted_token').notNull(),
    attemptedAt: integer('attempted_at').notNull().default(0),
  },
  (table) => [index('security_cleanup_operation_idx').on(table.operationId)],
)

/** Durable queue acknowledgements contain routing ids only, never workspace content. */
export const securityRoomCleanup = sqliteTable(
  'account_security_room_cleanup',
  {
    operationId: text('operation_id')
      .notNull()
      .references(() => securityOperation.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').notNull(),
    attemptedAt: integer('attempted_at').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.operationId, table.organizationId] }),
  ],
)

/** Every Better Auth table, in the shape the Drizzle adapter expects. */
export const authSchema = {
  user,
  session,
  account,
  verification,
  twoFactor,
  passkey,
  organization,
  member,
  invitation,
}

export type UserRow = typeof user.$inferSelect
export type SessionRow = typeof session.$inferSelect
export type AccountRow = typeof account.$inferSelect
export type PasskeyRow = typeof passkey.$inferSelect
export type OrganizationRow = typeof organization.$inferSelect
export type MemberRow = typeof member.$inferSelect
export type InvitationRow = typeof invitation.$inferSelect

/** Application-owned account authority is never exposed as native adapter models. */
export const accountSecuritySchema = {
  securityFence,
  accountSecurity,
  sessionAuthority,
  verificationAuthority,
  securityOperation,
  securityCleanup,
  securityRoomCleanup,
  factorProposal,
  factorBudget,
  factorReplay,
}
