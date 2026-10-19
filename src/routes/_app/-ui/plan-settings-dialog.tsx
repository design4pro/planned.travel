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
 * - **A failed save keeps the dialog open with the values as typed** and moves focus to the alert:
 *   the loading Save button has just stopped being focusable, which would drop focus to the page.
 * - **A saved dialog closes onto the button that opened it**, on purpose rather than through
 *   Radix's restore, because a button pressed in Safari is not focused and so is not remembered.
 *   The saved message goes to a polite live region beside the button, outside the dialog's portal.
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
  /** Counts failed saves, so each one moves focus to the alert again. */
  const [failures, setFailures] = useState(0)
  const [failed, setFailed] = useState(false)
  /** Whether the last save succeeded; cleared when the dialog opens, so a repeat is announced again. */
  const [saved, setSaved] = useState(false)

  const openerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const inflight = useRef(false)

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
    try {
      await updateVacayPlanFn({ data: { planId, ...patch } })
      await router.invalidate()
    } catch {
      setFailed(true)
      setFailures((count) => count + 1)
      return
    } finally {
      inflight.current = false
      setPending(false)
    }
    setSaved(true)
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
          data-part="vacay-settings-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            openerRef.current?.focus({ preventScroll: true })
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
                  onCheckedChange={(next) => setCarryOver(next === true)}
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
                    onChange={(event) => {
                      setDraft(event.target.value)
                      setInvalid(false)
                    }}
                  />
                </Field>
              </div>
            </DialogBody>

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
