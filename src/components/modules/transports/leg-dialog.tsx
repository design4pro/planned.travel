/**
 * Add or edit one travel transport.
 *
 * The mode picker at the top decides what the rest of the form asks for: a flight
 * wants airports and a service number, a taxi wants neither. The two endpoints are
 * laid out as they read on a ticket — from on the left, to on the right — and the
 * timing rule is checked live, so a transport that arrives before it departs is caught
 * while it is being typed rather than after a round trip.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'

import {
  Alert,
  Button,
  Chip,
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
import { useTranslate } from '#/lib/i18n'
import { createTransportFn, updateTransportFn } from '#/server/fns/transports'
import { useAction } from '../shared'
import { formatGap, transportTimingError } from './connections'
import {
  STATUS_LABELS,
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  emptyTransportDraft,
  endpointLabels,
  hasTransportErrors,
  isTransportMode,
  isTransportStatus,
  kilometresToMetres,
  metresToKilometres,
  modeLabel,
  suggestTransportTitle,
  usesCodes,
  usesSeat,
  usesService,
  validateTransportDraft,
} from './leg-form'
import { MODE_ICON } from './mode-icon'
import { transportDurationMinutes } from './leg-timing'

import type { TransportDraft } from './leg-form'
import type { TransportData } from './types'

function draftFrom(
  transport: TransportData,
  fallbackCurrency: string,
): TransportDraft {
  const currency = transport.currency ?? fallbackCurrency
  return {
    mode: isTransportMode(transport.mode) ? transport.mode : 'other',
    status: isTransportStatus(transport.status) ? transport.status : 'pending',
    title: transport.title,
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
  currency,
  open,
  onOpenChange,
}: {
  tripId: string
  /** Absent for a new transport. */
  transport?: TransportData
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslate()
  const editing = transport !== undefined
  const formId = useId()

  const [draft, setDraft] = useState<TransportDraft>(() =>
    emptyTransportDraft(currency),
  )
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setDraft(
      transport === undefined
        ? emptyTransportDraft(currency)
        : draftFrom(transport, currency),
    )
    setTouched(false)
  }, [open, transport, currency])

  const create = useAction(createTransportFn, {
    success: t('modules.transports.toast.added'),
    description: t('modules.transports.toast.addedBody'),
    failure: t('modules.transports.toast.addFailed'),
  })
  const update = useAction(updateTransportFn, {
    success: t('modules.transports.toast.updated'),
    failure: t('modules.transports.toast.updateFailed'),
  })
  const action = editing ? update : create

  const errors = useMemo(() => validateTransportDraft(draft), [draft])
  const invalid = hasTransportErrors(errors)
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

  function errorFor(key: keyof TransportDraft): string | undefined {
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
            {editing
              ? t('modules.transports.dialog.editTitle')
              : t('modules.transports.dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('modules.transports.dialog.description')}
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
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {action.error}
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
                    <Chip
                      key={mode}
                      selected={active}
                      icon={<Icon aria-hidden />}
                      onClick={() => set('mode', mode)}
                    >
                      {t(modeLabel(mode))}
                    </Chip>
                  )
                })}
              </div>
            </fieldset>

            <Field
              label={t('modules.field.name')}
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
                placeholder={t('modules.transports.field.namePlaceholder')}
                maxLength={160}
                autoComplete="off"
                required
              />
            </Field>

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
                    onChange={(event) => set('arrivalName', event.target.value)}
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
                  trailing={<span className="text-caption text-ink-4">km</span>}
                />
              </Field>
              <Field label={t('modules.field.price')} error={errorFor('price')}>
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
            disabled={touched && invalid}
            loading={action.pending}
            loadingLabel={t('modules.transports.action.saving')}
          >
            {editing
              ? t('modules.transports.action.save')
              : t('modules.transports.action.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The screen's primary action, for the module header.
 *
 * `sm` and `primary`, and the same in every tab that has one of these: Book,
 * Files, Lists and Costs. What was wrong was only the size — these used to omit
 * it and take the `md` default, so a header action was drawn 40px tall while
 * Costs, the one tab that chose deliberately, ran its three at 32px. The
 * emphasis was never the problem: this is the thing to do on the screen, and it
 * is drawn as such.
 */
export function NewTransportAction({ onClick }: { onClick: () => void }) {
  const t = useTranslate()

  return (
    <Button
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
