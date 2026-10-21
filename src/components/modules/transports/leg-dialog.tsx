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
 * The save is one call: the record and its chain go to the server together and land together or
 * not at all. Validation and network failures keep the draft open. An authored server refusal
 * instead closes the invalid action and refreshes the desk capability before another write is
 * offered; retrying that refresh repeats a read, never the refused save.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'
import { nanoid } from 'nanoid'

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
import { useLocale, useTranslate } from '#/lib/i18n'
import { saveTransportFn } from '#/server/fns/transports'
import { NOT_SET, fromSelectValue, toSelectValue, useAction } from '../shared'
import { ChainEditor } from './chain-editor'
import { ConnectionSearch } from './connection-search'
import { formatGap, transportTimingError } from './connections'
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
  emptyTransportDraft,
  endpointLabels,
  flatChain,
  hasChainErrors,
  hasTransportErrors,
  isTransportMode,
  isTransportStatus,
  metresToKilometres,
  modeLabel,
  suggestTransportTitle,
  transportPayload,
  usesCodes,
  usesSeat,
  usesService,
  validateChain,
  validateTransportDraft,
} from './leg-form'
import { MODE_ICON } from './mode-icon'
import { transportDurationMinutes } from './leg-timing'

import type { ChainDraft, TransportDraft } from './leg-form'
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
): TransportDraft {
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

export function TransportDialog({
  tripId,
  transport,
  days,
  currency,
  canSearchConnections,
  open,
  onOpenChange,
  onWriteError,
}: {
  tripId: string
  /** Absent for a new transport. */
  transport?: TransportData
  /** The trip's days, in order. Empty while the trip has none. */
  days: ReadonlyArray<TransportDayData>
  currency: string
  canSearchConnections: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onWriteError?: (cause: unknown) => void
}) {
  const t = useTranslate()
  const locale = useLocale()
  const editing = transport !== undefined
  const formId = useId()

  const [draft, setDraft] = useState<TransportDraft>(() =>
    emptyTransportDraft(currency),
  )
  const [chain, setChain] = useState<ChainDraft>(() => chainFor(transport))
  const [touched, setTouched] = useState(false)
  const [fillMode, setFillMode] = useState<DialogMode>('form')
  /**
   * The id a new transport is saved under, minted when the dialog opens and kept until it closes.
   *
   * The server treats an id it has seen as an edit of that row, so a second press on the same
   * draft - a double click, Enter after the button, a retry after a failure - rewrites the
   * transport the first press wrote instead of creating another.
   */
  const [draftId, setDraftId] = useState(() => nanoid())
  const transportId = transport?.id ?? draftId

  useEffect(() => {
    if (!open) {
      return
    }
    setDraft(
      transport === undefined
        ? emptyTransportDraft(currency)
        : draftFrom(transport, currency),
    )
    setChain(chainFor(transport))
    setTouched(false)
    setFillMode('form')
    setDraftId(nanoid())
  }, [open, transport, currency])

  /**
   * The precondition on the second mode, and the reason it is a precondition.
   *
   * A connection search without a date is a search against today's timetable for a journey next
   * spring. A trip whose days carry no dates has no date to search on, so the switch is not shown
   * at all rather than shown and then explained — a disabled affordance for something unavailable
   * is a promise the reader can see and cannot take up.
   */
  const searchable =
    canSearchConnections && days.some((day) => day.date !== null)

  const save = useAction(
    saveTransportFn,
    editing
      ? {
          onError: onWriteError,
          success: t('modules.transports.toast.updated'),
          failure: t('modules.transports.toast.updateFailed'),
        }
      : {
          onError: onWriteError,
          success: t('modules.transports.toast.added'),
          description: t('modules.transports.toast.addedBody'),
          failure: t('modules.transports.toast.addFailed'),
        },
  )

  const errors = useMemo(
    () => validateTransportDraft(draft, days),
    [draft, days],
  )
  const chainErrors = useMemo(
    () => validateChain(chain, draft.mode, days),
    [chain, draft.mode, days],
  )
  const dayOptions = useMemo(
    () => [
      { value: NOT_SET, label: t('modules.transports.field.noDay') },
      ...days.map((day) => ({
        value: day.id,
        label: dayLabel(day, t, locale),
      })),
    ],
    [days, t, locale],
  )
  const invalid =
    hasTransportErrors(blockingLegErrors(errors, chain)) ||
    (chain.broken && hasChainErrors(chainErrors))
  const labels = endpointLabels(draft.mode)
  const proposal = suggestTransportTitle(draft)
  const suggestion =
    proposal === null
      ? ''
      : t(proposal.key, {
          ...proposal.params,
          ...(proposal.operatorKey === null
            ? {}
            : { operator: t(proposal.operatorKey) }),
        })

  /** Live, not on submit: the one rule that makes a transport impossible. */
  const timing = transportTimingError({
    departureDate: draft.departureDate,
    departureTime: draft.departureTime,
    arrivalDate: draft.arrivalDate,
    arrivalTime: draft.arrivalTime,
  })
  const duration = transportDurationMinutes(draft)

  function set<TKey extends keyof TransportDraft>(
    key: TKey,
    value: TransportDraft[TKey],
  ): void {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  /**
   * `validateTransportDraft` hands back a key rather than a sentence, so the resolving
   * happens here, where there is a provider.
   */
  function errorFor(key: keyof TransportDraft): string | undefined {
    const error = touched ? errors[key] : undefined
    return error === undefined ? undefined : t(error)
  }

  async function submit(): Promise<void> {
    setTouched(true)
    // Enter in a field submits the form without the button, which is only `loading`: a second
    // call while one is in flight would race the first on the same id.
    if (invalid || save.pending) {
      return
    }
    /*
     * An unbroken journey still sends its chain, empty: that is the statement "this transport has
     * no legs", which removes the rows a journey used to have when the traveller puts it back
     * together.
     */
    const saved = await save.run({
      data: {
        ...transportPayload(draft, chain, tripId),
        transportId,
        intent: editing ? 'edit' : 'create',
        ...chainPayload(chain),
      },
    })
    if (saved === null) {
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t('modules.transports.dialog.editTitle')
              : t('modules.transports.dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('modules.transports.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {searchable ? (
            <div
              role="group"
              aria-label={t('modules.transports.fill.legend')}
              className="mb-5 flex w-fit gap-1 rounded-full bg-surface-2 p-1"
            >
              {(
                [
                  {
                    value: 'form',
                    label: t('modules.transports.fill.manual'),
                  },
                  {
                    value: 'search',
                    label: editing
                      ? t('modules.transports.fill.searchAgain')
                      : t('modules.transports.fill.search'),
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

          {searchable && fillMode === 'search' ? (
            <ConnectionSearch
              tripId={tripId}
              transportId={editing ? transport.id : undefined}
              journey={editing ? transport : undefined}
              days={days}
              onWriteError={onWriteError}
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
              {save.error === null ? null : (
                <Alert tone="danger" title={t('modules.form.saveError')}>
                  {save.error}
                </Alert>
              )}

              <fieldset className="min-w-0">
                <legend className="mb-2 text-label font-medium text-ink">
                  {t('modules.transports.form.modeLegend')}
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
                        {t(modeLabel(mode))}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <Field
                label={t('modules.field.name')}
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
                  placeholder={t('modules.transports.field.namePlaceholder')}
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
                    {t('modules.transports.chain.unsplit')}
                  </button>
                </>
              ) : (
                <>
                  {/* The two ends, side by side, in the order they happen. */}
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
                    <fieldset className="flex min-w-0 flex-col gap-3">
                      <legend className="mb-1 text-micro font-semibold tracking-label text-ink-3 uppercase">
                        {t(labels.from)}
                      </legend>
                      <Field
                        label={t('modules.transports.field.place')}
                        error={errorFor('departureName')}
                      >
                        <Input
                          value={draft.departureName}
                          onChange={(event) =>
                            set('departureName', event.target.value)
                          }
                          placeholder={t(
                            'modules.transports.field.departurePlaceholder',
                          )}
                          maxLength={200}
                          autoComplete="off"
                        />
                      </Field>
                      {usesCodes(draft.mode) ? (
                        <Field
                          label={t('modules.transports.field.code')}
                          error={errorFor('departureCode')}
                        >
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
                        <Field
                          label={t('modules.transports.field.date')}
                          error={errorFor('departureDate')}
                        >
                          <Input
                            type="date"
                            value={draft.departureDate}
                            onChange={(event) =>
                              set('departureDate', event.target.value)
                            }
                          />
                        </Field>
                        <Field
                          label={t('modules.field.time')}
                          error={errorFor('departureTime')}
                        >
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
                        <Field label={t(labels.fromDay)}>
                          <SimpleSelect
                            options={dayOptions}
                            value={toSelectValue(draft.departureDayId)}
                            onValueChange={(next) =>
                              set('departureDayId', fromSelectValue(next))
                            }
                            ariaLabel={t(labels.fromDay)}
                          />
                        </Field>
                      )}
                    </fieldset>

                    <div className="hidden self-center pt-8 sm:block">
                      <ArrowRight aria-hidden className="size-5 text-ink-4" />
                    </div>

                    <fieldset className="flex min-w-0 flex-col gap-3">
                      <legend className="mb-1 text-micro font-semibold tracking-label text-ink-3 uppercase">
                        {t(labels.to)}
                      </legend>
                      <Field
                        label={t('modules.transports.field.place')}
                        error={errorFor('arrivalName')}
                      >
                        <Input
                          value={draft.arrivalName}
                          onChange={(event) =>
                            set('arrivalName', event.target.value)
                          }
                          placeholder={t(
                            'modules.transports.field.arrivalPlaceholder',
                          )}
                          maxLength={200}
                          autoComplete="off"
                        />
                      </Field>
                      {usesCodes(draft.mode) ? (
                        <Field
                          label={t('modules.transports.field.code')}
                          error={errorFor('arrivalCode')}
                        >
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
                        <Field
                          label={t('modules.transports.field.date')}
                          error={errorFor('arrivalDate')}
                        >
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
                        <Field
                          label={t('modules.field.time')}
                          error={errorFor('arrivalTime')}
                        >
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
                          label={t(labels.toDay)}
                          error={errorFor('arrivalDayId')}
                          hint={t('modules.transports.field.arrivalDayHint')}
                        >
                          <SimpleSelect
                            options={dayOptions}
                            value={toSelectValue(draft.arrivalDayId)}
                            onValueChange={(next) =>
                              set('arrivalDayId', fromSelectValue(next))
                            }
                            ariaLabel={t(labels.toDay)}
                          />
                        </Field>
                      )}
                    </fieldset>
                  </div>

                  {timing !== null ? (
                    <Alert
                      tone="danger"
                      title={t('modules.transports.form.timingError')}
                    >
                      {t(timing)} {t('modules.transports.error.timingHint')}
                    </Alert>
                  ) : duration === null ? null : (
                    <p className="text-caption font-medium tabular-nums text-ink-3">
                      {t('modules.transports.doorToDoor', {
                        gap: formatGap(duration),
                      })}
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
                      {t('modules.transports.chain.splitHint')}
                    </p>
                    <Button
                      type="button"
                      data-part="split-leg"
                      variant="secondary"
                      size="sm"
                      shape="pill"
                      onClick={() => setChain(breakIntoLegs(chain, draft))}
                    >
                      {t('modules.transports.chain.split')}
                    </Button>
                  </div>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {usesService(draft.mode) ? (
                  <>
                    <Field
                      label={t('modules.transports.field.carrier')}
                      error={errorFor('carrier')}
                    >
                      <Input
                        value={draft.carrier}
                        onChange={(event) => set('carrier', event.target.value)}
                        placeholder="SAS"
                        maxLength={200}
                        autoComplete="off"
                      />
                    </Field>
                    <Field
                      label={t('modules.transports.field.serviceNumber')}
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
                  label={t('modules.transports.field.bookingRef')}
                  error={errorFor('bookingCode')}
                  hint={t('modules.transports.field.bookingRefHint')}
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
                  <Field
                    label={t('modules.transports.field.seat')}
                    error={errorFor('seat')}
                  >
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
                <Field
                  label={t('modules.transports.field.distance')}
                  error={errorFor('distanceKm')}
                >
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
                <Field
                  label={t('modules.field.price')}
                  error={errorFor('price')}
                >
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
                <Field label={t('modules.field.status')}>
                  <SimpleSelect
                    options={TRANSPORT_STATUSES.map((value) => ({
                      value,
                      label: t(STATUS_LABELS[value]),
                    }))}
                    value={draft.status}
                    onValueChange={(next) => {
                      if (isTransportStatus(next)) {
                        set('status', next)
                      }
                    }}
                    ariaLabel={t('modules.field.status')}
                  />
                </Field>
              </div>

              <Field label={t('modules.field.notes')}>
                <Textarea
                  value={draft.notes}
                  onChange={(event) => set('notes', event.target.value)}
                  placeholder={t('modules.transports.field.notesPlaceholder')}
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
            {searchable && fillMode === 'search'
              ? t('ui.action.close')
              : t('modules.action.cancel')}
          </Button>
          {/*
            The search mode has no footer save, and that is the honest shape: what is saved there
            is one chosen connection, so the button belongs on the row that names it rather than
            at the bottom of a dialog with nothing selected.
          */}
          {searchable && fillMode === 'search' ? null : (
            <Button
              type="submit"
              form={formId}
              variant="primary"
              shape="pill"
              disabled={touched && invalid}
              loading={save.pending}
              loadingLabel={t('modules.transports.action.saving')}
            >
              {editing
                ? t('modules.transports.action.save')
                : t('modules.transports.action.add')}
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
export function NewTransportAction({ onClick }: { onClick: () => void }) {
  const t = useTranslate()
  return (
    <Button
      data-part="new-transport"
      variant="primary"
      size="sm"
      shape="pill"
      icon={<Plus aria-hidden strokeWidth={2.5} />}
      onClick={onClick}
    >
      {t('modules.transports.action.add')}
    </Button>
  )
}
