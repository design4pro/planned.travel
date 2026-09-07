/**
 * Reads and writes for the settings section.
 *
 * Personal preferences land on `user_settings`, workspace defaults on
 * `organization_settings`, and the merge rule that decides which one a screen
 * actually obeys lives in the repository layer, not here.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { DEFAULT_LOCALE } from '#/lib/i18n/locales'
import { resolveLocaleTag } from '#/lib/i18n/negotiate'
// The catalogue module rather than the `#/lib/map` barrel, which would drag `style.ts`, `world.ts`
// and the bundled world geometry into the server graph for one string array.
import { BASEMAP_IDS } from '#/lib/map/basemap'
import { AUDIT_ACTIONS, trail } from '#/server/audit/trail'
import { getSession } from '#/server/auth/session'
import {
  DISTANCE_UNITS,
  NOTIFICATION_CHANNELS,
  THEME_PREFERENCES,
} from '#/server/db/schema'
import {
  countMembers,
  ensureOrganizationSettings,
  ensureUserSettings,
  getEffectiveSettings,
  getOrganization,
  listMemberProfiles,
  listPendingInvitations,
  listPreferences,
  localeSchema,
  resolveQuotas,
  setPreference,
  updateOrganizationSettings,
  updateUserSettings,
} from '#/server/repos'
import { appScope } from './context'
import { isoOf, isoOfRequired } from './serialise'

import type { Locale } from '#/lib/i18n'

/* ----------------------------------------------------------------- profile */

export interface RegionalSettings {
  readonly locale: string
  readonly timezone: string
  readonly currency: string
  readonly weekStartsOn: number
  readonly dateFormat: string
  readonly distanceUnit: (typeof DISTANCE_UNITS)[number]
  readonly mapStyle: string
}

/**
 * The same six fields, with the locale already narrowed to a shipped tag.
 *
 * Every payload below normalises the column it read — a workspace created before the picker existed
 * still carries `en-GB` — so this is what the values actually are. It is a separate type rather than
 * a narrowing of {@link RegionalSettings} only because `/settings/organization` still binds its
 * workspace language to a `SimpleSelect` whose `onValueChange` takes a `string`; that control is the
 * language picker's job to replace, and `defaults` can be narrowed with it.
 */
export interface ResolvedRegionalSettings extends RegionalSettings {
  readonly locale: Locale
}

export interface ProfilePayload {
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
    readonly image: string | null
    readonly emailVerified: boolean
    readonly twoFactorEnabled: boolean
  }
  readonly membership: {
    readonly role: string
    readonly joinedAt: string | null
    readonly organizationName: string
  }
  readonly effective: ResolvedRegionalSettings
  readonly overrides: {
    /** `null` is the follow-the-workspace state the picker offers as its own option. */
    readonly locale: Locale | null
    readonly timezone: string | null
    readonly currency: string | null
    readonly weekStartsOn: number | null
    readonly dateFormat: string | null
    readonly distanceUnit: string | null
    readonly mapStyle: string | null
  }
  readonly workspaceDefaults: ResolvedRegionalSettings
}

async function requireSessionUser(): Promise<{
  id: string
  name: string
  email: string
  image: string | null
  emailVerified: boolean
  twoFactorEnabled: boolean
}> {
  const session = await getSession()
  if (session === null) {
    throw new Error('Your session has expired. Sign in again to continue.')
  }
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    emailVerified: session.user.emailVerified,
    twoFactorEnabled: session.user.twoFactorEnabled,
  }
}

export const loadProfile = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProfilePayload> => {
    const scope = await appScope()

    const [user, effective, userRow, orgRow, organization, members] =
      await Promise.all([
        requireSessionUser(),
        getEffectiveSettings(scope),
        ensureUserSettings(scope),
        ensureOrganizationSettings(scope),
        getOrganization(scope),
        listMemberProfiles(scope),
      ])

    const self = members.find((row) => row.userId === scope.ctx.userId)

    return {
      user,
      membership: {
        role: scope.ctx.role,
        joinedAt: self === undefined ? null : isoOfRequired(self.joinedAt),
        organizationName: organization.name,
      },
      effective: {
        locale: effective.locale,
        timezone: effective.timezone,
        currency: effective.currency,
        weekStartsOn: effective.weekStartsOn,
        dateFormat: effective.dateFormat,
        distanceUnit: effective.distanceUnit,
        mapStyle: effective.mapStyle,
      },
      overrides: {
        locale: resolveLocaleTag(userRow.locale),
        timezone: userRow.timezone,
        currency: userRow.currency,
        weekStartsOn: userRow.weekStartsOn,
        dateFormat: userRow.dateFormat,
        distanceUnit: userRow.distanceUnit,
        mapStyle: userRow.mapStyle,
      },
      workspaceDefaults: {
        locale: resolveLocaleTag(orgRow.locale) ?? DEFAULT_LOCALE,
        timezone: orgRow.timezone,
        currency: orgRow.defaultCurrency,
        weekStartsOn: orgRow.weekStartsOn,
        dateFormat: orgRow.dateFormat,
        distanceUnit:
          orgRow.distanceUnit === 'imperial' ? 'imperial' : 'metric',
        mapStyle: orgRow.mapStyle,
      },
    }
  },
)

/** `''` clears an override so the workspace default takes over again. */
const optionalOverride = z.string().trim().max(64)

/**
 * The locale field of the two settings forms.
 *
 * `''` is the picker's follow-the-workspace option and clears the column to `NULL`; anything else
 * must be a tag the product ships, so this is {@link localeSchema} — `z.enum` over the frozen
 * registry, with the negotiator's own canonicalisation in front of it — and not the free text the
 * other five fields still are. A tag D1 would have accepted but the message layer cannot render is
 * rejected here, at the boundary, rather than surfacing three requests later as a screen in the
 * wrong language.
 */
const localeOverride = z.union([z.literal(''), localeSchema])

/** The six personal overrides, exported so the round-trip is testable without a session. */
export const regionalSettingsInput = z.object({
  locale: localeOverride,
  timezone: optionalOverride,
  currency: optionalOverride,
  dateFormat: optionalOverride,
  weekStartsOn: z.number().int().min(0).max(6).nullable(),
  distanceUnit: z.union([z.literal(''), z.enum(DISTANCE_UNITS)]),
})

/**
 * Turns the empty-string sentinel into the `NULL` the column uses for "follow the workspace".
 *
 * The language picker's follow-the-workspace chip and the five `Workspace default` options in the
 * regional form all submit `''`, and `NULL` is what makes {@link getEffectiveSettings} fall back to
 * the workspace row. Keeping the two representations converted in one named place is what stops a
 * sixth field from quietly persisting the empty string as a value in its own right.
 */
export function overrideOrNull<T extends string>(value: T | ''): T | null {
  return value === '' ? null : value
}

/**
 * The traveller's language, on its own — one chip click in the language picker.
 *
 * {@link regionalSettingsInput} cannot serve that click from either side. It requires all six
 * regional fields, so a payload carrying only `locale` fails Zod; and every one of those fields
 * treats `''` as "clear this override", so a client that fills the gaps with empty strings silently
 * blanks the traveller's timezone, currency, date format and distance unit on the way past. Widening
 * the six to optional would fix the first problem by handing a client the second one — an optional
 * `''` is still a write. A separate, narrower input is what makes a locale-only write possible
 * *without* giving anyone a way to reach a column this write has no business touching:
 * {@link updateUserSettings} passes the parsed patch through `definedOnly`, so a field this object
 * does not carry is not in the `SET` clause at all.
 *
 * `''` keeps its meaning from {@link regionalSettingsInput}: the follow-the-workspace chip, cleared
 * to `NULL` by {@link overrideOrNull}.
 */
export const languagePreferenceInput = z.object({ locale: localeOverride })

export const saveLanguagePreference = createServerFn({ method: 'POST' })
  .validator(languagePreferenceInput)
  .handler(async ({ data }): Promise<{ readonly locale: Locale | null }> => {
    const scope = await appScope()
    // `docs/ARCHITECTURE.md` §4 rule 2, as in `saveRegionalSettings`: no cache holds this row, so
    // there is no key to drop, and the re-negotiation this write is for reads D1 on the next
    // request rather than KV. The saved value is returned so the caller renders what D1 now holds
    // instead of the tag it hoped for — `en-GB` is stored, and answered, as `en`.
    const row = await updateUserSettings(scope, {
      locale: overrideOrNull(data.locale),
    })
    return { locale: resolveLocaleTag(row.locale) }
  })

export const saveRegionalSettings = createServerFn({ method: 'POST' })
  .validator(regionalSettingsInput)
  .handler(async ({ data }): Promise<{ readonly saved: true }> => {
    const scope = await appScope()
    // `docs/ARCHITECTURE.md` §4 rule 2: a mutation drops the cached state it invalidates before it
    // returns. §4's table lists no settings key — plan state, sessions, tiles and queue idempotency
    // are the four caches — so there is nothing to delete here, and the traveller's next request
    // negotiates its language from this D1 row rather than from KV's up-to-60-second-stale copy.
    // A settings cache added later belongs on both sides of that rule, in this handler.
    await updateUserSettings(scope, {
      locale: overrideOrNull(data.locale),
      timezone: overrideOrNull(data.timezone),
      currency: overrideOrNull(data.currency),
      dateFormat: overrideOrNull(data.dateFormat),
      weekStartsOn: data.weekStartsOn,
      distanceUnit: overrideOrNull(data.distanceUnit),
    })
    return { saved: true }
  })

/* -------------------------------------------------------------- appearance */

/** A stored theme string, narrowed back to the three states the UI knows. */
function themeOf(value: string): (typeof THEME_PREFERENCES)[number] {
  return (THEME_PREFERENCES as ReadonlyArray<string>).includes(value)
    ? (value as (typeof THEME_PREFERENCES)[number])
    : 'system'
}

export interface AppearancePayload {
  readonly theme: (typeof THEME_PREFERENCES)[number]
  readonly reduceMotion: boolean
  readonly maskConfirmationCodes: boolean
  readonly accentColour: string | null
  readonly mapStyle: string
  readonly workspaceMapStyle: string
}

export const loadAppearance = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AppearancePayload> => {
    const scope = await appScope()
    const [userRow, orgRow] = await Promise.all([
      ensureUserSettings(scope),
      ensureOrganizationSettings(scope),
    ])

    return {
      theme: themeOf(userRow.theme),
      reduceMotion: userRow.reduceMotion,
      maskConfirmationCodes: userRow.maskConfirmationCodes,
      accentColour: userRow.accentColour,
      mapStyle: userRow.mapStyle ?? orgRow.mapStyle,
      workspaceMapStyle: orgRow.mapStyle,
    }
  },
)

export const saveAppearance = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      theme: z.enum(THEME_PREFERENCES).optional(),
      reduceMotion: z.boolean().optional(),
      maskConfirmationCodes: z.boolean().optional(),
      /**
       * The same two-state field the regional form's five `Workspace default` options are: `''`
       * clears the override, anything else must be an id the catalogue ships. Absent means the
       * patch does not touch the column at all.
       *
       * Piped from `z.string()` rather than written as a bare union, exactly as
       * {@link localeOverride} is: that keeps the schema's *input* type `string`, so the screen's
       * `SimpleSelect` — whose `onValueChange` hands back a `string` — still type-checks while the
       * parse narrows to the catalogue. The picker that replaces the select carries a narrowed
       * value and the pipe can go with it.
       */
      mapStyle: z
        .string()
        .trim()
        .pipe(z.union([z.literal(''), z.enum(BASEMAP_IDS)]))
        .optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly saved: true }> => {
    const scope = await appScope()
    await updateUserSettings(scope, {
      theme: data.theme,
      reduceMotion: data.reduceMotion,
      maskConfirmationCodes: data.maskConfirmationCodes,
      // `undefined` is "leave the column alone" — {@link updateUserSettings} drops it in
      // `definedOnly` — and `''` is the follow-the-workspace sentinel, cleared to `NULL` by the same
      // {@link overrideOrNull} the language chip uses. This handler used to collapse both onto
      // `undefined`, which left the UI no path back to `NULL`: picking "Follow the workspace" wrote
      // nothing, so the member's row kept whatever id it already held and pinned a snapshot of the
      // workspace value instead of following it.
      mapStyle:
        data.mapStyle === undefined ? undefined : overrideOrNull(data.mapStyle),
    })
    return { saved: true }
  })

/**
 * The display preferences a screen outside the settings section has to obey.
 *
 * One channel, so the precedence rule stays in the repository and no screen
 * re-derives it: the booking desk and the transports tab both call this beside
 * their own loader, in the same `Promise.all`, and hand the answer down as a
 * prop — a `components/modules` component never fetches.
 *
 * It is deliberately **not** folded into either desk payload. A flag on one of
 * them would leave the other needing a second, differently shaped copy of one
 * boolean, and neither of those two server-function modules is free to be
 * edited by the stage that needs the value.
 *
 * Its cost is two single-row reads under one `Promise.all` inside
 * `getEffectiveSettings`, on indexes that already exist; the workspace-settings
 * ensure it makes is idempotent and at most once per workspace ever.
 */
export interface DisplayPreferences {
  readonly maskConfirmationCodes: boolean
}

export const loadDisplayPreferences = createServerFn({
  method: 'GET',
}).handler(async (): Promise<DisplayPreferences> => {
  const settings = await getEffectiveSettings(await appScope())
  return { maskConfirmationCodes: settings.maskConfirmationCodes }
})

/* ---------------------------------------------------------------- security */

export interface SecurityPayload {
  readonly emailVerified: boolean
  readonly twoFactorEnabled: boolean
  readonly sessionExpiresAt: string | null
  readonly email: string
}

export const loadSecurity = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SecurityPayload> => {
    const session = await getSession()
    if (session === null) {
      throw new Error('Your session has expired. Sign in again to continue.')
    }
    return {
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      twoFactorEnabled: session.user.twoFactorEnabled,
      sessionExpiresAt: isoOf(session.session.expiresAt),
    }
  },
)

/* ----------------------------------------------------- notification prefs */

export interface PreferenceRow {
  readonly eventType: string
  readonly channel: string
  readonly isEnabled: boolean
}

export const loadNotificationPreferences = createServerFn({
  method: 'GET',
}).handler(
  async (): Promise<{ readonly preferences: ReadonlyArray<PreferenceRow> }> => {
    const scope = await appScope()
    const rows = await listPreferences(scope, scope.ctx.userId)
    return {
      preferences: rows.map((row) => ({
        eventType: row.eventType,
        channel: row.channel,
        isEnabled: row.isEnabled,
      })),
    }
  },
)

export const saveNotificationPreference = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      eventType: z.string().trim().min(1).max(64),
      channel: z.enum(NOTIFICATION_CHANNELS),
      isEnabled: z.boolean(),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly saved: true }> => {
    const scope = await appScope()
    await setPreference(scope, {
      eventType: data.eventType,
      channel: data.channel,
      isEnabled: data.isEnabled,
    })
    return { saved: true }
  })

/* ------------------------------------------------------------ organization */

export interface OrganizationPayload {
  readonly organization: {
    readonly id: string
    readonly name: string
    readonly slug: string
    readonly createdAt: string
  }
  readonly defaults: RegionalSettings
  readonly members: ReadonlyArray<{
    readonly memberId: string
    readonly userId: string
    readonly role: string
    readonly name: string
    readonly email: string
    readonly image: string | null
    readonly joinedAt: string
  }>
  readonly invitations: ReadonlyArray<{
    readonly id: string
    readonly email: string
    readonly role: string | null
    readonly expiresAt: string
  }>
  readonly seats: { readonly used: number; readonly limit: number }
  /** The catalogue plan the customer bought, so every screen names it the same way. */
  readonly plan: string
  readonly viewerRole: string
  readonly canAdminister: boolean
}

export const loadOrganizationSettings = createServerFn({
  method: 'GET',
}).handler(async (): Promise<OrganizationPayload> => {
  const scope = await appScope()

  const [organization, defaults, members, invitations, seatsUsed, quotas] =
    await Promise.all([
      getOrganization(scope),
      ensureOrganizationSettings(scope),
      listMemberProfiles(scope),
      listPendingInvitations(scope),
      countMembers(scope),
      resolveQuotas(scope),
    ])

  return {
    plan: quotas.planId,
    viewerRole: scope.ctx.role,
    canAdminister: scope.ctx.role === 'owner' || scope.ctx.role === 'admin',
    seats: { used: seatsUsed, limit: quotas.limits.members },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: isoOfRequired(organization.createdAt),
    },
    defaults: {
      locale: resolveLocaleTag(defaults.locale) ?? DEFAULT_LOCALE,
      timezone: defaults.timezone,
      currency: defaults.defaultCurrency,
      weekStartsOn: defaults.weekStartsOn,
      dateFormat: defaults.dateFormat,
      distanceUnit:
        defaults.distanceUnit === 'imperial' ? 'imperial' : 'metric',
      mapStyle: defaults.mapStyle,
    },
    members: members.map((row) => ({
      memberId: row.memberId,
      userId: row.userId,
      role: row.role,
      name: row.name,
      email: row.email,
      image: row.image,
      joinedAt: isoOfRequired(row.joinedAt),
    })),
    invitations: invitations.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: isoOfRequired(row.expiresAt),
    })),
  }
})

/** The workspace defaults an owner or admin may set. Exported for the same reason as above. */
export const workspaceDefaultsInput = z.object({
  defaultCurrency: z.string().trim().length(3),
  locale: localeSchema,
  timezone: z.string().trim().min(1).max(64),
  dateFormat: z.string().trim().min(1).max(32),
  weekStartsOn: z.number().int().min(0).max(6),
  distanceUnit: z.enum(DISTANCE_UNITS),
})

/**
 * Writes the workspace defaults. Refused for anyone below `admin`.
 *
 * The `canAdminister` flag on {@link OrganizationPayload} disables the form for a plain member, and
 * that is all it does — a POST is a POST, and the flag is on the far side of the wire. The gate that
 * decides is {@link updateOrganizationSettings}, which asserts the caller's role from the tenant
 * scope before it touches the row, exactly as `updateOrganization` gates a workspace rename and
 * `addMember` gates an invitation. Re-checking here would be a second copy of a rule that has to
 * hold for every caller of that repository function, not just this one.
 */
export const saveWorkspaceDefaults = createServerFn({ method: 'POST' })
  .validator(workspaceDefaultsInput)
  .handler(async ({ data }): Promise<{ readonly saved: true }> => {
    const scope = await appScope()
    // The workspace language is the fallback every member without an override reads, so this write
    // changes what other travellers see. Nothing caches it — see the note in `saveRegionalSettings`.
    await updateOrganizationSettings(scope, data)

    // Recorded after the write, so the role assertion inside `updateOrganizationSettings` has
    // already refused anyone below `admin`: the trail holds changes that happened, not attempts.
    // The entity is the workspace itself — there is one settings row and its id is an
    // implementation detail, while the organization id is what every other entry already names.
    await trail(scope, {
      action: AUDIT_ACTIONS.WORKSPACE_DEFAULTS_CHANGED,
      entityType: 'organization',
      entityId: scope.ctx.organizationId,
      metadata: {
        defaultCurrency: data.defaultCurrency,
        locale: data.locale,
        timezone: data.timezone,
        dateFormat: data.dateFormat,
        weekStartsOn: data.weekStartsOn,
        distanceUnit: data.distanceUnit,
      },
    })
    return { saved: true }
  })
