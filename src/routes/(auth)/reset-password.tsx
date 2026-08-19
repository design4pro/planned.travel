import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { z } from 'zod'

import { Button, Field } from '#/components/ui'
import { authClient, toAuthFailure } from '#/lib/auth/client'
import { describeCallbackError, describeFailure } from './-lib/errors'
import { MIN_PASSWORD_LENGTH, resetPasswordSchema } from './-lib/schemas'
import { AuthShell } from './-ui/auth-shell'
import {
  AuthPanel,
  FieldStack,
  FormAlert,
  PasswordInput,
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
  const [failure, setFailure] = React.useState<AuthMessage | null>(null)
  const [done, setDone] = React.useState(false)

  const form = useForm({
    defaultValues: DEFAULTS,
    validators: { onChange: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      if (!token) return
      setFailure(null)
      const parsed = resetPasswordSchema.safeParse(value)
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

  /* --------------------------------------------------- the link went stale */

  if (!token) {
    const message = error
      ? describeCallbackError(error)
      : {
          title: 'This link is incomplete',
          detail:
            'Password reset links carry a one-time token. Open the most recent email, or request a fresh link.',
          tone: 'warning' as const,
        }

    return (
      <AuthShell
        eyebrow="Password reset"
        heading="That link cannot be used"
        description="Reset links expire after an hour and work only once — the safest possible trade."
        footer={
          <Link
            to="/login"
            className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
          >
            Back to sign in
          </Link>
        }
      >
        <AuthPanel>
          <FormAlert message={message} />
          <Button variant="primary" size="lg" block asChild>
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ------------------------------------------------------------- all done */

  if (done) {
    return (
      <AuthShell
        eyebrow="Password reset"
        heading="Your new password is set"
        description="Every other session has been signed out, so anyone who had the old password no longer has a way in."
      >
        <AuthPanel>
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-success-soft text-success">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-label font-semibold text-ink">
                Signed out everywhere else
              </p>
              <p className="mt-1 text-caption text-ink-3">
                Sign in with your new password to carry on planning.
              </p>
            </div>
          </div>
          <Button variant="primary" size="lg" block className="mt-6" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ---------------------------------------------------------------- form */

  return (
    <AuthShell
      eyebrow="Password reset"
      heading="Choose a new password"
      description={`Pick something at least ${MIN_PASSWORD_LENGTH} characters long. A short phrase is easier to remember and harder to guess.`}
      footer={
        <Link
          to="/login"
          className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
        >
          Back to sign in
        </Link>
      }
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
                  label="New password"
                  htmlFor={field.name}
                  error={visibleError(field.state.meta)}
                >
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    autoComplete="new-password"
                    size="lg"
                    placeholder="A phrase you will remember"
                    revealLabel="new password"
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
                  label="Confirm new password"
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
                  loadingLabel="Saving your password"
                  disabled={!canSubmit}
                >
                  Set new password
                </Button>
              )}
            </form.Subscribe>
          </FieldStack>
        </form>
      </AuthPanel>
    </AuthShell>
  )
}
