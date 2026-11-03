import { FreeRateDisclosure } from '#/components/rates/free-rate-disclosure'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button, Combobox, Field, Input, Skeleton } from '#/components/ui'
import { dashboardWidgetPreference } from '#/lib/clock-zones'
import { cn } from '#/lib/cn'
import { WIDGETS_IN_SHEET_QUERY } from './dashboard-widgets'
import { useI18n } from '#/lib/i18n'
import { ECB_REFERENCE_CURRENCIES, mergeCurrencies } from '#/lib/currency-list'
import { formatRateLine, formatMoney, toAmountInput } from '#/lib/money'
import {
  useWorkspaceClaim,
  workspaceClaimGeneration,
} from '#/lib/workspace-claim-store'
import { getPublicRatesFn } from '#/server/fns/public-rates'
import { converterAmount, converterResult } from '../-lib/currency-conversion'
import { openedCurrencyOptions } from '../-lib/currency-names'
import { Panel } from './scaffold'
import type { PublicRatesResult } from '#/server/rates/public-rates'

export interface ConverterState {
  amount: string
  from: string
  to: string
}

export function CurrencyConverter({
  state,
  onChange,
  inSheet = false,
}: {
  state: ConverterState
  onChange: (next: ConverterState) => void
  inSheet?: boolean
}) {
  const { t, locale } = useI18n()
  const claim = useWorkspaceClaim()
  const [result, setResult] = useState<PublicRatesResult | null>(null)
  const [busy, setBusy] = useState(
    state.from !== state.to &&
      converterAmount(state.amount, state.from, locale) !== null,
  )
  const [now, setNow] = useState(Date.now)
  const [confirmedAmount, setConfirmedAmount] = useState(state.amount)
  const serial = useRef(0)
  const active = useRef(false)
  const checked = useRef(0)
  const id = useId()
  const identity = state.from === state.to
  const amount = converterAmount(state.amount, state.from, locale)
  const loading = busy
  const currentAmount = useRef({ minor: amount, text: state.amount })
  currentAmount.current = { minor: amount, text: state.amount }
  const read = useCallback(
    async (refresh = false) => {
      if (
        identity ||
        claim.stale ||
        claim.switching ||
        active.current ||
        currentAmount.current.minor === null ||
        !dashboardWidgetPreference.read().shown.includes('currency') ||
        (!inSheet && window.matchMedia(WIDGETS_IN_SHEET_QUERY).matches)
      )
        return
      const request = ++serial.current
      const generation = workspaceClaimGeneration()
      active.current = true
      checked.current = Date.now()
      setBusy(true)
      try {
        const next = await getPublicRatesFn({ data: { refresh } })
        if (
          serial.current === request &&
          generation === workspaceClaimGeneration()
        ) {
          setConfirmedAmount(currentAmount.current.text)
          setResult(next)
          checked.current = Date.now()
          setNow(Date.now())
        }
      } catch {
        if (
          serial.current === request &&
          generation === workspaceClaimGeneration()
        ) {
          setConfirmedAmount(currentAmount.current.text)
          setResult((previous) =>
            previous?.status === 'available'
              ? { ...previous, freshness: 'stale', reason: 'provider-failed' }
              : { status: 'unavailable', reason: 'provider-failed' },
          )
        }
      } finally {
        if (serial.current === request) {
          active.current = false
          setBusy(false)
        }
      }
    },
    [
      identity,
      inSheet,
      state.from,
      state.to,
      claim.organizationId,
      claim.stale,
      claim.switching,
    ],
  )
  useEffect(() => {
    setResult(null)
  }, [claim.organizationId, claim.stale, claim.switching])
  useEffect(() => {
    ++serial.current
    active.current = false
    setBusy(false)
    checked.current = 0
    if (document.visibilityState === 'visible') void read()
    const visible = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - checked.current >= 3_600_000
      )
        void read()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      ++serial.current
      document.removeEventListener('visibilitychange', visible)
    }
  }, [read])
  useEffect(() => {
    const current = Date.now()
    const midnight = (Math.floor(current / 86_400_000) + 1) * 86_400_000
    const retry =
      (result?.retryAt ?? 0) > current
        ? (result?.retryAt ?? Infinity)
        : Infinity
    const hour =
      checked.current > 0 &&
      currentAmount.current.minor !== null &&
      (inSheet || !window.matchMedia(WIDGETS_IN_SHEET_QUERY).matches) &&
      !identity &&
      !claim.stale &&
      !claim.switching &&
      document.visibilityState === 'visible'
        ? Math.max(current + 1000, checked.current + 3_600_000)
        : Infinity
    const deadline = Math.min(midnight, retry, hour)
    const timer = setTimeout(() => {
      setNow(Date.now())
      if (
        document.visibilityState === 'visible' &&
        Date.now() - checked.current >= 3_600_000
      )
        void read()
    }, deadline - current)
    return () => clearTimeout(timer)
  }, [result, now, read])
  const snapshot = result?.status === 'available' ? result.snapshot : null
  const age = snapshot
    ? Math.floor(now / 86_400_000) -
      Math.floor(Date.parse(snapshot.effectiveOn) / 86_400_000)
    : Infinity
  const rates = snapshot && age <= 7 ? snapshot.rates : {}
  const conversion =
    amount === null
      ? null
      : converterResult(amount, state.from, state.to, rates)
  const confirmedMinor = converterAmount(confirmedAmount, state.from, locale)
  const spokenResult =
    confirmedMinor === null
      ? null
      : converterResult(confirmedMinor, state.from, state.to, rates)
  const coverage: ReadonlyArray<string> = snapshot
    ? Object.keys(snapshot.rates)
    : ECB_REFERENCE_CURRENCIES
  const codes = mergeCurrencies([...coverage, state.from, state.to]).filter(
    (code) =>
      coverage.includes(code) || code === state.from || code === state.to,
  )
  const options = openedCurrencyOptions(t, locale, codes)
  const invalidConversion =
    amount !== null &&
    !conversion &&
    (identity ||
      Boolean(
        rates[state.from as keyof typeof rates] &&
        rates[state.to as keyof typeof rates],
      ))
  const cooldown = (result?.retryAt ?? 0) > now
  const stale =
    result?.status === 'available' && (result.freshness === 'stale' || age > 4)
  let status = ''
  if (amount === null || invalidConversion)
    status = t('shell.dashboard.currency.invalid')
  else if (!identity && !conversion && !busy)
    status = t(
      snapshot && age <= 7
        ? 'shell.dashboard.currency.unsupported'
        : 'shell.dashboard.currency.failed',
    )
  if (amount !== null && !invalidConversion && !identity && result) {
    if (result.reason === 'provider-blocked')
      status = t('shell.dashboard.currency.blocked')
    else if (
      result.reason === 'provider-failed' ||
      result.reason === 'cache-unavailable'
    )
      status = t('shell.dashboard.currency.failed')
    else if (
      result.status === 'available' &&
      (result.freshness === 'stale' || age > 4)
    )
      status = t('shell.dashboard.currency.stale')
  }
  return (
    <Panel label={t('shell.dashboard.currency.label')}>
      <div className="flex min-w-0 flex-col gap-3">
        <Field
          label={t('shell.dashboard.currency.amount')}
          error={
            amount === null || invalidConversion
              ? t('shell.dashboard.currency.invalid')
              : undefined
          }
        >
          <Input
            value={state.amount}
            inputMode="decimal"
            maxLength={64}
            onChange={(e) => onChange({ ...state, amount: e.target.value })}
            onBlur={() => {
              setConfirmedAmount(state.amount)
              if (amount !== null) {
                onChange({
                  ...state,
                  amount: toAmountInput(amount, state.from),
                })
                if (!result || Date.now() - checked.current >= 3_600_000)
                  void read()
              }
            }}
          />
        </Field>
        <Field label={t('shell.dashboard.currency.from')}>
          <Combobox
            options={options}
            value={state.from}
            onChange={(value) => {
              if (value) onChange({ ...state, from: value })
            }}
          />
        </Field>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...state, from: state.to, to: state.from })}
        >
          {t('shell.dashboard.currency.swap')}
        </Button>
        <Field label={t('shell.dashboard.currency.to')}>
          <Combobox
            options={options}
            value={state.to}
            onChange={(value) => {
              if (value) onChange({ ...state, to: value })
            }}
          />
        </Field>
        <div className="min-h-28 min-w-0 break-words" aria-busy={loading}>
          <p id={id} className="text-caption text-ink-3">
            {t('shell.dashboard.currency.result')}
          </p>
          {loading && !conversion ? <Skeleton className="h-8 w-full" /> : null}
          {conversion ? (
            <output
              aria-labelledby={id}
              aria-live="off"
              className="block text-subtitle font-semibold tabular-nums"
            >
              <bdi>
                {formatMoney(conversion.minor, state.to, locale)} {state.to}
              </bdi>
            </output>
          ) : null}
          {conversion ? (
            <p className="text-caption tabular-nums">
              <bdi>
                {formatRateLine(conversion.rate, state.from, state.to, locale)}
              </bdi>
            </p>
          ) : null}
        </div>
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="min-h-10 text-caption text-ink-3"
        >
          {!loading && conversion && spokenResult ? (
            <span className="sr-only">
              {t('shell.dashboard.currency.result')}:{' '}
              {formatMoney(spokenResult.minor, state.to, locale)} {state.to}
              .{' '}
            </span>
          ) : null}
          {loading ? t('ui.status.loading') : status}
        </p>
        {!identity ? (
          <div
            className={cn('flex flex-col gap-3', !snapshot && 'invisible')}
            aria-hidden={!snapshot}
            inert={!snapshot}
          >
            <p className="text-caption text-ink-3">
              {t('shell.dashboard.currency.source')}
              <br />
              {t('shell.dashboard.currency.date', {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeZone: 'UTC',
                }).format(new Date(snapshot?.effectiveOn ?? now)),
              })}
            </p>
            <p className="text-caption text-ink-3">
              {t('shell.dashboard.currency.notice')}
            </p>
            <FreeRateDisclosure />
          </div>
        ) : null}
        {!identity ? (
          <p
            className={cn(
              'min-h-10 text-caption text-ink-3',
              !stale && 'invisible',
            )}
            aria-hidden={!stale}
          >
            {t('shell.dashboard.currency.stale')}
          </p>
        ) : null}
        {!identity ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              aria-disabled={busy || cooldown}
              aria-busy={busy}
              onClick={() => {
                if (!busy && !cooldown) void read(true)
              }}
            >
              {t('shell.dashboard.currency.refresh')}
            </Button>
            <p
              className={cn(
                'min-h-10 text-caption text-ink-3',
                !cooldown && 'invisible',
              )}
              aria-hidden={!cooldown}
            >
              {t('shell.dashboard.currency.cooldown', {
                time: new Intl.DateTimeFormat(locale, {
                  timeStyle: 'short',
                }).format(new Date(result?.retryAt ?? now)),
              })}
            </p>
          </>
        ) : null}
      </div>
    </Panel>
  )
}
