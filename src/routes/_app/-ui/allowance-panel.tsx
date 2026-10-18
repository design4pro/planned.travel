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
 * - **A failed write keeps the typed value.** Retry is offered only when trying again can help: the
 *   failure is a transport failure or a server error (`unexpected`) *and* a re-read of the figure
 *   still succeeds. A domain refusal (not found, owner only) also arrives as `unexpected`, so the
 *   re-read, not the status, tells them apart; a refusal or a rejected value says why and leaves the
 *   field to be edited.
 *
 * - **"Carried" is a second editable tile only as an opening balance**: the traveller has no row for
 *   the year before. Everywhere else it is plain text the walk calculates, and the repository
 *   refuses a typed figure. Another tab can make a year calculated while this one still shows an
 *   editor, so a failed carried write re-reads the figure: if it is no longer an opening balance the
 *   panel says why, with no retry, and moves focus to that message because the tile is no longer a
 *   button. It never reads the error's class (a refusal arrives as `unexpected`).
 * - **A save that replaces a typed opening balance says so** in an info alert that stays until it is
 *   dismissed or the next save: the replaced year is usually not the one on screen. The alert is the
 *   only announcer for it, so the live region never repeats it.
 *
 * The figures come from the route loader and the write reloads it with `router.invalidate()`, so
 * there is no local copy of the allowance that could disagree with the screen.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'

import { Alert, Button, Input, Progress } from '#/components/ui'
import { cn } from '#/lib/cn'
import { readPublicFailure } from '#/lib/errors'
import { useLocale, useTranslate } from '#/lib/i18n'
import { hasFractionalLeftover } from '#/lib/vacay/carry-over'
import { parseAllowanceDays } from '../-lib/allowance'
import { formatNumber } from '../-lib/format'
import { loadVacayAllowance, setAllowanceFn } from '../-server/vacay'
import { Panel } from './scaffold'

import type { FormEvent, KeyboardEvent, Ref } from 'react'
import type { AllowanceSaved, VacayAllowance } from '../-server/vacay'

export interface AllowancePanelProps {
  planId: string
  year: number
  allowance: VacayAllowance
  carryOverEnabled: boolean
  /**
   * The typed opening balance the last save replaced. The route owns it, because the panel is keyed
   * by year and the replaced year is usually the one the traveller switches to next.
   */
  superseded: AllowanceSaved['superseded']
  onSupersededChange: (superseded: AllowanceSaved['superseded']) => void
}

/** The tile whose editor is open. */
type Field = 'entitlement' | 'carried'

type Problem =
  | { readonly kind: 'invalid' }
  | {
      readonly kind: 'failed'
      readonly field: Field
      /** Authored sentence for a refusal or a rejected value; `null` for a diagnostic. */
      readonly message: string | null
      readonly retryable: boolean
      /** The server rejected the value itself, so the field is marked invalid. */
      readonly rejected: boolean
    }

export function AllowancePanel({
  planId,
  year,
  allowance,
  carryOverEnabled,
  superseded,
  onSupersededChange,
}: AllowancePanelProps) {
  const t = useTranslate()
  const locale = useLocale()
  const router = useRouter()
  const ids = useId()
  const daysLabelId = `${ids}-days-label`
  const carriedLabelId = `${ids}-carried-label`
  const hintId = `${ids}-hint`
  const carriedCaptionId = `${ids}-carried-caption`
  const wholeDaysId = `${ids}-whole-days`
  const descriptionId = `${ids}-description`
  const problemId = `${ids}-problem`
  const formId = `${ids}-form`

  const [editing, setEditing] = useState<Field | null>(null)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  /** Whether the last write succeeded; cleared when the next one starts, so a failure never reads as a save. */
  const [saved, setSaved] = useState(false)
  /** Counts invalid submits, so a repeated one mounts the alert again and is announced again. */
  const [attempts, setAttempts] = useState(0)
  /** Set when a carried figure turned out to be calculated; the message is where focus goes. */
  const [derivedFrom, setDerivedFrom] = useState<number | null>(null)

  const tileRefs = {
    entitlement: useRef<HTMLButtonElement>(null),
    carried: useRef<HTMLButtonElement>(null),
  }
  const inputRef = useRef<HTMLInputElement>(null)
  const derivedRef = useRef<HTMLDivElement>(null)
  const inflight = useRef(false)
  /** The tile focus returns to once the editor has closed, or `null` when it must not return. */
  const restoreFocus = useRef<Field | null>(null)

  useEffect(() => {
    if (editing !== null) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else if (restoreFocus.current !== null) {
      const field = restoreFocus.current
      restoreFocus.current = null
      // The carried tile is gone when another tab switched carry-over off while its editor was open.
      const target = tileRefs[field].current ?? tileRefs.entitlement.current
      target?.focus()
    }
    // The refs are stable objects; only the open editor decides where focus goes.
  }, [editing])

  useEffect(() => {
    if (derivedFrom !== null) derivedRef.current?.focus()
  }, [derivedFrom])

  const number = (value: number) => formatNumber(value, locale)
  const total = allowance.entitlementDays + allowance.carriedOverDays
  const over = allowance.remainingDays < 0
  const remaining = Math.abs(allowance.remainingDays)
  const carriedEditable = carryOverEnabled && allowance.openingBalance
  const wholeDaysOnly =
    carryOverEnabled && hasFractionalLeftover(allowance.remainingDays)

  function open(field: Field): void {
    if (pending || editing === field) return
    setDraft(
      String(
        field === 'carried'
          ? allowance.carriedOverDays
          : allowance.entitlementDays,
      ),
    )
    setProblem(null)
    setDerivedFrom(null)
    setEditing(field)
  }

  function close(): void {
    restoreFocus.current = editing
    setEditing(null)
  }

  /** The button that dismissed the notice goes with it, so focus returns to a tile that stays. */
  function dismissSuperseded(): void {
    onSupersededChange(null)
    tileRefs.entitlement.current?.focus()
  }

  function release(): void {
    inflight.current = false
    setPending(false)
  }

  async function commit(): Promise<void> {
    if (inflight.current || editing === null) return
    const field = editing
    const days = parseAllowanceDays(draft)
    if (days === null) {
      setProblem({ kind: 'invalid' })
      setAttempts((count) => count + 1)
      inputRef.current?.focus()
      return
    }

    inflight.current = true
    setPending(true)
    setSaved(false)
    setProblem(null)
    onSupersededChange(null)
    let result: AllowanceSaved | undefined
    try {
      result = await setAllowanceFn({
        data: {
          planId,
          year,
          ...(field === 'carried'
            ? { carriedOverDays: days }
            : { entitlementDays: days }),
        },
      })
    } catch (cause) {
      await fail(cause, field, days)
      return
    }

    try {
      await router.invalidate()
      onSupersededChange(result?.superseded ?? null)
      setSaved(true)
      close()
    } finally {
      release()
    }
  }

  async function fail(
    cause: unknown,
    field: Field,
    days: number,
  ): Promise<void> {
    const failure = readPublicFailure(cause)
    const unexpected = failure.kind === 'unexpected'
    // Not found, owner only and "this year is calculated" all arrive as `unexpected` too: only a
    // figure that still reads can be written again, and only a re-read tells the refusals apart.
    const fresh = unexpected ? await reread() : null

    // A lost response does not prove the write failed: when the re-read already holds the figure
    // that was sent, the save landed, so reconcile to it instead of calling it a failure.
    if (fresh !== null && landed(fresh, field, days)) {
      try {
        await router.invalidate()
        setSaved(true)
        close()
      } finally {
        release()
      }
      return
    }

    if (field === 'carried' && fresh !== null && !fresh.openingBalance) {
      // The tile is no longer a button, so the editor closes without taking focus back to it.
      restoreFocus.current = null
      setEditing(null)
      setDerivedFrom(fresh.previousYear)
      try {
        await router.invalidate()
      } finally {
        release()
      }
      return
    }

    setProblem({
      kind: 'failed',
      field,
      message: unexpected ? null : (failure.message ?? null),
      retryable: fresh !== null,
      rejected: failure.kind === 'validation',
    })
    release()
    inputRef.current?.focus()
  }

  function landed(fresh: VacayAllowance, field: Field, days: number): boolean {
    return field === 'carried'
      ? fresh.openingBalance && fresh.carriedOverDays === days
      : fresh.hasRow && fresh.entitlementDays === days
  }

  async function reread(): Promise<VacayAllowance | null> {
    try {
      return await loadVacayAllowance({ data: { planId, year } })
    } catch {
      return null
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
  const rejected = invalid || failed?.rejected === true

  return (
    <Panel label={t('modules.vacay.allowance.label', { year })}>
      <div className="flex flex-col gap-4">
        <p
          aria-describedby={wholeDaysOnly ? wholeDaysId : undefined}
          className="font-display text-subtitle font-bold tabular-nums text-ink"
        >
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
          <EditableTile
            labelId={daysLabelId}
            label={t('modules.vacay.allowance.tile.days')}
            field="entitlement"
            figure={number(allowance.entitlementDays)}
            name={t('modules.vacay.allowance.tile.edit.days', {
              value: number(allowance.entitlementDays),
            })}
            describedBy={allowance.hasRow ? undefined : hintId}
            expanded={editing === 'entitlement'}
            formId={formId}
            tileRef={tileRefs.entitlement}
            onOpen={() => open('entitlement')}
          />
          <Figure
            label={t('modules.vacay.allowance.tile.used')}
            value={number(allowance.usedDays)}
          />
          {carriedEditable ? (
            <EditableTile
              labelId={carriedLabelId}
              label={t('modules.vacay.allowance.tile.carried')}
              field="carried"
              figure={number(allowance.carriedOverDays)}
              name={t('modules.vacay.allowance.tile.edit.carried', {
                value: number(allowance.carriedOverDays),
              })}
              describedBy={carriedCaptionId}
              expanded={editing === 'carried'}
              formId={formId}
              tileRef={tileRefs.carried}
              onOpen={() => open('carried')}
            />
          ) : (
            <Figure
              label={t('modules.vacay.allowance.tile.carried')}
              value={number(allowance.carriedOverDays)}
              muted={!carryOverEnabled}
            />
          )}
        </dl>
        {allowance.hasRow ? null : (
          <p id={hintId} className="text-caption text-ink-3">
            {t('modules.vacay.allowance.default.hint')}
          </p>
        )}
        <p id={carriedCaptionId} className="text-caption text-ink-3">
          {t(
            !carryOverEnabled
              ? 'modules.vacay.allowance.carried.off'
              : allowance.openingBalance
                ? 'modules.vacay.allowance.carried.opening'
                : 'modules.vacay.allowance.carried.from',
            { year: allowance.openingBalance ? year : allowance.previousYear },
          )}
        </p>
        {wholeDaysOnly ? (
          <p id={wholeDaysId} className="text-caption text-ink-3">
            {t('modules.vacay.allowance.carried.wholeDays')}
          </p>
        ) : null}

        {derivedFrom === null ? null : (
          <Alert ref={derivedRef} tabIndex={-1} tone="warning" size="sm">
            {t('modules.vacay.allowance.error.derived', {
              year,
              previousYear: derivedFrom,
            })}
          </Alert>
        )}
        {superseded === null ? null : (
          <Alert tone="info" size="sm" onDismiss={dismissSuperseded}>
            {t('modules.vacay.allowance.superseded', {
              count: superseded.was,
              year: superseded.year,
              previousYear: superseded.year - 1,
              value: number(superseded.was),
            })}
          </Alert>
        )}

        {editing === null ? null : (
          <form
            id={formId}
            onSubmit={submit}
            onKeyDown={onKeyDown}
            data-motion-transform
            className="flex animate-rise flex-col gap-3 rounded-md border border-edge bg-surface-2 p-3"
          >
            <span id={descriptionId} className="text-caption text-ink-3">
              {t(
                editing === 'carried'
                  ? 'modules.vacay.allowance.input.carried'
                  : 'modules.vacay.allowance.input.days',
                { year },
              )}
            </span>
            <Input
              ref={inputRef}
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              readOnly={pending}
              aria-busy={pending || undefined}
              // The visible words beside the field are the tile's label and the description, so
              // the name carries both (WCAG 2.5.3 label in name).
              aria-labelledby={`${editing === 'carried' ? carriedLabelId : daysLabelId} ${descriptionId}`}
              aria-describedby={invalid ? problemId : undefined}
              invalid={rejected}
              onChange={(event) => {
                setDraft(event.target.value)
                if (rejected) setProblem(null)
              }}
            />
            {invalid ? (
              <p
                key={attempts}
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
                  t(
                    failed.field === 'carried'
                      ? 'modules.vacay.allowance.error.carried'
                      : 'modules.vacay.allowance.error.days',
                    failed.field === 'carried'
                      ? {
                          count: allowance.carriedOverDays,
                          year,
                          value: number(allowance.carriedOverDays),
                        }
                      : {
                          count: allowance.entitlementDays,
                          year,
                          value: number(allowance.entitlementDays),
                        },
                  )}
              </Alert>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="pointer-coarse:h-11"
              >
                {t('modules.vacay.allowance.save')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="pointer-coarse:h-11"
                aria-disabled={pending || undefined}
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
        )}

        <div role="status" aria-live="polite" className="sr-only">
          {pending ? (
            <span key="saving">{t('modules.vacay.allowance.saving')}</span>
          ) : saved ? (
            <span key="saved">{t('modules.vacay.allowance.saved')}</span>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}

/** A figure tile whose number is a button that opens the editor row. */
function EditableTile({
  labelId,
  label,
  field,
  figure,
  name,
  describedBy,
  expanded,
  formId,
  tileRef,
  onOpen,
}: {
  labelId: string
  label: string
  field: Field
  figure: string
  name: string
  describedBy: string | undefined
  expanded: boolean
  formId: string
  tileRef: Ref<HTMLButtonElement>
  onOpen: () => void
}) {
  return (
    <div className="rounded-md bg-surface-2 px-1.5 py-2">
      <dt
        id={labelId}
        className="text-micro font-semibold tracking-label uppercase text-ink-4"
      >
        {label}
      </dt>
      <dd className="font-display text-subtitle font-bold tabular-nums text-ink">
        <button
          ref={tileRef}
          type="button"
          aria-label={name}
          aria-describedby={describedBy}
          aria-expanded={expanded}
          aria-controls={expanded ? formId : undefined}
          onClick={onOpen}
          data-part="allowance-tile"
          data-field={field}
          className={cn(
            '-mx-1 inline-flex items-center gap-1 rounded-sm px-1 text-start tabular-nums',
            'hover:bg-hover active:bg-active aria-expanded:bg-hover',
            'focus-visible:outline-2 focus-visible:outline-ring',
          )}
        >
          {figure}
          <Pencil aria-hidden className="size-3 shrink-0 text-ink-3" />
        </button>
      </dd>
    </div>
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
    <div className="rounded-md bg-surface-2 px-1.5 py-2">
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
