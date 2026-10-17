import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { ArrowRight, BadgeCheck, MailCheck, Send } from 'lucide-react'
import { z } from 'zod'

import { Button, Field, Input } from '#/components/ui'
import { authClient, toAuthFailure } from '#/lib/auth/client'
import { useTranslate } from '#/lib/i18n'
import { describeCallbackError, describeFailure } from './-lib/errors'
import { signInHead } from './-lib/head'
import { DEFAULT_REDIRECT } from './-lib/redirect'
import { loadVerificationState } from './-server/config'
import { AuthShell } from './-ui/auth-shell'
import {
  AuthPanel,
  EmailSentence,
  FieldStack,
  FormAlert,
  useAuthSchemas,
  visibleError,
} from './-ui/form'

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
  head: signInHead,
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
  const t = useTranslate()
  const schemas = useAuthSchemas()

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
    validators: { onChange: schemas.resendVerification },
    onSubmit: async ({ value }) => {
      const parsed = schemas.resendVerification.safeParse(value)
      if (!parsed.success) return
      await resendTo(parsed.data.email)
    },
  })

  /* ------------------------------------------------------ already verified */

  if (state.verified) {
    const confirmed = state.email
    return (
      <AuthShell
        eyebrow={t('auth.verify.done.eyebrow')}
        heading={t('auth.verify.done.heading')}
        description={t('auth.verify.done.description')}
      >
        <AuthPanel>
          <Notice
            tone="success"
            icon={<BadgeCheck className="size-5" aria-hidden="true" />}
            title={t('auth.verify.done.title')}
          >
            {confirmed ? (
              <EmailSentence
                text={t('auth.verify.done.body', { email: confirmed })}
                email={confirmed}
              />
            ) : (
              t('auth.verify.done.bodyUnknown')
            )}
          </Notice>
          <Button
            variant="primary"
            size="lg"
            block
            className="mt-6"
            iconAfter={<ArrowRight data-mirror-rtl />}
            asChild
          >
            <Link to="/dashboard">{t('auth.verify.done.action')}</Link>
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
        eyebrow={t('auth.verify.pending.eyebrow')}
        heading={t('auth.verify.pending.heading')}
        description={
          <EmailSentence
            text={t('auth.verify.pending.description', { email })}
            email={email}
          />
        }
        footer={
          <>
            {t('auth.verify.pending.wrongAddress')}{' '}
            <Link
              to="/settings"
              className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
            >
              {t('auth.verify.pending.changeIt')}
            </Link>
          </>
        }
      >
        <AuthPanel>
          <FormAlert message={failure} onDismiss={() => setFailure(null)} />
          <Notice
            tone="brand"
            icon={<MailCheck className="size-5" aria-hidden="true" />}
            title={
              resentTo
                ? t('auth.verify.pending.resentTitle')
                : t('auth.verify.pending.title')
            }
          >
            {resentTo
              ? t('auth.verify.pending.resentBody')
              : t('auth.verify.pending.body')}
          </Notice>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              variant="secondary"
              size="lg"
              block
              loading={resending}
              loadingLabel={t('auth.verify.pending.resending')}
              onClick={() => void resendTo(email)}
            >
              {t('auth.verify.pending.resend')}
            </Button>
            <Button
              variant="primary"
              size="lg"
              block
              iconAfter={<ArrowRight data-mirror-rtl />}
              asChild
            >
              <Link to={DEFAULT_REDIRECT}>
                {t('auth.verify.pending.continue')}
              </Link>
            </Button>
          </div>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ---------------------------------------------- signed out: ask for the address */

  return (
    <AuthShell
      eyebrow={t('auth.verify.request.eyebrow')}
      heading={t('auth.verify.request.heading')}
      description={t('auth.verify.request.description')}
      footer={
        <Link
          to="/login"
          className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
        >
          {t('auth.verify.request.back')}
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
              title={t('auth.verify.request.sentTitle')}
            >
              {t('auth.verify.request.sentBody')}
            </Notice>
            <Button
              variant="secondary"
              size="lg"
              block
              className="mt-6"
              onClick={() => setResentTo(null)}
            >
              {t('auth.verify.request.change')}
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
                    icon={<Send data-mirror-rtl />}
                    loading={isSubmitting || resending}
                    loadingLabel={t('auth.verify.request.submitting')}
                    disabled={!canSubmit}
                  >
                    {t('auth.verify.request.submit')}
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
