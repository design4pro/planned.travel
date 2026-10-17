/**
 * The three controls every module row needs, defined once.
 *
 * `RowMenu` is the overflow menu — a real Radix menu, so it is reachable with the
 * keyboard and announces itself. `StatusMenu` turns a status pill into the control
 * that changes it, which is what stops "confirm five bookings" being five dialogs.
 * `ConfirmDialog` is the one place a destructive action asks first, and it says
 * what will be destroyed rather than "Are you sure?".
 */
import * as React from 'react'
import { Check, Eye, MoreHorizontal } from 'lucide-react'

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { useUiCopy } from '#/components/ui/copy'

import type { BadgeTone } from '#/components/ui'

/* ----------------------------------------------------------------- row menu */

export interface RowMenuItem {
  readonly label: string
  readonly icon?: React.ReactNode
  readonly onSelect: () => void
  readonly tone?: 'default' | 'danger'
  readonly disabled?: boolean
  /** Starts a new group above this item. */
  readonly separated?: boolean
}

export function RowMenu({
  label,
  items,
  size = 'sm',
  className,
}: {
  /** The accessible name — "Actions for Toothpaste", never just "Actions". */
  label: string
  items: ReadonlyArray<RowMenuItem>
  size?: 'sm' | 'md'
  className?: string
}) {
  const enabled = items.filter((item) => item.disabled !== true)
  if (enabled.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          variant="ghost"
          size={size}
          shape="pill"
          label={label}
          icon={<MoreHorizontal aria-hidden />}
          className={className}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {items.map((item, index) => (
          <React.Fragment key={item.label}>
            {item.separated && index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              icon={item.icon}
              disabled={item.disabled}
              destructive={item.tone === 'danger'}
              onSelect={item.onSelect}
            >
              {item.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------------------------------------------------------------- status menu */

export interface StatusOption {
  readonly value: string
  readonly label: string
  readonly tone: BadgeTone
}

/**
 * The status pill, as a menu.
 *
 * A `Badge` is deliberately not clickable, so the trigger is a real button that
 * *contains* the badge: the pill keeps its exact resting look and gains a hover,
 * a focus ring and a chevron's worth of affordance.
 */
export function StatusMenu({
  current,
  options,
  onSelect,
  label,
  disabled = false,
  size = 'sm',
}: {
  current: StatusOption
  options: ReadonlyArray<StatusOption>
  onSelect: (value: string) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`${label} — currently ${current.label}`}
          className={cn(
            'group inline-flex shrink-0 items-center rounded-full focus-ring',
            'transition-[box-shadow,opacity] duration-fast ease-out-quint',
            'hover:ring-2 hover:ring-edge-strong disabled:opacity-60',
          )}
        >
          <Badge tone={current.tone} dot size={size}>
            {current.label}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            icon={
              option.value === current.value ? (
                <Check aria-hidden />
              ) : (
                <span className="size-4" />
              )
            }
            onSelect={() => onSelect(option.value)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------------ confirm */

export interface ConfirmRequest {
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly onConfirm: () => Promise<unknown> | void
}

/**
 * A controlled confirmation. The parent owns the request — one dialog per screen
 * rather than one per row, so a list of forty items mounts one overlay.
 */
export function ConfirmDialog({
  request,
  onOpenChange,
  pending = false,
  busyLabel,
  cancelLabel,
  onCloseAutoFocus,
}: {
  request: ConfirmRequest | null
  onOpenChange: (open: boolean) => void
  pending?: boolean
  busyLabel?: string
  cancelLabel?: string
  onCloseAutoFocus?: React.ComponentProps<
    typeof DialogContent
  >['onCloseAutoFocus']
}) {
  // `useUiCopy` rather than `useTranslate`: the atlas and map suites render
  // this dialog with no provider above it, and `src/components/ui/copy.ts`
  // owns that contract. Its three words live in the `ui` namespace for the
  // same reason.
  const t = useUiCopy()

  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent size="sm" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{request?.title ?? ''}</DialogTitle>
          <DialogDescription>{request?.description ?? ''}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel ?? t('ui.action.keep')}
          </Button>
          <Button
            type="button"
            variant="danger"
            shape="pill"
            loading={pending}
            loadingLabel={busyLabel ?? t('ui.status.removing')}
            onClick={() => {
              void request?.onConfirm()
            }}
          >
            {request?.confirmLabel ?? t('ui.action.remove')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------------------------------------- copy value */

/**
 * Writes to the clipboard, reporting whether it worked.
 *
 * The API is absent in some embedded browsers and refused outright without a user
 * gesture or over plain HTTP, and both of those surface as a throw rather than as a
 * missing property — so this is a `try`, not a feature test.
 */
async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

/**
 * A confirmation number is only useful if it can be got out of the screen. The
 * button carries the value's name, so a screen reader hears what was copied.
 *
 * **`mask` starts it masked.** The value is then not in the DOM: the button shows
 * `glyphs` and answers to `revealLabel` until the reader activates it, and the
 * next activation copies. Masked and revealed are two states of this one button,
 * so the focus never has to be handed anywhere. Losing the focus masks it again —
 * the reader moved on. A hover or a `Tab` reveals nothing: neither is a decision
 * to read a code.
 *
 * Safari, and Firefox on macOS, focus no button on a click, and blur a focused one
 * on `mousedown`. So while a mask is given, `mousedown` moves no focus and the
 * reveal takes it explicitly — otherwise a pointer reveal would never blur, and a
 * second click would mask before it could copy.
 */
export function CopyValue({
  value,
  label,
  className,
  mask,
}: {
  value: string
  label: string
  className?: string
  /** Absent — the control only copies. `revealLabel` arrives translated. */
  mask?: { readonly glyphs: string; readonly revealLabel: string }
}) {
  const [copied, setCopied] = React.useState(false)
  const [revealed, setRevealed] = React.useState(false)
  const hidden = mask !== undefined && !revealed

  React.useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  function activate(button: HTMLButtonElement): void {
    if (hidden) {
      setRevealed(true)
      button.focus()
      return
    }
    void copyToClipboard(value).then(setCopied)
  }

  // Both states are this one element, so its focus survives the reveal.
  return (
    <button
      type="button"
      data-state={mask && (hidden ? 'masked' : 'revealed')}
      aria-label={hidden ? mask.revealLabel : copyLabel(label, copied)}
      onMouseDown={mask && ((event) => event.preventDefault())}
      onClick={(event) => activate(event.currentTarget)}
      onBlur={
        mask &&
        (() => {
          setRevealed(false)
          setCopied(false)
        })
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm font-mono text-caption tracking-wide focus-ring',
        'transition-colors duration-fast ease-out-quint',
        mask && 'px-1.5',
        hidden
          ? 'bg-surface-inset text-ink-4 hover:text-ink-2'
          : cn(
              'uppercase hover:text-brand',
              copied ? 'text-success' : 'text-ink',
            ),
        className,
      )}
    >
      {hidden ? (
        <>
          <span aria-hidden className="tabular-nums">
            {mask.glyphs}
          </span>
          <Eye aria-hidden className="size-3" />
        </>
      ) : (
        <>
          <span className="tabular-nums">{value}</span>
          <Check
            aria-hidden
            className={cn(
              'size-3 transition-opacity duration-fast',
              copied ? 'opacity-100' : 'opacity-0',
            )}
          />
        </>
      )}
    </button>
  )
}

function copyLabel(label: string, copied: boolean): string {
  return copied ? `${label} copied` : `Copy ${label}`
}
