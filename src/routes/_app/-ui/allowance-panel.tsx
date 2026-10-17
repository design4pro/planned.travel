/**
 * The traveller's allowance for one year on `/vacay`, with the "Days" tile as its editor.
 *
 * Pressing the tile opens a full-width row under the three figures: a whole-number field with
 * visible Save and Cancel. The rules the row keeps, because each one is a way a keyboard or
 * screen-reader traveller loses their place otherwise:
 *
 * - **Enter saves, Escape cancels, blur does nothing.** A field that commits on blur writes when the
 *   reader merely tabs past it. `inflight` is the one guard that lets Enter, the Save button and a
 *   retry share a single write, so Enter followed by blur - or Enter twice - sends one request.
 * - **Pending is read-only, not disabled.** `readOnly` + `aria-busy` keep the control focusable and
 *   its value announced; the Save button never takes `loading` or `disabled`, because a button that
 *   vanishes from the tab order mid-press drops the reader's focus to the page.
 * - **Focus goes back to the tile** after Enter, Escape, Cancel or a successful Save, and stays in
 *   the field after a refusal, an invalid value or a failed write.
 * - **A failed write keeps the typed value.** Retry is offered only when trying again can help - a
 *   transport failure or a server error (`unexpected`); a refusal or a rejected value says why and
 *   leaves the field to be edited.
 *
 * The figures come from the route loader and the write reloads it with `router.invalidate()`, so
 * there is no local copy of the allowance that could disagree with the screen.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

import { Alert, Button, Input, Progress } from '#/components/ui'
import { cn } from '#/lib/cn'
import { readPublicFailure } from '#/lib/errors'
import { useLocale, useTranslate } from '#/lib/i18n'
import { parseAllowanceDays } from '../-lib/allowance'
import { formatNumber } from '../-lib/format'
import { setAllowanceFn } from '../-server/vacay'
import { Panel } from './scaffold'

import type { FormEvent, KeyboardEvent } from 'react'
import type { VacayAllowance } from '../-server/vacay'

export interface AllowancePanelProps {
  planId: string
  year: number
  allowance: VacayAllowance
  carryOverEnabled: boolean
}

type Problem =
  | { readonly kind: 'invalid' }
  | {
      readonly kind: 'failed'
      /** Authored sentence for a refusal or a rejected value; `null` for a diagnostic. */
      readonly message: string | null
      readonly retryable: boolean
    }

export function AllowancePanel({
  planId,
  year,
  allowance,
  carryOverEnabled,
}: AllowancePanelProps) {
  const t = useTranslate()
  const locale = useLocale()
  const router = useRouter()
  const ids = useId()
  const labelId = `${ids}-label`
  const hintId = `${ids}-hint`
  const descriptionId = `${ids}-description`
  const problemId = `${ids}-problem`
  const formId = `${ids}-form`

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [saves, setSaves] = useState(0)

  const tileRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inflight = useRef(false)
  const restoreFocus = useRef(false)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else if (restoreFocus.current) {
      restoreFocus.current = false
      tileRef.current?.focus()
    }
  }, [editing])

  const number = (value: number) => formatNumber(value, locale)
  const total = allowance.entitlementDays + allowance.carriedOverDays
  const over = allowance.remainingDays < 0
  const remaining = Math.abs(allowance.remainingDays)

  function open(): void {
    if (editing) return
    setDraft(String(allowance.entitlementDays))
    setProblem(null)
    setEditing(true)
  }

  function close(): void {
    restoreFocus.current = true
    setEditing(false)
  }

  async function commit(): Promise<void> {
    if (inflight.current) return
    const days = parseAllowanceDays(draft)
    if (days === null) {
      setProblem({ kind: 'invalid' })
      inputRef.current?.focus()
      return
    }

    inflight.current = true
    setPending(true)
    setProblem(null)
    try {
      await setAllowanceFn({
        data: { planId, year, entitlementDays: days },
      })
    } catch (cause) {
      const failure = readPublicFailure(cause)
      setProblem({
        kind: 'failed',
        message:
          failure.kind === 'unexpected' ? null : (failure.message ?? null),
        retryable: failure.kind === 'unexpected',
      })
      inflight.current = false
      setPending(false)
      inputRef.current?.focus()
      return
    }

    try {
      await router.invalidate()
      setSaves((count) => count + 1)
      close()
    } finally {
      inflight.current = false
      setPending(false)
    }
  }

  function submit(event: FormEvent): void {
    event.preventDefault()
    void commit()
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !pending) {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  function retry(): void {
    inputRef.current?.focus()
    void commit()
  }

  const failed = problem?.kind === 'failed' ? problem : null
  const invalid = problem?.kind === 'invalid'

  return (
    <Panel label={t('modules.vacay.allowance.label', { year })}>
      <div className="flex flex-col gap-4">
        <p className="font-display text-subtitle font-bold tabular-nums text-ink">
          {t(
            over
              ? 'modules.vacay.allowance.daysOver'
              : 'modules.vacay.allowance.daysLeft',
            { count: remaining, value: number(remaining) },
          )}
        </p>
        <Progress
          value={allowance.usedDays}
          max={Math.max(total, 1)}
          size="sm"
          tone={over || allowance.remainingDays === 0 ? 'danger' : 'brand'}
          aria-label={t('modules.vacay.allowance.progress', {
            used: number(allowance.usedDays),
            total: number(total),
          })}
        />
        <dl className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-surface-2 px-2.5 py-2">
            <dt
              id={labelId}
              className="text-micro font-semibold tracking-label uppercase text-ink-4"
            >
              {t('modules.vacay.allowance.tile.days')}
            </dt>
            <dd className="font-display text-subtitle font-bold tabular-nums text-ink">
              <button
                ref={tileRef}
                type="button"
                aria-label={t('modules.vacay.allowance.tile.edit.days', {
                  value: number(allowance.entitlementDays),
                })}
                aria-describedby={allowance.hasRow ? undefined : hintId}
                aria-expanded={editing}
                aria-controls={editing ? formId : undefined}
                onClick={open}
                className={cn(
                  '-mx-1 rounded-sm px-1 text-start tabular-nums',
                  'hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring',
                )}
              >
                {number(allowance.entitlementDays)}
              </button>
              {allowance.hasRow ? null : (
                <span
                  id={hintId}
                  className="block text-micro font-medium text-ink-4"
                >
                  {t('modules.vacay.allowance.default.hint')}
                </span>
              )}
            </dd>
          </div>
          <Figure
            label={t('modules.vacay.allowance.tile.used')}
            value={number(allowance.usedDays)}
          />
          <Figure
            label={t('modules.vacay.allowance.tile.carried')}
            value={number(allowance.carriedOverDays)}
            muted={!carryOverEnabled}
          />
        </dl>

        {editing ? (
          <form
            id={formId}
            onSubmit={submit}
            onKeyDown={onKeyDown}
            data-motion-transform
            className="flex animate-rise flex-col gap-3 rounded-md border border-edge bg-surface-2 p-3"
          >
            <span id={descriptionId} className="text-caption text-ink-3">
              {t('modules.vacay.allowance.input.days', { year })}
            </span>
            <Input
              ref={inputRef}
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              readOnly={pending}
              aria-busy={pending || undefined}
              aria-labelledby={labelId}
              aria-describedby={
                invalid ? `${descriptionId} ${problemId}` : descriptionId
              }
              invalid={invalid}
              onChange={(event) => {
                setDraft(event.target.value)
                if (invalid) setProblem(null)
              }}
            />
            {invalid ? (
              <p
                id={problemId}
                role="alert"
                className="text-caption text-danger"
              >
                {t('modules.vacay.allowance.input.invalid')}
              </p>
            ) : null}
            {failed === null ? null : (
              <Alert
                tone="danger"
                size="sm"
                actions={
                  failed.retryable ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={retry}
                    >
                      {t('modules.vacay.allowance.retry')}
                    </Button>
                  ) : undefined
                }
              >
                {failed.message ??
                  t('modules.vacay.allowance.error.days', {
                    count: allowance.entitlementDays,
                    year,
                    value: number(allowance.entitlementDays),
                  })}
              </Alert>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="sm">
                {t('modules.vacay.allowance.save')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!pending) close()
                }}
              >
                {t('modules.vacay.allowance.cancel')}
              </Button>
              {pending ? (
                <span aria-hidden="true" className="text-caption text-ink-3">
                  {t('modules.vacay.allowance.saving')}
                </span>
              ) : null}
            </div>
          </form>
        ) : null}

        <div role="status" aria-live="polite" className="sr-only">
          {pending ? (
            <span key="saving">{t('modules.vacay.allowance.saving')}</span>
          ) : saves === 0 ? null : (
            <span key={saves}>{t('modules.vacay.allowance.saved')}</span>
          )}
        </div>
      </div>
    </Panel>
  )
}

function Figure({
  label,
  value,
  muted = false,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="rounded-md bg-surface-2 px-2.5 py-2">
      <dt className="text-micro font-semibold tracking-label uppercase text-ink-4">
        {label}
      </dt>
      <dd
        className={cn(
          'font-display text-subtitle font-bold tabular-nums',
          muted ? 'text-ink-4' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
