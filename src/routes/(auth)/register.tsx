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
import { describeCallbackError, describeFailure } from './-lib/errors'
import { MIN_PASSWORD_LENGTH, registerSchema } from './-lib/schemas'
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
  visibleError,
} from './-ui/form'

import type { AuthMessage } from './-lib/errors'
import type { RegisterValues } from './-lib/schemas'
import type { SocialProviderId } from './-server/config'

const searchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/register')({
  validateSearch: searchSchema,
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

const STRENGTH_LABELS = [
  'Too short',
  'Weak',
  'Fair',
  'Strong',
  'Excellent',
] as const
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
  const score = scorePassword(value)
  const label = STRENGTH_LABELS[score] ?? STRENGTH_LABELS[0]

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
          ? `At least ${MIN_PASSWORD_LENGTH} characters. A short phrase beats a clever word.`
          : `Strength: ${label}`}
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
    validators: { onChange: registerSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)
      const parsed = registerSchema.safeParse(value)
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
      eyebrow="Create your account"
      heading="Start planning in a couple of minutes"
      description="One account covers every trip, every travelling companion and every list."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            search={search.redirect ? { redirect: search.redirect } : {}}
            className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
          >
            Sign in
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
              verb="Sign up with"
            />
            <OrDivider label="or use your email" />
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
                  label="Your name"
                  htmlFor={field.name}
                  error={visibleError(field.state.meta)}
                  hint="Shown to the people you plan trips with."
                >
                  <Input
                    id={field.name}
                    name={field.name}
                    autoComplete="name"
                    size="lg"
                    placeholder="Alex Moreau"
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
                  label="Email address"
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
                    placeholder="you@example.com"
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
                    label="Password"
                    htmlFor={field.name}
                    error={visibleError(field.state.meta)}
                  >
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      autoComplete="new-password"
                      size="lg"
                      placeholder="A phrase you will remember"
                      revealLabel="password"
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
                  label="Confirm password"
                  htmlFor={field.name}
                  error={visibleError(field.state.meta)}
                >
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    autoComplete="new-password"
                    size="lg"
                    placeholder="Type it once more"
                    revealLabel="password confirmation"
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
                        I agree to the terms of service and the privacy notice.
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
                  loadingLabel="Creating your account"
                  disabled={!canSubmit || busy}
                >
                  Create account
                </Button>
              )}
            </form.Subscribe>
          </FieldStack>
        </form>
      </AuthPanel>
    </AuthShell>
  )
}
