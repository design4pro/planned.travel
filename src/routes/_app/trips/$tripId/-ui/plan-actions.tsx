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

import type { PlannerCategory, PlannerRow } from '#/components/planner'
import type {
  PlanBoardDay,
  PlanBoardPlace,
  PlanReservationStatus,
} from '../-server/plan'

/* -------------------------------------------------------------------------------------------------
 * Shared
 * ---------------------------------------------------------------------------------------------- */

const NO_CATEGORY = 'none'

const DURATIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '0', label: 'No fixed length' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1½ hours' },
  { value: '120', label: '2 hours' },
  { value: '180', label: '3 hours' },
  { value: '240', label: 'Half a day' },
  { value: '480', label: 'A full day' },
]

const RATINGS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '0', label: 'Not rated' },
  { value: '1', label: '★ 1 — skip it' },
  { value: '2', label: '★ 2 — if there is time' },
  { value: '3', label: '★ 3 — worth it' },
  { value: '4', label: '★ 4 — really good' },
  { value: '5', label: '★ 5 — do not miss' },
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
  label: string
}> = [
  { value: 'none', label: 'No booking needed' },
  { value: 'pending', label: 'Still to book' },
  { value: 'confirmed', label: 'Booked and confirmed' },
  { value: 'completed', label: 'Been and done' },
  { value: 'cancelled', label: 'Cancelled' },
]

/** Narrows the select's string back to the column's own vocabulary. */
function asBookingStatus(value: string): PlanReservationStatus {
  return BOOKING_STATUSES.find((entry) => entry === value) ?? 'none'
}

export function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) return error.message
  return fallback
}

function categoryOptions(
  categories: ReadonlyArray<PlannerCategory>,
): Array<{ value: string; label: string }> {
  return [
    { value: NO_CATEGORY, label: 'No category' },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ]
}

/* -------------------------------------------------------------------------------------------------
 * Row menu
 * ---------------------------------------------------------------------------------------------- */

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
          size="xs"
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
  readonly onSubmit: (values: PlaceFormValues) => void
}

/**
 * The place form.
 *
 * Coordinates are typed here as a last resort and picked off the map as the primary
 * path, so the field pair is honest about being the fallback: it validates as a pair,
 * because a latitude without a longitude is not a position and silently storing half
 * of one produces a pin in the Atlantic.
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
  onSubmit,
}: PlaceDialogProps) {
  const [draft, setDraft] = React.useState(initial)
  const [touched, setTouched] = React.useState(false)

  // The dialog is a single instance reused for every row, so the draft is reset
  // from the row it was opened for rather than seeded once at mount.
  React.useEffect(() => {
    if (open) {
      setDraft(initial)
      setTouched(false)
    }
    // `initial` is rebuilt by the screen when it opens the dialog for a new row.
  }, [initial, open])

  const lat = parseCoordinate(draft.lat)
  const lng = parseCoordinate(draft.lng)
  const latValid = lat === null || (Number.isFinite(lat) && Math.abs(lat) <= 90)
  const lngValid = lng === null || (Number.isFinite(lng) && Math.abs(lng) <= 180)
  const paired = (lat === null) === (lng === null)
  const named = draft.name.trim().length > 0
  const canSave = named && latValid && lngValid && paired && !saving

  const formId = `place-form-${mode}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add a place to this trip' : 'Edit this place'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Give it a name now and a position later — an unplanned place waits in the places panel until you drop it on a day.'
              : 'Changes apply everywhere this place appears: the map, every day it is on, and the trip’s inventory.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              setTouched(true)
              if (!canSave) return
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
              <Alert tone="danger" title="That did not save">
                {error}
              </Alert>
            )}

            <Field
              label="Name"
              required
              error={touched && !named ? 'A place needs a name' : undefined}
            >
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                placeholder="Fushimi Inari Taisha"
                leading={<MapPin />}
                maxLength={160}
                autoComplete="off"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City">
                <Input
                  value={draft.city}
                  onChange={(event) =>
                    setDraft({ ...draft, city: event.target.value })
                  }
                  placeholder="Kyoto"
                  maxLength={160}
                  autoComplete="off"
                />
              </Field>
              <Field label="Category">
                <SimpleSelect
                  options={categoryOptions(categories)}
                  value={draft.categoryId}
                  onValueChange={(value) =>
                    setDraft({ ...draft, categoryId: value })
                  }
                  ariaLabel="Category"
                />
              </Field>
            </div>

            <Field label="Address">
              <Input
                value={draft.address}
                onChange={(event) =>
                  setDraft({ ...draft, address: event.target.value })
                }
                placeholder="68 Fukakusa Yabunouchicho"
                maxLength={240}
                autoComplete="off"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="How long there">
                <SimpleSelect
                  options={[...DURATIONS]}
                  value={String(draft.durationMinutes)}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      durationMinutes: Number.parseInt(value, 10),
                    })
                  }
                  ariaLabel="How long there"
                />
              </Field>
              <Field label="Worth it?">
                <SimpleSelect
                  options={[...RATINGS]}
                  value={String(draft.rating)}
                  onValueChange={(value) =>
                    setDraft({ ...draft, rating: Number.parseInt(value, 10) })
                  }
                  ariaLabel="Rating"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Latitude"
                hint="Or close this and pick the spot on the map."
                error={
                  touched && !latValid
                    ? 'Between -90 and 90'
                    : touched && !paired
                      ? 'A position needs both numbers'
                      : undefined
                }
              >
                <Input
                  value={draft.lat}
                  onChange={(event) =>
                    setDraft({ ...draft, lat: event.target.value })
                  }
                  placeholder="34.9671"
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                />
              </Field>
              <Field
                label="Longitude"
                error={touched && !lngValid ? 'Between -180 and 180' : undefined}
              >
                <Input
                  value={draft.lng}
                  onChange={(event) =>
                    setDraft({ ...draft, lng: event.target.value })
                  }
                  placeholder="135.7727"
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                />
              </Field>
            </div>

            {mode === 'create' && days.length > 0 ? (
              <Field
                label="Put it on a day"
                hint="Leave this unset to keep it in the places panel."
              >
                <SimpleSelect
                  options={[
                    { value: '', label: 'Leave it unplanned' },
                    ...days.map((day) => ({
                      value: day.dayId,
                      label: `Day ${day.dayNumber}${
                        day.title === null ? '' : ` · ${day.title}`
                      }`,
                    })),
                  ]}
                  value={draft.dayId}
                  onValueChange={(value) => setDraft({ ...draft, dayId: value })}
                  ariaLabel="Put it on a day"
                />
              </Field>
            ) : null}

            {mode === 'edit' ? (
              <Field
                label="Already been"
                orientation="horizontal"
                hint="Marks the pin with a tick."
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
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel="Saving the place"
          >
            {mode === 'create' ? 'Add place' : 'Save changes'}
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
              <Alert tone="danger" title="That did not save">
                {error}
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Arrive">
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
                label="Leave"
                error={ordered ? undefined : 'Later than the arrival, please'}
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

            <Field label="How long there">
              <SimpleSelect
                options={[...DURATIONS]}
                value={String(draft.durationMinutes)}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    durationMinutes: Number.parseInt(value, 10),
                  })
                }
                ariaLabel="How long there"
              />
            </Field>

            <Field label="Booking">
              <SimpleSelect
                options={[...BOOKING]}
                value={draft.reservationStatus}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    reservationStatus: asBookingStatus(value),
                  })
                }
                ariaLabel="Booking"
              />
            </Field>

            <Field label="Note for this stop">
              <Textarea
                value={draft.notes}
                onChange={(event) =>
                  setDraft({ ...draft, notes: event.target.value })
                }
                placeholder="Go early — the queue past 9am is an hour."
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
            Cancel
          </Button>
          <Button
            type="submit"
            form="timing-form"
            variant="primary"
            shape="pill"
            disabled={!ordered || saving}
            loading={saving}
            loadingLabel="Saving the times"
          >
            Save
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
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
            onClick={() => onOpenChange(false)}
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
