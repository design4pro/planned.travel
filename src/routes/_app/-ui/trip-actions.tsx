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
 * **Two items every reader gets: the copy and the star.** A favourite is a row of the reader's own
 * (PRD #104 decision 5) — it changes nothing on the trip and nobody else can see it — so it is
 * offered to a viewer and to a colleague reading an organization-visible trip alike, and the menu
 * now renders for them where it used to render for nobody but the owner. A copy writes a trip of
 * the reader's own rather than touching this one (decision 6), so it sits above the star on the
 * same footing.
 *
 * **Delete is the one item that asks before it acts, and how hard it asks is the server's call.**
 * `TripDeleteDialog` reads a summary of what the trip carries and renders whichever ceremony that
 * summary asks for (PRD #104 decision 10). It never derives the threshold itself: the same server
 * function that hands it `requiresTitle` re-derives the rule on the write, so a browser that skipped
 * the dialog gains nothing.
 */
import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  Copy,
  MoreHorizontal,
  Pencil,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  SkeletonText,
  useSheetDirection,
} from '#/components/ui'
import {
  messageOf,
  useAction,
  useOptimistic,
} from '#/components/modules/shared'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatNumber } from '../-lib/format'
import {
  archiveTripFn,
  deleteTripFn,
  restoreTripFn,
  setTripFavouriteFn,
  tripDeleteSummaryFn,
  updateTripFn,
} from '../-server/trip-lifecycle'
import { TripCopyDialog } from './trip-copy-dialog'
import { TripFormFields, tripFormPayload, useTripForm } from './trip-form'

import type { TripCard } from '../-server/overview'
import type { TripDeleteSummary } from '../-server/trip-lifecycle'

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
  const t = useTranslate()
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
      toast.success(t('shell.editTrip.saved'))
    } catch (cause) {
      setError(messageOf(cause, t('shell.editTrip.error')))
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
          <SheetTitle>{t('shell.editTrip.title')}</SheetTitle>
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
                title={t('shell.editTrip.errorTitle')}
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
                    {t('shell.editTrip.retry')}
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
            {t('shell.editTrip.cancel')}
          </Button>
          <Button
            type="submit"
            form={`trip-edit-${trip.id}`}
            variant="primary"
            shape="pill"
            disabled={!form.canSave}
            loading={saving}
            loadingLabel={t('shell.editTrip.saving')}
          >
            {t('shell.editTrip.submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Delete dialog
 * ---------------------------------------------------------------------------------------------- */

export interface TripDeleteDialogProps {
  trip: TripCard
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * One line of the inventory, drawn only when there is something to count.
 *
 * The figure and the noun are two elements because the column reads as a column: `tabular-nums`
 * lines the digits up under each other, and a noun inside that span would inherit a width no word
 * wants. Which noun it is remains the *catalogue's* answer rather than this component's - the
 * caller passes an already-plural string, so Polish gets its `few`/`many` split and Arabic its six
 * categories from the same call, where a `count === 1` ternary here would have hard-coded English's
 * two.
 */
function Carried({ count, noun }: { count: number; noun: string }) {
  const locale = useLocale()
  if (count === 0) {
    return null
  }
  return (
    <li className="flex items-baseline gap-2">
      <span className="tabular-nums font-medium text-ink">
        {formatNumber(count, locale)}
      </span>
      <span className="text-ink-2">{noun}</span>
    </li>
  )
}

/**
 * The confirmation, graduated by what the trip carries (PRD #104 decision 10).
 *
 * **The threshold is read, never computed.** The dialog asks the server what the trip holds and
 * renders the ceremony that answer asks for: below it, one paragraph and an armed button; at or above
 * it, the same paragraph plus a field that has to match the trip's name character for character. A
 * copy of the rule in this file would be a copy that could drift, and the drift that matters is the
 * one where the browser thinks a trip is empty and the server knows it is not — which is why
 * `deleteTripFn` asks the same question again and refuses on its own answer.
 *
 * The inventory is named as counts rather than as a warning, because "12 bookings, 3 files and 2
 * people" is a thing a reader can recognise as theirs, and "this cannot be undone" is not.
 */
export function TripDeleteDialog({
  trip,
  open,
  onOpenChange,
}: TripDeleteDialogProps) {
  const t = useTranslate()
  const [summary, setSummary] = useState<TripDeleteSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')

  const remove = useAction(deleteTripFn, {
    success: t('shell.deleteTrip.deleted'),
    failure: t('shell.deleteTrip.failed'),
    onSuccess: () => onOpenChange(false),
  })

  useEffect(() => {
    if (!open) {
      return
    }
    let live = true
    setSummary(null)
    setSummaryError(null)
    setTyped('')

    tripDeleteSummaryFn({ data: { tripId: trip.id } })
      .then((answer) => {
        if (live) setSummary(answer)
      })
      .catch((cause: unknown) => {
        if (live) {
          setSummaryError(messageOf(cause, t('shell.deleteTrip.summaryError')))
        }
      })

    // The reader can close the dialog before the answer lands, and a `setState` after that is a
    // warning in the console and a claim about a trip nobody is looking at any more.
    return () => {
      live = false
    }
    // `t` is deliberately not a dependency: it is stable for a locale, and a locale change
    // remounts the tree the provider holds, so naming it could only re-read the summary for a
    // reason that never happens while this dialog is open.
  }, [open, trip.id])

  /**
   * Whether the button is live.
   *
   * Never before the summary lands: arming a terminal delete against an inventory nobody has read
   * would make the light dialog the default, which is precisely backwards.
   */
  const armed =
    summary !== null &&
    (!summary.requiresTitle || typed.trim() === summary.title)

  function submit(): void {
    // `armed` is false until the summary lands, which is what narrows it here.
    if (!armed) return
    void remove.run({
      data: {
        tripId: trip.id,
        ...(summary.requiresTitle ? { confirmTitle: typed.trim() } : {}),
      },
    })
  }

  /** The footer's button submits the body's form, so the two need one id between them. */
  const formId = `trip-delete-${trip.id}`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A delete in flight owns the dialog: it is terminal, and a reader who dismissed it mid-write
        // would be left unable to tell whether it happened.
        if (remove.pending) return
        onOpenChange(next)
      }}
    >
      <DialogContent size="sm" data-part="trip-delete-dialog">
        <DialogHeader>
          <DialogTitle>
            {t('shell.deleteTrip.title', { title: trip.title })}
          </DialogTitle>
          <DialogDescription>
            {t('shell.deleteTrip.description')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            {summaryError === null ? null : (
              <Alert tone="danger" title={t('shell.deleteTrip.errorTitle')}>
                {summaryError}
              </Alert>
            )}

            {summary === null && summaryError === null ? (
              <SkeletonText
                lines={3}
                role="status"
                aria-label={t('shell.deleteTrip.reading')}
              />
            ) : null}

            {summary === null ? null : (
              <>
                <ul className="flex flex-col gap-1 rounded-lg bg-surface-2 p-3 text-sm">
                  <Carried
                    count={summary.reservations}
                    noun={t('shell.deleteTrip.carried.reservations', {
                      count: summary.reservations,
                    })}
                  />
                  <Carried
                    count={summary.transports}
                    noun={t('shell.deleteTrip.carried.transports', {
                      count: summary.transports,
                    })}
                  />
                  <Carried
                    count={summary.expenses}
                    noun={t('shell.deleteTrip.carried.expenses', {
                      count: summary.expenses,
                    })}
                  />
                  <Carried
                    count={summary.files}
                    noun={t('shell.deleteTrip.carried.files', {
                      count: summary.files,
                    })}
                  />
                  <Carried
                    count={summary.members}
                    noun={t('shell.deleteTrip.carried.members', {
                      count: summary.members,
                    })}
                  />
                </ul>

                {summary.requiresTitle ? (
                  <Field
                    label={t('shell.deleteTrip.confirmLabel')}
                    hint={summary.title}
                    required
                  >
                    <Input
                      value={typed}
                      onChange={(event) => setTyped(event.target.value)}
                      autoComplete="off"
                      maxLength={120}
                      disabled={remove.pending}
                    />
                  </Field>
                ) : null}
              </>
            )}
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            disabled={remove.pending}
            onClick={() => onOpenChange(false)}
          >
            {t('ui.action.keep')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="danger"
            shape="pill"
            disabled={!armed}
            loading={remove.pending}
            loadingLabel={t('shell.deleteTrip.deleting')}
          >
            {t('shell.tripActions.deleteForGood')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Action menu
 * ---------------------------------------------------------------------------------------------- */

/**
 * The trip's star, as one value with one owner.
 *
 * The badge on the tile and the menu item that flips it are siblings, and each used to answer "is
 * this trip starred right now?" for itself — the menu from an optimistic overlay it kept to itself,
 * the badge from the loader payload. So a press lit the label at once and left the badge two pixels
 * away dark for the whole write plus `router.invalidate()`. The overlay therefore belongs to
 * whoever renders both of them (`TripTile`), which hands the same `starred` to each: "the trip's
 * current star" is one concept, and docs/SPEC.md §8 gives a concept one owner.
 */
export interface TripFavourite {
  /** What the reader should see now — their press if one is in flight, the server's answer otherwise. */
  readonly starred: boolean
  /** True while the write this hook started is in flight. */
  readonly pending: boolean
  readonly toggle: () => void
}

/**
 * The star as the reader has just left it, held only until the loader catches up.
 *
 * `claim` withdraws after `useAction` has awaited the router invalidation, so the star goes from
 * empty to lit once and stays there; a failed write withdraws it too, which is the rollback, and
 * the reason arrives in the toast `useAction` raises.
 */
export function useTripFavourite(trip: TripCard): TripFavourite {
  const t = useTranslate()
  const stars = useOptimistic<boolean>()
  const favourite = useAction(setTripFavouriteFn, {
    failure: t('shell.tripActions.starFailed'),
    fallback: t('shell.tripActions.starFallback'),
  })

  const starred = stars.get(trip.id) ?? trip.isFavourite

  return {
    starred,
    pending: favourite.pending,
    toggle: () => {
      const next = !starred
      void stars.claim([[trip.id, next]], () =>
        favourite.run({ data: { tripId: trip.id, isFavourite: next } }),
      )
    },
  }
}

export interface TripActionsMenuProps {
  trip: TripCard
  /** Owned by the tile, so the menu item and the tile's badge can never disagree. */
  favourite: TripFavourite
}

/**
 * The per-tile menu, one item of which every reader of the trip can exercise.
 *
 * The trigger names the trip — "Actions for Lisbon in April" — because a grid of tiles otherwise
 * hands a screen-reader user a column of identically-named buttons.
 */
export function TripActionsMenu({ trip, favourite }: TripActionsMenuProps) {
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copying, setCopying] = useState(false)

  const archive = useAction(archiveTripFn, {
    success: t('shell.tripActions.archived'),
    failure: t('shell.tripActions.archiveFailed'),
  })
  const restore = useAction(restoreTripFn, {
    success: t('shell.tripActions.restored'),
    failure: t('shell.tripActions.restoreFailed'),
  })

  const starred = favourite.starred
  const busy = favourite.pending || archive.pending || restore.pending

  /**
   * Everything but Delete is off while the `trip-copy` handler is still filling this trip in.
   *
   * A trip mid-copy is not yet the thing any of those items claim to act on: copying it would
   * duplicate whatever has landed so far, and editing or archiving it races the handler's own
   * writes. Delete stays, because abandoning a copy that is taking too long is the one thing a
   * reader may legitimately want from this menu — `deleteTrip` clears the target outright, which is
   * the same compensation the handler's own permanent path runs.
   *
   * Separate from {@link busy} because that one also spins the trigger, and a copy is not a write
   * this menu started: a permanently spinning button would claim that it was.
   */
  const frozen = busy || trip.copyPending

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            icon={<MoreHorizontal />}
            label={t('shell.tripActions.trigger', { title: trip.title })}
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
          {/*
            Why the items below are dimmed, said in words rather than left to be inferred from a
            menu that has gone quiet. A label rather than a tooltip on each disabled item: a
            disabled menu item is skipped by keyboard navigation, so a hint hung off it would only
            ever reach a reader with a pointer.
          */}
          {trip.copyPending ? (
            <DropdownMenuLabel>
              {t('shell.trips.card.copyingReason')}
            </DropdownMenuLabel>
          ) : null}

          {/*
            Copy is first and is offered to every reader, because every reader may copy (PRD #104
            decision 6) — so it is the first of a viewer's two items rather than an owner's
            privilege.
          */}
          <DropdownMenuItem
            icon={<Copy />}
            onSelect={() => setCopying(true)}
            disabled={frozen}
          >
            {t('shell.tripActions.copy')}
          </DropdownMenuItem>

          <DropdownMenuItem
            icon={starred ? <StarOff /> : <Star />}
            onSelect={() => favourite.toggle()}
            disabled={frozen}
          >
            {starred
              ? t('shell.tripActions.unfavourite')
              : t('shell.tripActions.favourite')}
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
                disabled={frozen}
              >
                {t('shell.tripActions.edit')}
              </DropdownMenuItem>
              {trip.isArchived ? (
                <DropdownMenuItem
                  icon={<ArchiveRestore />}
                  onSelect={() =>
                    void restore.run({ data: { tripId: trip.id } })
                  }
                  disabled={frozen}
                >
                  {t('shell.tripActions.restore')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  icon={<Archive />}
                  onSelect={() =>
                    void archive.run({ data: { tripId: trip.id } })
                  }
                  disabled={frozen}
                >
                  {t('shell.tripActions.archive')}
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/*
                Terminal, and labelled differently from the archive it sits under: from an archived
                row this is the last copy, so it says so. The confirmation is the dialog's, and how
                much of one there is is the server's answer rather than this menu's guess.
              */}
              <DropdownMenuItem
                icon={<Trash2 />}
                destructive
                onSelect={() => setDeleting(true)}
                disabled={busy}
              >
                {trip.isArchived
                  ? t('shell.tripActions.deleteForGood')
                  : t('shell.tripActions.delete')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {copying ? (
        <TripCopyDialog trip={trip} open onOpenChange={setCopying} />
      ) : null}

      {editing ? (
        <TripEditSheet trip={trip} open onOpenChange={setEditing} />
      ) : null}

      {deleting ? (
        <TripDeleteDialog trip={trip} open onOpenChange={setDeleting} />
      ) : null}
    </>
  )
}
