/**
 * The one step the tenant repositories cannot perform: resolving which workspace to seed, and giving
 * the demo dataset three collaborators to be about.
 *
 * `user`, `organization` and `member` belong to the auth module — Better Auth's organization plugin
 * writes them directly, and `src/server/auth/db.ts` exists precisely so provisioning can touch them
 * without importing the product data layer. This module follows that same seam: it looks the owner up
 * by email, reads their organization through the auth module's own `firstOrganizationIdFor`, and
 * inserts the collaborator rows. Everything after this point goes through `src/server/repos`.
 *
 * Every person in the dataset gets a credential account when a password is handed in, and every one
 * of them gets the same one. Without a signable account there is no way to reach an authenticated
 * screen, which means the whole product behind the login page is unreachable to the e2e suite and to
 * anyone opening the project for the first time; and without *four* signable accounts the platform
 * console's own claims cannot be demonstrated — a curator who cannot sign in cannot show that they
 * see the catalogue and not the accounts tab, and a suspended account that has no password is
 * refused for the wrong reason. See {@link ensureCollaboratorCredentials}.
 *
 * The **owner**'s account is minted through Better Auth's own sign-up API, so the password is hashed
 * by the same code path a real registration uses and the `user.create` hook provisions the personal
 * organization exactly as it would for a real person. The collaborators already have `user` rows by
 * the time they need a credential, so theirs is written directly with the same hasher. The seed
 * endpoint that calls all of this is behind `import.meta.env.DEV`, so none of it exists in a
 * production bundle.
 */

import { and, eq, inArray } from 'drizzle-orm'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { account, member, organization, user } from '#/server/db/auth-schema'
import { PLATFORM_ACTIONS, appendPlatformAudit } from '#/server/catalog/audit'
import { getDb } from '#/server/db/client'
import { platformAuditLog } from '#/server/db/schema'
import { createLogger } from '#/server/observability'
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  getAuth,
} from '#/server/auth'
import { authDb } from '#/server/auth/db'
import { recordParticipation } from '#/server/auth/participation'
import {
  firstOrganizationIdFor,
  membershipRoleFor,
} from '#/server/auth/provisioning'
import {
  addMember,
  createScope,
  createTrip,
  deleteTrip,
  getTripBySlug,
} from '#/server/repos'
import {
  SEED_ANCHOR_INSTANT,
  instantOn,
  people,
  secondWorkspace,
} from './dataset'
import { membershipInstants } from './fixture-rows'
import { stableId } from './stable-id'
import type { PlatformActionName } from '#/server/catalog/audit'
import type { OrganizationRole } from '#/server/db/auth-schema'
import type { Database } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'
import type { PersonKey } from './types'

/** Better Auth generates 24-character ids; the demo rows match so nothing looks foreign. */
const ID_LENGTH = 24

/**
 * The id a demo row gets, derived from the address it belongs to.
 *
 * Better Auth mints a random id for a real registration and so does this module's owner path, which
 * goes through `signUpEmail`. The three collaborators are fixture rows, and deriving their ids keeps
 * a freshly cloned workspace identical to every other freshly cloned workspace.
 */
function demoAuthId(namespace: string, email: string): string {
  return stableId(`demo-auth-${namespace}`, email, ID_LENGTH)
}

/** What Better Auth's credential provider writes into `account.provider_id` and `account.issuer`. */
const CREDENTIAL_PROVIDER = 'credential'
const CREDENTIAL_ISSUER = 'local:credential'

/** Outcome of reconciling the owner's password, for the seed report. */
export type CredentialOutcome = 'created' | 'reset' | 'unchanged' | 'left-alone'

export class SeedBootstrapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeedBootstrapError'
  }
}

export interface SeedPeople {
  /** `user.id` for every person key in the dataset. */
  readonly ids: ReadonlyMap<PersonKey, string>
  /** How many collaborator rows this run created, for the report. */
  readonly created: number
  /** A scope per person, so chat, votes and journal entries are attributed correctly. */
  readonly scopes: ReadonlyMap<PersonKey, TenantScope>
}

/** The workspace itself, resolved before anything is written. */
export interface ResolvedWorkspace {
  readonly organizationId: string
  readonly ownerUserId: string
  readonly ownerRole: OrganizationRole
  readonly ownerScope: TenantScope
  /** True when this run minted the owner's credential account rather than adopting one. */
  readonly createdOwner: boolean
  /** What happened to the owner's password: created, reset, already correct, or deliberately kept. */
  readonly credential: CredentialOutcome
  /**
   * The demo password this run was handed, carried so the collaborator credential pass can run again
   * once {@link ensureWorkspacePeople} has created the rows it applies to.
   *
   * A cold database has no collaborator `user` rows when {@link resolveWorkspace} runs, so the pass
   * it makes there finds nothing; a warm one never reaches `ensureWorkspacePeople` at all. Both
   * halves are needed and neither is reachable from the other without this. Dev-fixture state on an
   * object that never leaves the seed endpoint, which `import.meta.env.DEV` compiles out.
   */
  readonly demoPassword: string | undefined
  /** `--keep-password`: never overwrite a password that is already set. */
  readonly keepExistingPassword: boolean
}

/** The display name given to a freshly minted demo owner, matched to the dataset. */
const OWNER_NAME = 'Rafal Wolak'

/**
 * Creates the demo owner's credential account through Better Auth.
 *
 * Deliberately the public sign-up API rather than a direct row insert: the password must be hashed
 * by the same code the login form verifies against, and the `user.create.after` hook has to run so
 * the personal organization is provisioned. Writing `user` and `account` by hand would produce an
 * account that exists but cannot log in — the exact failure this function is here to prevent.
 */
async function createOwnerAccount(
  email: string,
  password: string,
): Promise<void> {
  try {
    await getAuth().api.signUpEmail({
      body: { name: OWNER_NAME, email, password },
    })
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'unknown'
    throw new SeedBootstrapError(
      `Could not create the demo account for ${email}: ${reason}. ` +
        `The password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`,
    )
  }

  // A demo owner should never meet a "verify your email" nag; there is no inbox
  // behind the address and the queued verification mail goes nowhere.
  await authDb()
    .update(user)
    .set({ emailVerified: true, updatedAt: SEED_ANCHOR_INSTANT })
    .where(eq(user.email, email))
}

/**
 * Makes one demo account's password the one the seed was given, so the fixture can be signed into.
 *
 * The common case is an account that already exists from an earlier manual registration, with a
 * password nobody wrote down — which leaves the authenticated half of the product unreachable to the
 * e2e suite. Reconciling it here is what makes "seed, then sign in" reliable.
 *
 * Used for the owner and, through {@link ensureCollaboratorCredentials}, for the three
 * collaborators. It was never owner-specific: it takes a `user.id` and reconciles the credential row
 * attached to it.
 *
 * Idempotent, and deliberately reluctant: the stored hash is verified against the seed password
 * first, so a database already in the right state is left untouched and re-running the seed is free.
 * The hash is produced by `better-auth/crypto`, the same function the credential provider uses when
 * no custom hasher is configured — writing our own would produce a row the login form rejects.
 */
async function ensureCredential(
  userId: string,
  password: string,
  keepExisting: boolean,
): Promise<CredentialOutcome> {
  const db = authDb()
  const rows = await db
    .select({
      id: account.id,
      accountId: account.accountId,
      password: account.password,
    })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, CREDENTIAL_PROVIDER),
      ),
    )
    .limit(1)
  const existing = rows.at(0)
  // The fixture's own instant, not the machine's: a demo workspace that says it was provisioned
  // three seconds ago reads as a test harness, and it makes two seedings of the same dataset
  // differ in a column for no reason anybody can act on.
  const now = SEED_ANCHOR_INSTANT

  if (existing === undefined) {
    await db.insert(account).values({
      id: demoAuthId('account', userId),
      issuer: CREDENTIAL_ISSUER,
      // `account_id`, and it must be the `user.id` itself rather than a derived value.
      // `better-auth@1.7.1` looks the credential up with
      // `accounts.find(a => a.providerId === 'credential' && a.issuer === issuer && a.accountId === user.id)`
      // (`dist/api/routes/sign-in.mjs`), so a row whose `account_id` is anything else is invisible to
      // the login form and the account is refused with "Invalid email or password" — a row that
      // exists, carries the right hash, and cannot be signed in with. `signUpEmail` writes the user
      // id here, and this path has to write what that path writes.
      accountId: userId,
      providerId: CREDENTIAL_PROVIDER,
      userId,
      password: await hashPassword(password),
      createdAt: now,
      updatedAt: now,
    })
    return 'created'
  }

  // A row whose `account_id` is not the user id is unusable whatever its hash says, so it is
  // straightened out before the password is even looked at — and `--keep-password` does not protect
  // it, because there is no working password there to keep.
  if (existing.accountId !== userId) {
    await db
      .update(account)
      .set({ accountId: userId, updatedAt: now })
      .where(eq(account.id, existing.id))
  }

  if (
    existing.accountId === userId &&
    existing.password !== null &&
    (await verifyPassword({ hash: existing.password, password }))
  ) {
    return 'unchanged'
  }

  if (keepExisting && existing.accountId === userId) {
    return 'left-alone'
  }

  await db
    .update(account)
    .set({ password: await hashPassword(password), updatedAt: now })
    .where(eq(account.id, existing.id))
  return 'reset'
}

/**
 * Gives the three collaborators a password of their own, so the demo has more than one signable
 * person in it.
 *
 * **Why this exists, against the paragraph at the top of this file that used to forbid it.** The
 * collaborators were deliberately credential-less: a demo dataset has no business minting passwords
 * for four people, and as long as the only thing behind a login was one workspace's own content that
 * was the right call. It stopped being the right call when the platform console landed. The console
 * ships three platform roles, and two of the three claims made about it — that a `curator` sees the
 * catalogue and no accounts tab, and that a `user` is turned away at `/console` entirely — can only
 * be *observed* by signing in as a curator and as a user. A fixture that provisions the roles but
 * not the credentials supports the screenshots and refuses the demonstration.
 *
 * They share the owner's password. There is one demo password, it is handed to the seed on the
 * command line, and four of them would be four things to remember about a fixture whose whole point
 * is that it is the same in every clone. The seed endpoint is behind `import.meta.env.DEV` and
 * reaches no production bundle.
 *
 * The suspended account gets one too, deliberately: the ban is only demonstrable against an account
 * that can otherwise sign in, and "suspended" and "has no password" are two different rejections
 * with two different messages.
 *
 * Idempotent through {@link ensureCredential}, which verifies the stored hash before it writes.
 * Returns how many rows it reconciled, for the seed report.
 */
async function ensureCollaboratorCredentials(
  password: string | undefined,
  keepExisting: boolean,
): Promise<number> {
  if (password === undefined || password.length === 0) {
    return 0
  }
  const db = authDb()
  const wanted = people.filter((person) => person.key !== 'rafal')
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(
      inArray(
        user.email,
        wanted.map((person) => person.email),
      ),
    )

  let reconciled = 0
  for (const row of rows) {
    const outcome = await ensureCredential(row.id, password, keepExisting)
    if (outcome === 'created' || outcome === 'reset') {
      reconciled += 1
    }
  }
  return reconciled
}

/**
 * Resolves the workspace owner from their email address, creating the account first when a password
 * is supplied and no account exists yet.
 */
async function resolveOwner(
  email: string,
  password: string | undefined,
  keepExistingPassword: boolean,
): Promise<{
  userId: string
  organizationId: string
  createdOwner: boolean
  credential: CredentialOutcome
}> {
  const db = authDb()
  const find = async () =>
    (
      await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1)
    ).at(0)

  let owner = await find()
  let createdOwner = false

  if (owner === undefined) {
    if (password === undefined || password.length === 0) {
      throw new SeedBootstrapError(
        `No account found for ${email}. Register it first, or re-run the seed with a password ` +
          `(--password, or the DEMO_PASSWORD environment variable) to have it created.`,
      )
    }
    await createOwnerAccount(email, password)
    createdOwner = true
    owner = await find()
    if (owner === undefined) {
      throw new SeedBootstrapError(
        `Signed ${email} up, but no user row appeared. The auth database may be pointing elsewhere.`,
      )
    }
  }

  const credential =
    password === undefined || password.length === 0
      ? 'left-alone'
      : await ensureCredential(owner.id, password, keepExistingPassword)

  const organizationId = await firstOrganizationIdFor(db, owner.id)
  if (organizationId === null) {
    throw new SeedBootstrapError(
      `${email} exists but belongs to no organization. Sign in once so it is provisioned.`,
    )
  }

  return { userId: owner.id, organizationId, createdOwner, credential }
}

/**
 * Ensures a `user` row exists for every collaborator in the dataset. Idempotent: existing addresses
 * are adopted rather than duplicated, which is what lets the seed be re-run.
 */
async function ensureCollaboratorUsers(
  ownerUserId: string,
): Promise<{ ids: Map<PersonKey, string>; created: number }> {
  const db = authDb()
  const wanted = people.filter((person) => person.key !== 'rafal')
  const ids = new Map<PersonKey, string>([['rafal', ownerUserId]])

  const existing = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(
      inArray(
        user.email,
        wanted.map((person) => person.email),
      ),
    )
  const byEmail = new Map(existing.map((row) => [row.email, row.id]))

  const missing = wanted.filter((person) => !byEmail.has(person.email))
  if (missing.length > 0) {
    const now = SEED_ANCHOR_INSTANT
    await db.insert(user).values(
      missing.map((person) => ({
        id: demoAuthId('user', person.email),
        name: person.name,
        email: person.email,
        emailVerified: true,
        image: null,
        twoFactorEnabled: false,
        createdAt: now,
        updatedAt: now,
      })),
    )
    const refreshed = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(
        inArray(
          user.email,
          missing.map((person) => person.email),
        ),
      )
    for (const row of refreshed) {
      byEmail.set(row.email, row.id)
    }
  }

  for (const person of wanted) {
    const id = byEmail.get(person.email)
    if (id === undefined) {
      throw new SeedBootstrapError(
        `Could not create or resolve the demo user ${person.email}.`,
      )
    }
    ids.set(person.key, id)
  }

  return { ids, created: missing.length }
}

/**
 * Resolves which workspace to seed and builds the owner's scope.
 *
 * Deliberately separate from {@link ensureWorkspacePeople}: the caller has to raise the seat quota
 * through the billing repository before three collaborators can be added, and it needs a scope to do
 * that with.
 */
export async function resolveWorkspace(
  db: Database,
  ownerEmail: string,
  ownerPassword?: string,
  keepExistingPassword = false,
): Promise<ResolvedWorkspace> {
  const owner = await resolveOwner(
    ownerEmail,
    ownerPassword,
    keepExistingPassword,
  )
  const ownerRole = await membershipRoleFor(authDb(), {
    userId: owner.userId,
    organizationId: owner.organizationId,
  })
  if (ownerRole !== 'owner' && ownerRole !== 'admin') {
    throw new SeedBootstrapError(
      `${ownerEmail} is "${ownerRole ?? 'not a member'}" of the workspace and cannot seed it.`,
    )
  }

  // Every run, warm or cold: a re-seed over an existing workspace never reaches
  // `ensureWorkspacePeople`, and the console has no subject without either of these. On a cold
  // database the collaborator rows do not exist yet and the credential pass finds nothing to do —
  // `ensureWorkspacePeople` runs it again once it has created them.
  await applyPlatformStanding()
  await applyPlatformLedger()
  await ensureCollaboratorCredentials(ownerPassword, keepExistingPassword)

  return {
    organizationId: owner.organizationId,
    ownerUserId: owner.userId,
    ownerRole,
    createdOwner: owner.createdOwner,
    credential: owner.credential,
    demoPassword: ownerPassword,
    keepExistingPassword,
    ownerScope: createScope(db, {
      userId: owner.userId,
      organizationId: owner.organizationId,
      role: ownerRole,
      impersonatedBy: null,
    }),
  }
}

/**
 * Puts the anchor on the four auth-side rows the fixture cannot fill in for itself.
 *
 * `./fixture-rows` answers the column defaults in `src/server/db/schema.ts`, and that covers every
 * row a repository inserts without naming a date. It does not cover these: Better Auth's sign-up
 * writes the owner's `user` and `account` rows with its own clock, its organization plugin writes
 * `organization` with the same, and `addMember()` in `src/server/repos/members.ts` passes an explicit
 * `new Date()`. So a freshly provisioned workspace carries the day it was provisioned in four places,
 * and `/settings` prints one of them — "Member since", which read a different date on each machine
 * and on each morning until this ran.
 *
 * Idempotent, and cheap enough to run on every seed: it writes the same four values every time, so a
 * warm database is left exactly as a cold one ends up.
 */
async function anchorAuthRows(
  workspace: ResolvedWorkspace,
  ids: ReadonlyMap<PersonKey, string>,
): Promise<void> {
  const db = authDb()
  const now = SEED_ANCHOR_INSTANT
  const userIds = people.flatMap((person) => {
    const id = ids.get(person.key)
    return id === undefined ? [] : [id]
  })

  await db
    .update(user)
    .set({ createdAt: now, updatedAt: now })
    .where(inArray(user.id, userIds))
  await db
    .update(account)
    .set({ createdAt: now, updatedAt: now })
    .where(inArray(account.userId, userIds))
  await db
    .update(organization)
    .set({ createdAt: now, updatedAt: now })
    .where(eq(organization.id, workspace.organizationId))

  for (const { userId, joinedAt } of membershipInstants(userIds)) {
    await db
      .update(member)
      .set({ createdAt: joinedAt })
      .where(
        and(
          eq(member.organizationId, workspace.organizationId),
          eq(member.userId, userId),
        ),
      )
  }
}

/**
 * The platform standing the four demo accounts hold, which is a different vocabulary from the
 * workspace roles beside it and must never be confused with them (docs/SPEC.md §5).
 *
 * `people[].role` in the dataset is `owner` / `admin` / `member`: membership of *this workspace*.
 * What this table sets is `user.role`, `user.banned`, `user.ban_reason` and `user.ban_expires` —
 * standing on the *product*. An owner of their own workspace is almost always `platformRole: 'user'`,
 * and the two disagreeing is the normal case rather than a bug.
 *
 * It exists because the platform console has no subject without it. Every screen under `/console`
 * needs an `admin` to open it, the role scale needs a `curator` to be a scale rather than a
 * yes/no, and the accounts table's suspended treatment — the one place `--color-danger` appears —
 * has nothing to render unless somebody is suspended. A visual baseline recorded against a database
 * where none of that is true photographs a redirect to `/dashboard` and looks like evidence.
 *
 * The demo owner is the `admin` because that is the one account the e2e suite can sign in as.
 *
 * `banExpires` is anchored like every other date in the fixture (`instantOn`), never `new Date()`:
 * the accounts table prints it, and a suspension that expires "in 45 days from whenever you seeded"
 * would put a different string in the baseline every morning.
 */
const PLATFORM_STANDING: ReadonlyArray<{
  readonly key: PersonKey
  readonly role: string | null
  readonly banned: boolean
  readonly banReason: string | null
  readonly banExpires: Date | null
}> = [
  {
    key: 'rafal',
    role: 'admin',
    banned: false,
    banReason: null,
    banExpires: null,
  },
  {
    key: 'mika',
    role: 'curator',
    banned: false,
    banReason: null,
    banExpires: null,
  },
  {
    key: 'jonas',
    role: null,
    banned: false,
    banReason: null,
    banExpires: null,
  },
  {
    key: 'priya',
    role: null,
    banned: true,
    banReason:
      'Sharing a workspace login with a third party. Suspended pending review.',
    banExpires: instantOn(45),
  },
]

/**
 * Writes the platform standing directly, which is the one place in the product that is allowed to.
 *
 * docs/ACCESS.md §8.1 bootstraps the first `admin` with a direct database statement and §8.2 says
 * every role afterwards goes through the console, "because a role that arrives without an audit
 * entry is a role nobody can account for later". This is §8.1's path, run against a development
 * fixture: there is no operator to attribute the grant to and no `platform_audit_log` row is
 * written, exactly as the bootstrap does not write one. It is behind `import.meta.env.DEV` with the
 * rest of the seed and reaches no production bundle.
 *
 * Resolved by address rather than from a caller's id map, and called from **both** seed paths, so it
 * lands on a warm database too. A re-run over an already-seeded workspace stops at the
 * `demo.seed` marker long before the collaborator rows are touched, and a fixture that only existed
 * on the cold path would be missing from every checkout that had ever been seeded before it was
 * written - which is every checkout that matters.
 *
 * Idempotent, and it writes all four columns on every account it names, including the nulls. A
 * fixture that only ever *added* standing could not take it away again, so a database seeded once
 * against an older table would keep whatever it was given the first time and drift away from the
 * standing every other clone has.
 */
async function applyPlatformStanding(): Promise<void> {
  const db = authDb()
  const emailFor = new Map(people.map((person) => [person.key, person.email]))

  for (const standing of PLATFORM_STANDING) {
    const email = emailFor.get(standing.key)
    if (email === undefined) {
      continue
    }
    await db
      .update(user)
      .set({
        role: standing.role,
        banned: standing.banned,
        banReason: standing.banReason,
        banExpires: standing.banExpires,
        updatedAt: SEED_ANCHOR_INSTANT,
      })
      .where(eq(user.email, email))
  }
}

/* -------------------------------------------------------------------------------------------------
 * The platform ledger fixture
 * ---------------------------------------------------------------------------------------------- */

/**
 * One entry the fixture puts in `platform_audit_log`, written the way the console writes it.
 *
 * `changes` carries `auditUserState`'s exact key set on both sides - `name`, `email`,
 * `emailVerified`, `role`, `banned`, `banReason`, `banExpiresAt` - because the account screen diffs
 * the two sides and drops every key whose values match. A fixture with a different shape would
 * render a diff no real action can produce.
 */
interface LedgerFixtureEntry {
  /** The account the entry is *about*: `entity_id` on the row, and whose timeline shows it. */
  readonly subject: PersonKey
  /** Who did it. Always the demo admin - the only account in the fixture that holds `user:*`. */
  readonly actor: PersonKey
  readonly action: PlatformActionName
  /** Days before the fixture's anchor, so the timeline reads the same in every clone. */
  readonly daysAgo: number
  /** Minutes past midday on that day, which is what orders two entries written the same day. */
  readonly minute: number
  /**
   * The `changes` payload, given the subject's id.
   *
   * A function rather than a literal because the impersonation verbs record the account id inside
   * the payload, and the demo ids are derived from the addresses at seed time rather than written
   * down here.
   */
  readonly changes: (subjectId: string) => {
    readonly before: LedgerSide
    readonly after: LedgerSide
  }
}

/** One side of a fixture payload. Scalars only, which is all any writer in the product records. */
type LedgerSide = Record<string, string | boolean | null>

/** `auditUserState`'s key set with everything at rest, so an entry only has to name what moved. */
function accountState(
  person: { readonly name: string; readonly email: string },
  overrides: LedgerSide = {},
): LedgerSide {
  return {
    name: person.name,
    email: person.email,
    emailVerified: true,
    role: null,
    banned: false,
    banReason: null,
    banExpiresAt: null,
    ...overrides,
  }
}

const MIKA = { name: 'Mika Tanaka', email: 'mika@planned.travel' }
const PRIYA = { name: 'Priya Raman', email: 'priya@planned.travel' }

/** The reason recorded with the suspension the fixture lifts again three days later. */
const MIKA_BAN_REASON =
  'Duplicate sign-ups from one address, pending a look at the logs.'

/**
 * The history the fixture gives the demo accounts, oldest first.
 *
 * Every screen in the product has a seeded subject; until this existed the account screen's audit
 * timeline did not, so `/console/users/$userId` rendered a designed empty state in a fresh clone and
 * a timeline on whichever machine had clicked around before recording. The two frames differ by
 * several hundred pixels of height, which fails a screenshot comparison before a pixel of it is
 * read - the frame stopped being evidence about the panel and became evidence about the recorder.
 *
 * The set is chosen to exercise the panel rather than to fill it: a suspension and its lifting (the
 * two `--color-danger` rows), a role grant (the neutral majority), and an impersonation pair (the
 * `--color-warning` rows). Priya carries the standing suspension `PLATFORM_STANDING` gives her, so
 * her page and her ledger agree.
 */
const PLATFORM_LEDGER: ReadonlyArray<LedgerFixtureEntry> = [
  {
    subject: 'mika',
    actor: 'rafal',
    action: PLATFORM_ACTIONS.USER_BANNED,
    daysAgo: 26,
    minute: 34,
    changes: () => ({
      before: accountState(MIKA),
      after: accountState(MIKA, {
        banned: true,
        banReason: MIKA_BAN_REASON,
        banExpiresAt: instantOn(-19).toISOString(),
      }),
    }),
  },
  {
    subject: 'mika',
    actor: 'rafal',
    action: PLATFORM_ACTIONS.USER_UNBANNED,
    daysAgo: 23,
    minute: 12,
    changes: () => ({
      before: accountState(MIKA, {
        banned: true,
        banReason: MIKA_BAN_REASON,
        banExpiresAt: instantOn(-19).toISOString(),
      }),
      after: accountState(MIKA),
    }),
  },
  {
    subject: 'mika',
    actor: 'rafal',
    action: PLATFORM_ACTIONS.USER_ROLE_CHANGED,
    daysAgo: 9,
    minute: 5,
    changes: () => ({
      before: accountState(MIKA),
      after: accountState(MIKA, { role: 'curator' }),
    }),
  },
  {
    subject: 'mika',
    actor: 'rafal',
    action: PLATFORM_ACTIONS.USER_IMPERSONATION_STARTED,
    daysAgo: 2,
    minute: 41,
    // The impersonation verbs record a session rather than an account, so their payload is the shape
    // of `src/server/fns/console/impersonation.ts` and not `auditUserState`'s key set. A fixture
    // that reused the account shape here would render an entry with nothing under it, which a reader
    // would take to mean the platform recorded nothing. The live start row also carries
    // `organizationId`, the workspace the session landed in; the seed leaves it out because the
    // subject's workspace id is not known here, and a row without it is the shape older rows have.
    changes: (subjectId) => ({
      before: { impersonating: null },
      after: {
        impersonating: subjectId,
        targetRole: 'curator',
        expiresAt: instantOn(-2, '12:56').toISOString(),
      },
    }),
  },
  {
    subject: 'mika',
    actor: 'rafal',
    action: PLATFORM_ACTIONS.USER_IMPERSONATION_ENDED,
    daysAgo: 2,
    minute: 48,
    changes: (subjectId) => ({
      before: { impersonating: subjectId },
      after: { impersonating: null },
    }),
  },
  {
    subject: 'priya',
    actor: 'rafal',
    action: PLATFORM_ACTIONS.USER_BANNED,
    daysAgo: 4,
    minute: 27,
    changes: () => ({
      before: accountState(PRIYA),
      after: accountState(PRIYA, {
        banned: true,
        banReason:
          'Sharing a workspace login with a third party. Suspended pending review.',
        banExpiresAt: instantOn(45).toISOString(),
      }),
    }),
  },
]

/**
 * Gives the demo accounts a platform audit trail, through the table's one sanctioned writer.
 *
 * `docs/SPEC.md` §5 makes `src/server/catalog/audit.ts` the single writer of `platform_audit_log`,
 * so the fixture calls {@link appendPlatformAudit} rather than inserting rows itself - the same
 * validation, the same bounds on `ip`, `user_agent` and `changes`, and the same `entity_type`
 * derived from the action. What it cannot do through that door is choose `created_at`: the column
 * takes the clock, and a timeline stamped "today" reads differently every morning. So the instant is
 * rewritten afterwards, exactly as `anchorAuthRows` rewrites the four auth-side dates Better Auth
 * stamps with its own clock, and for the same reason.
 *
 * **Idempotent by presence, not by upsert.** The ledger is append-only: there is no key to write
 * twice to, and a second seed run must not double the timeline. So a subject that already carries an
 * entry is left completely alone - including entries a real console action added, which is the
 * behaviour a developer who has been clicking around wants.
 *
 * Behind `import.meta.env.DEV` with the rest of the seed; none of it reaches a production bundle.
 */
async function applyPlatformLedger(): Promise<void> {
  const db = getDb()
  const logger = createLogger({ context: { component: 'seed-ledger' } })

  const ids = new Map<PersonKey, string>()
  for (const person of people) {
    const rows = await authDb()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, person.email))
      .limit(1)
    const row = rows.at(0)
    if (row !== undefined) {
      ids.set(person.key, row.id)
    }
  }

  const subjects = [...new Set(PLATFORM_LEDGER.map((entry) => entry.subject))]
  for (const subject of subjects) {
    const subjectId = ids.get(subject)
    if (subjectId === undefined) {
      continue
    }

    const existing = await db
      .select({ id: platformAuditLog.id })
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, subjectId))
      .limit(1)
    if (existing.length > 0) {
      continue
    }

    const written = new Set<string>()
    for (const entry of PLATFORM_LEDGER) {
      if (entry.subject !== subject) continue
      const actorId = ids.get(entry.actor)
      if (actorId === undefined) continue

      await appendPlatformAudit(
        db,
        { userId: actorId, actorKind: 'human', role: 'admin', tokenId: null },
        {
          action: entry.action,
          entityId: subjectId,
          changes: entry.changes(subjectId),
          ip: null,
          userAgent: null,
        },
        logger,
      )

      // `appendPlatformAudit` never throws and never returns an id, so the row it just wrote is
      // found rather than named: the one row under this subject no earlier pass has stamped. A
      // missing one means the append was refused and logged, which the fixture survives.
      const rows = await db
        .select({ id: platformAuditLog.id })
        .from(platformAuditLog)
        .where(eq(platformAuditLog.entityId, subjectId))
      const fresh = rows.find((row) => !written.has(row.id))
      if (fresh === undefined) continue
      written.add(fresh.id)

      await db
        .update(platformAuditLog)
        .set({
          createdAt: instantOn(
            -entry.daysAgo,
            `12:${String(entry.minute).padStart(2, '0')}`,
          ),
        })
        .where(eq(platformAuditLog.id, fresh.id))
    }
  }
}

/**
 * Creates the collaborator user rows, joins them to the workspace and builds a scope for each.
 *
 * Membership goes through the repository, so the seat quota and the "never remove the last owner"
 * rules apply exactly as they would to a real invitation — which is why the caller must have set the
 * subscription first. The collaborators' scopes carry the role the dataset gives them, so a write
 * attempted by the wrong person still fails the way it would in production.
 */
export async function ensureWorkspacePeople(
  db: Database,
  workspace: ResolvedWorkspace,
): Promise<SeedPeople> {
  const { ids, created } = await ensureCollaboratorUsers(workspace.ownerUserId)

  for (const person of people) {
    const userId = ids.get(person.key)
    if (userId === undefined || person.key === 'rafal') {
      continue
    }
    await addMember(workspace.ownerScope, { userId, role: person.role })
  }

  // Before the anchor, so the credential rows it writes are caught by the same `createdAt` rewrite
  // as every other auth row and a freshly seeded clone carries the fixture's instant everywhere.
  await ensureCollaboratorCredentials(
    workspace.demoPassword,
    workspace.keepExistingPassword,
  )

  await anchorAuthRows(workspace, ids)
  // After the anchor, which rewrites `updatedAt` on every one of these rows: the standing write
  // carries the same instant, so the two cannot leave the four accounts with different clocks.
  await applyPlatformStanding()
  await applyPlatformLedger()

  const scopes = new Map<PersonKey, TenantScope>()
  for (const person of people) {
    const userId = ids.get(person.key)
    if (userId === undefined) {
      continue
    }
    scopes.set(
      person.key,
      person.key === 'rafal'
        ? workspace.ownerScope
        : createScope(db, {
            userId,
            organizationId: workspace.organizationId,
            role: person.role,
            impersonatedBy: null,
          }),
    )
  }

  return { ids, created, scopes }
}

/**
 * Gives the demo owner a second workspace, so the workspace switcher has somewhere to go.
 *
 * The auth half follows the seam the rest of this module uses: `organization` and `member` belong to
 * the auth module, so the rows are written through `authDb()` with ids derived from the slug and the
 * anchor on every stamp, and the trip goes through `createTrip` like every other tenant row. The
 * owner joins a day after the first workspace's founding membership on purpose: the shell falls back
 * to the *oldest* membership when a session has no active workspace, and the demo owner has to keep
 * landing in the first one.
 *
 * Idempotent. A re-run finds the organization and the membership and rebuilds only the trip, the
 * same teardown the first workspace's trips get.
 */
export async function ensureSecondWorkspace(
  db: Database,
  workspace: ResolvedWorkspace,
): Promise<void> {
  const auth = authDb()
  const { name, slug, trip } = secondWorkspace
  const founded = SEED_ANCHOR_INSTANT
  const joined = instantOn(1)

  const organizationId = demoAuthId('organization', slug)
  const existing = (
    await auth
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1)
  ).at(0)
  if (existing !== undefined && existing.id !== organizationId) {
    // A workspace somebody made by hand under the demo slug: adding the demo owner to it as
    // `owner` would be the seed reaching into data it did not write.
    throw new Error(
      `A workspace with the slug "${slug}" already exists and is not the demo's; rename or remove it.`,
    )
  }
  if (existing === undefined) {
    await auth.insert(organization).values({
      id: organizationId,
      name,
      slug,
      createdAt: founded,
      updatedAt: founded,
    })
  }

  const membership = await membershipRoleFor(auth, {
    userId: workspace.ownerUserId,
    organizationId,
  })
  if (membership === null) {
    await recordParticipation(auth, organizationId, workspace.ownerUserId)
    await auth.insert(member).values({
      id: demoAuthId('member', `${slug}:${workspace.ownerUserId}`),
      organizationId,
      userId: workspace.ownerUserId,
      role: 'owner',
      createdAt: joined,
    })
  }

  const scope = createScope(db, {
    userId: workspace.ownerUserId,
    organizationId,
    role: 'owner',
    impersonatedBy: null,
  })
  const stale = await getTripBySlug(scope, trip.slug)
  if (stale !== null) {
    await deleteTrip(scope, stale.id)
  }
  await createTrip(scope, {
    id: trip.id,
    title: trip.title,
    slug: trip.slug,
    summary: trip.summary,
    destination: trip.destination,
    countryCodes: [...trip.countryCodes],
    startDate: trip.startDate,
    endDate: trip.endDate,
    timezone: trip.timezone,
    currency: trip.currency,
    status: trip.status,
    visibility: trip.visibility,
    accentColour: trip.accentColour,
  })
}
