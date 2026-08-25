/**
 * Minting an account from the console, which is how the second `admin` and every `curator` arrive.
 *
 * `docs/ACCESS.md` §8.1 bootstraps the *first* admin with one SQL statement, once per environment,
 * and says in as many words that the path exists once and never becomes a habit - it writes no
 * `platform_audit_log` entry, so a role that arrived that way is a role nobody can account for
 * afterwards. This control is the reason that stays true: it goes through
 * `createPlatformUserFn`, which passes `requirePermission(session, { user: ['create', 'set-role'] })`
 * and appends `platform.user.created` with the role in the `after` payload.
 *
 * The password is set by the operator and not mailed. Better Auth's `/admin/create-user` hashes
 * whatever it is handed and never consults the product's own length policy - the one path in the
 * product where nothing else would stop a one-character credential - so the boundary that catches a
 * weak one is `createPlatformUserInputSchema`, and its message is what the dialog shows.
 */

import { useCallback, useState } from 'react'
import { UserRoundPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Field, Input, RadioCard, RadioGroup } from '#/components/ui'
import {
  PLATFORM_ROLE_ORDER,
  PLATFORM_ROLE_VOCABULARY,
} from '#/components/console'
import { createConsoleAccount } from '../-server/users'
import { ConsoleActionDialog } from './action-dialog'

import type { ShellPlatformRole } from '#/components/layout/session'

export interface CreateAccountButtonProps {
  /** Reloads the users list once the account exists. */
  readonly onCreated: () => Promise<void> | void
}

export function CreateAccountButton({ onCreated }: CreateAccountButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<ShellPlatformRole>('user')

  const create = useCallback(async (): Promise<void> => {
    const created = await createConsoleAccount({
      data: {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      },
    })
    setName('')
    setEmail('')
    setPassword('')
    setRole('user')
    await onCreated()
    toast.success('Account created', {
      description: `${created.email} can sign in with the password you set.`,
    })
  }, [email, name, onCreated, password, role])

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        shape="pill"
        icon={<UserRoundPlus />}
        onClick={() => {
          setOpen(true)
        }}
      >
        New account
      </Button>

      <ConsoleActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Create an account"
        description="The address is not verified and no mail is sent — hand the password over yourself."
        confirmLabel="Create account"
        confirmDisabled={
          name.trim().length === 0 ||
          email.trim().length === 0 ||
          password.length === 0
        }
        onConfirm={create}
      >
        <Field label="Name" required>
          <Input
            value={name}
            maxLength={120}
            autoComplete="off"
            placeholder="Mika Tanaka"
            onChange={(event) => {
              setName(event.currentTarget.value)
            }}
          />
        </Field>
        <Field label="Email address" required>
          <Input
            type="email"
            value={email}
            maxLength={320}
            autoComplete="off"
            placeholder="mika@planned.travel"
            onChange={(event) => {
              setEmail(event.currentTarget.value)
            }}
          />
        </Field>
        <Field
          label="Password"
          required
          hint="Long enough to be a passphrase. The account can change it afterwards."
        >
          <Input
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => {
              setPassword(event.currentTarget.value)
            }}
          />
        </Field>
        {/* A radio set rather than a select: a Radix select popover carries `--z-dropdown`, which
            is below `--z-overlay`, so one opened inside a dialog renders behind that dialog's own
            scrim. Reported with this item; the control that needs no layer is the one used here. */}
        <Field label="Platform role">
          <RadioGroup
            aria-label="Platform role"
            value={role}
            onValueChange={(next) => {
              setRole(next as ShellPlatformRole)
            }}
          >
            {PLATFORM_ROLE_ORDER.map((option) => {
              const descriptor = PLATFORM_ROLE_VOCABULARY[option]
              const Icon = descriptor.icon
              return (
                <RadioCard
                  key={option}
                  value={option}
                  icon={<Icon className="size-4" />}
                  label={descriptor.label}
                  description={descriptor.summary}
                />
              )
            })}
          </RadioGroup>
        </Field>
      </ConsoleActionDialog>
    </>
  )
}
