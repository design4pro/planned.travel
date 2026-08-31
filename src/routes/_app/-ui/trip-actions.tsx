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
 * **The one item every reader gets is the star.** A favourite is a row of the reader's own
 * (PRD #104 decision 5) — it changes nothing on the trip and nobody else can see it — so it is
 * offered to a viewer and to a colleague reading an organization-visible trip alike, and the menu
 * now renders for them where it used to render for nobody but the owner.
 *
 * Copy and Delete arrive in the later slices of `01-S1`.
 */
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Star,
  StarOff,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Alert,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useSheetDirection,
} from '#/components/ui'
import {
  messageOf,
  useAction,
  useOptimistic,
} from '#/components/modules/shared'
import {
  archiveTripFn,
  restoreTripFn,
  setTripFavouriteFn,
  updateTripFn,
} from '../-server/trip-lifecycle'
import { TripFormFields, tripFormPayload, useTripForm } from './trip-form'

import type { TripCard } from '../-server/overview'

/* -------------------------------------------------------------------------------------------------
 * Edit sheet
 * ---------------------------------------------------------------------------------------------- */

export interface TripEditSheetProps {
  trip: TripCard
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The trip's own field set, in a sheet, over the trip it was opened from.
 *
 * The fields are `./trip-form`'s — the same ones the creation dialog asks for, because they are the
 * same questions — and this contributes the chrome, the patch and where the answer lands. Blank
 * clears and an untouched field is left alone, but the sheet shows all five and so sends all five:
 * "untouched" is a property of the *patch*, not of the form, and a sheet that omitted an empty field
 * could never clear a destination.
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
  const form = useTripForm(
    {
      title: trip.title,
      destination: trip.destination ?? '',
      startDate: trip.startDate ?? '',
      endDate: trip.endDate ?? '',
      currency: trip.currency,
    },
    saving,
  )

  async function submit(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await updateTripFn({
        data: { tripId: trip.id, ...tripFormPayload(form) },
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
              if (form.canSave) {
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
                      if (form.canSave) void submit()
                    }}
                  >
                    Try again
                  </Button>
                }
              >
                {error}
              </Alert>
            )}

            <TripFormFields form={form} />
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
            disabled={!form.canSave}
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
 * The per-tile menu, one item of which every reader of the trip can exercise.
 *
 * The trigger names the trip — "Actions for Lisbon in April" — because a grid of tiles otherwise
 * hands a screen-reader user a column of identically-named buttons.
 */
export function TripActionsMenu({ trip }: TripActionsMenuProps) {
  const [editing, setEditing] = useState(false)

  /**
   * The star as the reader has just left it, held only until the loader catches up.
   *
   * `claim` withdraws after `useAction` has awaited the router invalidation, so the item's label
   * goes from Favourite to Unfavourite once and stays there; a failed write withdraws it too, which
   * is the rollback, and the reason arrives in the toast `useAction` raises.
   */
  const stars = useOptimistic<boolean>()
  const favourite = useAction(setTripFavouriteFn, {
    failure: 'That star did not save',
    fallback: 'The trip has been put back the way it was.',
  })
  const archive = useAction(archiveTripFn, {
    success: 'Trip archived',
    failure: 'The trip could not be archived',
  })
  const restore = useAction(restoreTripFn, {
    success: 'Trip restored',
    failure: 'The trip could not be restored',
  })

  const starred = stars.get(trip.id) ?? trip.isFavourite
  const busy = favourite.pending || archive.pending || restore.pending

  async function toggleFavourite(): Promise<void> {
    const next = !starred
    await stars.claim([[trip.id, next]], () =>
      favourite.run({ data: { tripId: trip.id, isFavourite: next } }),
    )
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
            icon={starred ? <StarOff /> : <Star />}
            onSelect={() => void toggleFavourite()}
            disabled={busy}
          >
            {starred ? 'Unfavourite' : 'Favourite'}
          </DropdownMenuItem>

          {/*
            Items the role cannot exercise are absent rather than disabled: the repository is the
            control, the menu the courtesy, and a reader who is not the owner simply has a shorter
            product.
          */}
          {trip.role === 'owner' ? (
            <>
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
                  onSelect={() =>
                    void restore.run({ data: { tripId: trip.id } })
                  }
                  disabled={busy}
                >
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  icon={<Archive />}
                  onSelect={() =>
                    void archive.run({ data: { tripId: trip.id } })
                  }
                  disabled={busy}
                >
                  Archive
                </DropdownMenuItem>
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {editing ? (
        <TripEditSheet trip={trip} open onOpenChange={setEditing} />
      ) : null}
    </>
  )
}
