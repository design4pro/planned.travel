import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { ArrowRight, BadgeCheck, MailCheck, Send } from 'lucide-react'
import { z } from 'zod'

import { Button, Field, Input } from '#/components/ui'
import { authClient, toAuthFailure } from '#/lib/auth/client'
import { describeCallbackError, describeFailure } from './-lib/errors'
import { resendVerificationSchema } from './-lib/schemas'
import { DEFAULT_REDIRECT } from './-lib/redirect'
import { loadVerificationState } from './-server/config'
import { AuthShell } from './-ui/auth-shell'
import { AuthPanel, FieldStack, FormAlert, visibleError } from './-ui/form'

import type { AuthMessage } from './-lib/errors'
import type { ResendVerificationValues } from './-lib/schemas'

/** Confirmation links come back here, so the page must explain every outcome. */
const VERIFY_LANDING = '/verify-email'

const searchSchema = z.object({
  /** Set by `/api/auth/verify-email` when the token was stale or already spent. */
  error: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/verify-email')({
  validateSearch: searchSchema,
  loader: () => loadVerificationState(),
  component: VerifyEmailPage,
})

/** A panel with a glyph, a headline and one line of explanation. */
function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'brand' | 'success'
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        className={
          tone === 'success'
            ? 'grid size-10 shrink-0 place-items-center rounded-md bg-success-soft text-success'
            : 'grid size-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand'
        }
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-label font-semibold text-ink">{title}</p>
        <p className="mt-1 text-caption text-ink-3">{children}</p>
      </div>
    </div>
  )
}

const DEFAULTS: ResendVerificationValues = { email: '' }

function VerifyEmailPage() {
  const state = Route.useLoaderData()
  const { error } = Route.useSearch()

  const [failure, setFailure] = React.useState<AuthMessage | null>(() =>
    error ? describeCallbackError(error) : null,
  )
  const [resending, setResending] = React.useState(false)
  const [resentTo, setResentTo] = React.useState<string | null>(null)

  async function resendTo(email: string): Promise<void> {
    setResending(true)
    setFailure(null)
    const { error: sendError } = await authClient.sendVerificationEmail({
      email,
      callbackURL: VERIFY_LANDING,
    })
    if (sendError) {
      setFailure(describeFailure(toAuthFailure(sendError)))
    } else {
      setResentTo(email)
    }
    setResending(false)
  }

  const form = useForm({
    defaultValues: DEFAULTS,
    validators: { onChange: resendVerificationSchema },
    onSubmit: async ({ value }) => {
      const parsed = resendVerificationSchema.safeParse(value)
      if (!parsed.success) return
      await resendTo(parsed.data.email)
    },
  })

  /* ------------------------------------------------------ already verified */

  if (state.verified) {
    return (
      <AuthShell
        eyebrow="Email confirmed"
        heading="You are all set"
        description="Your address is verified, so invitations, reminders and trip digests will reach you."
      >
        <AuthPanel>
          <Notice
            tone="success"
            icon={<BadgeCheck className="size-5" aria-hidden="true" />}
            title="Verified"
          >
            {state.email ?? 'Your email address'} is confirmed on this account.
          </Notice>
          <Button
            variant="primary"
            size="lg"
            block
            className="mt-6"
            iconAfter={<ArrowRight />}
            asChild
          >
            <Link to="/dashboard">Go to your dashboard</Link>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ------------------------------------------- signed in, not yet verified */

  if (state.signedIn && state.email) {
    const email = state.email
    return (
      <AuthShell
        eyebrow="One last thing"
        heading="Confirm your email address"
        description={
          <>
            We sent a confirmation link to{' '}
            <span className="font-semibold text-ink">{email}</span>. Opening it
            keeps your account recoverable and lets trip-mates invite you.
          </>
        }
        footer={
          <>
            Wrong address?{' '}
            <Link
              to="/settings"
              className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
            >
              Change it in settings
            </Link>
          </>
        }
      >
        <AuthPanel>
          <FormAlert message={failure} onDismiss={() => setFailure(null)} />
          <Notice
            tone="brand"
            icon={<MailCheck className="size-5" aria-hidden="true" />}
            title={resentTo ? 'Sent again just now' : 'The link lasts 24 hours'}
          >
            {resentTo
              ? 'Give it a minute, then check your inbox — and your spam folder.'
              : 'Nothing in your inbox? Check spam, then send it again.'}
          </Notice>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              size="lg"
              block
              loading={resending}
              loadingLabel="Sending again"
              onClick={() => void resendTo(email)}
            >
              Resend confirmation
            </Button>
            <Button
              variant="primary"
              size="lg"
              block
              iconAfter={<ArrowRight />}
              asChild
            >
              <Link to={DEFAULT_REDIRECT}>Continue anyway</Link>
            </Button>
          </div>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ---------------------------------------------- signed out: ask for the address */

  return (
    <AuthShell
      eyebrow="Email confirmation"
      heading="Send a new confirmation link"
      description="Confirmation links last 24 hours and work only once. Tell us your address and a fresh one is on its way."
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

        {resentTo ? (
          <>
            <Notice
              tone="success"
              icon={<MailCheck className="size-5" aria-hidden="true" />}
              title="On its way"
            >
              If that address has an account awaiting confirmation, the link is
              in its inbox now.
            </Notice>
            <Button
              variant="secondary"
              size="lg"
              block
              className="mt-6"
              onClick={() => setResentTo(null)}
            >
              Use a different email
            </Button>
          </>
        ) : (
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
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                  </Field>
                )}
              </form.Field>

              <form.Subscribe
                selector={(formState) => ({
                  canSubmit: formState.canSubmit,
                  isSubmitting: formState.isSubmitting,
                })}
              >
                {({ canSubmit, isSubmitting }) => (
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    block
                    icon={<Send />}
                    loading={isSubmitting || resending}
                    loadingLabel="Sending your link"
                    disabled={!canSubmit}
                  >
                    Send confirmation link
                  </Button>
                )}
              </form.Subscribe>
            </FieldStack>
          </form>
        )}
      </AuthPanel>
    </AuthShell>
  )
}
