/**
 * Add or edit one transport.
 *
 * The mode picker at the top decides what the rest of the form asks for: a flight
 * wants airports and a service number, a taxi wants neither. The two endpoints are
 * laid out as they read on a ticket — from on the left, to on the right — and the
 * timing rule is checked live, so a journey that arrives before it departs is
 * caught while it is being typed rather than after a round trip.
 *
 * Each end also names the itinerary day it happens on, and the two are separate
 * answers rather than one and a derivation: the night flight leaves on day 3 and
 * lands on day 4, and only the traveller knows that. Which words the pair is asked
 * in comes from `endpointLabels`, so the legend over an endpoint and the label over
 * its day cannot drift apart — a hire car is picked up and returned.
 *
 * A journey with more than two stations swaps that pair for the **chain editor**.
 * There is no empty chain and no third state to design: a transport that nobody
 * has broken up shows its two endpoints and one quiet action, and the first click
 * produces a two-station chain seeded from what was already recorded. Going back
 * is the same door in the other direction, and it says what it will cost.
 *
 * **The dialog has a second mode**, and it appears only when the trip has real dates: a
 * connection search against a public timetable, which is a search against *today's* timetable for
 * a journey next spring if there is no date to search on. What it saves is the same journey this
 * form writes by hand — an ordinary record with an ordinary chain — so the two modes are two ways
 * to fill one thing in and never two kinds of transport. On an existing journey the second mode
 * **replaces its route in place**: the record keeps its identity, its status and its booking
 * fields, which is the whole point of re-searching rather than starting again.
 *
 * The save is two writes, in this order: the record, then its chain. They are
 * separate because they are separate rules — a transport is a row and a chain is
 * a set of rows with an invariant — and the second failing leaves the dialog open
 * with the whole chain exactly as typed. A chain is expensive to retype and
 * losing it to a network blip is unforgivable.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'

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
  Field,
  Input,
  SimpleSelect,
  Textarea,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  createLegFn,
  saveLegChainFn,
  updateLegFn,
} from '#/server/fns/transports'
import { NOT_SET, fromSelectValue, toSelectValue, useAction } from '../shared'
import { ChainEditor } from './chain-editor'
import { ConnectionSearch } from './connection-search'
import { formatGap, legTimingError } from './connections'
import {
  STATUS_LABELS,
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  blockingLegErrors,
  breakIntoLegs,
  chainFromTransport,
  chainPayload,
  dayLabel,
  emptyChain,
  emptyLegDraft,
  endpointLabels,
  flatChain,
  hasChainErrors,
  hasLegErrors,
  isTransportMode,
  isTransportStatus,
  kilometresToMetres,
  metresToKilometres,
  modeLabel,
  suggestLegTitle,
  usesCodes,
  usesSeat,
  usesService,
  validateChain,
  validateLegDraft,
} from './leg-form'
import { MODE_ICON } from './mode-icon'
import { legDurationMinutes } from './leg-timing'

import type { ChainDraft, ChainOwnedField, LegDraft } from './leg-form'
import type { TransportData, TransportDayData } from './types'

/** Which of the dialog's two ways of filling a journey in is on screen. */
type DialogMode = 'form' | 'search'

/**
 * The chain a dialog opens on: the record's own, or two blank stations for a
 * transport that does not exist yet.
 */
function chainFor(transport: TransportData | undefined): ChainDraft {
  return transport === undefined ? emptyChain() : chainFromTransport(transport)
}

/**
 * The same door in the other direction: the journey as one movement again.
 *
 * Deliberately not {@link chainFor}, which reads a journey that *has* rows back
 * as the chain it is — asking it for the way out would hand back the very chain
 * being put away. The record's own two endpoints are what a collapsed journey
 * is, and an unbroken chain is saved as no rows at all, which removes the ones
 * it used to have.
 */
function unbrokenChainFor(transport: TransportData | undefined): ChainDraft {
  return transport === undefined ? emptyChain() : flatChain(transport)
}

function draftFrom(
  transport: TransportData,
  fallbackCurrency: string,
): LegDraft {
  const currency = transport.currency ?? fallbackCurrency
  return {
    mode: isTransportMode(transport.mode) ? transport.mode : 'other',
    status: isTransportStatus(transport.status) ? transport.status : 'pending',
    title: transport.title,
    departureDayId: transport.departureDayId ?? '',
    arrivalDayId: transport.arrivalDayId ?? '',
    carrier: transport.carrier ?? '',
    serviceNumber: transport.serviceNumber ?? '',
    bookingCode: transport.bookingCode ?? '',
    seat: transport.seat ?? '',
    departureName: transport.departureName ?? '',
    departureCode: transport.departureCode ?? '',
    departureDate: transport.departureDate ?? '',
    departureTime: transport.departureTime ?? '',
    arrivalName: transport.arrivalName ?? '',
    arrivalCode: transport.arrivalCode ?? '',
    arrivalDate: transport.arrivalDate ?? '',
    arrivalTime: transport.arrivalTime ?? '',
    distanceKm: metresToKilometres(transport.distanceMetres),
    price:
      transport.priceMinor === null || transport.priceMinor === 0
        ? ''
        : String(transport.priceMinor / 100),
    currency,
    notes: transport.notes ?? '',
  }
}

export function LegDialog({
  tripId,
  transport,
  days,
  currency,
  open,
  onOpenChange,
}: {
  tripId: string
  /** Absent for a new transport. */
  transport?: TransportData
  /** The trip's days, in order. Empty while the trip has none. */
  days: ReadonlyArray<TransportDayData>
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const editing = transport !== undefined
  const formId = useId()

  const [draft, setDraft] = useState<LegDraft>(() => emptyLegDraft(currency))
  const [chain, setChain] = useState<ChainDraft>(() => chainFor(transport))
  const [touched, setTouched] = useState(false)
  const [fillMode, setFillMode] = useState<DialogMode>('form')

  useEffect(() => {
    if (!open) {
      return
    }
    setDraft(
      transport === undefined
        ? emptyLegDraft(currency)
        : draftFrom(transport, currency),
    )
    setChain(chainFor(transport))
    setTouched(false)
    setFillMode('form')
  }, [open, transport, currency])

  /**
   * The precondition on the second mode, and the reason it is a precondition.
   *
   * A connection search without a date is a search against today's timetable for a journey next
   * spring. A trip whose days carry no dates has no date to search on, so the switch is not shown
   * at all rather than shown and then explained — a disabled affordance for something unavailable
   * is a promise the reader can see and cannot take up.
   */
  const searchable = days.some((day) => day.date !== null)

  const create = useAction(createLegFn, {
    success: 'Transport added',
    description: 'It is in the travel order now.',
    failure: 'The transport was not added',
  })
  const update = useAction(updateLegFn, {
    success: 'Transport updated',
    failure: 'The transport was not updated',
  })
  const saveChain = useAction(saveLegChainFn, {
    failure: 'The legs were not saved',
    fallback: 'The transport was saved; its legs were not.',
  })
  const action = editing ? update : create

  const errors = useMemo(() => validateLegDraft(draft, days), [draft, days])
  const chainErrors = useMemo(
    () => validateChain(chain, draft.mode, days),
    [chain, draft.mode, days],
  )
  const dayOptions = useMemo(
    () => [
      { value: NOT_SET, label: 'No day yet' },
      ...days.map((day) => ({ value: day.id, label: dayLabel(day) })),
    ],
    [days],
  )
  const invalid =
    hasLegErrors(blockingLegErrors(errors, chain)) ||
    (chain.broken && hasChainErrors(chainErrors))
  const labels = endpointLabels(draft.mode)
  const suggestion = suggestLegTitle(draft)

  /** Live, not on submit: the one rule that makes a transport impossible. */
  const timing = legTimingError({
    departureDate: draft.departureDate,
    departureTime: draft.departureTime,
    arrivalDate: draft.arrivalDate,
    arrivalTime: draft.arrivalTime,
  })
  const duration = legDurationMinutes(draft)

  function set<TKey extends keyof LegDraft>(
    key: TKey,
    value: LegDraft[TKey],
  ): void {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function errorFor(key: keyof LegDraft): string | undefined {
    return touched ? errors[key] : undefined
  }

  /**
   * The record's own endpoints and days, which a chain owns once there is one.
   *
   * The repository rewrites the endpoints from the outer stations in the same
   * batch that writes the legs, so this is not the source of truth — it is what
   * keeps the record correct for the moment between the two writes, and for a
   * save whose second half never lands. The two day references have no such
   * second writer, so this is the only place they are decided.
   */
  function recordEndpoints(): Pick<LegDraft, ChainOwnedField> {
    const first = chain.stations.at(0)
    const last = chain.stations.at(-1)
    const firstLeg = chain.legs.at(0)
    const lastLeg = chain.legs.at(-1)
    if (
      !chain.broken ||
      first === undefined ||
      last === undefined ||
      firstLeg === undefined ||
      lastLeg === undefined
    ) {
      return {
        departureName: draft.departureName,
        departureCode: draft.departureCode,
        departureDate: draft.departureDate,
        departureTime: draft.departureTime,
        departureDayId: draft.departureDayId,
        arrivalName: draft.arrivalName,
        arrivalCode: draft.arrivalCode,
        arrivalDate: draft.arrivalDate,
        arrivalTime: draft.arrivalTime,
        arrivalDayId: draft.arrivalDayId,
      }
    }
    return {
      departureName: first.name.trim(),
      departureCode: first.code.trim(),
      departureDate: firstLeg.departureDate,
      departureTime: firstLeg.departureTime,
      departureDayId: firstLeg.departureDayId,
      arrivalName: last.name.trim(),
      arrivalCode: last.code.trim(),
      arrivalDate: lastLeg.arrivalDate,
      arrivalTime: lastLeg.arrivalTime,
      arrivalDayId: lastLeg.arrivalDayId,
    }
  }

  async function submit(): Promise<void> {
    setTouched(true)
    if (invalid) {
      return
    }
    const priceMinor = Math.round(
      Number.parseFloat(draft.price.trim().replace(',', '.') || '0') * 100,
    )
    const payload = {
      tripId,
      mode: draft.mode,
      status: draft.status,
      title: draft.title.trim(),
      carrier: draft.carrier,
      serviceNumber: draft.serviceNumber,
      bookingCode: draft.bookingCode,
      seat: draft.seat,
      ...recordEndpoints(),
      distanceMetres: kilometresToMetres(draft.distanceKm),
      priceMinor:
        Number.isFinite(priceMinor) && priceMinor > 0 ? priceMinor : 0,
      currency:
        Number.isFinite(priceMinor) && priceMinor > 0 ? draft.currency : '',
      notes: draft.notes,
    }
    const result = editing
      ? await update.run({ data: { ...payload, transportId: transport.id } })
      : await create.run({ data: payload })
    if (result === null) {
      return
    }

    /*
     * The chain is written after the record, because it needs the record's id
     * and because a leg parented onto nothing is not a thing this model can
     * express. An unbroken journey still posts — an empty chain is the statement
     * "this transport has no legs", which is what removes the rows a journey
     * used to have when the traveller puts it back together.
     */
    const transportId = editing ? transport.id : result.transportId
    const chained = await saveChain.run({
      data: { tripId, transportId, ...chainPayload(chain) },
    })
    if (chained === null) {
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit this transport' : 'Add a transport'}
          </DialogTitle>
          <DialogDescription>
            Flights, trains, ferries and the drive from the airport. Times are
            the local ones printed on the ticket.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {searchable ? (
            <div
              role="group"
              aria-label="How to fill this in"
              className="mb-5 flex w-fit gap-1 rounded-full bg-surface-2 p-1"
            >
              {(
                [
                  { value: 'form', label: 'Enter it yourself' },
                  {
                    value: 'search',
                    label: editing ? 'Search again' : 'Search connections',
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-part={`transport-mode-${option.value}`}
                  aria-pressed={fillMode === option.value}
                  onClick={() => setFillMode(option.value)}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-caption font-semibold focus-ring',
                    'transition-[background-color,color] duration-base ease-out-quint',
                    fillMode === option.value
                      ? 'bg-surface text-ink shadow-e1'
                      : 'text-ink-3 hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {fillMode === 'search' ? (
            <ConnectionSearch
              tripId={tripId}
              transportId={editing ? transport.id : undefined}
              days={days}
              onSaved={() => onOpenChange(false)}
            />
          ) : (
            <form
              id={formId}
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              {action.error === null ? null : (
                <Alert tone="danger" title="That did not save">
                  {action.error}
                </Alert>
              )}

              <fieldset className="min-w-0">
                <legend className="mb-2 text-label font-medium text-ink">
                  How are you travelling
                </legend>
                <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {TRANSPORT_MODES.map((mode) => {
                    const Icon = MODE_ICON[mode]
                    const active = draft.mode === mode
                    return (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set('mode', mode)}
                        className={cn(
                          'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-caption font-semibold whitespace-nowrap focus-ring',
                          'transition-[background-color,border-color,color] duration-base ease-out-quint',
                          active
                            ? 'border-transparent bg-accent text-accent-on'
                            : 'border-edge bg-surface text-ink-2 hover:border-edge-strong hover:text-ink',
                        )}
                      >
                        <Icon aria-hidden className="size-3.5" />
                        {modeLabel(mode)}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <Field
                label="Name"
                required
                error={errorFor('title')}
                action={
                  suggestion === '' ||
                  draft.title === suggestion ? undefined : (
                    <button
                      type="button"
                      className="rounded-sm text-caption font-semibold text-brand underline decoration-brand/35 underline-offset-2 focus-ring hover:decoration-brand"
                      onClick={() => set('title', suggestion)}
                    >
                      Use “{suggestion}”
                    </button>
                  )
                }
              >
                <Input
                  value={draft.title}
                  onChange={(event) => set('title', event.target.value)}
                  placeholder="SAS from LHR to HND"
                  maxLength={160}
                  autoComplete="off"
                  required
                />
              </Field>

              {chain.broken ? (
                <>
                  <ChainEditor
                    chain={chain}
                    mode={draft.mode}
                    days={days}
                    errors={chainErrors}
                    showErrors={touched}
                    onChange={setChain}
                  />
                  <button
                    type="button"
                    data-part="unsplit-leg"
                    className="self-start rounded-sm text-caption font-semibold text-ink-3 underline decoration-edge-strong underline-offset-2 focus-ring hover:text-ink hover:decoration-ink-4"
                    onClick={() => setChain(unbrokenChainFor(transport))}
                  >
                    Put it back as one journey
                  </button>
                </>
              ) : (
                <>
                  {/* The two ends, side by side, in the order they happen. */}
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
                    <fieldset className="flex min-w-0 flex-col gap-3">
                      <legend className="mb-1 text-micro font-semibold tracking-label text-ink-3 uppercase">
                        {labels.from}
                      </legend>
                      <Field label="Place" error={errorFor('departureName')}>
                        <Input
                          value={draft.departureName}
                          onChange={(event) =>
                            set('departureName', event.target.value)
                          }
                          placeholder="London Heathrow"
                          maxLength={200}
                          autoComplete="off"
                        />
                      </Field>
                      {usesCodes(draft.mode) ? (
                        <Field label="Code" error={errorFor('departureCode')}>
                          <Input
                            value={draft.departureCode}
                            onChange={(event) =>
                              set(
                                'departureCode',
                                event.target.value.toUpperCase(),
                              )
                            }
                            placeholder="LHR"
                            maxLength={8}
                            autoComplete="off"
                            className="font-mono tracking-wide uppercase"
                          />
                        </Field>
                      ) : null}
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <Field label="Date" error={errorFor('departureDate')}>
                          <Input
                            type="date"
                            value={draft.departureDate}
                            onChange={(event) =>
                              set('departureDate', event.target.value)
                            }
                          />
                        </Field>
                        <Field label="Time" error={errorFor('departureTime')}>
                          <Input
                            type="time"
                            value={draft.departureTime}
                            onChange={(event) =>
                              set('departureTime', event.target.value)
                            }
                            className="w-28"
                          />
                        </Field>
                      </div>
                      {days.length === 0 ? null : (
                        <Field label={labels.fromDay}>
                          <SimpleSelect
                            options={dayOptions}
                            value={toSelectValue(draft.departureDayId)}
                            onValueChange={(next) =>
                              set('departureDayId', fromSelectValue(next))
                            }
                            ariaLabel={labels.fromDay}
                          />
                        </Field>
                      )}
                    </fieldset>

                    <div className="hidden self-center pt-8 sm:block">
                      <ArrowRight aria-hidden className="size-5 text-ink-4" />
                    </div>

                    <fieldset className="flex min-w-0 flex-col gap-3">
                      <legend className="mb-1 text-micro font-semibold tracking-label text-ink-3 uppercase">
                        {labels.to}
                      </legend>
                      <Field label="Place" error={errorFor('arrivalName')}>
                        <Input
                          value={draft.arrivalName}
                          onChange={(event) =>
                            set('arrivalName', event.target.value)
                          }
                          placeholder="Tokyo Haneda"
                          maxLength={200}
                          autoComplete="off"
                        />
                      </Field>
                      {usesCodes(draft.mode) ? (
                        <Field label="Code" error={errorFor('arrivalCode')}>
                          <Input
                            value={draft.arrivalCode}
                            onChange={(event) =>
                              set(
                                'arrivalCode',
                                event.target.value.toUpperCase(),
                              )
                            }
                            placeholder="HND"
                            maxLength={8}
                            autoComplete="off"
                            className="font-mono tracking-wide uppercase"
                          />
                        </Field>
                      ) : null}
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <Field label="Date" error={errorFor('arrivalDate')}>
                          <Input
                            type="date"
                            value={draft.arrivalDate}
                            min={
                              draft.departureDate === ''
                                ? undefined
                                : draft.departureDate
                            }
                            onChange={(event) =>
                              set('arrivalDate', event.target.value)
                            }
                          />
                        </Field>
                        <Field label="Time" error={errorFor('arrivalTime')}>
                          <Input
                            type="time"
                            value={draft.arrivalTime}
                            onChange={(event) =>
                              set('arrivalTime', event.target.value)
                            }
                            className="w-28"
                          />
                        </Field>
                      </div>
                      {days.length === 0 ? null : (
                        <Field
                          label={labels.toDay}
                          error={errorFor('arrivalDayId')}
                          hint="A journey that lands the next morning says so here."
                        >
                          <SimpleSelect
                            options={dayOptions}
                            value={toSelectValue(draft.arrivalDayId)}
                            onValueChange={(next) =>
                              set('arrivalDayId', fromSelectValue(next))
                            }
                            ariaLabel={labels.toDay}
                          />
                        </Field>
                      )}
                    </fieldset>
                  </div>

                  {timing !== null ? (
                    <Alert tone="danger" title="Check the times">
                      {timing} Move one of them so the transport can actually be
                      caught.
                    </Alert>
                  ) : duration === null ? null : (
                    <p className="text-caption text-ink-3">
                      That is{' '}
                      <span className="font-semibold tabular-nums text-ink">
                        {formatGap(duration)}
                      </span>{' '}
                      door to door.
                    </p>
                  )}

                  {/*
                  The empty state of a chain, which is a real state and not a
                  blank panel: the journey already has two endpoints, so the
                  first click produces a two-station chain seeded from them
                  rather than an empty editor asking to be filled.
                */}
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3">
                    <p className="min-w-0 text-caption text-ink-3">
                      Changing trains on the way? Record each part with its own
                      service number, platform, seat and clock.
                    </p>
                    <Button
                      type="button"
                      data-part="split-leg"
                      variant="secondary"
                      size="sm"
                      shape="pill"
                      onClick={() => setChain(breakIntoLegs(chain))}
                    >
                      Break this into legs
                    </Button>
                  </div>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {usesService(draft.mode) ? (
                  <>
                    <Field label="Carrier" error={errorFor('carrier')}>
                      <Input
                        value={draft.carrier}
                        onChange={(event) => set('carrier', event.target.value)}
                        placeholder="SAS"
                        maxLength={200}
                        autoComplete="off"
                      />
                    </Field>
                    <Field
                      label="Service number"
                      error={errorFor('serviceNumber')}
                    >
                      <Input
                        value={draft.serviceNumber}
                        onChange={(event) =>
                          set('serviceNumber', event.target.value)
                        }
                        placeholder="SK983"
                        maxLength={200}
                        autoComplete="off"
                        className="font-mono tracking-wide uppercase"
                      />
                    </Field>
                  </>
                ) : null}
                <Field
                  label="Booking reference"
                  error={errorFor('bookingCode')}
                  hint="The code you will read back at the desk."
                >
                  <Input
                    value={draft.bookingCode}
                    onChange={(event) => set('bookingCode', event.target.value)}
                    placeholder="TXK9QP"
                    maxLength={200}
                    autoComplete="off"
                    className="font-mono tracking-wide uppercase"
                  />
                </Field>
                {usesSeat(draft.mode) ? (
                  <Field label="Seat" error={errorFor('seat')}>
                    <Input
                      value={draft.seat}
                      onChange={(event) => set('seat', event.target.value)}
                      placeholder="21A"
                      maxLength={200}
                      autoComplete="off"
                      className="font-mono tracking-wide uppercase"
                    />
                  </Field>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Distance" error={errorFor('distanceKm')}>
                  <Input
                    value={draft.distanceKm}
                    onChange={(event) => set('distanceKm', event.target.value)}
                    inputMode="decimal"
                    placeholder="9560"
                    trailing={
                      <span className="text-caption text-ink-4">km</span>
                    }
                  />
                </Field>
                <Field label="Price" error={errorFor('price')}>
                  <Input
                    value={draft.price}
                    onChange={(event) => set('price', event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    trailing={
                      <span className="text-caption text-ink-4">
                        {draft.currency}
                      </span>
                    }
                  />
                </Field>
                <Field label="Status">
                  <SimpleSelect
                    options={TRANSPORT_STATUSES.map((value) => ({
                      value,
                      label: STATUS_LABELS[value],
                    }))}
                    value={draft.status}
                    onValueChange={(next) => {
                      if (isTransportStatus(next)) {
                        set('status', next)
                      }
                    }}
                    ariaLabel="Status"
                  />
                </Field>
              </div>

              <Field label="Notes">
                <Textarea
                  value={draft.notes}
                  onChange={(event) => set('notes', event.target.value)}
                  placeholder="Aisle seat requested. Bags checked through to Kyoto."
                  maxLength={4000}
                  rows={3}
                  autoResize
                  maxRows={8}
                />
              </Field>
            </form>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {fillMode === 'search' ? 'Close' : 'Cancel'}
          </Button>
          {/*
            The search mode has no footer save, and that is the honest shape: what is saved there
            is one chosen connection, so the button belongs on the row that names it rather than
            at the bottom of a dialog with nothing selected.
          */}
          {fillMode === 'search' ? null : (
            <Button
              type="submit"
              form={formId}
              variant="primary"
              shape="pill"
              disabled={touched && invalid}
              loading={action.pending}
              loadingLabel="Saving the transport"
            >
              {editing ? 'Save transport' : 'Add transport'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The screen's primary action, for the module header.
 *
 * `data-part` rather than a class name: the visual gate opens this dialog to
 * photograph a state that does not exist at rest, and a selector picked off the
 * styling would break the evidence the next time the button is restyled.
 */
export function NewLegAction({ onClick }: { onClick: () => void }) {
  return (
    <Button
      data-part="new-transport"
      variant="primary"
      shape="pill"
      onClick={onClick}
    >
      <Plus aria-hidden strokeWidth={2.5} />
      Add transport
    </Button>
  )
}
