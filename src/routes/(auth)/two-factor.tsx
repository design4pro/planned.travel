import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react'
import { z } from 'zod'

import {
  Button,
  Checkbox,
  Field,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui'
import { authClient, toAuthFailure } from '#/lib/auth/client'
import { useTranslate } from '#/lib/i18n'
import { describeFailure } from './-lib/errors'
import { safeRedirect } from './-lib/redirect'
import { AuthShell } from './-ui/auth-shell'
import {
  AuthPanel,
  CodeInput,
  FieldStack,
  FormAlert,
  useAuthSchemas,
  visibleError,
} from './-ui/form'

import type { AuthMessage } from './-lib/errors'
import type { BackupCodeValues, TotpValues } from './-lib/schemas'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/two-factor')({
  validateSearch: searchSchema,
  component: TwoFactorPage,
})

type Method = 'totp' | 'backup'

/** Typed, not `satisfies`, so `trustDevice` widens to `boolean`. */
const TOTP_DEFAULTS: TotpValues = { code: '', trustDevice: false }
const BACKUP_DEFAULTS: BackupCodeValues = { code: '', trustDevice: false }

function TwoFactorPage() {
  const search = Route.useSearch()
  const target = safeRedirect(search.redirect)
  const t = useTranslate()
  const schemas = useAuthSchemas()

  const [method, setMethod] = React.useState<Method>('totp')
  const [failure, setFailure] = React.useState<AuthMessage | null>(null)
  const [handingOff, setHandingOff] = React.useState(false)

  /**
   * A document load, not a client navigation: verification is what upgrades the
   * cookie to a full session, and the app shell's server loader has to see it.
   */
  const handOff = React.useCallback(() => {
    setHandingOff(true)
    window.location.assign(target)
  }, [target])

  const totpForm = useForm({
    defaultValues: TOTP_DEFAULTS,
    validators: { onChange: schemas.totp },
    onSubmit: async ({ value }) => {
      setFailure(null)
      const parsed = schemas.totp.safeParse(value)
      if (!parsed.success) return

      const { error } = await authClient.twoFactor.verifyTotp({
        code: parsed.data.code,
        trustDevice: parsed.data.trustDevice,
      })
      if (error) {
        setFailure(describeFailure(toAuthFailure(error)))
        return
      }
      handOff()
    },
  })

  const backupForm = useForm({
    defaultValues: BACKUP_DEFAULTS,
    validators: { onChange: schemas.backupCode },
    onSubmit: async ({ value }) => {
      setFailure(null)
      const parsed = schemas.backupCode.safeParse(value)
      if (!parsed.success) return

      const { error } = await authClient.twoFactor.verifyBackupCode({
        code: parsed.data.code,
        trustDevice: parsed.data.trustDevice,
      })
      if (error) {
        setFailure(describeFailure(toAuthFailure(error)))
        return
      }
      handOff()
    },
  })

  return (
    <AuthShell
      eyebrow={t('auth.twoFactor.eyebrow')}
      heading={t('auth.twoFactor.heading')}
      description={t('auth.twoFactor.description')}
      footer={
        <Link
          to="/login"
          className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
        >
          {t('auth.twoFactor.back')}
        </Link>
      }
    >
      <AuthPanel>
        <FormAlert message={failure} onDismiss={() => setFailure(null)} />

        <Tabs
          variant="segmented"
          value={method}
          onValueChange={(next) => {
            setMethod(next === 'backup' ? 'backup' : 'totp')
            setFailure(null)
          }}
        >
          <TabsList aria-label={t('auth.twoFactor.methods')}>
            <TabsTrigger value="totp" icon={<Smartphone />}>
              {t('auth.twoFactor.totp.tab')}
            </TabsTrigger>
            <TabsTrigger value="backup" icon={<KeyRound />}>
              {t('auth.twoFactor.backup.tab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="totp">
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                void totpForm.handleSubmit()
              }}
            >
              <FieldStack>
                <totpForm.Field name="code">
                  {(field) => (
                    <Field
                      label={t('auth.twoFactor.totp.label')}
                      htmlFor="totp-code"
                      error={visibleError(field.state.meta)}
                      hint={t('auth.twoFactor.totp.hint')}
                    >
                      {/* The two placeholders on this screen are pictures of
                          the characters a field takes, not copy: a digit mask
                          reads the same in all twenty-three languages, and a
                          translation identical to English is what the parity
                          gate calls untranslated. */}
                      <CodeInput
                        id="totp-code"
                        name={field.name}
                        maxLength={7}
                        placeholder="000000"
                        autoFocus
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        disabled={handingOff}
                      />
                    </Field>
                  )}
                </totpForm.Field>

                <totpForm.Field name="trustDevice">
                  {(field) => (
                    <TrustDevice
                      id="totp-trust"
                      checked={field.state.value}
                      disabled={handingOff}
                      onChange={(checked) => field.handleChange(checked)}
                    />
                  )}
                </totpForm.Field>

                <totpForm.Subscribe
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
                      icon={<ShieldCheck />}
                      loading={isSubmitting || handingOff}
                      loadingLabel={t('auth.twoFactor.submitting')}
                      disabled={!canSubmit || handingOff}
                    >
                      {t('auth.twoFactor.totp.submit')}
                    </Button>
                  )}
                </totpForm.Subscribe>
              </FieldStack>
            </form>
          </TabsContent>

          <TabsContent value="backup">
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                void backupForm.handleSubmit()
              }}
            >
              <FieldStack>
                <backupForm.Field name="code">
                  {(field) => (
                    <Field
                      label={t('auth.twoFactor.backup.label')}
                      htmlFor="backup-code"
                      error={visibleError(field.state.meta)}
                      hint={t('auth.twoFactor.backup.hint')}
                    >
                      <Input
                        id="backup-code"
                        name={field.name}
                        size="lg"
                        autoComplete="one-time-code"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={24}
                        placeholder="xxxxx-xxxxx"
                        data-numeric
                        className="font-mono tracking-wide numeral"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        disabled={handingOff}
                      />
                    </Field>
                  )}
                </backupForm.Field>

                <backupForm.Field name="trustDevice">
                  {(field) => (
                    <TrustDevice
                      id="backup-trust"
                      checked={field.state.value}
                      disabled={handingOff}
                      onChange={(checked) => field.handleChange(checked)}
                    />
                  )}
                </backupForm.Field>

                <backupForm.Subscribe
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
                      icon={<ShieldCheck />}
                      loading={isSubmitting || handingOff}
                      loadingLabel={t('auth.twoFactor.submitting')}
                      disabled={!canSubmit || handingOff}
                    >
                      {t('auth.twoFactor.backup.submit')}
                    </Button>
                  )}
                </backupForm.Subscribe>
              </FieldStack>
            </form>
          </TabsContent>
        </Tabs>
      </AuthPanel>
    </AuthShell>
  )
}

/** Shared between both methods, so the promise reads identically either way. */
function TrustDevice({
  id,
  checked,
  disabled,
  onChange,
}: {
  id: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  const t = useTranslate()
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <label htmlFor={id} className="text-label text-ink-2 select-none">
        {t('auth.twoFactor.trust.label')}
        <span className="mt-0.5 block text-caption text-ink-3">
          {t('auth.twoFactor.trust.detail')}
        </span>
      </label>
    </div>
  )
}
