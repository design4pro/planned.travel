import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { z } from 'zod'

import { Button, Field } from '#/components/ui'
import { authClient, toAuthFailure } from '#/lib/auth/client'
import { formatNumber } from '#/lib/format'
import { useI18n } from '#/lib/i18n'
import {
  LINK_INCOMPLETE,
  describeCallbackError,
  describeFailure,
} from './-lib/errors'
import { MIN_PASSWORD_LENGTH } from './-lib/schemas'
import { AuthShell } from './-ui/auth-shell'
import {
  AuthPanel,
  FieldStack,
  FormAlert,
  PasswordInput,
  useAuthSchemas,
  useRevalidateAuthErrors,
  visibleError,
} from './-ui/form'

import type { AuthMessage } from './-lib/errors'
import type { ResetPasswordValues } from './-lib/schemas'

/**
 * Better Auth's `/reset-password/:token` callback checks the token, then bounces
 * here with `?token=` on success or `?error=` when it has already expired or been
 * spent — so both halves of the arrival are in the search params.
 */
const searchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/reset-password')({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
})

const DEFAULTS: ResetPasswordValues = { password: '', confirmPassword: '' }

function ResetPasswordPage() {
  const { token, error } = Route.useSearch()
  const { t, locale } = useI18n()
  const schemas = useAuthSchemas()
  const [failure, setFailure] = React.useState<AuthMessage | null>(null)
  const [done, setDone] = React.useState(false)

  const form = useForm({
    defaultValues: DEFAULTS,
    validators: { onChange: schemas.resetPassword },
    onSubmit: async ({ value }) => {
      if (!token) return
      setFailure(null)
      const parsed = schemas.resetPassword.safeParse(value)
      if (!parsed.success) return

      const { error: resetError } = await authClient.resetPassword({
        newPassword: parsed.data.password,
        token,
      })
      if (resetError) {
        setFailure(describeFailure(toAuthFailure(resetError)))
        return
      }
      setDone(true)
    },
  })
  useRevalidateAuthErrors(form)

  const backToSignIn = (
    <Link
      to="/login"
      className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
    >
      {t('auth.reset.back')}
    </Link>
  )

  /* --------------------------------------------------- the link went stale */

  if (!token) {
    // A `?error=` names what went wrong; its absence means the link arrived
    // without a token at all, which is its own message rather than a code.
    const message = error ? describeCallbackError(error) : LINK_INCOMPLETE

    return (
      <AuthShell
        eyebrow={t('auth.reset.eyebrow')}
        heading={t('auth.reset.stale.heading')}
        description={t('auth.reset.stale.description')}
        footer={backToSignIn}
      >
        <AuthPanel>
          <FormAlert message={message} />
          <Button variant="primary" size="lg" block asChild>
            <Link to="/forgot-password">{t('auth.reset.stale.action')}</Link>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ------------------------------------------------------------- all done */

  if (done) {
    return (
      <AuthShell
        eyebrow={t('auth.reset.eyebrow')}
        heading={t('auth.reset.done.heading')}
        description={t('auth.reset.done.description')}
      >
        <AuthPanel>
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-success-soft text-success">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-label font-semibold text-ink">
                {t('auth.reset.done.title')}
              </p>
              <p className="mt-1 text-caption text-ink-3">
                {t('auth.reset.done.body')}
              </p>
            </div>
          </div>
          <Button variant="primary" size="lg" block className="mt-6" asChild>
            <Link to="/login">{t('auth.reset.done.action')}</Link>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ---------------------------------------------------------------- form */

  return (
    <AuthShell
      eyebrow={t('auth.reset.eyebrow')}
      heading={t('auth.reset.heading')}
      description={t('auth.reset.description', {
        count: MIN_PASSWORD_LENGTH,
        value: formatNumber(MIN_PASSWORD_LENGTH, locale),
      })}
      footer={backToSignIn}
    >
      <AuthPanel>
        <FormAlert message={failure} onDismiss={() => setFailure(null)} />
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldStack>
            <form.Field name="password">
              {(field) => (
                <Field
                  label={t('auth.field.newPassword')}
                  htmlFor={field.name}
                  error={visibleError(field.state.meta)}
                >
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    autoComplete="new-password"
                    size="lg"
                    placeholder={t('auth.field.newPassword.placeholder')}
                    showLabel={t('auth.password.showNew')}
                    hideLabel={t('auth.password.hideNew')}
                    autoFocus
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => (
                <Field
                  label={t('auth.field.confirmNewPassword')}
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
                  />
                </Field>
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
                  icon={<KeyRound />}
                  loading={isSubmitting}
                  loadingLabel={t('auth.reset.submitting')}
                  disabled={!canSubmit}
                >
                  {t('auth.reset.submit')}
                </Button>
              )}
            </form.Subscribe>
          </FieldStack>
        </form>
      </AuthPanel>
    </AuthShell>
  )
}
