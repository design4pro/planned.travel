import * as React from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { Check } from 'lucide-react'
import { z } from 'zod'

import { Button, Checkbox, Field, Input } from '#/components/ui'
import {
  authClient,
  thrownToAuthFailure,
  toAuthFailure,
} from '#/lib/auth/client'
import { cn } from '#/lib/cn'
import { formatNumber } from '#/lib/format'
import { useI18n, useTranslate } from '#/lib/i18n'
import { describeCallbackError, describeFailure } from './-lib/errors'
import { signInHead } from './-lib/head'
import { MIN_PASSWORD_LENGTH } from './-lib/schemas'
import { safeRedirect } from './-lib/redirect'
import { loadAuthConfig } from './-server/config'
import { AuthShell } from './-ui/auth-shell'
import {
  AuthPanel,
  FieldStack,
  FormAlert,
  OrDivider,
  PasswordInput,
  SocialButtons,
  useAuthSchemas,
  visibleError,
} from './-ui/form'

import type { MessageKey } from '#/lib/i18n'
import type { AuthMessage } from './-lib/errors'
import type { RegisterValues } from './-lib/schemas'
import type { SocialProviderId } from './-server/config'

const searchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/register')({
  validateSearch: searchSchema,
  head: signInHead,
  beforeLoad: async ({ search }) => {
    const config = await loadAuthConfig()
    if (config.signedIn) {
      throw redirect({ href: safeRedirect(search.redirect), statusCode: 302 })
    }
    return { config }
  },
  component: RegisterPage,
})

/* --------------------------------------------------------------- strength */

/**
 * One rung of the meter, as a whole sentence rather than a level glued to the
 * word "Strength": the five rungs are adjectives, and an adjective agreeing with
 * a noun is exactly what a two-key assembly cannot express in most of the
 * twenty-three languages.
 */
const STRENGTH_KEYS: ReadonlyArray<MessageKey> = [
  'auth.strength.tooShort',
  'auth.strength.weak',
  'auth.strength.fair',
  'auth.strength.strong',
  'auth.strength.excellent',
]

const STRENGTH_FILLS = [
  'bg-edge-strong',
  'bg-danger',
  'bg-warning',
  'bg-success',
  'bg-success',
] as const

/**
 * A deliberately transparent score: length does most of the work, because it
 * genuinely does, and variety tops it up. It never blocks a submit — the schema
 * owns the rule — it only tells the reader where they stand.
 */
function scorePassword(value: string): number {
  if (value.length < MIN_PASSWORD_LENGTH) return 0
  let score = 1
  if (value.length >= 14) score += 1
  if (value.length >= 20) score += 1
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((pattern) =>
    pattern.test(value),
  ).length
  if (classes >= 3) score += 1
  return Math.min(score, 4)
}

function PasswordStrength({ value }: { value: string }) {
  const { t, locale } = useI18n()
  const score = scorePassword(value)
  const rung = STRENGTH_KEYS[score] ?? STRENGTH_KEYS[0]

  return (
    <div className="mt-2">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-[background-color] duration-base ease-out-quint',
              index < score ? STRENGTH_FILLS[score] : 'bg-surface-inset',
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-caption text-ink-3" aria-live="polite">
        {value.length === 0
          ? t('auth.strength.hint', {
              count: MIN_PASSWORD_LENGTH,
              value: formatNumber(MIN_PASSWORD_LENGTH, locale),
            })
          : t(rung)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ screen */

/** Typed, not `satisfies`, so `acceptTerms` widens to `boolean`. */
const DEFAULTS: RegisterValues = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
}

function RegisterPage() {
  const search = Route.useSearch()
  const { config } = Route.useRouteContext()
  const target = safeRedirect(search.redirect)
  const t = useTranslate()
  const schemas = useAuthSchemas()

  const [failure, setFailure] = React.useState<AuthMessage | null>(() =>
    search.error ? describeCallbackError(search.error) : null,
  )
  const [socialPending, setSocialPending] =
    React.useState<SocialProviderId | null>(null)
  const [handingOff, setHandingOff] = React.useState(false)

  const handOff = React.useCallback((href: string) => {
    setHandingOff(true)
    window.location.assign(href)
  }, [])

  const form = useForm({
    defaultValues: DEFAULTS,
    validators: { onChange: schemas.register },
    onSubmit: async ({ value }) => {
      setFailure(null)
      const parsed = schemas.register.safeParse(value)
      if (!parsed.success) return

      const { error } = await authClient.signUp.email({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        // Where the confirmation link lands. The address is signed into the
        // token, so this only has to be a page that can explain itself.
        callbackURL: '/verify-email',
      })

      if (error) {
        setFailure(describeFailure(toAuthFailure(error)))
        return
      }
      // `autoSignIn` is on, so they are already in. The confirmation screen tells
      // them what is waiting in their inbox before they get on with planning.
      handOff('/verify-email')
    },
  })

  async function signUpWithProvider(provider: SocialProviderId): Promise<void> {
    setFailure(null)
    setSocialPending(provider)
    try {
      const { data, error } = await authClient.signIn.social({
        provider,
        callbackURL: target,
        errorCallbackURL: '/register',
      })
      if (error) {
        setFailure(describeFailure(toAuthFailure(error)))
        setSocialPending(null)
        return
      }
      if (typeof data.url === 'string' && data.url.length > 0) {
        window.location.assign(data.url)
        return
      }
      setSocialPending(null)
    } catch (cause) {
      setFailure(describeFailure(thrownToAuthFailure(cause)))
      setSocialPending(null)
    }
  }

  const busy = socialPending !== null || handingOff

  return (
    <AuthShell
      eyebrow={t('auth.register.eyebrow')}
      heading={t('auth.register.heading')}
      description={t('auth.register.description')}
      footer={
        <>
          {t('auth.register.haveAccount')}{' '}
          <Link
            to="/login"
            search={search.redirect ? { redirect: search.redirect } : {}}
            className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
          >
            {t('auth.register.signIn')}
          </Link>
        </>
      }
    >
      <AuthPanel>
        <FormAlert message={failure} onDismiss={() => setFailure(null)} />

        {config.socialProviders.length > 0 ? (
          <>
            <SocialButtons
              providers={config.socialProviders}
              pending={socialPending}
              disabled={busy}
              onSelect={(provider) => void signUpWithProvider(provider)}
              intent="signUp"
            />
            <OrDivider label={t('auth.divider.orEmail')} />
          </>
        ) : null}

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldStack>
            <form.Field name="name">
              {(field) => (
                <Field
                  label={t('auth.field.name')}
                  htmlFor={field.name}
                  error={visibleError(field.state.meta)}
                  hint={t('auth.field.name.hint')}
                >
                  <Input
                    id={field.name}
                    name={field.name}
                    autoComplete="name"
                    size="lg"
                    placeholder={t('auth.field.name.placeholder')}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    disabled={busy}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="email">
              {(field) => (
                <Field
                  label={t('auth.field.email')}
                  htmlFor={field.name}
                  error={visibleError(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                    size="lg"
                    placeholder={t('auth.field.email.placeholder')}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    disabled={busy}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <div>
                  <Field
                    label={t('auth.field.password')}
                    htmlFor={field.name}
                    error={visibleError(field.state.meta)}
                  >
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      autoComplete="new-password"
                      size="lg"
                      placeholder={t('auth.field.newPassword.placeholder')}
                      showLabel={t('auth.password.show')}
                      hideLabel={t('auth.password.hide')}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      disabled={busy}
                    />
                  </Field>
                  <PasswordStrength value={field.state.value} />
                </div>
              )}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => (
                <Field
                  label={t('auth.field.confirmPassword')}
                  htmlFor={field.name}
                  error={visibleError(field.state.meta)}
                >
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    autoComplete="new-password"
                    size="lg"
                    placeholder={t('auth.field.confirmPassword.placeholder')}
                    showLabel={t('auth.password.showConfirm')}
                    hideLabel={t('auth.password.hideConfirm')}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    disabled={busy}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="acceptTerms">
              {(field) => {
                const error = visibleError(field.state.meta)
                return (
                  <div>
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        id={field.name}
                        checked={field.state.value}
                        invalid={Boolean(error)}
                        onCheckedChange={(checked) => {
                          field.handleChange(checked === true)
                          field.handleBlur()
                        }}
                        disabled={busy}
                        aria-describedby={
                          error ? `${field.name}-error` : undefined
                        }
                      />
                      <label
                        htmlFor={field.name}
                        className="text-label text-ink-2 select-none"
                      >
                        {t('auth.register.terms')}
                      </label>
                    </div>
                    {error ? (
                      <p
                        id={`${field.name}-error`}
                        role="status"
                        aria-live="polite"
                        className="mt-1.5 text-caption font-medium text-danger"
                      >
                        {error}
                      </p>
                    ) : null}
                  </div>
                )
              }}
            </form.Field>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  block
                  icon={<Check />}
                  loading={isSubmitting || handingOff}
                  loadingLabel={t('auth.register.submitting')}
                  disabled={!canSubmit || busy}
                >
                  {t('auth.register.submit')}
                </Button>
              )}
            </form.Subscribe>
          </FieldStack>
        </form>
      </AuthPanel>
    </AuthShell>
  )
}
