/**
 * The planner's edit surfaces.
 *
 * Three of them, kept apart because they answer three different questions and
 * merging them would make each one worse: what *is* this place, when are we there,
 * and where does it belong. Each is a controlled dialog owned by the screen — one
 * instance, not one per row — so a forty-stop itinerary mounts one form rather than
 * forty.
 */

import * as React from 'react'
import {
  ArrowRightLeft,
  Clock,
  Crosshair,
  MapPin,
  MoreHorizontal,
  Navigation,
  PencilLine,
  Trash2,
  Undo2,
} from 'lucide-react'

import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Field,
  IconButton,
  Input,
  SimpleSelect,
  Switch,
  Textarea,
} from '#/components/ui'
import {
  MAP_SERVICE_NAME,
  POINT_SERVICES,
  pointLink,
  positionOf,
} from '#/lib/geo/handoff'
import { formatCoordinate, parsePosition } from '#/lib/geo/position'
import { useTranslate } from '#/lib/i18n'
import { reopenNoticeFor } from '#/lib/workspace-claim-store'

import type { PlannerCategory, PlannerRow } from '#/components/planner'
import type { Translate, MessageKey } from '#/lib/i18n'
import type { GeoPosition } from '#/lib/geo/position'
import type {
  PlanBoardDay,
  PlanBoardPlace,
  PlanReservationStatus,
} from '../-server/plan'

/* -------------------------------------------------------------------------------------------------
 * Shared
 * ---------------------------------------------------------------------------------------------- */

const NO_CATEGORY = 'none'

const DURATIONS: ReadonlyArray<{ value: string; key: MessageKey }> = [
  { value: '0', key: 'trips.plan.editor.duration0' },
  { value: '30', key: 'trips.plan.editor.duration30' },
  { value: '45', key: 'trips.plan.editor.duration45' },
  { value: '60', key: 'trips.plan.editor.duration60' },
  { value: '90', key: 'trips.plan.editor.duration90' },
  { value: '120', key: 'trips.plan.editor.duration120' },
  { value: '180', key: 'trips.plan.editor.duration180' },
  { value: '240', key: 'trips.plan.editor.duration240' },
  { value: '480', key: 'trips.plan.editor.duration480' },
]

const RATINGS: ReadonlyArray<{ value: string; key: MessageKey }> = [
  { value: '0', key: 'trips.plan.editor.rating0' },
  { value: '1', key: 'trips.plan.editor.rating1' },
  { value: '2', key: 'trips.plan.editor.rating2' },
  { value: '3', key: 'trips.plan.editor.rating3' },
  { value: '4', key: 'trips.plan.editor.rating4' },
  { value: '5', key: 'trips.plan.editor.rating5' },
]

/** Every value `day_assignments.reservation_status` accepts, in the order a trip moves through them. */
const BOOKING_STATUSES = [
  'none',
  'pending',
  'confirmed',
  'completed',
  'cancelled',
] as const

const BOOKING: ReadonlyArray<{
  value: PlanReservationStatus
  key: MessageKey
}> = [
  { value: 'none', key: 'trips.plan.editor.bookingNone' },
  { value: 'pending', key: 'trips.plan.editor.bookingPending' },
  { value: 'confirmed', key: 'trips.plan.editor.bookingConfirmed' },
  { value: 'completed', key: 'trips.plan.editor.bookingCompleted' },
  { value: 'cancelled', key: 'trips.plan.editor.bookingCancelled' },
]

/** Narrows the select's string back to the column's own vocabulary. */
function asBookingStatus(value: string): PlanReservationStatus {
  return BOOKING_STATUSES.find((entry) => entry === value) ?? 'none'
}

export function messageOf(error: unknown, fallback: string): string {
  if (reopenNoticeFor(error)) return fallback
  if (error instanceof Error && error.message.length > 0) return error.message
  return fallback
}

/**
 * Runs the rest of a board write whose first part has already landed, and refreshes the board
 * if that rest fails.
 *
 * A delete whose follow-up journey restatement is refused has already taken the stop out of the
 * database, so the board catches up to what the server now holds before the failure reaches the
 * caller. Only such a write refreshes on failure: one that failed outright changed nothing, and
 * when it failed because the server was unreachable, the refresh would fail too and put the
 * route's error panel in place of the dialog holding the reader's input.
 */
export async function refreshOnFailure(
  work: () => Promise<unknown>,
  refresh: () => Promise<unknown>,
): Promise<void> {
  try {
    await work()
  } catch (cause) {
    await refresh()
    throw cause
  }
}

function categoryOptions(
  categories: ReadonlyArray<PlannerCategory>,
  t: Translate,
): Array<{ value: string; label: string }> {
  return [
    { value: NO_CATEGORY, label: t('trips.plan.editor.noCategory') },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ]
}

/* -------------------------------------------------------------------------------------------------
 * Row menu
 * ---------------------------------------------------------------------------------------------- */

/** Read-only by construction: no mutation callbacks or pending state. */
export function StopHandoffMenu({ row }: { readonly row: PlannerRow }) {
  const t = useTranslate()
  if (positionOf(row) === null) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          icon={<MoreHorizontal />}
          label={t('modules.actionsFor', { name: row.name })}
          size="sm"
          variant="ghost"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <StopHandoffItems row={row} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The same map links in the editing menu and the read-only menu. */
function StopHandoffItems({ row }: { readonly row: PlannerRow }) {
  const t = useTranslate()
  const position = positionOf(row)
  if (position === null) return null

  return POINT_SERVICES.map((service) => (
    <DropdownMenuLinkItem
      key={service}
      href={pointLink(service, position)}
      icon={<Navigation />}
      aria-label={t('trips.plan.handoff.stop', {
        place: row.name,
        service: MAP_SERVICE_NAME[service],
      })}
    >
      {MAP_SERVICE_NAME[service]}
    </DropdownMenuLinkItem>
  ))
}

export interface StopMenuProps {
  readonly row: PlannerRow
  readonly days: ReadonlyArray<PlanBoardDay>
  readonly disabled?: boolean
  readonly onEditPlace: () => void
  readonly onEditTiming: () => void
  readonly onPickPosition: () => void
  readonly onMoveToDay: (dayId: string) => void
  readonly onUnschedule: () => void
  readonly onDelete: () => void
}

/**
 * Everything a row can have done to it, in one menu.
 *
 * A real `DropdownMenu`, so it is keyboard-reachable from the row it belongs to and
 * the day submenu is arrow-navigable — the reference offers a pencil that opens a
 * form and nothing else, which leaves "move this to Thursday" as a drag or nothing.
 * A drag is not available to every reader, so every drag on this screen has a menu
 * equivalent.
 */
export function StopMenu({
  row,
  days,
  disabled = false,
  onEditPlace,
  onEditTiming,
  onPickPosition,
  onMoveToDay,
  onUnschedule,
  onDelete,
}: StopMenuProps) {
  const elsewhere = days.filter((day) => day.dayNumber !== row.dayNumber)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          icon={<MoreHorizontal />}
          label={`Actions for ${row.name}`}
          size="sm"
          variant="ghost"
          disabled={disabled}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem icon={<PencilLine />} onSelect={onEditPlace}>
          Edit place
        </DropdownMenuItem>

        {row.assignmentId === null ? null : (
          <DropdownMenuItem icon={<Clock />} onSelect={onEditTiming}>
            Set a time
          </DropdownMenuItem>
        )}

        <DropdownMenuItem icon={<Crosshair />} onSelect={onPickPosition}>
          {row.lat === null ? 'Place it on the map' : 'Move its pin'}
        </DropdownMenuItem>

        <StopHandoffItems row={row} />

        {elsewhere.length === 0 ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger icon={<ArrowRightLeft />}>
                Move to day
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 w-48 overflow-y-auto">
                {elsewhere.map((day) => (
                  <DropdownMenuItem
                    key={day.dayId}
                    onSelect={() => onMoveToDay(day.dayId)}
                    icon={
                      <span className="text-micro font-bold tabular-nums">
                        {day.dayNumber}
                      </span>
                    }
                  >
                    {day.title ?? `Day ${day.dayNumber}`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        {row.assignmentId === null ? null : (
          <DropdownMenuItem icon={<Undo2 />} onSelect={onUnschedule}>
            Back to unplanned
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem destructive icon={<Trash2 />} onSelect={onDelete}>
          Delete from trip
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Place form
 * ---------------------------------------------------------------------------------------------- */

/** The form's own state, so one component serves both create and edit. */
export interface PlaceDraft {
  readonly name: string
  readonly city: string
  readonly address: string
  readonly categoryId: string
  readonly durationMinutes: number
  readonly rating: number
  readonly lat: string
  readonly lng: string
  readonly isVisited: boolean
  /** Empty for "leave it unplanned". Only offered when creating. */
  readonly dayId: string
}

export const emptyDraft: PlaceDraft = {
  name: '',
  city: '',
  address: '',
  categoryId: NO_CATEGORY,
  durationMinutes: 60,
  rating: 0,
  lat: '',
  lng: '',
  isVisited: false,
  dayId: '',
}

/**
 * Seeds the form from the stored place rather than from the rendered row.
 *
 * A row collapses `address` and `city` into one display line, and editing through
 * that line would quietly move a city into the address column the first time
 * anybody opened the form. The place row keeps them apart, so the form does too.
 */
export function draftFromPlace(place: PlanBoardPlace): PlaceDraft {
  return {
    name: place.name,
    city: place.city ?? '',
    address: place.address ?? '',
    categoryId: place.categoryId ?? NO_CATEGORY,
    durationMinutes: place.durationMinutes,
    rating: place.rating ?? 0,
    lat: place.lat === null ? '' : String(place.lat),
    lng: place.lng === null ? '' : String(place.lng),
    isVisited: place.isVisited,
    dayId: '',
  }
}

/** `''` for a blank field, a number for a real one, `NaN` for nonsense. */
function parseCoordinate(value: string): number | null | typeof NaN {
  const trimmed = value.trim()
  if (trimmed === '') return null
  return Number(trimmed)
}

export interface PlaceFormValues {
  readonly name: string
  readonly city: string
  readonly address: string
  readonly categoryId: string
  readonly durationMinutes: number
  readonly rating: number
  readonly lat: number | null
  readonly lng: number | null
  readonly isVisited: boolean
  readonly dayId: string
}

export interface PlaceDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly mode: 'create' | 'edit'
  readonly categories: ReadonlyArray<PlannerCategory>
  /** Offered as "put it straight on a day" when creating. */
  readonly days: ReadonlyArray<PlanBoardDay>
  readonly initial: PlaceDraft
  readonly saving: boolean
  readonly error: string | null
  /**
   * A way out of `error`, shown inside the same alert so it stays within the form. It opens in a
   * new tab: following it in this one would unmount the form and lose the draft.
   */
  readonly errorAction?: {
    readonly label: string
    readonly href: string
  } | null
  readonly onSubmit: (values: PlaceFormValues) => void
}

/**
 * The place form.
 *
 * Coordinates are typed here as a last resort and picked off the map as the primary
 * path, so the field pair is honest about being the fallback: it validates as a pair,
 * because a latitude without a longitude is not a position and silently storing half
 * of one produces a pin in the Atlantic.
 *
 * A position pasted into either field fills both and says what it read, because a
 * reader with a position on the clipboard should not have to split it by hand. A
 * paste that does not parse is left to the browser: a field that rewrites itself
 * under a half-typed number is worse than no help.
 */
export function PlaceDialog({
  open,
  onOpenChange,
  mode,
  categories,
  days,
  initial,
  saving,
  error,
  errorAction = null,
  onSubmit,
}: PlaceDialogProps) {
  const t = useTranslate()
  const [draft, setDraft] = React.useState(initial)
  const [touched, setTouched] = React.useState(false)
  // The pair the last paste read, shown until either field is edited by hand.
  const [pasted, setPasted] = React.useState<GeoPosition | null>(null)
  const lngRef = React.useRef<HTMLInputElement>(null)
  const pastedHintId = React.useId()

  // The dialog is a single instance reused for every row, so the draft is reset
  // from the row it was opened for rather than seeded once at mount.
  React.useEffect(() => {
    if (open) {
      setDraft(initial)
      setTouched(false)
      setPasted(null)
    }
    // `initial` is rebuilt by the screen when it opens the dialog for a new row.
  }, [initial, open])

  const lat = parseCoordinate(draft.lat)
  const lng = parseCoordinate(draft.lng)
  const latValid = lat === null || (Number.isFinite(lat) && Math.abs(lat) <= 90)
  const lngValid =
    lng === null || (Number.isFinite(lng) && Math.abs(lng) <= 180)
  const paired = (lat === null) === (lng === null)
  const named = draft.name.trim().length > 0
  const canSave = named && latValid && lngValid && paired

  let latitudeError: string | undefined
  if (touched && !latValid) latitudeError = t('trips.plan.editor.latitudeError')
  else if (touched && !paired)
    latitudeError = t('trips.plan.editor.positionError')

  const formId = `place-form-${mode}`

  const pastePosition = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const position = parsePosition(event.clipboardData.getData('text/plain'))
    if (position === null) return
    event.preventDefault()
    setDraft({
      ...draft,
      lat: formatCoordinate(position.lat),
      lng: formatCoordinate(position.lng),
    })
    setPasted(position)
    // Ends on the half the reader did not paste into, which the hint describes.
    lngRef.current?.focus()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('trips.plan.editor.createTitle')
              : t('trips.plan.editor.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? t('trips.plan.editor.createDescription')
              : t('trips.plan.editor.editDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              setTouched(true)
              if (!canSave || saving) return
              onSubmit({
                name: draft.name.trim(),
                city: draft.city.trim(),
                address: draft.address.trim(),
                categoryId:
                  draft.categoryId === NO_CATEGORY ? '' : draft.categoryId,
                durationMinutes: draft.durationMinutes,
                rating: draft.rating,
                lat: lat === null ? null : lat,
                lng: lng === null ? null : lng,
                isVisited: draft.isVisited,
                dayId: draft.dayId,
              })
            }}
          >
            {error === null ? null : (
              <Alert
                tone="danger"
                title={t('modules.form.saveError')}
                actions={
                  errorAction === null ? undefined : (
                    <Button asChild variant="secondary" size="sm">
                      <a
                        href={errorAction.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {errorAction.label}
                      </a>
                    </Button>
                  )
                }
              >
                {error}
              </Alert>
            )}

            <Field
              label={t('modules.field.name')}
              required
              error={
                touched && !named
                  ? t('trips.plan.editor.nameRequired')
                  : undefined
              }
            >
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                placeholder={t('trips.plan.editor.nameExample')}
                leading={<MapPin />}
                maxLength={160}
                autoComplete="off"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('trips.plan.editor.city')}>
                <Input
                  value={draft.city}
                  onChange={(event) =>
                    setDraft({ ...draft, city: event.target.value })
                  }
                  placeholder={t('trips.plan.editor.cityExample')}
                  maxLength={160}
                  autoComplete="off"
                />
              </Field>
              <Field label={t('modules.field.category')}>
                <SimpleSelect
                  options={categoryOptions(categories, t)}
                  value={draft.categoryId}
                  onValueChange={(value) =>
                    setDraft({ ...draft, categoryId: value })
                  }
                  ariaLabel={t('modules.field.category')}
                />
              </Field>
            </div>

            <Field label={t('modules.book.field.address')}>
              <Input
                value={draft.address}
                onChange={(event) =>
                  setDraft({ ...draft, address: event.target.value })
                }
                placeholder={t('trips.plan.editor.addressExample')}
                maxLength={240}
                autoComplete="off"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('trips.plan.editor.duration')}>
                <SimpleSelect
                  options={DURATIONS.map(({ value, key }) => ({
                    value,
                    label: t(key),
                  }))}
                  value={String(draft.durationMinutes)}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      durationMinutes: Number.parseInt(value, 10),
                    })
                  }
                  ariaLabel={t('trips.plan.editor.duration')}
                />
              </Field>
              <Field label={t('trips.plan.editor.rating')}>
                <SimpleSelect
                  options={RATINGS.map(({ value, key }) => ({
                    value,
                    label: t(key),
                  }))}
                  value={String(draft.rating)}
                  onValueChange={(value) =>
                    setDraft({ ...draft, rating: Number.parseInt(value, 10) })
                  }
                  ariaLabel={t('trips.plan.editor.rating')}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('trips.plan.editor.latitude')}
                  hint={t('trips.plan.editor.positionHint')}
                  error={latitudeError}
                >
                  <Input
                    value={draft.lat}
                    onChange={(event) => {
                      setDraft({ ...draft, lat: event.target.value })
                      setPasted(null)
                    }}
                    onPaste={pastePosition}
                    aria-describedby={pastedHintId}
                    data-part="place-lat"
                    placeholder={t('trips.plan.editor.latitudeExample')}
                    inputMode="decimal"
                    autoComplete="off"
                    className="tabular-nums"
                  />
                </Field>
                <Field
                  label={t('trips.plan.editor.longitude')}
                  error={
                    touched && !lngValid
                      ? t('trips.plan.editor.longitudeError')
                      : undefined
                  }
                >
                  <Input
                    ref={lngRef}
                    value={draft.lng}
                    onChange={(event) => {
                      setDraft({ ...draft, lng: event.target.value })
                      setPasted(null)
                    }}
                    onPaste={pastePosition}
                    aria-describedby={pastedHintId}
                    data-part="place-lng"
                    placeholder={t('trips.plan.editor.longitudeExample')}
                    inputMode="decimal"
                    autoComplete="off"
                    className="tabular-nums"
                  />
                </Field>
              </div>
              {/* The box is reserved empty so the hint never shifts what sits below. */}
              <p
                id={pastedHintId}
                role="status"
                className="min-h-[2lh] text-caption text-ink-3 tabular-nums sm:min-h-lh"
              >
                {pasted === null
                  ? null
                  : t('trips.plan.place.pastedPosition', {
                      lat: formatCoordinate(pasted.lat),
                      lng: formatCoordinate(pasted.lng),
                    })}
              </p>
            </div>

            {mode === 'create' && days.length > 0 ? (
              <Field
                label={t('trips.plan.editor.day')}
                hint={t('trips.plan.editor.dayHint')}
              >
                <SimpleSelect
                  options={[
                    { value: '', label: t('trips.plan.editor.unplanned') },
                    ...days.map((day) => ({
                      value: day.dayId,
                      label:
                        day.title === null
                          ? t('trips.plan.editor.dayNumber', {
                              day: day.dayNumber,
                            })
                          : t('trips.plan.editor.dayNamed', {
                              day: day.dayNumber,
                              title: day.title,
                            }),
                    })),
                  ]}
                  value={draft.dayId}
                  onValueChange={(value) =>
                    setDraft({ ...draft, dayId: value })
                  }
                  ariaLabel={t('trips.plan.editor.day')}
                />
              </Field>
            ) : null}

            {mode === 'edit' ? (
              <Field
                label={t('trips.plan.editor.visited')}
                orientation="horizontal"
                hint={t('trips.plan.editor.visitedHint')}
              >
                <Switch
                  checked={draft.isVisited}
                  onCheckedChange={(checked) =>
                    setDraft({ ...draft, isVisited: checked })
                  }
                />
              </Field>
            ) : null}
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel={t('trips.plan.editor.saving')}
          >
            {mode === 'create'
              ? t('trips.plan.addPlace.label')
              : t('trips.plan.editor.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Timing form
 * ---------------------------------------------------------------------------------------------- */

export interface TimingDraft {
  readonly startTime: string
  readonly endTime: string
  readonly durationMinutes: number
  readonly notes: string
  readonly reservationStatus: PlanReservationStatus
}

export const emptyTiming: TimingDraft = {
  startTime: '',
  endTime: '',
  durationMinutes: 0,
  notes: '',
  reservationStatus: 'none',
}

export interface TimingDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly placeName: string
  readonly dayLabel: string
  readonly initial: TimingDraft
  readonly saving: boolean
  readonly error: string | null
  readonly onSubmit: (values: TimingDraft) => void
}

/**
 * When we are there, and whether it is booked.
 *
 * Separate from the place form because these belong to the *stop*, not the place: the
 * same shrine visited twice has two sets of times and one address, and a single form
 * for both would make it impossible to tell which you were editing.
 */
export function TimingDialog({
  open,
  onOpenChange,
  placeName,
  dayLabel,
  initial,
  saving,
  error,
  onSubmit,
}: TimingDialogProps) {
  const t = useTranslate()
  const [draft, setDraft] = React.useState(initial)

  React.useEffect(() => {
    if (open) setDraft(initial)
  }, [initial, open])

  const ordered =
    draft.startTime === '' ||
    draft.endTime === '' ||
    draft.startTime <= draft.endTime

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{placeName}</DialogTitle>
          <DialogDescription>{dayLabel}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id="timing-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (ordered && !saving) onSubmit(draft)
            }}
          >
            {error === null ? null : (
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {error}
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('trips.plan.editor.arrive')}>
                <Input
                  type="time"
                  value={draft.startTime}
                  onChange={(event) =>
                    setDraft({ ...draft, startTime: event.target.value })
                  }
                  className="tabular-nums"
                />
              </Field>
              <Field
                label={t('trips.plan.editor.leave')}
                error={ordered ? undefined : t('trips.plan.editor.timeError')}
              >
                <Input
                  type="time"
                  value={draft.endTime}
                  onChange={(event) =>
                    setDraft({ ...draft, endTime: event.target.value })
                  }
                  className="tabular-nums"
                />
              </Field>
            </div>

            <Field label={t('trips.plan.editor.duration')}>
              <SimpleSelect
                options={DURATIONS.map(({ value, key }) => ({
                  value,
                  label: t(key),
                }))}
                value={String(draft.durationMinutes)}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    durationMinutes: Number.parseInt(value, 10),
                  })
                }
                ariaLabel={t('trips.plan.editor.duration')}
              />
            </Field>

            <Field label={t('trips.plan.editor.booking')}>
              <SimpleSelect
                options={BOOKING.map(({ value, key }) => ({
                  value,
                  label: t(key),
                }))}
                value={draft.reservationStatus}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    reservationStatus: asBookingStatus(value),
                  })
                }
                ariaLabel={t('trips.plan.editor.booking')}
              />
            </Field>

            <Field label={t('trips.plan.editor.note')}>
              <Textarea
                value={draft.notes}
                onChange={(event) =>
                  setDraft({ ...draft, notes: event.target.value })
                }
                placeholder={t('trips.plan.editor.noteExample')}
                rows={3}
                maxLength={2000}
                autoResize
              />
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form="timing-form"
            variant="primary"
            shape="pill"
            disabled={!ordered}
            loading={saving}
            loadingLabel={t('trips.plan.editor.savingTimes')}
          >
            {t('trips.plan.editor.saveTimes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Delete confirmation
 * ---------------------------------------------------------------------------------------------- */

export interface DeleteDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly placeName: string
  readonly dayCount: number
  readonly saving: boolean
  readonly error: string | null
  readonly onConfirm: () => void
}

/** The one destructive action on the screen, and the only one behind a question. */
export function DeleteDialog({
  open,
  onOpenChange,
  placeName,
  dayCount,
  saving,
  error,
  onConfirm,
}: DeleteDialogProps) {
  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && saving) return
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent size="sm" hideClose={saving}>
        <DialogHeader>
          <DialogTitle>Delete {placeName}?</DialogTitle>
          <DialogDescription>
            {dayCount === 0
              ? 'It leaves the trip’s places entirely. This cannot be undone.'
              : `It is on ${dayCount === 1 ? '1 day' : `${dayCount} days`} of this trip, and it leaves all of them. This cannot be undone.`}
          </DialogDescription>
        </DialogHeader>

        {error === null ? null : (
          <DialogBody>
            <Alert tone="danger" title="That did not delete">
              {error}
            </Alert>
          </DialogBody>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            aria-disabled={saving || undefined}
            className="aria-disabled:text-ink-4"
            onClick={() => changeOpen(false)}
          >
            Keep it
          </Button>
          <Button
            type="button"
            variant="danger"
            shape="pill"
            loading={saving}
            loadingLabel="Deleting the place"
            onClick={onConfirm}
          >
            Delete place
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Dropping a time
 * ---------------------------------------------------------------------------------------------- */

export interface DropTimeDialogProps {
  readonly open: boolean
  /** The place's name, or the note's headline — whatever the item is called. */
  readonly name: string
  /** The `HH:MM` the item carries, and would lose. */
  readonly time: string
  readonly onConfirm: () => void
  /** Escape, Cancel, the close button and the overlay all land here. */
  readonly onDecline: () => void
}

/**
 * "Move this and drop its 14:30?"
 *
 * A time outranks a position (PRD #104 decision 9), so a drag that contradicts one
 * is neither applied nor refused — it is a question, and this is the question. The
 * board is untouched while it is open: nothing moves until the reader agrees, and
 * agreeing sends the new order and the cleared time as a single write.
 *
 * Confirm takes initial focus rather than Cancel, which is the opposite of
 * `DeleteDialog`: nothing is destroyed here beyond a time the reader is already in
 * the middle of contradicting, and the dialog exists to make the drag they just
 * performed go through, not to talk them out of it. Escape still declines.
 */
export function DropTimeDialog({
  open,
  name,
  time,
  onConfirm,
  onDecline,
}: DropTimeDialogProps) {
  const t = useTranslate()
  const confirmRef = React.useRef<HTMLButtonElement>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDecline()
      }}
    >
      <DialogContent
        size="sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          confirmRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {t('trips.plan.move.dropTime.title', { name, time })}
          </DialogTitle>
          <DialogDescription>
            {t('trips.plan.move.dropTime.body')}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={onDecline}
          >
            {t('trips.plan.move.dropTime.cancel')}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="primary"
            shape="pill"
            onClick={onConfirm}
          >
            {t('trips.plan.move.dropTime.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
