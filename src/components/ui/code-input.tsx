import * as React from 'react'
import { cn } from '#/lib/cn'
import { Input } from './input'
import type { InputProps } from './input'

/**
 * The six-digit authenticator input. Wide tracking and tabular figures so the
 * digits read as a code rather than as a word, and every browser autofill hint
 * a one-time code can carry.
 *
 * `data-numeric` pins the run left-to-right: a code is digits in every locale,
 * and under `dir="rtl"` the surrounding paragraph would otherwise reorder the
 * separators a reader pastes with it.
 */
export const CodeInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <Input
      ref={ref}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      size="lg"
      data-numeric
      className={cn(
        'text-center font-display text-2xl font-bold tracking-widest numeral',
        className,
      )}
      {...props}
    />
  ),
)
CodeInput.displayName = 'CodeInput'
