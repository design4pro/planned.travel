import { describe, expect, it } from 'vitest'

import { PLATFORM_AUDIT_ACTIONS } from '#/server/db/schema'
import {
  auditChanges,
  describeAuditActor,
  describeAuditField,
  describePlatformAction,
  platformActionTone,
} from '../ledger'

/**
 * The ledger is append-only and kept for four hundred days, so a row written by an older shape of
 * the code is a row this module still has to render. Every assertion here is about that: an unknown
 * action, an unknown field and a malformed payload each have to produce something truthful rather
 * than an exception or a blank.
 */
describe('describePlatformAction', () => {
  /** The twelve `PLATFORM_AUDIT_ACTIONS` that can name an account as their entity. */
  const ACCOUNT_ACTIONS: ReadonlyArray<string> = [
    'platform.user.created',
    'platform.user.updated',
    'platform.user.role_changed',
    'platform.user.banned',
    'platform.user.unbanned',
    'platform.user.deleted',
    'platform.user.password_set',
    'platform.user.email_set',
    'platform.user.impersonation_started',
    'platform.user.impersonation_ended',
    'platform.session.revoked',
    'platform.session.revoked_all',
  ]

  it('names every action an account timeline can carry', () => {
    for (const action of ACCOUNT_ACTIONS) {
      expect(
        describePlatformAction(action),
        `${action} has no sentence, so the timeline would print the raw name`,
      ).not.toBe(action)
    }
  })

  it('only claims actions the schema actually declares', () => {
    const declared = new Set<string>(PLATFORM_AUDIT_ACTIONS)
    for (const action of ACCOUNT_ACTIONS) {
      expect(
        declared.has(action),
        `${action} is not in PLATFORM_AUDIT_ACTIONS — the two lists have drifted`,
      ).toBe(true)
    }
  })

  it('prints an action it does not know rather than swallowing the row', () => {
    expect(describePlatformAction('catalog_place.published')).toBe(
      'catalog_place.published',
    )
  })
})

/**
 * `--color-danger` is spent on ban, revoke and delete and on nothing else — the rule the reference
 * screen breaks by painting its primary button and its Administrator badge the same red. A timeline
 * is the easiest place to lose it, because every row is a past action and every past action feels
 * consequential.
 */
describe('platformActionTone', () => {
  it('spends danger on exactly the three destructive verbs', () => {
    const danger = [
      'platform.user.banned',
      'platform.user.deleted',
      'platform.session.revoked',
      'platform.session.revoked_all',
    ]
    for (const action of danger) {
      expect(platformActionTone(action)).toBe('danger')
    }
  })

  it('keeps impersonation loud without making it destructive', () => {
    expect(platformActionTone('platform.user.impersonation_started')).toBe(
      'warning',
    )
    expect(platformActionTone('platform.user.impersonation_ended')).toBe(
      'warning',
    )
  })

  it('leaves everything else neutral', () => {
    for (const action of [
      'platform.user.created',
      'platform.user.updated',
      'platform.user.role_changed',
      'platform.user.unbanned',
      'platform.user.password_set',
      'platform.user.email_set',
      'something.nobody.wrote',
    ]) {
      expect(platformActionTone(action)).toBe('neutral')
    }
  })
})

describe('describeAuditActor', () => {
  it('names the platform itself for a system row rather than an em dash', () => {
    // docs/ACCESS.md §4.3: a temporary ban lifts itself inside the plugin's own hook, audited as
    // `actor_kind: system` with no operator anywhere near it. That is an actor, not an absence.
    const actor = describeAuditActor('system', null)
    expect(actor.name).toBe('The platform itself')
    expect(actor.detail).toBe('automatic')
  })

  it('says a human row whose account has since been deleted is exactly that', () => {
    expect(describeAuditActor('human', null).name).toBe('A deleted account')
    expect(describeAuditActor('human', 'Mika Tanaka').name).toBe('Mika Tanaka')
  })

  it('marks an agent row as arriving on a credential', () => {
    expect(describeAuditActor('agent', 'Import bot').detail).toBe('MCP token')
  })
})

describe('describeAuditField', () => {
  it('labels every field auditUserState can move', () => {
    for (const field of [
      'name',
      'email',
      'emailVerified',
      'role',
      'banned',
      'banReason',
      'banExpiresAt',
    ]) {
      expect(describeAuditField(field)).not.toBe(field)
    }
  })

  it('prints a field it does not know as it was stored', () => {
    expect(describeAuditField('somethingNew')).toBe('somethingNew')
  })
})

describe('auditChanges', () => {
  it('lists only the fields that moved', () => {
    const changes = auditChanges({
      before: { name: 'Jonas Berg', role: null, banned: false },
      after: { name: 'Jonas Berg', role: 'curator', banned: false },
    })
    expect(changes).toEqual([
      { field: 'role', before: '—', after: 'curator' },
    ])
  })

  it('renders booleans as words and nulls as an em dash', () => {
    const changes = auditChanges({
      before: { banned: false, banReason: null },
      after: { banned: true, banReason: 'Repeated abuse reports' },
    })
    expect(changes).toEqual([
      { field: 'banned', before: 'no', after: 'yes' },
      { field: 'banReason', before: '—', after: 'Repeated abuse reports' },
    ])
  })

  it('orders the fields the way the account screen reads them', () => {
    const changes = auditChanges({
      before: { banned: false, name: 'Old', role: null, unknownKey: 1 },
      after: { banned: true, name: 'New', role: 'admin', unknownKey: 2 },
    })
    expect(changes.map((change) => change.field)).toEqual([
      'name',
      'role',
      'banned',
      'unknownKey',
    ])
  })

  it('treats a missing side as nothing rather than as a deletion of everything', () => {
    expect(auditChanges({ before: null, after: { role: 'admin' } })).toEqual([
      { field: 'role', before: '—', after: 'admin' },
    ])
  })

  it('produces no rows for a payload it cannot read, and never throws', () => {
    for (const payload of [null, undefined, 'a string', 42, [], {}]) {
      expect(auditChanges(payload)).toEqual([])
    }
  })

  it('reads an instant the way the rest of the console reads instants', () => {
    // The ledger stores `banExpiresAt` as a full ISO-8601 string. Printing it raw would put
    // `2026-10-04T00:00:00.000Z` next to `4 Oct 2026, 00:00 UTC` in the same panel.
    const changes = auditChanges({
      before: { banExpiresAt: null },
      after: { banExpiresAt: '2026-10-04T00:00:00.000Z' },
    })
    expect(changes).toEqual([
      { field: 'banExpiresAt', before: '—', after: '4 Oct 2026, 00:00 UTC' },
    ])
  })

  it('leaves a string that only looks date-ish alone', () => {
    const changes = auditChanges({
      before: { banReason: null },
      after: { banReason: '2026 is the year of the incident' },
    })
    expect(changes[0]?.after).toBe('2026 is the year of the incident')
  })

  it('renders a nested value once rather than dropping it', () => {
    const changes = auditChanges({
      before: { quota: { seats: 1 } },
      after: { quota: { seats: 5 } },
    })
    expect(changes).toEqual([
      { field: 'quota', before: '{"seats":1}', after: '{"seats":5}' },
    ])
  })
})


/**
 * The impersonation verbs are the one pair whose payload is not `auditUserState`'s key set.
 *
 * `src/server/fns/console/impersonation.ts` records `{ impersonating }` on the way in, with the
 * session's expiry and the target's platform role beside it, and `{ impersonating: null }` on the
 * way out - and the dev seed's ledger fixture writes exactly that shape so the account screen has a
 * subject in a fresh clone. All three keys sit outside `FIELD_ORDER`, which is what makes this worth
 * pinning: an unlabelled key is printed as the column stored it, and `EXPIRESAT` in tracked capitals
 * is a variable name where a reader expected English.
 */
describe('an impersonation entry', () => {
  it('names all three of its fields in words', () => {
    const changes = auditChanges({
      before: { impersonating: null },
      after: {
        impersonating: 'acct_9',
        targetRole: 'curator',
        expiresAt: '2026-08-18T12:56:00.000Z',
      },
    })

    expect(changes.map((change) => describeAuditField(change.field))).toEqual([
      'Session expires',
      'Acting as',
      'Their platform role',
    ])
  })

  it('reads the session expiry as an instant rather than as a serialisation', () => {
    const changes = auditChanges({
      before: { impersonating: null },
      after: { impersonating: 'acct_9', expiresAt: '2026-08-18T12:56:00.000Z' },
    })

    const expiry = changes.find((change) => change.field === 'expiresAt')
    expect(expiry?.after).not.toContain('T12:56')
    expect(expiry?.after).toContain('2026')
  })

  it('shows the exit as a value cleared rather than as a diff of an absence', () => {
    const changes = auditChanges({
      before: { impersonating: 'acct_9' },
      after: { impersonating: null },
    })

    expect(changes).toEqual([
      { field: 'impersonating', before: 'acct_9', after: '\u2014' },
    ])
  })
})
