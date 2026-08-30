/**
 * Everything the platform console says, in the source locale.
 *
 * `docs/SPEC.md` §9 fixes the shape: one flat object of keys, default-exported,
 * at `messages/<locale>/<namespace>.ts`. A screen reads a key as
 * `t('console.<key>')`, and `../../types.ts` derives the key union from this
 * file — so a typo here is a compile error at the call site rather than English
 * leaking onto a Polish screen (§9 bans the silent fallback outright).
 *
 * **Why an eleventh namespace.** The console is the platform surface — accounts,
 * platform roles, the audit ledger, the agent fleet — and none of it belongs to
 * a workspace. `settings` is the workspace's own administration and speaks the
 * `owner`/`admin`/`member` vocabulary; §5 forbids conflating the two scales, and
 * a shared namespace is exactly where that conflation would start: one file
 * holding both `role.admin` scales, with nothing to say which is which.
 *
 * **What is deliberately not here.**
 *
 * - *Registry field values.* `run.kind`, `run.stage` and `run.status` on the
 *   agent-runs screen are printed as the registry stores them, beside the run
 *   id, the host and the branch name, which are also stored strings. They are
 *   data being read out, not copy being written. `origin` is the exception and
 *   is here, because it was already a hand-written display map.
 * - *Server refusals.* `ConsoleActionError`'s seven-code vocabulary is authored
 *   on the server (`src/server/fns/console/errors.ts`) and arrives through the
 *   redaction envelope already worded. Only the fallback for a rejection that
 *   carries no readable sentence at all is below.
 * - *Identifiers.* An account id, an IP address, a branch name and a user-agent
 *   string are the same in every language.
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  /* ------------------------------------------------------------- sections -- */

  'nav.label': 'Console sections',
  'nav.overview': 'Overview',
  'nav.overview.description': 'The platform at a glance',
  'nav.accounts': 'Accounts',
  'nav.accounts.description': 'Roles, suspensions and sessions',
  'nav.runs': 'Agent runs',
  'nav.runs.description': 'What the sandcastle fleet is building',

  /* ---------------------------------------------------------------- shell -- */

  'shell.eyebrow': 'Platform',
  'shell.title': 'Console',
  'shell.description':
    'The product itself — accounts, standing and the global catalogue',
  'shell.signedInAs': 'Signed in as',
  'shell.error.title': 'The console did not load',
  'shell.notFound.title': 'No such account',
  'shell.notFound.body':
    'Nothing on the platform carries that id. It may have been deleted since the link was made, or the address may have been mistyped.',
  'shell.allAccounts': 'All accounts',
  'shell.overview': 'Console overview',

  /** The one sentence a refusal falls back to when it carries nothing readable. */
  'failure.fallback': 'The action did not go through. Try again in a moment.',

  /* ------------------------------------------------------------- overview -- */

  'overview.error.title': 'The overview did not load',
  'overview.standing.title': 'Your standing on the platform',
  'overview.standing.body':
    'Accounts, sessions and impersonation belong to a platform admin, so the console shows you the catalogue and nothing else.',
  'overview.stat.accounts': 'Accounts',
  'overview.stat.accounts.caption': {
    one: 'One of them holds a platform role',
    other: '{staff} of them hold a platform role',
  },
  'overview.stat.admins': 'Admins',
  'overview.stat.admins.caption': 'Full authority over accounts and sessions',
  'overview.stat.curators': 'Curators',
  'overview.stat.curators.caption': 'The catalogue only — never accounts',
  'overview.stat.suspended': 'Suspended',
  'overview.stat.suspended.none': 'Nobody is locked out',
  'overview.stat.suspended.some': 'Signed out everywhere until a ban is lifted',
  'overview.stat.suspended.review': 'Review them',
  'overview.newest.label': 'Newest accounts',
  'overview.newest.empty.title': 'No accounts yet',
  'overview.newest.empty.body': 'The first person to register appears here.',
  'overview.catalogue.label': 'Catalogue by status',
  'overview.catalogue.empty.title': 'The global catalogue is not open yet',
  'overview.catalogue.empty.body':
    'Once the ingestion pipeline lands, this panel counts every place in the shared catalogue as draft, in review or published — and each count opens the list behind it.',
  'overview.scraping.label': 'Scraping runs',
  'overview.scraping.empty.title': 'No source has been run',
  'overview.scraping.empty.body':
    'Sources are scraped on a weekly schedule. When the first run finishes, the last five appear here with what each one ingested, changed and rejected.',

  /* -------------------------------------------------------- the role scale -- */

  'role.admin': 'Admin',
  'role.admin.summary':
    'Full platform authority: accounts, roles, bans, sessions and impersonation.',
  'role.admin.holds.accounts': 'Create accounts and set platform roles',
  'role.admin.holds.bans': 'Suspend accounts and lift suspensions',
  'role.admin.holds.sessions': 'Revoke sessions and set passwords',
  'role.admin.holds.impersonate': 'Impersonate an account for fifteen minutes',
  'role.admin.holds.curation': 'Everything a curator may do',
  'role.admin.withheld.admins': 'Impersonate another platform admin',
  'role.curator': 'Curator',
  'role.curator.summary':
    'The catalogue, packs, sources and share moderation. Nothing that touches accounts.',
  'role.curator.holds.places': 'Read, write and publish catalogue places',
  'role.curator.holds.packs': 'Read, write and publish place packs',
  'role.curator.holds.sources': 'Read and run catalogue sources',
  'role.curator.holds.shares': 'Review and revoke shared links',
  'role.curator.withheld.accounts':
    'Anything that touches an account or a session',
  'role.curator.withheld.tokens': 'Issuing or revoking machine credentials',
  'role.user': 'User',
  'role.user.summary': 'No platform surface at all. This is nearly everybody.',
  'role.user.withheld.everything':
    'Every platform statement, without exception',

  /* ---------------------------------------------------------- one account -- */

  'identity.you': 'You',
  'status.active': 'Active',
  'status.suspended': 'Suspended',
  'status.permanent': 'Permanent',
  'status.until': 'Until {date}',
  'status.unverified': 'Unverified',
  'device.on': '{browser} on {platform}',
  'device.unrecognised': 'Unrecognised device',

  /* --------------------------------------------------------- accounts list -- */

  'users.error.title': 'The accounts list did not load',
  'users.total': '{total} total',
  'users.loading': 'Loading accounts',
  'users.table.label': 'Platform accounts',
  'users.search.label': 'Search accounts',
  'users.search.email': 'Search email addresses',
  'users.search.name': 'Search names',
  'users.search.column': 'Search which column',
  'users.search.submit': 'Search',
  'users.field.email': 'Email',
  'users.field.name': 'Name',
  'users.filter.role.label': 'Filter by platform role',
  'users.filter.role.any': 'Any role',
  'users.filter.role.admin': 'Admins',
  'users.filter.role.curator': 'Curators',
  'users.filter.status.label': 'Filter by account status',
  'users.filter.status.any': 'Any status',
  'users.filter.clear': 'Clear filters',
  'users.filter.hint': 'Narrow by role or by status — one at a time.',
  'users.column.account': 'Account',
  'users.column.role': 'Platform role',
  'users.column.status': 'Status',
  'users.column.joined': 'Joined',
  'users.column.actions': 'Actions',
  'users.joined': 'Joined {date}',
  'users.pastEnd.title': 'That page is past the end',
  'users.pastEnd.body': {
    one: 'There is one account in this view, and page 1 is the only page it has.',
    other:
      'There are {total} accounts in this view, which is {pages}. Page {page} is beyond it.',
  },
  'users.pastEnd.pages': {
    one: 'a single page',
    other: '{pages} pages',
  },
  'users.pastEnd.back': 'Back to the first page',
  'users.empty.filtered.title': 'Nothing matches those filters',
  'users.empty.filtered.body':
    'No account on the platform answers this search. Widen it, or clear the filters to see everybody.',
  'users.empty.title': 'No accounts to show',
  'users.empty.body':
    'This view is empty. Nothing is filtered, so there is nothing here to widen.',

  /* ------------------------------------------------------- account screen -- */

  'account.error.title': 'That account did not load',
  'account.loading': 'Loading the account',
  'account.meta.lastChange': 'Last change',
  'account.meta.id': 'Account id',
  'account.banned.title': 'This account is suspended',
  'account.banned.noReason': 'No reason was recorded with the suspension.',
  'account.banned.permanent': ' It stays in force until an admin lifts it.',
  'account.banned.until': ' It lifts itself on {date}.',
  'account.banned.untilUnknown': 'its expiry date',
  'account.authority.label': 'Platform authority',
  'account.authority.may': 'May',
  'account.authority.mayNot': 'May not',
  'account.authority.none': 'Nothing on the platform.',
  'account.workspaces.label': 'Workspaces',
  'account.workspaces.truncated':
    'This account belongs to more workspaces than the {listed} listed here.',
  'account.workspaces.empty.title': 'In no workspace',
  'account.workspaces.empty.body':
    'This account belongs to no workspace yet. One is provisioned the first time it signs in, and any it is invited to appear here.',
  'account.workspaces.column.workspace': 'Workspace',
  'account.workspaces.column.role': 'Role',
  'account.workspaces.column.plan': 'Plan',
  'account.subscription.label': 'Subscription',
  'account.subscription.free.title': 'On the free plan',
  'account.subscription.free.body':
    'The workspace this account owns has never been through checkout, so it carries no subscription record and runs on the free plan’s quotas.',
  'account.subscription.none.title': 'Nothing bills to this account',
  'account.subscription.none.body':
    'This account owns no workspace. A member of somebody else’s workspace is not who that workspace bills, so there is nothing here to collect.',
  'account.subscription.endsAtClose': 'Ends at period close',
  'account.subscription.seats': 'Seats',
  'account.subscription.seatsValue': '{used} of {limit}',
  'account.subscription.ends': 'Ends',
  'account.subscription.renews': 'Renews',
  'account.sessions.label': 'Live sessions',
  'account.sessions.truncated':
    'This account holds more sessions than one call lists. Revoke every session from the actions menu to be sure none is left behind.',
  'account.sessions.empty.title': 'Signed out everywhere',
  'account.sessions.empty.body':
    'This account holds no session that has not expired. It will appear here the moment it signs in again.',
  'account.sessions.column.device': 'Device',
  'account.sessions.column.address': 'Address',
  'account.sessions.column.started': 'Started',
  'account.sessions.column.expires': 'Expires',
  'account.sessions.impersonated': 'Minted by impersonation',
  'account.sessions.noAddress': 'Not recorded',
  'account.sessions.noAddressLong': 'Address not recorded',
  'account.sessions.when': 'Started {started} · expires {expires}',
  'account.audit.label': 'Audit history',
  'account.audit.truncated':
    'The ledger holds more entries than this. The platform audit trail is append-only and kept for four hundred days.',
  'account.audit.empty.title': 'Nothing has been done to this account',
  'account.audit.empty.body':
    'Every role change, suspension, password reset, session revocation and impersonation is written here with the operator’s name on it. Nobody has touched this one.',

  /* --------------------------------------------------- the workspace scale -- */

  'workspace.role.owner': 'Owner',
  'workspace.role.admin': 'Admin',
  'workspace.role.member': 'Member',
  'plan.free': 'Free',
  'plan.starter': 'Starter',
  'plan.pro': 'Pro',
  'plan.business': 'Business',
  'subscription.trialing': 'Trialing',
  'subscription.active': 'Active',
  'subscription.pastDue': 'Past due',
  'subscription.canceled': 'Cancelled',
  'subscription.incomplete': 'Incomplete',
  'subscription.expired': 'Expired',
  'subscription.unpaid': 'Unpaid',
  'subscription.paused': 'Paused',

  /* ---------------------------------------------------------- audit ledger -- */

  'audit.action.created': 'Account created',
  'audit.action.updated': 'Account details changed',
  'audit.action.roleChanged': 'Platform role changed',
  'audit.action.banned': 'Account suspended',
  'audit.action.unbanned': 'Suspension lifted',
  'audit.action.deleted': 'Account deleted',
  'audit.action.passwordSet': 'Password set by an admin',
  'audit.action.emailSet': 'Email address changed',
  'audit.action.impersonationStarted': 'Impersonation started',
  'audit.action.impersonationEnded': 'Impersonation ended',
  'audit.action.sessionRevoked': 'A session was revoked',
  'audit.action.sessionRevokedAll': 'Every session was revoked',
  'audit.actor.system': 'The platform itself',
  'audit.actor.system.detail': 'automatic',
  'audit.actor.agent': 'A machine credential',
  'audit.actor.agent.detail': 'MCP token',
  'audit.actor.deleted': 'A deleted account',
  'audit.actorBadge': '{role} at the time',
  'audit.field.name': 'Name',
  'audit.field.email': 'Email address',
  'audit.field.emailVerified': 'Email verified',
  'audit.field.role': 'Platform role',
  'audit.field.banned': 'Suspended',
  'audit.field.banReason': 'Reason',
  'audit.field.banExpiresAt': 'Suspension ends',
  'audit.field.revoked': 'Sessions ended',
  'audit.field.impersonating': 'Acting as',
  'audit.field.impersonatedBy': 'Acted by',
  'audit.field.expiresAt': 'Session expires',
  'audit.field.targetRole': 'Their platform role',
  'audit.field.sessionId': 'Session',
  'audit.value.yes': 'yes',
  'audit.value.no': 'no',
  'audit.value.cleared': 'cleared',
  'audit.became': 'became',

  /* --------------------------------------------------------------- dialogs -- */

  'dialog.cancel': 'Cancel',

  'create.button': 'New account',
  'create.title': 'Create an account',
  'create.body':
    'The address is not verified and no mail is sent — hand the password over yourself.',
  'create.confirm': 'Create account',
  'create.name.placeholder': 'Mika Tanaka',
  'create.email': 'Email address',
  'create.email.placeholder': 'mika@planned.travel',
  'create.password': 'Password',
  'create.password.hint':
    'Long enough to be a passphrase. The account can change it afterwards.',
  'create.done': 'Account created',
  'create.done.body': '{email} can sign in with the password you set.',

  'action.menu.label': 'Actions for {name}',
  'action.group.account': 'Account',
  'action.group.credentials': 'Credentials',

  'action.role.item': 'Change platform role',
  'action.role.self':
    'Not on your own account — a self-demotion can leave the platform with no admin.',
  'action.role.body':
    'What {name} may do on the platform itself. Workspace membership is a separate vocabulary and does not move.',
  'action.role.confirm': 'Save role',
  'action.role.current': 'Current',
  'action.role.done': 'Platform role updated',
  'action.role.done.body': '{name} now holds the {role} role on the platform.',

  'action.impersonate.item': 'Impersonate',
  'action.impersonate.self':
    'There is nobody to become — this is your own account.',
  'action.impersonate.banned':
    'The account is suspended, so it holds no session to wear.',
  'action.impersonate.admin':
    'No role on the platform may impersonate an admin, including yours.',
  'action.impersonate.title': 'Act as {name}',
  'action.impersonate.body':
    'You will see the product exactly as this account does, for fifteen minutes.',
  'action.impersonate.confirm': 'Start impersonating',
  'action.impersonate.note.bar':
    'A warning bar stays on every screen until you end it, and it cannot be dismissed.',
  'action.impersonate.note.platform':
    'Platform actions are unavailable while you are acting as somebody else — the console included.',
  'action.impersonate.note.audit':
    'Starting and ending are both written to the platform audit trail, with your name on them.',

  'action.password.item': 'Set a password',
  'action.password.title': 'Set a password for {name}',
  'action.password.body':
    'Use this to recover a locked-out account or to shut an attacker out of a compromised one.',
  'action.password.confirm': 'Set password',
  'action.password.field': 'New password',
  'action.password.hint.self':
    'Every session ends when this is set — including yours.',
  'action.password.hint':
    'Every session the account holds ends when this is set.',
  'action.password.done': 'Password set',
  'action.password.done.body': '{name} has been signed out of every device.',

  'action.sessions.item': 'Revoke every session',
  'action.sessions.body.self':
    'This signs you out of every device, including the one you are reading this on.',
  'action.sessions.body':
    '{name} is signed out of every device and has to sign in again.',
  'action.sessions.confirm': 'Revoke sessions',
  'action.sessions.done': 'Sessions revoked',
  'action.sessions.done.body': {
    one: 'One session was ended.',
    other: '{revoked} sessions were ended.',
  },

  'action.ban.item': 'Suspend the account',
  'action.ban.self':
    'Not on your own account — a self-suspension takes away your own way back in.',
  'action.ban.title': 'Suspend {name}',
  'action.ban.body':
    'Every session ends immediately and the account cannot sign in again until the suspension is lifted or expires.',
  'action.ban.confirm': 'Suspend account',
  'action.ban.reason': 'Reason',
  'action.ban.reason.hint':
    'Kept on the platform audit trail for thirteen months, and shown to nobody but an admin.',
  'action.ban.reason.placeholder':
    'Repeated abuse reports from three workspaces',
  'action.ban.duration': 'Duration',
  'action.ban.duration.label': 'Suspension duration',
  'action.ban.duration.permanent.body':
    'Stays in force until an admin lifts it deliberately.',
  'action.ban.duration.day': '24 hours',
  'action.ban.duration.day.body':
    'Long enough to interrupt, short enough to be an intervention.',
  'action.ban.duration.week': '7 days',
  'action.ban.duration.week.body': 'A week to answer a complaint.',
  'action.ban.duration.month': '30 days',
  'action.ban.duration.month.body': 'A month of enforced quiet.',
  'action.ban.duration.quarter': '90 days',
  'action.ban.duration.quarter.body':
    'The longest the console offers. Beyond it, suspend permanently.',
  'action.ban.done': 'Account suspended',
  'action.ban.done.body':
    '{name} has been signed out everywhere and cannot sign in again.',

  'action.unban.item': 'Lift the suspension',
  'action.unban.title': 'Lift the suspension on {name}',
  'action.unban.body':
    'The account can sign in again from its next attempt. No previous session is restored.',
  'action.unban.confirm': 'Lift suspension',
  'action.unban.done': 'Suspension lifted',
  'action.unban.done.body':
    '{name} can sign in again. No session was restored.',

  'action.delete.item': 'Delete the account',
  'action.delete.self':
    'Not on your own account — there is no way back from it.',
  'action.delete.title': 'Delete {name}',
  'action.delete.body':
    'The account, its sessions and every credential attached to it are removed. This cannot be undone.',
  'action.delete.confirm': 'Delete account',
  'action.delete.note':
    'Workspace content this person created stays with the workspace that owns it. Suspending the account instead keeps the record and takes away the access.',
  'action.delete.done': 'Account deleted',
  'action.delete.done.body':
    '{name} and everything attached to the account are gone.',

  'session.revoke.label': 'End the session on {device}',
  'session.revoke.title': 'End this session',
  'session.revoke.body':
    '{device} has to sign in again on its next request. If it is the session you are reading this in, you are signed out with it.',
  'session.revoke.confirm': 'End session',
  'session.revoke.done': 'Session ended',
  'session.revoke.done.body':
    'The device has to sign in again on its next request.',

  /* ------------------------------------------------------------ agent runs -- */

  'runs.error.title': 'The run registry did not answer',
  'runs.origin.local': 'Local',
  'runs.origin.githubActions': 'GitHub Actions',
  'runs.stat.live': 'Live runs',
  'runs.stat.live.none': 'Nothing is building right now',
  'runs.stat.live.some': 'Heartbeating against a five-minute lease',
  'runs.stat.issues': 'Issues held',
  'runs.stat.issues.caption':
    'Leased to one run each, ancestors and sub-issues included',
  'runs.stat.orphans': 'Orphaned branches',
  'runs.stat.orphans.none': 'No work is sitting unclaimed',
  'runs.stat.orphans.some':
    'Commits from a run that stopped, waiting to be adopted',
  'runs.live.empty.title': 'No run is registered',
  'runs.live.empty.body':
    'A run appears here the moment it registers — from this machine, from another, or from a GitHub Actions runner — with the issues it has claimed.',
  'runs.holds.nothing': 'holds nothing',
  'runs.holds': 'holds {issues}',
  'runs.uptime': '{elapsed} up · {lease}',
  'runs.lease.expired': 'expired',
  'runs.lease.left': '{elapsed} left',
  'runs.wip.label': 'Work in progress',
  'runs.wip.empty.title': 'No branch is carrying work',
  'runs.wip.empty.body':
    'A run records its branch as soon as it has commits on it, so that if the run dies the next one to claim the issue is offered the work instead of starting it again.',
  'runs.wip.orphaned': 'Orphaned',
  'runs.wip.meta': {
    one: '{commits} commit · {elapsed} ago',
    other: '{commits} commits · {elapsed} ago',
  },
  'runs.recent.label': 'Recently finished',
  'runs.recent.empty.title': 'No run has finished yet',
  'runs.recent.empty.body':
    'The last fifty runs are kept here with how each one ended.',
  'runs.ago': '{elapsed} ago',
  'runs.notCoordinator.title': 'This deployment does not coordinate the fleet',
  'runs.notCoordinator.body':
    'The run registry is bound on staging alone, and deliberately: a second registry would let two fleets each believe they hold the backlog, which is the one thing it exists to prevent. Read the fleet on staging.',
  'nav.providers': 'Providers',
  'nav.providers.description': 'Outbound calls and their ceilings',
  'providers.error.title': 'The provider meters could not be read',
  'providers.list.label': 'Services',
  'providers.status.planned': 'Not integrated',
  'providers.status.planned.description':
    'Nothing calls this service yet, so there is nothing to count. It is listed so a ceiling can be agreed before the first call rather than after the first invoice.',
  'providers.policy.allow': 'Bills through',
  'providers.policy.block': 'Refuses at the ceiling',
  'providers.badge.blocked': {
    one: 'One call refused',
    other: '{calls} calls refused',
  },
  'providers.limit.none': 'No ceiling agreed · {used} this month',
  'providers.limit.value': '{used} of {limit}',
  'providers.limit.window.day': 'Today',
  'providers.limit.window.month': 'This month',
  'providers.measuring.none': 'Nothing measured yet',
  'providers.measuring.since': 'Measuring since {date}',
  'providers.stat.calls': 'Calls this month',
  'providers.stat.calls.caption': 'Across every integrated service',
  'providers.stat.errors': 'Failed calls',
  'providers.stat.errors.caption':
    'Counted as calls as well, because most vendors bill them',
  'providers.stat.nearLimit': 'Near a ceiling',
  'providers.stat.nearLimit.caption': 'Services past their warning threshold',
  'providers.stat.blocked': 'Refused calls',
  'providers.stat.blocked.none': 'Nothing has been turned away',
  'providers.stat.blocked.some': 'Demand a ceiling turned away',
  'providers.forecast.label': 'Forecast',
  'providers.forecast.provider': 'Service',
  'providers.forecast.monthEnd': 'By month end',
  'providers.forecast.runRate': 'Per month at this rate',
  'providers.forecast.perWorkspace': 'Per workspace, per month',
  'providers.forecast.noWorkspaceTraffic': 'No workspace traffic to average',
  'providers.forecast.window': {
    one: 'Projected from one hour of measurement.',
    other: 'Projected from {hours} hours of measurement.',
  },
  'providers.forecast.tooEarly': {
    one: 'Only one hour measured so far — not enough to project from. Extrapolating a month from less than a day would be arithmetic rather than a forecast.',
    other:
      'Only {hours} hours measured so far — not enough to project from. Extrapolating a month from less than a day would be arithmetic rather than a forecast.',
  },
  'providers.forecast.atWorkspaces': 'At how many workspaces',
  'providers.forecast.callsEach': 'Calls each per month',
  'providers.forecast.projected': 'About {calls} calls a month.',
  'providers.workspaces.label': 'Busiest workspaces',
  'providers.workspaces.platform': 'Platform (no workspace)',
  'providers.workspaces.empty.title': 'No calls attributed yet',
  'providers.workspaces.empty.description':
    'A call made for a workspace is recorded against it. Cron work and platform mail belong to no workspace and are counted apart.',
  'providers.readOnly':
    'You can read these meters but not move a ceiling. Changing a limit or its policy needs the provider:configure statement.',
} as const satisfies NamespaceMessages

export default messages
