import * as React from 'react'

import { cn } from '#/lib/cn'
import { useFieldControl } from './field'
import { transitionBase } from './shared'

const textareaSizes = {
  sm: 'px-2.5 py-2 text-caption',
  md: 'px-3 py-2.5 text-label',
  lg: 'px-3.5 py-3 text-body',
} as const

export type TextareaProps = Omit<
  React.ComponentPropsWithoutRef<'textarea'>,
  'size'
> & {
  size?: keyof typeof textareaSizes
  invalid?: boolean
  /**
   * Grows with its content instead of scrolling. The height is written to the
   * element directly, so the caller's `rows` still sets the floor.
   */
  autoResize?: boolean
  /** Upper bound for `autoResize`, in rows. Past this it scrolls. */
  maxRows?: number
}

/**
 * The multi-line text control. Same shell as `Input`, plus an optional
 * auto-grow that measures on input rather than on every render.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      size = 'md',
      invalid,
      autoResize = false,
      maxRows = 12,
      rows = 3,
      disabled,
      id,
      'aria-describedby': describedBy,
      'aria-invalid': ariaInvalid,
      onChange,
      value,
      ...props
    },
    forwardedRef,
  ) => {
    const field = useFieldControl({
      id,
      'aria-describedby': describedBy,
      'aria-invalid': invalid ?? ariaInvalid,
      disabled,
    })

    const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

    const setRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      },
      [forwardedRef],
    )

    const resize = React.useCallback(() => {
      const node = innerRef.current
      if (!node || !autoResize) return
      const styles = window.getComputedStyle(node)
      const lineHeight = Number.parseFloat(styles.lineHeight) || 20
      const vertical =
        Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom) +
        Number.parseFloat(styles.borderTopWidth) +
        Number.parseFloat(styles.borderBottomWidth)
      node.style.height = 'auto'
      const max = lineHeight * maxRows + vertical
      node.style.height = `${Math.min(node.scrollHeight, max)}px`
      node.style.overflowY = node.scrollHeight > max ? 'auto' : 'hidden'
    }, [autoResize, maxRows])

    React.useEffect(resize, [resize, value])

    return (
      <textarea
        ref={setRef}
        rows={rows}
        value={value}
        className={cn(
          'w-full min-w-0 rounded-md border border-edge-strong bg-surface text-ink',
          'placeholder:text-ink-4',
          transitionBase,
          'hover:border-ink-4',
          'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4 disabled:hover:border-edge-strong',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:outline-danger',
          autoResize ? 'resize-none' : 'resize-y',
          textareaSizes[size],
          className,
        )}
        onChange={(event) => {
          resize()
          onChange?.(event)
        }}
        {...props}
        {...field}
      />
    )
  },
)
Textarea.displayName = 'Textarea'
