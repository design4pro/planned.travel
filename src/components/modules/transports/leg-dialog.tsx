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
import { createLegFn, updateLegFn } from '#/server/fns/transports'
import { NOT_SET, fromSelectValue, toSelectValue, useAction } from '../shared'
import { formatGap, legTimingError } from './connections'
import {
  STATUS_LABELS,
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  dayLabel,
  emptyLegDraft,
  endpointLabels,
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
  validateLegDraft,
} from './leg-form'
import { MODE_ICON } from './mode-icon'
import { legDurationMinutes } from './leg-timing'

import type { TransportDayOption } from '#/server/fns/transports'
import type { LegDraft } from './leg-form'
import type { TransportData } from './types'

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
  days: ReadonlyArray<TransportDayOption>
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const editing = transport !== undefined
  const formId = useId()

  const [draft, setDraft] = useState<LegDraft>(() => emptyLegDraft(currency))
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setDraft(
      transport === undefined
        ? emptyLegDraft(currency)
        : draftFrom(transport, currency),
    )
    setTouched(false)
  }, [open, transport, currency])

  const create = useAction(createLegFn, {
    success: 'Transport added',
    description: 'It is in the travel order now.',
    failure: 'The transport was not added',
  })
  const update = useAction(updateLegFn, {
    success: 'Transport updated',
    failure: 'The transport was not updated',
  })
  const action = editing ? update : create

  const errors = useMemo(() => validateLegDraft(draft, days), [draft, days])
  const dayOptions = useMemo(
    () => [
      { value: NOT_SET, label: 'No day yet' },
      ...days.map((day) => ({ value: day.id, label: dayLabel(day) })),
    ],
    [days],
  )
  const invalid = hasLegErrors(errors)
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
      departureName: draft.departureName,
      departureCode: draft.departureCode,
      departureDate: draft.departureDate,
      departureTime: draft.departureTime,
      arrivalName: draft.arrivalName,
      arrivalCode: draft.arrivalCode,
      arrivalDate: draft.arrivalDate,
      arrivalTime: draft.arrivalTime,
      departureDayId: draft.departureDayId,
      arrivalDayId: draft.arrivalDayId,
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
    if (result !== null) {
      onOpenChange(false)
    }
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
                suggestion === '' || draft.title === suggestion ? undefined : (
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
                        set('departureCode', event.target.value.toUpperCase())
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
                    onChange={(event) => set('arrivalName', event.target.value)}
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
                        set('arrivalCode', event.target.value.toUpperCase())
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
                  trailing={<span className="text-caption text-ink-4">km</span>}
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
            disabled={touched && invalid}
            loading={action.pending}
            loadingLabel="Saving the transport"
          >
            {editing ? 'Save transport' : 'Add transport'}
          </Button>
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
