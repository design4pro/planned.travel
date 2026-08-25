/**
 * Settings — workspace defaults, per-traveller overrides, and the one deliberately un-scoped table.
 *
 * `organization_settings` holds what a workspace agreed on (currency, locale, week start, map style);
 * `user_settings` holds a traveller's personal overrides of the same fields. {@link getEffectiveSettings}
 * is the merge every screen should read, so the precedence rule lives in exactly one place.
 *
 * **The locale columns hold a shipped tag and nothing else.** {@link localeSchema} narrows every
 * write to the twenty-three tags of `src/lib/i18n/locales.ts`, canonicalising a legacy `en-GB` or
 * `pl-PL` on the way in, and {@link getEffectiveSettings} narrows every read the same way, so a row
 * written before that rule existed still resolves rather than silently falling through to
 * `Accept-Language`. Nothing here is cached: `docs/ARCHITECTURE.md` §4 lists no settings key, and
 * rule 2 of that section is why it stays that way — a locale write is read back on the next request
 * from D1, so the read-your-own-write path can never serve KV's up-to-60-second stale answer.
 *
 * `app_settings` is instance-wide deployment configuration and has no `organization_id`. It is reached
 * through the {@link appSettingsStore} helpers, which take a plain {@link Database} rather than a
 * {@link TenantScope} —
 * which is what keeps it structurally impossible to leak into tenant data.
 */

import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { DEFAULT_LOCALE, LOCALE_TAGS } from '#/lib/i18n/locales'
import { negotiate, resolveLocaleTag } from '#/lib/i18n/negotiate'
import {
  DISTANCE_UNITS,
  THEME_PREFERENCES,
  appSettings,
  organizationSettings,
  userSettings,
} from '#/server/db/schema'
import { createTenantRepository } from './base'
import { RepositoryError } from './context'
import {
  colourSchema,
  currencySchema,
  definedOnly,
  idSchema,
  instantSchema,
  shortTextSchema,
} from './validation'
import type { Locale } from '#/lib/i18n'
import type { JsonRecord } from '#/server/db/schema'
import type {
  AppSetting,
  Database,
  OrganizationSettings,
  UserSettings,
} from '#/server/db/types'
import type { TenantScope } from './base'

export const organizationSettingsRepository = createTenantRepository(
  organizationSettings,
  'workspace settings',
)
export const userSettingsRepository = createTenantRepository(userSettings, 'user settings')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const jsonRecordSchema: z.ZodType<JsonRecord> = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
)

const weekStartSchema = z.number().int().min(0).max(6)

/**
 * A stored locale, narrowed to the twenty-three tags `docs/SPEC.md` §8 ships.
 *
 * The set is `z.enum(LOCALE_TAGS)` over the frozen registry in
 * `src/lib/i18n/locales.ts`, never a list re-typed here: a twenty-fourth
 * language must be one edit in one table, and a column that can hold a tag the
 * message layer has no catalogue for is a screen rendered in the wrong
 * language at best. The predecessor was `z.string().min(2).max(16)`, which let
 * `__proto__` and `constructor` reach the negotiator through a settings form.
 *
 * The canonicalising step in front of the enum is not politeness, it is the
 * data. `organization_settings.locale` defaulted to `en-GB` for every workspace
 * created before this migration, the demo dataset still declares `en-GB`, and
 * the regional-format picker wrote `pl-PL` and `ja-JP`. A bare membership test
 * would reject all of them and hand every existing workspace a validation
 * error on the next save. So a tag is first put through {@link resolveLocaleTag}
 * — the same case-fold, alias table and BCP-47 truncation the negotiator uses,
 * so `en-GB` → `en`, `pt-PT` → `pt-BR`, `zh-Hant-TW` → `zh-Hant` — and only
 * what that cannot canonicalise is rejected. The column therefore holds a
 * shipped tag and nothing else, whatever the caller sent.
 *
 * The bound is on the *input* so a 16 kB header pasted into a form is refused
 * before any work happens; `resolveLocaleTag` bounds its own walk as well.
 */
export const localeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .transform((tag) => resolveLocaleTag(tag) ?? tag)
  .pipe(z.enum(LOCALE_TAGS))

const timezoneSchema = z.string().trim().min(1).max(64)
const dateFormatSchema = z.string().trim().min(1).max(32)
const mapStyleSchema = z.string().trim().min(1).max(64)

export const updateOrganizationSettingsInput = z.object({
  defaultCurrency: currencySchema.optional(),
  locale: localeSchema.optional(),
  timezone: timezoneSchema.optional(),
  weekStartsOn: weekStartSchema.optional(),
  dateFormat: dateFormatSchema.optional(),
  distanceUnit: z.enum(DISTANCE_UNITS).optional(),
  mapStyle: mapStyleSchema.optional(),
  features: jsonRecordSchema.nullish(),
  onboardedAt: instantSchema.nullish(),
})
/**
 * What a caller may send. It is the schema's *input* type, so a legacy tag such
 * as `en-GB` still compiles and is canonicalised by the parse; the row that
 * reaches D1 always carries the narrowed {@link Locale}.
 */
export type UpdateOrganizationSettingsInput = z.input<typeof updateOrganizationSettingsInput>

export const updateUserSettingsInput = z.object({
  theme: z.enum(THEME_PREFERENCES).optional(),
  locale: localeSchema.nullish(),
  timezone: timezoneSchema.nullish(),
  currency: currencySchema.nullish(),
  weekStartsOn: weekStartSchema.nullish(),
  dateFormat: dateFormatSchema.nullish(),
  distanceUnit: z.enum(DISTANCE_UNITS).nullish(),
  mapStyle: mapStyleSchema.nullish(),
  accentColour: colourSchema.nullish(),
  reduceMotion: z.boolean().optional(),
  onboardingCompletedAt: instantSchema.nullish(),
})
/** As {@link UpdateOrganizationSettingsInput}: the input side, canonicalised on parse. */
export type UpdateUserSettingsInput = z.input<typeof updateUserSettingsInput>

/* -------------------------------------------------------------------------------------------------
 * Workspace settings
 * ---------------------------------------------------------------------------------------------- */

export async function getOrganizationSettings(
  scope: TenantScope,
): Promise<OrganizationSettings | null> {
  const rows = await organizationSettingsRepository.findMany(scope, { limit: 1 })
  return rows[0] ?? null
}

/**
 * Returns the workspace settings row, creating it with schema defaults on first use.
 *
 * The locale is the one default written out rather than left to the column, because the column's
 * default is a string in the DDL and {@link DEFAULT_LOCALE} is the registry's answer to the same
 * question. Drizzle inlines a static `.default()` into the `INSERT` client-side, so the DDL default
 * is not even consulted on this path — stating it here is what actually decides the value, and it
 * keeps "the language a fresh workspace speaks" in the same table as the twenty-three tags.
 */
export async function ensureOrganizationSettings(
  scope: TenantScope,
): Promise<OrganizationSettings> {
  const existing = await getOrganizationSettings(scope)
  return existing ?? organizationSettingsRepository.insert(scope, { locale: DEFAULT_LOCALE })
}

export async function updateOrganizationSettings(
  scope: TenantScope,
  input: UpdateOrganizationSettingsInput,
): Promise<OrganizationSettings> {
  const row = await ensureOrganizationSettings(scope)
  return organizationSettingsRepository.requireUpdate(
    scope,
    row.id,
    definedOnly(updateOrganizationSettingsInput.parse(input)),
  )
}

/** Stamps the workspace as onboarded. Idempotent: the first timestamp wins. */
export async function markOrganizationOnboarded(
  scope: TenantScope,
): Promise<OrganizationSettings> {
  const row = await ensureOrganizationSettings(scope)
  if (row.onboardedAt !== null) {
    return row
  }
  return organizationSettingsRepository.requireUpdate(scope, row.id, { onboardedAt: new Date() })
}

/* -------------------------------------------------------------------------------------------------
 * Traveller settings
 * ---------------------------------------------------------------------------------------------- */

export async function getUserSettings(
  scope: TenantScope,
  userId?: string,
): Promise<UserSettings | null> {
  const id = userId === undefined ? scope.ctx.userId : idSchema.parse(userId)
  return userSettingsRepository.findOne(scope, eq(userSettings.userId, id))
}

export async function ensureUserSettings(
  scope: TenantScope,
  userId?: string,
): Promise<UserSettings> {
  const id = userId === undefined ? scope.ctx.userId : idSchema.parse(userId)
  const existing = await getUserSettings(scope, id)
  return existing ?? userSettingsRepository.insert(scope, { userId: id })
}

export async function updateUserSettings(
  scope: TenantScope,
  input: UpdateUserSettingsInput,
  userId?: string,
): Promise<UserSettings> {
  const row = await ensureUserSettings(scope, userId)
  return userSettingsRepository.requireUpdate(
    scope,
    row.id,
    definedOnly(updateUserSettingsInput.parse(input)),
  )
}

export async function markUserOnboarded(
  scope: TenantScope,
  userId?: string,
): Promise<UserSettings> {
  const row = await ensureUserSettings(scope, userId)
  if (row.onboardingCompletedAt !== null) {
    return row
  }
  return userSettingsRepository.requireUpdate(scope, row.id, {
    onboardingCompletedAt: new Date(),
  })
}

/** The settings a screen should actually use: workspace defaults with the traveller's overrides on top. */
export interface EffectiveSettings {
  readonly theme: (typeof THEME_PREFERENCES)[number]
  /** Always one of the twenty-three shipped tags — never a stored value verbatim. */
  readonly locale: Locale
  readonly timezone: string
  readonly currency: string
  readonly weekStartsOn: number
  readonly dateFormat: string
  readonly distanceUnit: (typeof DISTANCE_UNITS)[number]
  readonly mapStyle: string
  readonly accentColour: string | null
  readonly reduceMotion: boolean
  readonly features: JsonRecord
  readonly onboarded: boolean
}

export async function getEffectiveSettings(
  scope: TenantScope,
  userId?: string,
): Promise<EffectiveSettings> {
  const [organization, user] = await Promise.all([
    ensureOrganizationSettings(scope),
    getUserSettings(scope, userId),
  ])

  const distanceUnit = z
    .enum(DISTANCE_UNITS)
    .catch('metric')
    .parse(user?.distanceUnit ?? organization.distanceUnit)

  return {
    theme: z.enum(THEME_PREFERENCES).catch('system').parse(user?.theme ?? 'system'),
    // Same normalisation, same precedence and same fallback the request-time negotiator runs, because
    // it *is* that function: a row written before the picker existed can hold `en-GB`, `pl-PL` or
    // free text, and a caller that asked for the effective settings must never be handed a tag the
    // message layer has no catalogue for. An override that cannot be canonicalised defers to the
    // workspace exactly as an absent one does; if neither resolves, `en`.
    locale: negotiate({ user: user?.locale, workspace: organization.locale }),
    timezone: user?.timezone ?? organization.timezone,
    currency: user?.currency ?? organization.defaultCurrency,
    weekStartsOn: user?.weekStartsOn ?? organization.weekStartsOn,
    dateFormat: user?.dateFormat ?? organization.dateFormat,
    distanceUnit,
    mapStyle: user?.mapStyle ?? organization.mapStyle,
    accentColour: user?.accentColour ?? null,
    reduceMotion: user?.reduceMotion ?? false,
    features: organization.features ?? {},
    onboarded: organization.onboardedAt !== null,
  }
}

/* -------------------------------------------------------------------------------------------------
 * Instance-wide configuration (not tenant-scoped)
 * ---------------------------------------------------------------------------------------------- */

const settingKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'must be a lowercase dotted key')

/**
 * Deployment configuration: the published tile pack, marketing flags, maintenance banners.
 *
 * These helpers take a {@link Database} rather than a {@link TenantScope} on purpose — the table has no
 * tenant column, and giving it a scope-shaped API would invite someone to treat tenant data the same
 * way. Only cron handlers, migrations and the admin surface should call them.
 */
export const appSettingsStore = {
  async get(db: Database, key: string): Promise<AppSetting | null> {
    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, settingKeySchema.parse(key)))
      .limit(1)
    return rows[0] ?? null
  },

  async list(db: Database): Promise<Array<AppSetting>> {
    return db.select().from(appSettings).orderBy(asc(appSettings.key))
  },

  async set(
    db: Database,
    key: string,
    value: JsonRecord,
    description?: string,
  ): Promise<AppSetting> {
    const parsedKey = settingKeySchema.parse(key)
    const parsedValue = jsonRecordSchema.parse(value)
    const parsedDescription =
      description === undefined ? undefined : shortTextSchema.parse(description)

    const rows = await db
      .insert(appSettings)
      .values({ key: parsedKey, value: parsedValue, description: parsedDescription })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: parsedValue,
          ...(parsedDescription === undefined ? {} : { description: parsedDescription }),
          updatedAt: new Date(),
        },
      })
      .returning()

    const row = rows.at(0)
    if (row === undefined) {
      throw new RepositoryError(
        `Writing app setting ${parsedKey} returned no row.`,
        'INSERT_FAILED',
      )
    }
    return row
  },

  async remove(db: Database, key: string): Promise<boolean> {
    const rows = await db
      .delete(appSettings)
      .where(eq(appSettings.key, settingKeySchema.parse(key)))
      .returning({ key: appSettings.key })
    return rows.length > 0
  },
}
