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
 * The collaborators are deliberately created without a credential account, so they exist as people in
 * the workspace — names, avatars, splits, votes — but cannot sign in. A demo dataset has no business
 * minting passwords for four people.
 *
 * The **owner** is the one exception, and only when a password is handed in. Without a signable
 * account there is no way to reach an authenticated screen, which means the whole product behind the
 * login page is unreachable to the e2e suite and to anyone opening the project for the first time.
 * The account is minted through Better Auth's own sign-up API, so the password is hashed by the same
 * code path a real registration uses, and the `user.create` hook provisions the personal organization
 * exactly as it would for a real person. The seed endpoint that calls this is behind
 * `import.meta.env.DEV`, so none of it exists in a production bundle.
 */

import { and, eq, inArray } from 'drizzle-orm'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { account, member, organization, user } from '#/server/db/auth-schema'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, getAuth } from '#/server/auth'
import { authDb } from '#/server/auth/db'
import { firstOrganizationIdFor, membershipRoleFor } from '#/server/auth/provisioning'
import { addMember, createScope } from '#/server/repos'
import { SEED_ANCHOR_INSTANT, instantOn, people } from './dataset'
import { membershipInstants } from './fixture-rows'
import { stableId } from './stable-id'
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
async function createOwnerAccount(email: string, password: string): Promise<void> {
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
 * Makes the owner's password the one the seed was given, so a fixture workspace can actually be
 * signed into.
 *
 * The common case is an account that already exists from an earlier manual registration, with a
 * password nobody wrote down — which leaves the authenticated half of the product unreachable to the
 * e2e suite. Reconciling it here is what makes "seed, then sign in" reliable.
 *
 * Idempotent, and deliberately reluctant: the stored hash is verified against the seed password
 * first, so a database already in the right state is left untouched and re-running the seed is free.
 * The hash is produced by `better-auth/crypto`, the same function the credential provider uses when
 * no custom hasher is configured — writing our own would produce a row the login form rejects.
 */
async function ensureOwnerCredential(
  userId: string,
  password: string,
  keepExisting: boolean,
): Promise<CredentialOutcome> {
  const db = authDb()
  const rows = await db
    .select({ id: account.id, password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, CREDENTIAL_PROVIDER)))
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
      accountId: demoAuthId('account-external', userId),
      providerId: CREDENTIAL_PROVIDER,
      userId,
      password: await hashPassword(password),
      createdAt: now,
      updatedAt: now,
    })
    return 'created'
  }

  if (existing.password !== null && (await verifyPassword({ hash: existing.password, password }))) {
    return 'unchanged'
  }

  if (keepExisting) {
    return 'left-alone'
  }

  await db
    .update(account)
    .set({ password: await hashPassword(password), updatedAt: now })
    .where(eq(account.id, existing.id))
  return 'reset'
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
    (await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)).at(0)

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
      : await ensureOwnerCredential(owner.id, password, keepExistingPassword)

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
      throw new SeedBootstrapError(`Could not create or resolve the demo user ${person.email}.`)
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
  const owner = await resolveOwner(ownerEmail, ownerPassword, keepExistingPassword)
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
  // `ensureWorkspacePeople`, and the console has no subject without this.
  await applyPlatformStanding()

  return {
    organizationId: owner.organizationId,
    ownerUserId: owner.userId,
    ownerRole,
    createdOwner: owner.createdOwner,
    credential: owner.credential,
    ownerScope: createScope(db, {
      userId: owner.userId,
      organizationId: owner.organizationId,
      role: ownerRole,
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

  await db.update(user).set({ createdAt: now, updatedAt: now }).where(inArray(user.id, userIds))
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
      .where(and(eq(member.organizationId, workspace.organizationId), eq(member.userId, userId)))
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
  { key: 'jonas', role: null, banned: false, banReason: null, banExpires: null },
  {
    key: 'priya',
    role: null,
    banned: true,
    banReason: 'Sharing a workspace login with a third party. Suspended pending review.',
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

  await anchorAuthRows(workspace, ids)
  // After the anchor, which rewrites `updatedAt` on every one of these rows: the standing write
  // carries the same instant, so the two cannot leave the four accounts with different clocks.
  await applyPlatformStanding()

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
          }),
    )
  }

  return { ids, created, scopes }
}
