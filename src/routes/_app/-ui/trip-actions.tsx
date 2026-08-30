/**
 * What a reader can do to a trip from its tile: the action menu and the edit sheet.
 *
 * **The menu is a courtesy, not the control.** Every item here maps onto a server function whose
 * repository refuses the write outright when the caller's trip role does not allow it
 * (`assertTripRole`, PRD #104 decision 6). So an item the role cannot exercise is *not rendered*
 * rather than rendered disabled: a disabled control invites a reader to wonder what they are missing,
 * where an absent one simply is not part of their product. A viewer's menu is short, and a stale
 * payload costs a refused write rather than an unauthorised one.
 *
 * Favourite, Copy and Delete arrive in the later slices of `01-S1`; this module's menu holds the
 * three owner verbs it has server functions for.
 */
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Archive, ArchiveRestore, MoreHorizontal, Pencil } from 'lucide-react'
import { toast } from 'sonner'

import {
  Alert,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  IconButton,
  Input,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SimpleSelect,
  useSheetDirection,
} from '#/components/ui'
import {
  archiveTripFn,
  restoreTripFn,
  updateTripFn,
} from '../-server/trip-lifecycle'

import type { TripCard } from '../-server/overview'

/**
 * The currencies a trip is most often budgeted in.
 *
 * The same nine the creation dialog offers, restated rather than shared: `01-S8` replaces both with
 * one field set over the full ISO-4217 list, and a helper extracted here now would be a third place
 * to delete then. Until then the edit sheet and the dialog must offer the same choices, which is what
 * `__tests__` on neither can prove and a reader would notice immediately.
 */
const CURRENCIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — Pound sterling' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'CHF', label: 'CHF — Swiss franc' },
  { value: 'PLN', label: 'PLN — Polish złoty' },
  { value: 'SEK', label: 'SEK — Swedish krona' },
  { value: 'JPY', label: 'JPY — Japanese yen' },
  { value: 'AUD', label: 'AUD — Australian dollar' },
  { value: 'CAD', label: 'CAD — Canadian dollar' },
]

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return fallback
}

/* -------------------------------------------------------------------------------------------------
 * Edit sheet
 * ---------------------------------------------------------------------------------------------- */

export interface TripEditSheetProps {
  trip: TripCard
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The five fields a trip is created with, offered again for editing.
 *
 * Blank clears and an untouched field is left alone — but this form shows all five, so it sends all
 * five: "untouched" is a property of the *patch*, not of the form, and a sheet that omitted an empty
 * field could never clear a destination. `01-S8` replaces this with the full field set the creation
 * dialog will also render.
 */
export function TripEditSheet({
  trip,
  open,
  onOpenChange,
}: TripEditSheetProps) {
  const router = useRouter()
  const direction = useSheetDirection('end')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState(trip.title)
  const [destination, setDestination] = useState(trip.destination ?? '')
  const [startDate, setStartDate] = useState(trip.startDate ?? '')
  const [endDate, setEndDate] = useState(trip.endDate ?? '')
  const [currency, setCurrency] = useState(trip.currency)

  const datesOutOfOrder =
    startDate !== '' && endDate !== '' && endDate < startDate
  const canSave = title.trim().length > 0 && !datesOutOfOrder && !saving

  async function submit(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await updateTripFn({
        data: {
          tripId: trip.id,
          title: title.trim(),
          destination: destination.trim(),
          startDate,
          endDate,
          currency,
        },
      })
      await router.invalidate()
      onOpenChange(false)
      toast.success('Trip updated')
    } catch (cause) {
      setError(
        messageOf(cause, 'The trip could not be saved. Try again in a moment.'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      direction={direction}
      open={open}
      onOpenChange={(next) => {
        // A save in flight owns the sheet: dismissing it mid-write would leave the reader with no
        // place for the answer to land.
        if (saving) return
        onOpenChange(next)
      }}
    >
      <SheetContent
        side="end"
        className="w-full sm:max-w-md"
        data-part="trip-edit-sheet"
      >
        <SheetHeader className="pe-14">
          <SheetTitle>Edit trip</SheetTitle>
        </SheetHeader>

        <SheetBody>
          <form
            id={`trip-edit-${trip.id}`}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (canSave) {
                void submit()
              }
            }}
          >
            {error === null ? null : (
              <Alert
                tone="danger"
                title="That did not save"
                actions={
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    shape="pill"
                    onClick={() => {
                      if (canSave) void submit()
                    }}
                  >
                    Try again
                  </Button>
                }
              >
                {error}
              </Alert>
            )}

            <Field label="Trip name" required>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <Field
              label="Destination"
              hint="A city, a region, or the whole route."
            >
              <Input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                maxLength={160}
                autoComplete="off"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Departure">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </Field>
              <Field
                label="Return"
                error={
                  datesOutOfOrder
                    ? 'The return date is before departure.'
                    : undefined
                }
              >
                <Input
                  type="date"
                  value={endDate}
                  min={startDate === '' ? undefined : startDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Budget currency"
              hint="Every expense on this trip is totalled in it."
            >
              <SimpleSelect
                options={[...CURRENCIES]}
                value={currency}
                onValueChange={setCurrency}
                ariaLabel="Budget currency"
              />
            </Field>
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={`trip-edit-${trip.id}`}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel="Saving the trip"
          >
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Action menu
 * ---------------------------------------------------------------------------------------------- */

export interface TripActionsMenuProps {
  trip: TripCard
}

/**
 * The per-tile menu. Renders nothing at all for a reader who owns none of its items, so an
 * organization-visible trip a colleague is browsing carries no dead control.
 *
 * The trigger names the trip — "Actions for Lisbon in April" — because a grid of tiles otherwise
 * hands a screen-reader user a column of identically-named buttons.
 */
export function TripActionsMenu({ trip }: TripActionsMenuProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const isOwner = trip.role === 'owner'
  if (!isOwner) {
    return null
  }

  async function shelve(archived: boolean): Promise<void> {
    setBusy(true)
    try {
      if (archived) {
        await archiveTripFn({ data: { tripId: trip.id } })
      } else {
        await restoreTripFn({ data: { tripId: trip.id } })
      }
      await router.invalidate()
      toast.success(archived ? 'Trip archived' : 'Trip restored')
    } catch (cause) {
      toast.error(
        messageOf(
          cause,
          archived
            ? 'The trip could not be archived.'
            : 'The trip could not be restored.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            icon={<MoreHorizontal />}
            label={`Actions for ${trip.title}`}
            size="sm"
            variant="glass"
            data-part="trip-actions-trigger"
            loading={busy}
            /**
             * Hidden until wanted above `md`, and never hidden below it: a hover-revealed control on
             * a touch screen is an invisible control. `group-focus-within` is what keeps it reachable
             * by keyboard at every width, so the reveal is not a hover-only affordance.
             */
            className="opacity-100 transition-opacity duration-fast md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:data-[state=open]:opacity-100"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem
            icon={<Pencil />}
            onSelect={() => setEditing(true)}
            disabled={busy}
          >
            Edit
          </DropdownMenuItem>
          {trip.isArchived ? (
            <DropdownMenuItem
              icon={<ArchiveRestore />}
              onSelect={() => void shelve(false)}
              disabled={busy}
            >
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              icon={<Archive />}
              onSelect={() => void shelve(true)}
              disabled={busy}
            >
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editing ? (
        <TripEditSheet trip={trip} open onOpenChange={setEditing} />
      ) : null}
    </>
  )
}
