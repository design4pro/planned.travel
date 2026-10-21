/**
 * The pieces every authentication form is assembled from.
 *
 * Nothing here is generic over the form instance: TanStack Form's type
 * parameters do not survive being threaded through a wrapper without either an
 * `any` or a wall of pass-through generics, so each screen keeps its own
 * `form.Field` / `form.Subscribe` calls and reuses the presentation below.
 *
 * Every word these components say comes out of the `auth` catalogue through
 * `t()`, including the ones only a screen reader hears - the reveal control on a
 * password field, the sentence a button announces while it is busy. These are
 * screens reachable without a session, so their language comes from the visitor
 * cookie, then `Accept-Language`, then English (`docs/SPEC.md` §9 rules 3 and 6).
 */
import * as React from 'react'
import { Eye, EyeOff, Fingerprint } from 'lucide-react'

import { Alert, Button, Input, Separator } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useI18n, useTranslate } from '#/lib/i18n'
import { isPasskeySupported } from '#/lib/auth/client'
import { createAuthSchemas } from '../-lib/schemas'

import type { InputProps } from '#/components/ui'
import type { AuthMessage } from '../-lib/errors'
import type { AuthSchemas } from '../-lib/schemas'
import type { SocialProviderId } from '../-server/config'

/* -------------------------------------------------------------- validation */

/**
 * The seven form schemas, carrying this reader's language.
 *
 * A Zod message is fixed when the schema is built, so the schemas cannot be
 * module constants; they are memoised on the translator instead, which
 * `I18nProvider` keeps stable for the life of a locale. TanStack Form compares
 * the validator by identity, so a fresh object every render would re-run
 * validation on every keystroke.
 */
export function useAuthSchemas(): AuthSchemas {
  const { t, locale } = useI18n()
  return React.useMemo(() => createAuthSchemas({ t, locale }), [t, locale])
}

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

/** The public field seam needed to refresh already visible client errors. */
interface AuthValidationForm {
  readonly fieldInfo: Readonly<
    Record<
      string,
      | {
          readonly instance: {
            readonly getMeta: () => {
              readonly isTouched: boolean
              readonly errors: ReadonlyArray<unknown>
            }
            readonly validate: (cause: 'change') => unknown
          } | null
        }
      | undefined
    >
  >
}

/** Re-run validation only for fields displaying an error, without submitting or resetting. */
export function useRevalidateAuthErrors(form: AuthValidationForm): void {
  const { locale } = useI18n()
  const previousLocale = React.useRef(locale)
  React.useEffect(() => {
    if (previousLocale.current === locale) return
    previousLocale.current = locale
    // useForm updates its validators in a layout effect before this effect.
    const fields = Object.values(form.fieldInfo)
      .map((info) => info?.instance)
      .filter((field) => field && visibleError(field.getMeta()) !== undefined)
    for (const field of fields) {
      if (field) void field.validate('change')
    }
  }, [form, locale])
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
      data-part="auth-panel"
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
 * A sentence with one email address set into it, emphasised.
 *
 * The whole sentence is one catalogue key, because splitting it at the address
 * would fix the English word order onto twenty-two other grammars. The address
 * is found in the rendered string instead, and carries `dir="ltr"`: an address
 * is Latin in every locale, and inside Arabic prose the bidi algorithm reorders
 * a bare one around its `@`. The `dir` attribute is what isolates the run - the
 * HTML rendering spec gives any element with `dir` `unicode-bidi: isolate`, so
 * no stylesheet has to know about this.
 */
export function EmailSentence({
  text,
  email,
}: {
  text: string
  email: string
}) {
  const at = email.length > 0 ? text.indexOf(email) : -1
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <span dir="ltr" className="font-semibold text-ink">
        {email}
      </span>
      {text.slice(at + email.length)}
    </>
  )
}

/**
 * The server's verdict on the last submit. Rendered above the fields so a
 * screen reader meets it before the inputs it is complaining about.
 *
 * The message arrives as a pair of catalogue keys rather than as sentences, so
 * an API failure is described in the reader's language rather than in the
 * language the endpoint happens to be written in - see `../-lib/errors.ts`.
 */
export function FormAlert({
  message,
  onDismiss,
}: {
  message: AuthMessage | null
  onDismiss?: () => void
}) {
  const t = useTranslate()
  if (!message) return null
  return (
    <Alert
      tone={message.tone}
      size="sm"
      title={t(message.titleKey)}
      onDismiss={onDismiss}
      className="mb-5"
    >
      {t(message.detailKey)}
    </Alert>
  )
}

/** A hairline with a word set into it. Separates social sign-in from the form. */
export function OrDivider({ label }: { label?: string }) {
  const t = useTranslate()
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden="true">
      <Separator className="flex-1" />
      <span className="text-micro font-semibold uppercase tracking-label text-ink-4">
        {label ?? t('auth.divider.or')}
      </span>
      <Separator className="flex-1" />
    </div>
  )
}

/* ------------------------------------------------------------------ inputs */

export type PasswordInputProps = Omit<InputProps, 'type' | 'trailing'> & {
  /** Announced on the reveal control while the password is hidden. */
  showLabel: string
  /** Announced on the same control once it is revealed. */
  hideLabel: string
}

/**
 * A password field with a reveal toggle.
 *
 * The toggle is a real focusable button placed over the control rather than
 * passed to `Input`'s `trailing` slot, because that slot is `aria-hidden` —
 * correct for units and glyphs, wrong for something you can press. Both of its
 * names are supplied whole rather than assembled from a verb and a field name:
 * several of the twenty-three languages inflect the noun after "show", which a
 * sentence glued together from two keys cannot express.
 *
 * It sits on the inline end of the field, so in `ar` it is on the left, where
 * the caret leaves off.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(({ className, showLabel, hideLabel, ...props }, ref) => {
  const [revealed, setRevealed] = React.useState(false)
  const Glyph = revealed ? EyeOff : Eye

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={revealed ? 'text' : 'password'}
        className={cn('pe-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        aria-pressed={revealed}
        aria-label={revealed ? hideLabel : showLabel}
        disabled={props.disabled}
        className={cn(
          'absolute inset-y-0 end-0 grid w-11 place-items-center rounded-e-md text-ink-4',
          'transition-[color] duration-fast ease-out-quint',
          // Ink only: a background tint here would paint over the field's own
          // border on the inline end, since the control spans its border box.
          'hover:text-ink active:text-ink-2',
          'focus-ring-inset disabled:pointer-events-none disabled:opacity-45',
        )}
      >
        <Glyph className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'

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

/** Trademarks, so they are data rather than copy and are never translated. */
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
  /** Which sentence a single button says: sign-in, or registration. */
  intent?: 'signIn' | 'signUp'
}

/**
 * Rendered only for providers this environment has credentials for — the list
 * comes from the server, so a half-configured deployment never shows a button
 * that leads to an error page.
 *
 * With two or more providers the buttons carry only the mark and the name, which
 * is the same string in every locale; a lone button gets the full sentence, and
 * that sentence is where the reader's language shows.
 */
export function SocialButtons({
  providers,
  pending,
  disabled,
  onSelect,
  intent = 'signIn',
}: SocialButtonsProps) {
  const t = useTranslate()
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
        const name = PROVIDER_NAMES[provider]
        return (
          <Button
            key={provider}
            variant="secondary"
            size="lg"
            block
            icon={<Mark />}
            loading={pending === provider}
            loadingLabel={t('auth.social.opening', { provider: name })}
            disabled={disabled && pending !== provider}
            onClick={() => onSelect(provider)}
          >
            {providers.length > 1
              ? name
              : intent === 'signUp'
                ? t('auth.social.signUp', { provider: name })
                : t('auth.social.continue', { provider: name })}
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
}: PasskeyButtonProps) {
  const t = useTranslate()
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
      loadingLabel={t('auth.passkey.waiting')}
      disabled={disabled && !pending}
      onClick={onSelect}
    >
      {t('auth.passkey.action')}
    </Button>
  )
}
