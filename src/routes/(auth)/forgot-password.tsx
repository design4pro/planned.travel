import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { ArrowLeft, MailCheck, Send } from 'lucide-react'

import { Button, Field, Input } from '#/components/ui'
import { authClient, toAuthFailure } from '#/lib/auth/client'
import { describeFailure } from './-lib/errors'
import { forgotPasswordSchema } from './-lib/schemas'
import { AuthShell } from './-ui/auth-shell'
import { AuthPanel, FieldStack, FormAlert, visibleError } from './-ui/form'

import type { AuthMessage } from './-lib/errors'
import type { ForgotPasswordValues } from './-lib/schemas'

/** Where the emailed link should land once the token has been checked. */
const RESET_LANDING = '/reset-password'

export const Route = createFileRoute('/(auth)/forgot-password')({
  component: ForgotPasswordPage,
})

const DEFAULTS: ForgotPasswordValues = { email: '' }

function ForgotPasswordPage() {
  const [failure, setFailure] = React.useState<AuthMessage | null>(null)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [resending, setResending] = React.useState(false)

  const form = useForm({
    defaultValues: DEFAULTS,
    validators: { onChange: forgotPasswordSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)
      const parsed = forgotPasswordSchema.safeParse(value)
      if (!parsed.success) return

      const { error } = await authClient.requestPasswordReset({
        email: parsed.data.email,
        redirectTo: RESET_LANDING,
      })
      if (error) {
        setFailure(describeFailure(toAuthFailure(error)))
        return
      }
      // The endpoint answers identically for unknown addresses, and so do we:
      // confirming which emails exist is not a feature.
      setSentTo(parsed.data.email)
    },
  })

  async function resend(): Promise<void> {
    if (!sentTo) return
    setResending(true)
    setFailure(null)
    const { error } = await authClient.requestPasswordReset({
      email: sentTo,
      redirectTo: RESET_LANDING,
    })
    if (error) {
      setFailure(describeFailure(toAuthFailure(error)))
    }
    setResending(false)
  }

  const backToSignIn = (
    <Link
      to="/login"
      className="inline-flex items-center gap-1.5 rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      Back to sign in
    </Link>
  )

  if (sentTo) {
    return (
      <AuthShell
        eyebrow="Check your inbox"
        heading="Your reset link is on its way"
        description={
          <>
            If an account uses{' '}
            <span className="font-semibold text-ink">{sentTo}</span>, a link to
            choose a new password is in that inbox now.
          </>
        }
        footer={backToSignIn}
      >
        <AuthPanel>
          <FormAlert message={failure} onDismiss={() => setFailure(null)} />
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand">
              <MailCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-label font-semibold text-ink">
                The link works once, for one hour
              </p>
              <p className="mt-1 text-caption text-ink-3">
                Nothing arrived? Check spam, then send it again. Requesting a
                new link quietly retires the previous one.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              size="lg"
              block
              loading={resending}
              loadingLabel="Sending again"
              onClick={() => void resend()}
            >
              Send it again
            </Button>
            <Button
              variant="ghost"
              size="lg"
              block
              onClick={() => {
                setSentTo(null)
                setFailure(null)
              }}
            >
              Use a different email
            </Button>
          </div>
        </AuthPanel>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Password help"
      heading="Reset your password"
      description="Tell us the address on your account and we will email you a link to set a new password."
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
                    autoFocus
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
                  icon={<Send />}
                  loading={isSubmitting}
                  loadingLabel="Sending your link"
                  disabled={!canSubmit}
                >
                  Email me a reset link
                </Button>
              )}
            </form.Subscribe>
          </FieldStack>
        </form>
      </AuthPanel>
    </AuthShell>
  )
}
