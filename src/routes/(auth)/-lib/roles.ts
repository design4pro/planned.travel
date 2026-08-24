/**
 * How the invitation screen names the role someone has been offered.
 *
 * The product says "Owner", "Admin" and "Member"; the database spells them
 * `owner`, `admin` and `member`, and the organization plugin will happily store
 * a role neither this module nor any catalogue has heard of. So the lookup is
 * guarded rather than indexed: the value arrives off the wire, and
 * `ROLE_COPY['constructor']` would otherwise answer with a function that the
 * screen would then hand to `t()` — which returns its argument unchanged for an
 * unknown key, so React would be asked to render a function. The sibling module
 * `errors.ts` guards the identically-sourced failure code for the same reason.
 *
 * A role the server invented therefore falls through to `null`, and the screen
 * shows the raw word with `auth.invitation.role.other` to explain it: the honest
 * answer, because no catalogue can carry a word coined after it was written.
 */
import type { MessageKey } from '#/lib/i18n'

/** The badge a role wears, and the one line that says what it may do. */
export interface RoleCopy {
  readonly badge: MessageKey
  readonly meaning: MessageKey
}

const ROLE_COPY: Readonly<Record<string, RoleCopy>> = {
  owner: {
    badge: 'auth.invitation.role.badge.owner',
    meaning: 'auth.invitation.role.owner',
  },
  admin: {
    badge: 'auth.invitation.role.badge.admin',
    meaning: 'auth.invitation.role.admin',
  },
  member: {
    badge: 'auth.invitation.role.badge.member',
    meaning: 'auth.invitation.role.member',
  },
}

/** The catalogue keys for a known role, or `null` for anything else. */
export function roleCopy(role: string): RoleCopy | null {
  return Object.hasOwn(ROLE_COPY, role) ? (ROLE_COPY[role] ?? null) : null
}
