/**
 * Where a provider's ceiling and its over-ceiling policy are set.
 *
 * The counters on this screen are a measurement; this is the one control that changes what the
 * platform *does*, which is why it is a dialog with an explicit confirm rather than fields that
 * save as you leave them. Setting `block` on the wrong row stops a feature.
 *
 * **The consequence is named before the press, not after it.** `provider_registry.blockable` refuses
 * the impossible cases server-side and `ConsoleActionError('provider-not-blockable')` renders inside
 * this dialog when it does — but an interlock that only speaks after the button is a control that
 * teaches nothing. So the block option carries what it turns off, in words, on the option itself.
 *
 * **A provider with no client behind it is configurable, and that is the point.** ADR 0013 gives
 * Geoapify 3,000 credits a *day* and ADR 0011 gives HERE 30,000 a month; an operator could enter
 * either before its client existed, and can do the same for a slug still planned, so the gate is
 * live from the first call rather than from the first invoice.
 *
 * **Radio cards rather than a select, for both choices.** Each option carries a consequence that
 * has to be readable before the press, and a closed select shows one line. The layering that used
 * to force this (issue #201, a select opened in a dialog painted under the scrim) is fixed —
 * `SelectContent` now sits on `--z-popover` — so this is a presentation choice, not a workaround.
 */

import { useCallback, useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Field, Input, RadioCard, RadioGroup } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { updateProviderLimitFn } from '../-server/providers'
import { ConsoleActionDialog } from './action-dialog'

import type { ProviderPanel } from '../-server/providers'

/**
 * An empty field is "no ceiling agreed", which is not the same fact as a ceiling of zero — one lets
 * every call through and the other, under `block`, refuses all of them. So the box is text rather
 * than a number input with a default, and blank round-trips as `null`.
 */
function parseCeiling(raw: string): number | null | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) return undefined
  return Number(trimmed)
}

function parsePercent(raw: string): number | undefined {
  const value = Number(raw.trim())
  return Number.isInteger(value) && value >= 1 && value <= 100
    ? value
    : undefined
}

export interface ProviderLimitDialogProps {
  readonly panel: ProviderPanel
  /** Reloads the screen once the ceiling has moved. */
  readonly onSaved: () => Promise<void> | void
}

export function ProviderLimitDialog({
  panel,
  onSaved,
}: ProviderLimitDialogProps) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(panel.label ?? panel.slug)
  const [ceiling, setCeiling] = useState(
    panel.callLimit === null ? '' : String(panel.callLimit),
  )
  const [limitWindow, setLimitWindow] = useState(panel.limitWindow)
  const [policy, setPolicy] = useState(panel.policy)
  const [warn, setWarn] = useState(String(panel.warnPercent))
  const [critical, setCritical] = useState(String(panel.criticalPercent))

  // Reopening after a save elsewhere must not show the values from before it. The dialog is mounted
  // for the life of the row, so the reset belongs to opening rather than to mounting.
  useEffect(() => {
    if (!open) return
    setLabel(panel.label ?? panel.slug)
    setCeiling(panel.callLimit === null ? '' : String(panel.callLimit))
    setLimitWindow(panel.limitWindow)
    setPolicy(panel.policy)
    setWarn(String(panel.warnPercent))
    setCritical(String(panel.criticalPercent))
  }, [open, panel])

  const parsedCeiling = parseCeiling(ceiling)
  const parsedWarn = parsePercent(warn)
  const parsedCritical = parsePercent(critical)

  const invalid =
    label.trim().length === 0 ||
    parsedCeiling === undefined ||
    parsedWarn === undefined ||
    parsedCritical === undefined ||
    parsedWarn > parsedCritical

  const save = useCallback(async (): Promise<void> => {
    // Re-read rather than close over the derived values: `onConfirm` is called from the dialog and
    // the guard above has already refused an unparseable form.
    const nextCeiling = parseCeiling(ceiling)
    const nextWarn = parsePercent(warn)
    const nextCritical = parsePercent(critical)
    if (
      nextCeiling === undefined ||
      nextWarn === undefined ||
      nextCritical === undefined
    ) {
      return
    }

    await updateProviderLimitFn({
      data: {
        slug: panel.slug,
        label: label.trim(),
        limitWindow,
        callLimit: nextCeiling,
        policy,
        warnPercent: nextWarn,
        criticalPercent: nextCritical,
        notes: null,
      },
    })
    await onSaved()
    toast.success(t('console.providers.edit.done', { provider: panel.slug }))
  }, [
    ceiling,
    critical,
    label,
    limitWindow,
    onSaved,
    panel.slug,
    policy,
    t,
    warn,
  ])

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        shape="pill"
        icon={<SlidersHorizontal />}
        onClick={() => {
          setOpen(true)
        }}
      >
        {t('console.providers.edit.button')}
      </Button>

      <ConsoleActionDialog
        open={open}
        onOpenChange={setOpen}
        title={t('console.providers.edit.title', { provider: panel.slug })}
        description={t('console.providers.edit.body')}
        confirmLabel={t('console.providers.edit.confirm')}
        confirmDisabled={invalid}
        onConfirm={save}
      >
        <Field label={t('console.providers.edit.label')} required>
          <Input
            value={label}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => {
              setLabel(event.currentTarget.value)
            }}
          />
        </Field>

        <Field
          label={t('console.providers.edit.ceiling')}
          hint={t('console.providers.edit.ceiling.hint')}
        >
          <Input
            inputMode="numeric"
            value={ceiling}
            autoComplete="off"
            placeholder={t('console.providers.edit.ceiling.placeholder')}
            onChange={(event) => {
              setCeiling(event.currentTarget.value)
            }}
          />
        </Field>

        <Field label={t('console.providers.edit.window')}>
          <RadioGroup
            aria-label={t('console.providers.edit.window')}
            value={limitWindow}
            onValueChange={(next) => {
              setLimitWindow(next as ProviderPanel['limitWindow'])
            }}
          >
            <RadioCard
              value="month"
              label={t('console.providers.edit.window.month')}
              description={t('console.providers.edit.window.month.body')}
            />
            <RadioCard
              value="day"
              label={t('console.providers.edit.window.day')}
              description={t('console.providers.edit.window.day.body')}
            />
          </RadioGroup>
        </Field>

        <Field label={t('console.providers.edit.policy')}>
          <RadioGroup
            aria-label={t('console.providers.edit.policy')}
            value={policy}
            onValueChange={(next) => {
              setPolicy(next as ProviderPanel['policy'])
            }}
          >
            <RadioCard
              value="allow"
              label={t('console.providers.edit.policy.allow')}
              description={t('console.providers.edit.policy.allow.body')}
            />
            {/* Present and refused rather than absent: an option that vanishes teaches nothing, and
                the reason this one cannot be chosen is the most useful sentence on the screen. */}
            <RadioCard
              value="block"
              disabled={!panel.blockable}
              label={t('console.providers.edit.policy.block')}
              description={
                panel.blockable
                  ? t('console.providers.edit.policy.block.body')
                  : t('console.providers.edit.policy.block.refused', {
                      provider: panel.slug,
                    })
              }
            />
          </RadioGroup>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('console.providers.edit.warn')}
            hint={t('console.providers.edit.thresholds.hint')}
          >
            <Input
              inputMode="numeric"
              value={warn}
              autoComplete="off"
              onChange={(event) => {
                setWarn(event.currentTarget.value)
              }}
            />
          </Field>
          <Field label={t('console.providers.edit.critical')}>
            <Input
              inputMode="numeric"
              value={critical}
              autoComplete="off"
              onChange={(event) => {
                setCritical(event.currentTarget.value)
              }}
            />
          </Field>
        </div>
      </ConsoleActionDialog>
    </>
  )
}
