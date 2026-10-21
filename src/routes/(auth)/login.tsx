import * as React from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'

import { Button, Checkbox, Field, Input } from '#/components/ui'
import {
  authClient,
  needsTwoFactor,
  signInWithPasskey,
  thrownToAuthFailure,
  toAuthFailure,
} from '#/lib/auth/client'
import { useTranslate } from '#/lib/i18n'
import { describeCallbackError, describeFailure } from './-lib/errors'
import { signInHead } from './-lib/head'
import { safeRedirect } from './-lib/redirect'
import { loadAuthConfig } from './-server/config'
import { AuthShell } from './-ui/auth-shell'
import {
  AuthPanel,
  FieldStack,
  FormAlert,
  OrDivider,
  PasskeyButton,
  PasswordInput,
  SocialButtons,
  useAuthSchemas,
  useRevalidateAuthErrors,
  visibleError,
} from './-ui/form'

import type { AuthMessage } from './-lib/errors'
import type { LoginValues } from './-lib/schemas'
import type { SocialProviderId } from './-server/config'

const searchSchema = z.object({
  /** Where `_app` wanted to go before it bounced an anonymous visitor here. */
  redirect: z.string().optional(),
  /** Set by an OAuth provider when the round trip failed. */
  error: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/login')({
  validateSearch: searchSchema,
  head: signInHead,
  beforeLoad: async ({ search }) => {
    const config = await loadAuthConfig()
    // Someone who is already signed in has no business on the sign-in screen.
    if (config.signedIn) {
      throw redirect({ href: safeRedirect(search.redirect), statusCode: 302 })
    }
    return { config }
  },
  component: LoginPage,
})

/** Typed, not `satisfies`, so `rememberMe` widens to `boolean`. */
const DEFAULTS: LoginValues = { email: '', password: '', rememberMe: true }

function LoginPage() {
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
  const [passkeyPending, setPasskeyPending] = React.useState(false)
  const [handingOff, setHandingOff] = React.useState(false)

  /**
   * A full document load rather than a client navigation: the session cookie
   * arrives on the sign-in response, and reloading is what guarantees the app
   * shell's server loader sees it on its very first run.
   */
  const handOff = React.useCallback((href: string) => {
    setHandingOff(true)
    window.location.assign(href)
  }, [])

  const form = useForm({
    defaultValues: DEFAULTS,
    validators: { onChange: schemas.login },
    onSubmit: async ({ value }) => {
      setFailure(null)
      // Re-parsed rather than reused: the schema is what lowercases the address.
      const parsed = schemas.login.safeParse(value)
      if (!parsed.success) return

      const { data, error } = await authClient.signIn.email({
        email: parsed.data.email,
        password: parsed.data.password,
        rememberMe: parsed.data.rememberMe,
      })

      if (error) {
        setFailure(describeFailure(toAuthFailure(error)))
        return
      }
      if (needsTwoFactor(data)) {
        handOff(
          target === '/dashboard'
            ? '/two-factor'
            : `/two-factor?redirect=${encodeURIComponent(target)}`,
        )
        return
      }
      handOff(target)
    },
  })
  useRevalidateAuthErrors(form)

  async function signInWithProvider(provider: SocialProviderId): Promise<void> {
    setFailure(null)
    setSocialPending(provider)
    try {
      const { data, error } = await authClient.signIn.social({
        provider,
        callbackURL: target,
        errorCallbackURL: '/login',
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

  async function signInWithDevicePasskey(): Promise<void> {
    setFailure(null)
    setPasskeyPending(true)
    const result = await signInWithPasskey(form.getFieldValue('email'))
    if (result.ok) {
      handOff(target)
      return
    }
    if (!result.aborted) {
      setFailure(describeFailure(result.failure))
    }
    setPasskeyPending(false)
  }

  const busy = socialPending !== null || passkeyPending || handingOff

  return (
    <AuthShell
      eyebrow={t('auth.login.eyebrow')}
      heading={t('auth.login.heading')}
      description={t('auth.login.description')}
      footer={
        <>
          {t('auth.login.newHere')}{' '}
          <Link
            to="/register"
            search={search.redirect ? { redirect: search.redirect } : {}}
            className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
          >
            {t('auth.login.createAccount')}
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
              onSelect={(provider) => void signInWithProvider(provider)}
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
                    autoComplete="email username"
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
                <Field
                  label={t('auth.field.password')}
                  htmlFor={field.name}
                  error={visibleError(field.state.meta)}
                  action={
                    <Link
                      to="/forgot-password"
                      className="rounded-sm font-medium text-brand underline decoration-brand/30 underline-offset-4 focus-ring hover:decoration-brand"
                    >
                      {t('auth.login.forgot')}
                    </Link>
                  }
                >
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    autoComplete="current-password"
                    size="lg"
                    placeholder={t('auth.field.password.placeholder')}
                    showLabel={t('auth.password.show')}
                    hideLabel={t('auth.password.hide')}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    disabled={busy}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="rememberMe">
              {(field) => (
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                    disabled={busy}
                  />
                  <label
                    htmlFor={field.name}
                    className="text-label text-ink-2 select-none"
                  >
                    {t('auth.login.remember')}
                  </label>
                </div>
              )}
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
                  loading={isSubmitting || handingOff}
                  loadingLabel={t('auth.login.submitting')}
                  disabled={!canSubmit || busy}
                >
                  {t('auth.login.submit')}
                </Button>
              )}
            </form.Subscribe>
          </FieldStack>
        </form>

        <PasskeyDivider />
        <PasskeyButton
          pending={passkeyPending}
          disabled={busy}
          onSelect={() => void signInWithDevicePasskey()}
        />
      </AuthPanel>
    </AuthShell>
  )
}

/**
 * The divider only earns its space when the passkey button below it will render,
 * which is a client-only fact — so it resolves support on the same terms.
 */
function PasskeyDivider() {
  const [supported, setSupported] = React.useState(false)
  React.useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential === 'function',
    )
  }, [])
  if (!supported) return null
  return <OrDivider />
}
