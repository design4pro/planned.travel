/**
 * The leave plan's own settings on `/vacay`: whether unused days carry into the next year, and the
 * allowance a traveller without a row of their own sees. The button that opens it sits in the page
 * header beside the year switcher, and the dialog is the plan owner's - the repository refuses
 * everyone else, so hiding the button is not the guard.
 *
 * The settings change what is displayed and rewrite nothing: stored carried-over figures are kept
 * while carry-over is off, so there is no preview of a cost and no recompute. The rules the dialog
 * keeps, because each one is a way a keyboard or screen-reader reader loses their place otherwise:
 *
 * - **Nothing changed is not a save.** Save with both values as they were closes the dialog without
 *   a request.
 * - **An invalid default moves focus to the field**, whose `Field` links the message to it. Enter in
 *   that field submits the form, so the keyboard path is the same as the button's.
 * - **An invalid default is announced on every submit**, including Enter in the field, where focus
 *   does not move: a visually hidden alert, keyed by the attempt, says it again.
 * - **A failed save keeps the dialog open with the values as typed** and moves focus to the alert,
 *   so the failure is heard and focus has a stable place to land. A rejected write does not prove
 *   nothing was stored, so the plan is read again first: when it now holds what was typed, the
 *   save counts as done. A write that landed and a reload that failed count as done too.
 * - **While a save is in flight the fields are read-only and the close button is gone**, so an edit
 *   made during the wait is not silently dropped when the request that carried the old value lands.
 * - **A saved dialog closes onto the button that opened it**, on purpose rather than through
 *   Radix's restore, because a button pressed in Safari is not focused and so is not remembered.
 *   The saved message goes to a polite live region beside the button, outside the dialog's portal,
 *   and is written once the dialog has closed: while the dialog is open Radix hides everything
 *   outside it from assistive technology, and text inserted into a hidden region is not announced.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

import {
  Alert,
  Button,
  CheckboxField,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { parseAllowanceDays } from '../-lib/allowance'
import { updateVacayPlanFn } from '../-server/vacay'

import type { FormEvent } from 'react'

export interface PlanSettingsDialogProps {
  planId: string
  carryOverEnabled: boolean
  defaultEntitlementDays: number
}

export function PlanSettingsDialog({
  planId,
  carryOverEnabled,
  defaultEntitlementDays,
}: PlanSettingsDialogProps) {
  const t = useTranslate()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [carryOver, setCarryOver] = useState(carryOverEnabled)
  const [draft, setDraft] = useState(String(defaultEntitlementDays))
  const [pending, setPending] = useState(false)
  const [invalid, setInvalid] = useState(false)
  /** Counts invalid submits, so each one is announced again. */
  const [attempts, setAttempts] = useState(0)
  /** Counts failed saves, so each one moves focus to the alert again. */
  const [failures, setFailures] = useState(0)
  const [failed, setFailed] = useState(false)
  /** Whether the last save succeeded; cleared when the dialog opens, so a repeat is announced again. */
  const [saved, setSaved] = useState(false)

  const openerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const inflight = useRef(false)
  /** Set by a save that landed; the live region is written when the dialog has closed. */
  const announce = useRef(false)
  /** The plan as last rendered, so a save can be judged against a re-read made after it. */
  const current = useRef({ carryOverEnabled, defaultEntitlementDays })
  current.current = { carryOverEnabled, defaultEntitlementDays }

  useEffect(() => {
    if (failures > 0) alertRef.current?.focus()
  }, [failures])

  function show(): void {
    setCarryOver(carryOverEnabled)
    setDraft(String(defaultEntitlementDays))
    setInvalid(false)
    setFailed(false)
    setSaved(false)
    setOpen(true)
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (inflight.current) return

    const days = parseAllowanceDays(draft)
    if (days === null) {
      setInvalid(true)
      setAttempts((count) => count + 1)
      inputRef.current?.focus()
      return
    }

    const patch = {
      ...(carryOver === carryOverEnabled
        ? {}
        : { carryOverEnabled: carryOver }),
      ...(days === defaultEntitlementDays
        ? {}
        : { defaultEntitlementDays: days }),
    }
    if (Object.keys(patch).length === 0) {
      setOpen(false)
      return
    }

    inflight.current = true
    setPending(true)
    setFailed(false)
    let landed = false
    try {
      await updateVacayPlanFn({ data: { planId, ...patch } })
      landed = true
    } catch {
      // The response may have been lost after the write: read the plan again and compare.
    }
    try {
      await router.invalidate()
    } catch {
      // The write already landed or the screen could not be refreshed; neither is reported twice.
    }
    const stored = current.current
    landed ||=
      stored.carryOverEnabled === carryOver &&
      stored.defaultEntitlementDays === days
    inflight.current = false
    setPending(false)

    if (!landed) {
      setFailed(true)
      setFailures((count) => count + 1)
      return
    }
    announce.current = true
    setOpen(false)
  }

  return (
    <>
      <Button
        ref={openerRef}
        type="button"
        variant="secondary"
        size="sm"
        shape="pill"
        className="h-11 sm:h-8"
        data-part="vacay-settings"
        aria-haspopup="dialog"
        onClick={show}
      >
        {t('modules.vacay.settings.open')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          // A save in flight owns the dialog, so a failure has somewhere to land.
          if (!pending) setOpen(next)
        }}
      >
        <DialogContent
          size="sm"
          hideClose={pending}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            openerRef.current?.focus({ preventScroll: true })
            if (announce.current) {
              announce.current = false
              setSaved(true)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('modules.vacay.settings.title')}</DialogTitle>
            <DialogDescription>
              {t('modules.vacay.settings.description')}
            </DialogDescription>
          </DialogHeader>

          <form
            noValidate
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => void submit(event)}
          >
            <DialogBody>
              <div className="flex flex-col gap-4">
                {failed ? (
                  <Alert ref={alertRef} tabIndex={-1} tone="danger" size="sm">
                    {t('modules.vacay.settings.error')}
                  </Alert>
                ) : null}

                <CheckboxField
                  checked={carryOver}
                  onCheckedChange={(next) => {
                    if (!pending) setCarryOver(next === true)
                  }}
                  label={t('modules.vacay.settings.carryOver')}
                  description={t('modules.vacay.settings.carryOver.hint')}
                />

                <Field
                  label={t('modules.vacay.settings.defaultAllowance')}
                  hint={t('modules.vacay.settings.defaultAllowance.hint')}
                  error={
                    invalid
                      ? t('modules.vacay.allowance.input.invalid')
                      : undefined
                  }
                >
                  <Input
                    ref={inputRef}
                    inputMode="numeric"
                    autoComplete="off"
                    value={draft}
                    readOnly={pending}
                    aria-busy={pending || undefined}
                    onChange={(event) => {
                      setDraft(event.target.value)
                      setInvalid(false)
                    }}
                  />
                </Field>
              </div>
            </DialogBody>

            {invalid ? (
              <div key={attempts} role="alert" className="sr-only">
                {t('modules.vacay.allowance.input.invalid')}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                shape="pill"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {t('modules.vacay.settings.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                shape="pill"
                loading={pending}
                loadingLabel={t('modules.vacay.allowance.saving')}
              >
                {t('modules.vacay.settings.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div role="status" aria-live="polite" className="sr-only">
        {saved ? (
          <span key="saved">{t('modules.vacay.settings.saved')}</span>
        ) : null}
      </div>
    </>
  )
}
