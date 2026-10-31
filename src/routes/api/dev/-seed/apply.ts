/**
 * The seed orchestrator.
 *
 * Runs the whole demo dataset through `src/server/repos` in dependency order and reports what it
 * wrote. Three properties matter more than anything else here:
 *
 * **Idempotence.** A marker row in `app_settings` records the dataset version once a run has finished
 * completely. A second run sees the marker and does nothing. A run that crashed half way leaves no
 * marker, so the next run repairs: every trip, journey and collection is addressed by its slug and a
 * stale one is deleted (cascading its children) before being rebuilt, and every other entity is
 * written through a repository function that is already an upsert.
 *
 * **Honesty.** Nothing here writes SQL, stamps an `organization_id` by hand, or reaches around a
 * validation schema. If the repositories would reject a value in production they reject it here, which
 * is why the dataset is worth trusting as a fixture.
 *
 * **Determinism.** The values this file writes are a pure function of `./dataset`. Every date and
 * every instant is measured from `SEED_ANCHOR_INSTANT` rather than from the machine's clock; the one
 * secret the dataset needs — a published journey's share token — is derived from the journey's slug
 * rather than drawn from a random source; and every primary key and row stamp comes from
 * `./fixture-rows` rather than from `newId()` and `new Date()`, because a trip's cover drawing and
 * its wash colour are hashed straight out of its id and a fresh id repaints a screen nobody edited
 * while a fresh stamp leaves a sort with nothing to break its ties. The only wall-clock read left is
 * the stopwatch behind `durationMs`, which is reported and never stored. Two runs a month apart
 * therefore write the same rows, which is what lets a visual baseline outlive the day it was
 * recorded.
 */

import {
  achieveBucketListItem,
  addCompanyHoliday,
  addHolidayCalendar,
  addPhoto,
  addCollectionPlace,
  auditLogRepository,
  appSettingsStore,
  createBucketListItem,
  createCollection,
  createEntry,
  createJourney,
  createLabel,
  createCategory,
  deleteCollection,
  deleteJourney,
  deleteNotification,
  deleteTrip,
  ensureDefaultCategories,
  ensureDefaultMoods,
  ensureOrganizationSettings,
  ensurePlan,
  ensureUserSettings,
  ensureYear,
  getCollectionBySlug,
  getJourneyBySlug,
  getOrganization,
  getTripBySlug,
  invitePlanMember,
  listBucketList,
  listCategories,
  listMoods,
  listPlanMembers,
  listVisitedCountries,
  markCountryVisited,
  markOrganizationOnboarded,
  markRegionVisited,
  notificationsRepository,
  publishJourney,
  recomputeTravelStats,
  resolveTags,
  setCollectionPlaceLabels,
  setEntitlement,
  setEntryRange,
  setPlanMemberStatus,
  setPreference,
  setUsage,
  setUserColour,
  travelStatsRepository,
  updateOrganizationSettings,
  updatePlan,
  updateUserSettings,
  upsertSubscription,
  upsertTravelStats,
  visitedCountriesRepository,
} from '#/server/repos'
import { applyTrip } from './apply-trip'
import {
  ensureSecondWorkspace,
  ensureWorkspacePeople,
  resolveWorkspace,
} from './bootstrap'
import { fixtureRows } from './fixture-rows'
import { stableId } from './stable-id'
import { rowValuesFromRecord } from '#/server/billing/store'
import {
  DATASET_VERSION,
  SEED_ANCHOR_DAY,
  SEED_ANCHOR_INSTANT,
  auditTrail,
  bucketList,
  collections,
  daysFromAnchor,
  demoSubscriptionRecord,
  extraCategories,
  instantOn,
  journeys,
  minutesBeforeAnchor,
  notificationPreferences,
  notifications,
  organizationSettings,
  people,
  travelStats,
  trips,
  vacay,
  visitedCountries,
  visitedRegions,
} from './dataset'
import type { CredentialOutcome } from './bootstrap'
import type { FixtureRows } from './fixture-rows'
import type { TripApplyContext, TripCounts } from './apply-trip'
import type { JsonRecord } from '#/server/db/schema'
import type { Database } from '#/server/db/types'
import type { PersonKey } from './types'

/** `app_settings` key holding the marker that makes a second run a no-op. */
const MARKER_KEY = 'demo.seed'

/**
 * Names per `resolveTags` call.
 *
 * Not the fifty `resolveTagsInput` allows: a `tags` row binds seven columns, and D1 refuses a
 * statement with more than a hundred bound parameters, so one call may create at most fourteen rows
 * before the insert fails. Twelve leaves room for a column.
 */
const TAG_BATCH = 12

/** How far back the inbox and audit sweep looks for rows an earlier run of this dataset wrote. */
const INBOX_SWEEP_LIMIT = 500
const MS_PER_DAY = 86_400_000

/** Substituted by the applier so the copy stays true however long after seeding it is read. */
const DAYS_UNTIL_TRIP_START = '@daysUntilTripStart'
const ORGANIZATION_NAME = '@organizationName'

export interface SeedReport {
  readonly skipped: boolean
  readonly datasetVersion: number
  readonly organizationId: string
  readonly ownerUserId: string
  readonly ownerEmail: string
  /** True when this run minted the owner's credential account rather than adopting an existing one. */
  readonly createdOwner: boolean
  /** What happened to the owner's password: `created`, `reset`, `unchanged` or `left-alone`. */
  readonly credential: CredentialOutcome
  readonly usersCreated: number
  readonly members: number
  readonly categories: number
  readonly moods: number
  readonly trips: ReadonlyArray<{
    readonly slug: string
    readonly counts: TripCounts
  }>
  readonly totals: {
    readonly trips: number
    readonly days: number
    readonly dayNotes: number
    readonly places: number
    readonly stops: number
    readonly accommodations: number
    readonly transports: number
    readonly reservations: number
    readonly budgetItems: number
    readonly expenses: number
    readonly expenseShares: number
    readonly settlements: number
    readonly lists: number
    readonly listItems: number
    readonly messages: number
    readonly reactions: number
    readonly notes: number
    readonly polls: number
    readonly votes: number
    readonly files: number
  }
  readonly journeys: number
  readonly journeyEntries: number
  readonly journeyPhotos: number
  readonly collections: number
  readonly collectionPlaces: number
  readonly visitedCountries: number
  readonly visitedRegions: number
  readonly bucketListItems: number
  readonly vacayEntries: number
  readonly companyHolidays: number
  readonly notifications: number
  readonly auditEntries: number
  readonly durationMs: number
}

/** Inclusive number of calendar days in a `YYYY-MM-DD` range. */
function daysInRange(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0
  }
  return Math.floor((end - start) / MS_PER_DAY) + 1
}

/** Replaces the two dataset sentinels with values only the applier knows. */
function resolveParams(
  params: Record<string, string | number>,
  replacements: { readonly days: number; readonly organizationName: string },
): JsonRecord {
  const resolved: JsonRecord = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === DAYS_UNTIL_TRIP_START) {
      resolved[key] = replacements.days
    } else if (value === ORGANIZATION_NAME) {
      resolved[key] = replacements.organizationName
    } else {
      resolved[key] = value
    }
  }
  return resolved
}

/**
 * The 32 hex characters a published journey is shared under.
 *
 * Derived from the journey's slug rather than drawn from a random source, so a re-seed does not
 * silently invalidate a share URL somebody kept. See `./stable-id.ts` for why that is safe here and
 * nowhere else.
 */
function publicToken(slug: string): string {
  return stableId('demo-journey-token', slug, 32)
}

export interface ApplySeedOptions {
  readonly ownerEmail?: string
  /**
   * Password for the owner's credential account, used only when no account exists yet. Supplying it
   * lets the seed produce a workspace that can actually be signed into; omitting it keeps the old
   * behaviour of failing with "register it first".
   */
  readonly ownerPassword?: string
  /** Never overwrite a password that is already set, even when it is not the one supplied. */
  readonly keepExistingPassword?: boolean
  /** Re-run even when the marker says this dataset version is already applied. */
  readonly force?: boolean
}

const DEFAULT_OWNER_EMAIL = 'rafal@planned.travel'

/**
 * Seeds the demo workspace.
 *
 * The whole run happens inside one fixture scope: the primary keys and the `created_at` /
 * `updated_at` stamps come from `./fixture-rows` rather than from the clock and a random source, so
 * the rows this writes are the same rows every time and the covers drawn from their ids do not move.
 * See that module for why an id is as load-bearing as a date here.
 */
export async function applySeed(
  db: Database,
  options: ApplySeedOptions = {},
): Promise<SeedReport> {
  const fixture = fixtureRows()
  return await fixture.run(() => writeSeed(db, options, fixture))
}

/**
 * The run itself, split out so {@link applySeed} can open the fixture scope without indenting it.
 *
 * `fixture.section(...)` divides the run into named stretches; see `./fixture-rows` for what that
 * buys and why the sections are the ones they are. Adding a phase means naming it, and moving one
 * past another re-records the baselines its rows appear in.
 */
async function writeSeed(
  db: Database,
  options: ApplySeedOptions,
  fixture: FixtureRows,
): Promise<SeedReport> {
  const startedAt = Date.now()
  // The fixture's one notion of now, and it is not a clock: see `./dataset/anchor.ts`. Nothing in
  // this file reads the wall clock except `startedAt`, which measures the run and is never written
  // to a row — so seeding twice, on two machines, in two calendar months, produces the same rows.
  const now = SEED_ANCHOR_INSTANT
  const ownerEmail = options.ownerEmail ?? DEFAULT_OWNER_EMAIL

  fixture.section('workspace')
  const resolved = await resolveWorkspace(
    db,
    ownerEmail,
    options.ownerPassword,
    options.keepExistingPassword === true,
  )
  const owner = resolved.ownerScope

  const marker = await appSettingsStore.get(db, MARKER_KEY)
  const markerVersion =
    typeof marker?.value?.version === 'number' ? marker.value.version : null
  if (markerVersion === DATASET_VERSION && options.force !== true) {
    return {
      ...emptyReport(
        resolved.organizationId,
        resolved.ownerUserId,
        ownerEmail,
        resolved.createdOwner,
        resolved.credential,
      ),
      skipped: true,
      durationMs: Date.now() - startedAt,
    }
  }

  const organization = await getOrganization(owner)

  /* ------------------------------------------------------------------------- settings and billing */

  await ensureOrganizationSettings(owner)
  await updateOrganizationSettings(owner, {
    ...organizationSettings,
    onboardedAt: now,
  })
  await markOrganizationOnboarded(owner)

  // The subscription comes first on purpose: the free plan seats one person, and the demo needs four.
  // The row is derived from the plan by `rowValuesFromRecord()` — the same translation the billing
  // webhook uses — so the tier, the seats, the price and the ceilings cannot drift apart, and the
  // membership writes below still go through the same quota guard rather than around it.
  await upsertSubscription(
    owner,
    rowValuesFromRecord(
      demoSubscriptionRecord(resolved.organizationId, {
        start: instantOn(-12),
        end: instantOn(18),
      }),
    ),
  )

  fixture.section('people')
  const seedPeople = await ensureWorkspacePeople(db, resolved)

  for (const person of people) {
    const scope = seedPeople.scopes.get(person.key)
    if (scope === undefined) {
      continue
    }
    await ensureUserSettings(scope)
    await updateUserSettings(scope, {
      theme: 'system',
      currency: organizationSettings.defaultCurrency,
      accentColour: person.colour,
      reduceMotion: false,
      onboardingCompletedAt: now,
    })
  }

  for (const preference of notificationPreferences) {
    await setPreference(owner, {
      eventType: preference.eventType,
      channel: preference.channel,
      isEnabled: preference.isEnabled,
    })
  }

  /* --------------------------------------------------------------------- taxonomy and mood palette */

  fixture.section('taxonomy')
  await ensureDefaultCategories(owner)
  const knownSlugs = new Set(
    (await listCategories(owner)).map((row) => row.slug),
  )
  for (const category of extraCategories) {
    if (!knownSlugs.has(category.slug)) {
      await createCategory(owner, category)
    }
  }
  const categoryRows = await listCategories(owner)
  const categoryIds = new Map(categoryRows.map((row) => [row.slug, row.id]))

  await ensureDefaultMoods(owner)
  const moodRows = await listMoods(owner)
  const moodIds = new Map(moodRows.map((row) => [row.key, row.id]))

  // Tags are workspace-scoped and outlive the trip they were typed on, so `resolveTags` inside
  // `applyTrip` creates them on a cold database and merely finds them on a warm one. That difference
  // in *how many rows a trip writes* would shift every identifier minted after the first tagged place
  // in that trip — the covers would hold, but the places under them would not — so the whole tag
  // vocabulary is created here instead, once, in a section of its own, and the trip pass only ever
  // looks it up.
  const tagNames = [
    ...new Set(
      trips.flatMap((trip) =>
        (trip.places ?? []).flatMap((place) => place.tags ?? []),
      ),
    ),
  ]
  for (let start = 0; start < tagNames.length; start += TAG_BATCH) {
    await resolveTags(owner, tagNames.slice(start, start + TAG_BATCH))
  }

  /* ---------------------------------------------------------------------------------------- trips */

  const context: TripApplyContext = {
    owner,
    scopes: seedPeople.scopes,
    categoryIds,
    colours: new Map<PersonKey, string>(
      people.map((person) => [person.key, person.colour]),
    ),
  }

  const tripReports: Array<{ slug: string; counts: TripCounts }> = []
  const tripIdBySlug = new Map<string, string>()
  const tripStartBySlug = new Map<string, string | null>()

  for (const trip of trips) {
    const stale = await getTripBySlug(owner, trip.slug)
    if (stale !== null) {
      // A trip present without the completion marker is the debris of an interrupted run.
      await deleteTrip(owner, stale.id)
    }
    fixture.section(`trip/${trip.slug}`)
    const counts = await applyTrip(context, trip)
    tripReports.push({ slug: trip.slug, counts })
    tripIdBySlug.set(trip.slug, counts.tripId)
    tripStartBySlug.set(trip.slug, trip.startDate ?? null)
  }

  /* -------------------------------------------------------------------------------------- journal */

  let journeyEntryCount = 0
  let journeyPhotoCount = 0
  for (const journey of journeys) {
    const stale = await getJourneyBySlug(owner, journey.slug)
    if (stale !== null) {
      await deleteJourney(owner, stale.id)
    }
    fixture.section(`journey/${journey.slug}`)
    const created = await createJourney(owner, {
      tripId:
        journey.tripSlug === undefined
          ? null
          : (tripIdBySlug.get(journey.tripSlug) ?? null),
      title: journey.title,
      slug: journey.slug,
      subtitle: journey.subtitle,
      description: journey.description,
      coverGradient: journey.coverGradient,
      visibility: 'organization',
      startedOn: journey.startedOn,
      endedOn: journey.endedOn,
    })

    for (const entry of journey.entries) {
      const entryRow = await createEntry(owner, {
        journeyId: created.id,
        moodId: moodIds.get(entry.moodKey) ?? null,
        sourceTripId:
          journey.tripSlug === undefined
            ? null
            : (tripIdBySlug.get(journey.tripSlug) ?? null),
        type: entry.type,
        title: entry.title,
        body: entry.body,
        entryDate: entry.entryDate,
        entryTime: entry.entryTime,
        locationName: entry.locationName,
        lat: entry.lat,
        lng: entry.lng,
        weather: entry.weather,
        temperatureCelsius: entry.temperatureCelsius,
        tags: [...entry.tags],
        sortOrder: entry.sortOrder,
      })
      journeyEntryCount += 1

      for (const [index, photo] of (entry.photos ?? []).entries()) {
        await addPhoto(owner, {
          journeyId: created.id,
          entryId: entryRow.id,
          storageKey: `journeys/${resolved.organizationId}/${photo.storageKey}`,
          thumbnailKey: `journeys/${resolved.organizationId}/${photo.thumbnailKey}`,
          caption: photo.caption,
          contentType: photo.contentType,
          sizeBytes: photo.sizeBytes,
          width: photo.width,
          height: photo.height,
          takenAt: new Date(`${entry.entryDate}T${entry.entryTime}:00.000Z`),
          lat: entry.lat,
          lng: entry.lng,
          sortOrder: index,
        })
        journeyPhotoCount += 1
      }
    }

    // The Dolomites write-up is published; Marrakech stays a draft, so both states are on screen.
    if (journey.slug === 'dolomites-hut-to-hut') {
      await publishJourney(owner, created.id, publicToken(journey.slug))
    }
  }

  /* ---------------------------------------------------------------------------------- collections */

  let collectionPlaceCount = 0
  for (const [index, collection] of collections.entries()) {
    const stale = await getCollectionBySlug(owner, collection.slug)
    if (stale !== null) {
      await deleteCollection(owner, stale.id)
    }
    fixture.section(`collection/${collection.slug}`)
    const created = await createCollection(owner, {
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      colour: collection.colour,
      icon: collection.icon,
      visibility: collection.visibility,
      sortOrder: index,
    })

    const labelIds = new Map<string, string>()
    for (const [labelIndex, label] of collection.labels.entries()) {
      const row = await createLabel(owner, {
        collectionId: created.id,
        name: label.name,
        colour: label.colour,
        sortOrder: labelIndex,
      })
      labelIds.set(label.name, row.id)
    }

    for (const place of collection.places) {
      const row = await addCollectionPlace(owner, {
        collectionId: created.id,
        categoryId: categoryIds.get(place.categorySlug) ?? null,
        name: place.name,
        description: place.description,
        notes: place.notes ?? null,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        city: place.city,
        countryCode: place.countryCode,
        website: place.website ?? null,
        status: place.status,
        source: 'manual',
        sortOrder: place.sortOrder,
      })
      collectionPlaceCount += 1

      const ids = place.labels.flatMap((name) => {
        const id = labelIds.get(name)
        return id === undefined ? [] : [id]
      })
      if (ids.length > 0) {
        await setCollectionPlaceLabels(owner, row.id, ids)
      }
    }
  }

  /* ---------------------------------------------------------------------------------------- atlas */

  fixture.section('atlas')
  const existingBucket = await listBucketList(owner, resolved.ownerUserId)
  const bucketByName = new Map(existingBucket.map((row) => [row.name, row]))
  for (const item of bucketList) {
    const existing = bucketByName.get(item.name)
    const row =
      existing ??
      (await createBucketListItem(owner, {
        kind: item.kind,
        name: item.name,
        countryCode: item.countryCode ?? null,
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        note: item.note,
        targetYear: item.targetYear ?? null,
        sortOrder: item.sortOrder,
      }))
    if (item.achievedOn !== undefined && !row.isAchieved) {
      // Ticking a country goal also records the country as visited, which the block below then
      // reconciles to the exact dates and visit count the dataset declares.
      await achieveBucketListItem(owner, row.id, item.achievedOn)
    }
  }

  // Read once, after the bucket-list pass has had its chance to create rows for achieved countries.
  const seenCountries = await listVisitedCountries(owner, resolved.ownerUserId)
  for (const country of visitedCountries) {
    const sorted = [...country.visits].sort()
    const first = sorted.at(0) ?? null
    const last = sorted.at(-1) ?? null

    let row = seenCountries.find(
      (entry) => entry.countryCode === country.countryCode,
    )
    if (row === undefined) {
      row = await markCountryVisited(owner, {
        userId: resolved.ownerUserId,
        countryCode: country.countryCode,
        continent: country.continent,
        visitedOn: first ?? undefined,
        note: country.note ?? null,
      })
    }
    await visitedCountriesRepository.update(owner, row.id, {
      continent: country.continent,
      firstVisitedOn: first,
      lastVisitedOn: last,
      visitCount: country.visits.length,
      note: country.note ?? null,
    })
  }

  for (const region of visitedRegions) {
    await markRegionVisited(owner, {
      userId: resolved.ownerUserId,
      countryCode: region.countryCode,
      regionCode: region.regionCode,
      regionName: region.regionName,
      visitedOn: region.visitedOn,
    })
  }

  for (const stats of travelStats) {
    await recomputeTravelStats(owner, resolved.ownerUserId, stats.statYear)
    const statsRow = await upsertTravelStats(owner, {
      userId: resolved.ownerUserId,
      statYear: stats.statYear,
      distanceMetres: stats.distanceMetres,
      yearStreak: stats.yearStreak,
    })
    // Both writes above stamp `computedAt` from the wall clock, which is right for a cron rebuild and
    // wrong for a fixture: it is the last column in this dataset that two runs would disagree about.
    await travelStatsRepository.requireUpdate(owner, statsRow.id, {
      computedAt: SEED_ANCHOR_INSTANT,
    })
  }

  /* ---------------------------------------------------------------------------------------- vacay */

  fixture.section('vacay')
  const plan = await ensurePlan(owner, resolved.ownerUserId)
  await updatePlan(owner, plan.id, {
    name: vacay.name,
    blockWeekends: true,
    holidaysEnabled: true,
    companyHolidaysEnabled: true,
    carryOverEnabled: true,
    defaultEntitlementDays: vacay.defaultEntitlementDays,
  })
  for (const year of vacay.years) {
    await ensureYear(owner, plan.id, year)
  }

  for (const person of people) {
    const userId = seedPeople.ids.get(person.key)
    if (userId === undefined) {
      continue
    }
    await invitePlanMember(owner, plan.id, userId)
    await setUserColour(owner, plan.id, userId, person.colour)
  }
  for (const member of await listPlanMembers(owner, plan.id)) {
    if (member.status !== 'accepted') {
      await setPlanMemberStatus(owner, member.id, 'accepted')
    }
  }

  for (const entitlement of vacay.entitlements) {
    const userId = seedPeople.ids.get(entitlement.person)
    if (userId === undefined) {
      continue
    }
    await setEntitlement(owner, {
      planId: plan.id,
      userId,
      year: entitlement.year,
      entitlementDays: entitlement.entitlementDays,
      carriedOverDays: entitlement.carriedOverDays,
    })
  }

  for (const calendar of vacay.calendars) {
    await addHolidayCalendar(owner, { planId: plan.id, ...calendar })
  }
  for (const holiday of vacay.companyHolidays) {
    await addCompanyHoliday(owner, { planId: plan.id, ...holiday })
  }

  let vacayEntryCount = 0
  for (const entry of vacay.entries) {
    const userId = seedPeople.ids.get(entry.person)
    if (userId === undefined) {
      continue
    }
    await setEntryRange(owner, {
      planId: plan.id,
      userId,
      from: entry.from,
      to: entry.to,
      kind: entry.kind,
      note: entry.note,
    })
    vacayEntryCount += daysInRange(entry.from, entry.to)
  }

  /* ------------------------------------------------------------------------------ inbox and audit */

  // A run that reaches this point has just rebuilt the trips, so any demo notification from an earlier
  // run points at an id that no longer exists. Clear the rows this dataset owns — identified by their
  // message key — and write them fresh, rather than accumulating a stale copy per run.
  fixture.section('inbox')
  const datasetTitleKeys = new Set(
    notifications.map((notification) => notification.titleKey),
  )
  const inbox = await notificationsRepository.findMany(owner, {
    limit: INBOX_SWEEP_LIMIT,
  })
  for (const row of inbox) {
    if (
      row.recipientUserId === resolved.ownerUserId &&
      datasetTitleKeys.has(row.titleKey)
    ) {
      await deleteNotification(owner, row.id)
    }
  }

  let notificationCount = 0
  for (const notification of notifications) {
    const tripId =
      notification.entityTripSlug === undefined
        ? null
        : (tripIdBySlug.get(notification.entityTripSlug) ?? null)
    const replacements = {
      days: daysFromAnchor(
        notification.entityTripSlug === undefined
          ? null
          : (tripStartBySlug.get(notification.entityTripSlug) ?? null),
      ),
      organizationName: organization.name,
    }
    const createdAt = minutesBeforeAnchor(notification.minutesAgo)
    await notificationsRepository.insert(owner, {
      recipientUserId: resolved.ownerUserId,
      senderUserId:
        seedPeople.ids.get(notification.sender) ?? resolved.ownerUserId,
      type: notification.type,
      scope: notification.scope,
      entityType: notification.entityType ?? null,
      entityId: tripId,
      titleKey: notification.titleKey,
      titleParams: resolveParams(notification.titleParams, replacements),
      bodyKey: notification.bodyKey,
      bodyParams: resolveParams(notification.bodyParams, replacements),
      actionUrl: tripId === null ? null : `/trips/${tripId}`,
      isRead: notification.isRead,
      readAt: notification.isRead
        ? minutesBeforeAnchor(Math.max(notification.minutesAgo - 30, 0))
        : null,
      createdAt,
      updatedAt: createdAt,
    })
    notificationCount += 1
  }

  fixture.section('audit')
  const datasetActions = new Set(auditTrail.map((entry) => entry.action))
  const trail = await auditLogRepository.findMany(owner, {
    limit: INBOX_SWEEP_LIMIT,
  })
  for (const row of trail) {
    if (datasetActions.has(row.action)) {
      await auditLogRepository.remove(owner, row.id)
    }
  }

  let auditCount = 0
  for (const entry of auditTrail) {
    const createdAt = minutesBeforeAnchor(entry.minutesAgo)
    await auditLogRepository.insert(owner, {
      actorUserId: resolved.ownerUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId:
        entry.entityTripSlug === undefined
          ? null
          : (tripIdBySlug.get(entry.entityTripSlug) ?? null),
      metadata: entry.metadata,
      createdAt,
    })
    auditCount += 1
  }

  /* -------------------------------------------------------------------------------- usage counters */

  fixture.section('usage')
  const totals = sumTotals(tripReports)
  await setUsage(owner, { metric: 'trips', value: totals.trips })
  await setUsage(owner, { metric: 'places', value: totals.places })
  await setUsage(owner, { metric: 'members', value: people.length })
  await setUsage(owner, { metric: 'files', value: totals.files })
  await setUsage(owner, { metric: 'collections', value: collections.length })
  await setUsage(owner, { metric: 'journeys', value: journeys.length })

  // Last, in a section of its own, so the identifiers of every row above it stay where they were:
  // the visual baselines photograph the first workspace and nothing here may move them.
  fixture.section('second-workspace')
  await ensureSecondWorkspace(db, resolved)

  await appSettingsStore.set(
    db,
    MARKER_KEY,
    {
      version: DATASET_VERSION,
      anchor: SEED_ANCHOR_DAY,
      organizationId: resolved.organizationId,
    },
    'Demo dataset marker written by /api/dev/seed. Delete it to allow a re-seed.',
  )

  return {
    skipped: false,
    datasetVersion: DATASET_VERSION,
    organizationId: resolved.organizationId,
    ownerUserId: resolved.ownerUserId,
    ownerEmail,
    createdOwner: resolved.createdOwner,
    credential: resolved.credential,
    usersCreated: seedPeople.created,
    members: people.length,
    categories: categoryRows.length,
    moods: moodRows.length,
    trips: tripReports,
    totals,
    journeys: journeys.length,
    journeyEntries: journeyEntryCount,
    journeyPhotos: journeyPhotoCount,
    collections: collections.length,
    collectionPlaces: collectionPlaceCount,
    visitedCountries: visitedCountries.length,
    visitedRegions: visitedRegions.length,
    bucketListItems: bucketList.length,
    vacayEntries: vacayEntryCount,
    companyHolidays: vacay.companyHolidays.length,
    notifications: notificationCount,
    auditEntries: auditCount,
    durationMs: Date.now() - startedAt,
  }
}

function sumTotals(
  reports: ReadonlyArray<{ readonly counts: TripCounts }>,
): SeedReport['totals'] {
  const add = (pick: (counts: TripCounts) => number): number =>
    reports.reduce((total, report) => total + pick(report.counts), 0)
  return {
    trips: reports.length,
    days: add((counts) => counts.days),
    dayNotes: add((counts) => counts.dayNotes),
    places: add((counts) => counts.places),
    stops: add((counts) => counts.stops),
    accommodations: add((counts) => counts.accommodations),
    transports: add((counts) => counts.transports),
    reservations: add((counts) => counts.reservations),
    budgetItems: add((counts) => counts.budgetItems),
    expenses: add((counts) => counts.expenses),
    expenseShares: add((counts) => counts.expenseShares),
    settlements: add((counts) => counts.settlements),
    lists: add((counts) => counts.lists),
    listItems: add((counts) => counts.listItems),
    messages: add((counts) => counts.messages),
    reactions: add((counts) => counts.reactions),
    notes: add((counts) => counts.notes),
    polls: add((counts) => counts.polls),
    votes: add((counts) => counts.votes),
    files: add((counts) => counts.files),
  }
}

/** The shape returned when the marker says there is nothing to do. */
function emptyReport(
  organizationId: string,
  ownerUserId: string,
  ownerEmail: string,
  createdOwner: boolean,
  credential: CredentialOutcome,
): SeedReport {
  return {
    skipped: true,
    datasetVersion: DATASET_VERSION,
    organizationId,
    ownerUserId,
    ownerEmail,
    createdOwner,
    credential,
    usersCreated: 0,
    members: people.length,
    categories: 0,
    moods: 0,
    trips: [],
    totals: sumTotals([]),
    journeys: 0,
    journeyEntries: 0,
    journeyPhotos: 0,
    collections: 0,
    collectionPlaces: 0,
    visitedCountries: 0,
    visitedRegions: 0,
    bucketListItems: 0,
    vacayEntries: 0,
    companyHolidays: 0,
    notifications: 0,
    auditEntries: 0,
    durationMs: 0,
  }
}
