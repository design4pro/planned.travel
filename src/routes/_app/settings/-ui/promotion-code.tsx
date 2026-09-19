import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button, Field, Input } from '#/components/ui'
import { cn } from '#/lib/cn'
import { DISCOUNT_CODE_PATTERN } from '#/lib/discount-code'
import { useTranslate } from '#/lib/i18n'

import type { MessageKey } from '#/lib/i18n'
import type { DiscountRejectionReason } from '#/server/billing/discounts'
import type { RefObject } from 'react'

const REJECTION_COPY: Record<DiscountRejectionReason, MessageKey> = {
  invalid: 'settings.billing.discount.rejected.invalid',
  not_applicable: 'settings.billing.discount.rejected.notApplicable',
  rate_limited: 'settings.billing.discount.rejected.rateLimited',
  busy: 'settings.billing.discount.rejected.busy',
}

export interface PromotionCodeState {
  readonly value: string
  readonly setValue: (value: string) => void
  readonly expanded: boolean
  readonly toggle: () => void
  readonly error: MessageKey | null
  readonly inputRef: RefObject<HTMLInputElement | null>
  /**
   * The code to send with the next plan choice: `undefined` when the field is empty, `null` when
   * what was typed is not a code — the error is shown and the caller must send nothing.
   */
  readonly read: () => string | undefined | null
  /** Puts the server's refusal under the field and hands it the focus. */
  readonly reject: (reason: DiscountRejectionReason) => void
}

/**
 * The page-state half of the promotion-code field. It is not a form: the plan cards' own buttons
 * submit it through `read()`, which is why it lives in a hook the page holds rather than inside
 * the field.
 */
export function usePromotionCode(): PromotionCodeState {
  const [value, setRawValue] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  // Bumped to move focus once the field has rendered expanded; a collapsed field has no input
  // to focus yet.
  const [focusRequest, setFocusRequest] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusRequest > 0) inputRef.current?.focus()
  }, [focusRequest])

  function fail(message: MessageKey): void {
    setError(message)
    setExpanded(true)
    setFocusRequest((count) => count + 1)
  }

  return {
    value,
    setValue: (next) => {
      setRawValue(next)
      setError(null)
    },
    expanded,
    toggle: () => setExpanded((open) => !open),
    error,
    inputRef,
    read: () => {
      const code = value.trim()
      if (code === '') return undefined
      if (DISCOUNT_CODE_PATTERN.test(code)) return code
      fail('settings.billing.discount.invalidFormat')
      return null
    },
    reject: (reason) => fail(REJECTION_COPY[reason]),
  }
}

/**
 * The collapsed "Have a promotion code?" row above the plan grid. **Apply to current plan** is
 * offered only when there is a live subscription to attach the code to.
 */
export function PromotionCodeField({
  state,
  canApply,
  applyPending,
  disabled,
  onApply,
}: {
  state: PromotionCodeState
  canApply: boolean
  applyPending: boolean
  disabled: boolean
  onApply: () => void
}) {
  const t = useTranslate()
  const panelId = useId()

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="ghost"
        size="sm"
        shape="pill"
        className="self-start"
        aria-expanded={state.expanded}
        aria-controls={state.expanded ? panelId : undefined}
        iconAfter={
          <ChevronDown
            className={cn(
              'transition-transform',
              state.expanded && 'rotate-180',
            )}
          />
        }
        onClick={state.toggle}
      >
        {t('settings.billing.discount.toggle')}
      </Button>

      {state.expanded ? (
        <div
          id={panelId}
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <Field
            className="sm:max-w-xs sm:flex-1"
            label={t('settings.billing.discount.label')}
            hint={t(
              canApply
                ? 'settings.billing.discount.hintCurrent'
                : 'settings.billing.discount.hint',
            )}
            error={state.error === null ? undefined : t(state.error)}
          >
            <Input
              ref={state.inputRef}
              value={state.value}
              onChange={(event) => state.setValue(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={64}
            />
          </Field>
          {canApply ? (
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              // Aligns with the input rather than its label on wide screens.
              className="sm:mt-7"
              disabled={disabled || state.value.trim() === ''}
              loading={applyPending}
              loadingLabel={t('settings.billing.discount.applying')}
              onClick={onApply}
            >
              {t('settings.billing.discount.applyCurrent')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
