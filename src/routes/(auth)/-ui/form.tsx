/**
 * The pieces every authentication form is assembled from.
 *
 * Nothing here is generic over the form instance: TanStack Form's type
 * parameters do not survive being threaded through a wrapper without either an
 * `any` or a wall of pass-through generics, so each screen keeps its own
 * `form.Field` / `form.Subscribe` calls and reuses the presentation below.
 */
import * as React from 'react'
import { Eye, EyeOff, Fingerprint } from 'lucide-react'

import { Alert, Button, Input, Separator } from '#/components/ui'
import { cn } from '#/lib/cn'
import { isPasskeySupported } from '#/lib/auth/client'

import type { InputProps } from '#/components/ui'
import type { AuthMessage } from '../-lib/errors'
import type { SocialProviderId } from '../-server/config'

/* -------------------------------------------------------------- validation */

/**
 * The first message out of a field's validation state.
 *
 * A Standard Schema validator reports issue objects; `onSubmitAsync` handlers
 * in these screens report plain strings. Both shapes arrive in the same array,
 * so both are read here.
 */
export function firstError(errors: ReadonlyArray<unknown>): string | undefined {
  for (const entry of errors) {
    if (typeof entry === 'string' && entry.length > 0) return entry
    if (typeof entry === 'object' && entry !== null && 'message' in entry) {
      const message = (entry as { message?: unknown }).message
      if (typeof message === 'string' && message.length > 0) return message
    }
  }
  return undefined
}

/** Only surface a field error once the reader has actually left the field. */
export function visibleError(meta: {
  isTouched: boolean
  errors: ReadonlyArray<unknown>
}): string | undefined {
  return meta.isTouched ? firstError(meta.errors) : undefined
}

/* ------------------------------------------------------------------ layout */

/** The card every form lives in. One shape, so all seven screens agree. */
export function AuthPanel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-edge-faint bg-surface p-6 shadow-card sm:p-7',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Vertical rhythm for a stack of fields. */
export function FieldStack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>
}

/**
 * The server's verdict on the last submit. Rendered above the fields so a
 * screen reader meets it before the inputs it is complaining about, and keyed
 * so a repeated failure re-announces instead of sitting silently.
 */
export function FormAlert({
  message,
  onDismiss,
}: {
  message: AuthMessage | null
  onDismiss?: () => void
}) {
  if (!message) return null
  return (
    <Alert
      tone={message.tone}
      size="sm"
      title={message.title}
      onDismiss={onDismiss}
      className="mb-5"
    >
      {message.detail.length > 0 ? message.detail : null}
    </Alert>
  )
}

/** A hairline with a word set into it. Separates social sign-in from the form. */
export function OrDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden="true">
      <Separator className="flex-1" />
      <span className="text-micro font-semibold uppercase tracking-label text-ink-4">
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  )
}

/* ------------------------------------------------------------------ inputs */

export type PasswordInputProps = Omit<InputProps, 'type' | 'trailing'> & {
  /** Announced on the reveal control; distinguishes two fields on one screen. */
  revealLabel?: string
}

/**
 * A password field with a reveal toggle.
 *
 * The toggle is a real focusable button placed over the control rather than
 * passed to `Input`'s `trailing` slot, because that slot is `aria-hidden` —
 * correct for units and glyphs, wrong for something you can press.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(({ className, revealLabel = 'password', ...props }, ref) => {
  const [revealed, setRevealed] = React.useState(false)
  const Glyph = revealed ? EyeOff : Eye

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={revealed ? 'text' : 'password'}
        className={cn('pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        aria-pressed={revealed}
        aria-label={`${revealed ? 'Hide' : 'Show'} ${revealLabel}`}
        disabled={props.disabled}
        className={cn(
          'absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-ink-4',
          'transition-[color,background-color] duration-fast ease-out-quint',
          'hover:text-ink focus-ring-inset disabled:pointer-events-none disabled:opacity-45',
        )}
      >
        <Glyph className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'

/**
 * The six-digit authenticator input. Wide tracking and tabular figures so the
 * digits read as a code rather than as a word, and every browser autofill hint
 * a one-time code can carry.
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
      className={cn(
        'text-center font-display text-2xl font-bold tracking-widest numeral',
        className,
      )}
      {...props}
    />
  ),
)
CodeInput.displayName = 'CodeInput'

/* ----------------------------------------------------------- social sign-in */

/**
 * Provider marks are third-party assets, so they are the one place in the
 * product that cannot be expressed in our own tokens. Google's four-colour "G"
 * keeps its brand values; Apple's mark is monochrome by design and takes
 * `currentColor` so it works on both themes.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4.5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.68 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.34-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.34 5.7c1.74-5.2 6.59-9.07 12.32-9.07z"
      />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.54 12.63c.02-2.62 2.14-3.88 2.23-3.94-1.22-1.78-3.12-2.03-3.79-2.05-1.61-.12-3.15.95-3.97.95-.82 0-2.08-.93-3.42-.9-1.77.03-3.4 1.03-4.3 2.6-1.84 3.19-.47 7.9 1.31 10.48.88 1.27 1.92 2.6 3.29 2.55 1.31-.05 1.81-.85 3.41-.85s2.04.85 3.44.83c1.42-.03 2.32-1.29 3.19-2.56 1-1.46 1.41-2.87 1.43-2.95-.03-.01-2.75-1.06-2.78-4.2zM15.19 4.9c.72-.87 1.21-2.09 1.08-3.3-1.07.04-2.37.71-3.13 1.59-.69.77-1.29 2.01-1.13 3.2 1.19.09 2.4-.61 3.18-1.49z"
      />
    </svg>
  )
}

const PROVIDER_MARKS: Record<SocialProviderId, () => React.JSX.Element> = {
  google: GoogleMark,
  apple: AppleMark,
}

const PROVIDER_NAMES: Record<SocialProviderId, string> = {
  google: 'Google',
  apple: 'Apple',
}

export interface SocialButtonsProps {
  providers: ReadonlyArray<SocialProviderId>
  /** The provider currently mid-redirect, so only that button spins. */
  pending: SocialProviderId | null
  disabled: boolean
  onSelect: (provider: SocialProviderId) => void
  /** "Continue with" on sign-in, "Sign up with" on registration. */
  verb?: string
}

/**
 * Rendered only for providers this environment has credentials for — the list
 * comes from the server, so a half-configured deployment never shows a button
 * that leads to an error page.
 */
export function SocialButtons({
  providers,
  pending,
  disabled,
  onSelect,
  verb = 'Continue with',
}: SocialButtonsProps) {
  if (providers.length === 0) return null
  return (
    <div
      className={cn(
        'grid gap-3',
        providers.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1',
      )}
    >
      {providers.map((provider) => {
        const Mark = PROVIDER_MARKS[provider]
        return (
          <Button
            key={provider}
            variant="secondary"
            size="lg"
            block
            icon={<Mark />}
            loading={pending === provider}
            loadingLabel={`Opening ${PROVIDER_NAMES[provider]}`}
            disabled={disabled && pending !== provider}
            onClick={() => onSelect(provider)}
          >
            {providers.length > 1
              ? PROVIDER_NAMES[provider]
              : `${verb} ${PROVIDER_NAMES[provider]}`}
          </Button>
        )
      })}
    </div>
  )
}

export interface PasskeyButtonProps {
  pending: boolean
  disabled: boolean
  onSelect: () => void
  label?: string
}

/**
 * Shown only once the client has confirmed WebAuthn is available, which is why
 * support is read in an effect: the server cannot know, and rendering the button
 * optimistically would mean removing it a frame later.
 */
export function PasskeyButton({
  pending,
  disabled,
  onSelect,
  label = 'Sign in with a passkey',
}: PasskeyButtonProps) {
  const [supported, setSupported] = React.useState(false)
  React.useEffect(() => setSupported(isPasskeySupported()), [])

  if (!supported) return null
  return (
    <Button
      variant="secondary"
      size="lg"
      block
      icon={<Fingerprint />}
      loading={pending}
      loadingLabel="Waiting for your device"
      disabled={disabled && !pending}
      onClick={onSelect}
    >
      {label}
    </Button>
  )
}
