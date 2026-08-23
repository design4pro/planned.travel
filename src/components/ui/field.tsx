import * as React from 'react'
import { Label as LabelPrimitive } from 'radix-ui'

import { cn } from '#/lib/cn'
import { transitionBase } from './shared'

/**
 * The form-row wrapper. It owns the ids, so a control nested inside it is
 * wired to its label, hint and error message without the caller ever writing
 * an `aria-describedby` by hand — the single most commonly forgotten attribute
 * in a design system, made automatic.
 */

type FieldContextValue = {
  controlId: string
  hintId: string | undefined
  errorId: string | undefined
  invalid: boolean
  disabled: boolean
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

export function useField(): FieldContextValue | null {
  return React.useContext(FieldContext)
}

type ControlAriaProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
  disabled?: boolean
}

/**
 * Called by Input / Textarea / the Select and Combobox triggers. Anything the
 * caller passed explicitly always wins over the value the surrounding `Field`
 * would have supplied.
 */
export function useFieldControl(own: ControlAriaProps): ControlAriaProps {
  const field = useField()
  if (!field) return own

  const inherited = [field.errorId, field.hintId].filter(Boolean).join(' ')

  return {
    id: own.id ?? field.controlId,
    'aria-describedby':
      own['aria-describedby'] ?? (inherited === '' ? undefined : inherited),
    'aria-invalid': own['aria-invalid'] ?? (field.invalid || undefined),
    disabled: own.disabled ?? (field.disabled || undefined),
  }
}

export type FieldProps = Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'children'
> & {
  /** Visible label. Omit it only when the control carries its own `aria-label`. */
  label?: React.ReactNode
  /** Quiet helper line under the control. Hidden while an error is showing. */
  hint?: React.ReactNode
  /** Validation message. Its presence is what makes the control invalid. */
  error?: React.ReactNode
  /** Marks the label and sets `aria-required` on the control. */
  required?: boolean
  /** Dims the whole row and disables the nested control. */
  disabled?: boolean
  /** Trailing content on the label row — a character count, a "learn more". */
  action?: React.ReactNode
  /** Label above the control (default) or beside it, for switches and checkboxes. */
  orientation?: 'vertical' | 'horizontal'
  /** Explicit id for the control; generated when omitted. */
  htmlFor?: string
  children?: React.ReactNode
}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  (
    {
      className,
      label,
      hint,
      error,
      required = false,
      disabled = false,
      action,
      orientation = 'vertical',
      htmlFor,
      children,
      ...props
    },
    ref,
  ) => {
    const generated = React.useId()
    const controlId = htmlFor ?? `field-${generated}`
    const invalid = Boolean(error)

    const value = React.useMemo<FieldContextValue>(
      () => ({
        controlId,
        hintId: hint ? `${controlId}-hint` : undefined,
        errorId: invalid ? `${controlId}-error` : undefined,
        invalid,
        disabled,
      }),
      [controlId, hint, invalid, disabled],
    )

    return (
      <FieldContext.Provider value={value}>
        <div
          ref={ref}
          data-invalid={invalid ? '' : undefined}
          data-disabled={disabled ? '' : undefined}
          className={cn(
            'min-w-0',
            orientation === 'vertical'
              ? 'flex flex-col gap-1.5'
              : 'flex flex-row-reverse items-center justify-end gap-3',
            disabled && 'opacity-60',
            className,
          )}
          {...props}
        >
          {label || action ? (
            <div className="flex items-baseline justify-between gap-3">
              <FieldLabel htmlFor={controlId} required={required}>
                {label}
              </FieldLabel>
              {action ? (
                <span className="shrink-0 text-caption text-ink-3">
                  {action}
                </span>
              ) : null}
            </div>
          ) : null}

          {children}

          {invalid ? (
            <FieldError id={value.errorId}>{error}</FieldError>
          ) : hint ? (
            <FieldHint id={value.hintId}>{hint}</FieldHint>
          ) : null}
        </div>
      </FieldContext.Provider>
    )
  },
)
Field.displayName = 'Field'

export type FieldLabelProps = React.ComponentPropsWithoutRef<
  typeof LabelPrimitive.Root
> & {
  required?: boolean
}

export const FieldLabel = React.forwardRef<HTMLLabelElement, FieldLabelProps>(
  ({ className, required = false, children, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        'text-label font-medium text-ink-2 select-none',
        transitionBase,
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="ms-0.5 text-danger" aria-hidden="true">
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  ),
)
FieldLabel.displayName = 'FieldLabel'

export const FieldHint = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<'p'>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-caption text-ink-3', className)}
    {...props}
  />
))
FieldHint.displayName = 'FieldHint'

/**
 * Announced politely rather than assertively: a message that appears while the
 * reader is still typing should not interrupt them mid-word.
 */
export const FieldError = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<'p'>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    role="status"
    aria-live="polite"
    className={cn('text-caption font-medium text-danger', className)}
    {...props}
  />
))
FieldError.displayName = 'FieldError'
