/**
 * Every platform action an operator can aim at one account, behind one control.
 *
 * One component for the users table and for the account screen, so a row and a page can never offer
 * different powers over the same person. It renders the affordance and the confirmation; the
 * decision stays where `docs/ACCESS.md` §2.5 puts it - each server function calls
 * `requirePermission` again, and a control this component chose to disable is a courtesy rather than
 * a boundary.
 *
 * **What is disabled, and why each one is disabled rather than left to fail.**
 *
 * - *Impersonate* is off on the operator's own row (there is nobody to become), on a banned account
 *   (`impersonateUser` mints a session the account's own ban forbids) and on another `admin`
 *   (§2.4 grants `user:impersonate-admins` to no role at all, ours included). All three are refused
 *   server-side too; the difference is that a disabled item with a reason beside it answers the
 *   question, and a 409 two seconds later only reports it.
 * - *Change role*, *Ban* and *Delete* are off on the operator's own row. A self-demotion can leave a
 *   platform with no `admin` at all - the model reserves no seat and the product ships no recovery
 *   path - and a self-ban or self-delete removes the operator's own way back in.
 * - *Lift the ban* appears only on a banned account, and *Ban* only on one that is not, because they
 *   are two states of one fact rather than two commands.
 *
 * *Revoke every session* and *Set a password* are deliberately **not** disabled on the operator's
 * own row. Both are legitimate there - an operator who has left a session on a machine they no
 * longer control wants exactly this - and both sign the operator out, so the copy says so in the
 * first person instead of the control quietly disappearing.
 */

import { useCallback, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  ArrowRightLeft,
  Ban,
  EllipsisVertical,
  KeyRound,
  MonitorSmartphone,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  IconButton,
  Input,
  RadioCard,
  RadioGroup,
  RadioGroupItem,
} from '#/components/ui'
import { startImpersonationFn } from '#/server/fns/console/impersonation'
import { revokePlatformUserSessionsFn } from '#/server/fns/console/sessions'
import {
  PLATFORM_ROLE_ORDER,
  PLATFORM_ROLE_VOCABULARY,
  displayPlatformRole,
} from '#/components/console'
import {
  deleteConsoleAccount,
  restoreConsoleAccount,
  setConsoleAccountPassword,
  setConsoleAccountRole,
  suspendConsoleAccount,
} from '../-server/users'
import { ConsoleActionDialog } from './action-dialog'

import type { ShellPlatformRole } from '#/components/layout/session'
import type { ConsoleUser } from '#/server/fns/console/projections'

/** Which panel is open. `null` is the resting state and the only one without a dialog. */
type OpenAction =
  | 'role'
  | 'ban'
  | 'unban'
  | 'sessions'
  | 'password'
  | 'impersonate'
  | 'delete'
  | null

/**
 * The temporary bans the console offers, plus permanent.
 *
 * Ninety days is the ceiling `banPlatformUserInputSchema` enforces; beyond it the honest answer is a
 * permanent ban that somebody has to lift deliberately, rather than an expiry nobody will remember
 * setting.
 */
const BAN_DURATIONS: ReadonlyArray<{
  value: string
  label: string
  description: string
}> = [
  {
    value: 'permanent',
    label: 'Permanent',
    description: 'Stays in force until an admin lifts it deliberately.',
  },
  {
    value: '1',
    label: '24 hours',
    description:
      'Long enough to interrupt, short enough to be an intervention.',
  },
  { value: '7', label: '7 days', description: 'A week to answer a complaint.' },
  { value: '30', label: '30 days', description: 'A month of enforced quiet.' },
  {
    value: '90',
    label: '90 days',
    description:
      'The longest the console offers. Beyond it, suspend permanently.',
  },
]

export interface UserActionsProps {
  readonly user: ConsoleUser
  /** True when this row is the signed-in operator's own account. */
  readonly self: boolean
  /** Reloads whatever is showing the account once an action has landed. */
  readonly onChanged: () => Promise<void> | void
  readonly align?: 'start' | 'end'
}

export function UserActions({
  user,
  self,
  onChanged,
  align = 'end',
}: UserActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState<OpenAction>(null)
  const currentRole = displayPlatformRole(user.role)
  const [role, setRole] = useState<ShellPlatformRole>(currentRole)
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('permanent')
  const [password, setPassword] = useState('')

  const targetIsAdmin = currentRole === 'admin'

  const close = useCallback(() => {
    setOpen(null)
  }, [])

  const settle = useCallback(
    async (message: string, description: string): Promise<void> => {
      await onChanged()
      toast.success(message, { description })
    },
    [onChanged],
  )

  const changeRole = useCallback(async (): Promise<void> => {
    await setConsoleAccountRole({ data: { userId: user.id, role } })
    await settle(
      'Platform role updated',
      `${user.name} is now ${PLATFORM_ROLE_VOCABULARY[role].label.toLowerCase()} on the platform.`,
    )
  }, [role, settle, user.id, user.name])

  const ban = useCallback(async (): Promise<void> => {
    await suspendConsoleAccount({
      data: {
        userId: user.id,
        reason: reason.trim(),
        ...(duration === 'permanent'
          ? {}
          : { expiresInDays: Number.parseInt(duration, 10) }),
      },
    })
    setReason('')
    setDuration('permanent')
    await settle(
      'Account suspended',
      `${user.name} has been signed out everywhere and cannot sign in again.`,
    )
  }, [duration, reason, settle, user.id, user.name])

  const unban = useCallback(async (): Promise<void> => {
    await restoreConsoleAccount({ data: { userId: user.id } })
    await settle(
      'Suspension lifted',
      `${user.name} can sign in again. No session was restored.`,
    )
  }, [settle, user.id, user.name])

  const revokeSessions = useCallback(async (): Promise<void> => {
    const result = await revokePlatformUserSessionsFn({
      data: { userId: user.id },
    })
    await settle(
      'Sessions revoked',
      result.revoked === 1
        ? 'One session was ended.'
        : `${result.revoked} sessions were ended.`,
    )
  }, [settle, user.id])

  const setNewPassword = useCallback(async (): Promise<void> => {
    await setConsoleAccountPassword({
      data: { userId: user.id, newPassword: password },
    })
    setPassword('')
    await settle(
      'Password set',
      `${user.name} has been signed out of every device.`,
    )
  }, [password, settle, user.id, user.name])

  const impersonate = useCallback(async (): Promise<void> => {
    await startImpersonationFn({ data: { userId: user.id } })
    // The session cookie now belongs to somebody else, so every loader result the router is holding
    // was resolved for the operator and has to go before the shell renders again.
    await router.invalidate()
    await router.navigate({ to: '/dashboard', replace: true })
  }, [router, user.id])

  const remove = useCallback(async (): Promise<void> => {
    await deleteConsoleAccount({ data: { userId: user.id } })
    await settle(
      'Account deleted',
      `${user.name} and everything attached to the account are gone.`,
    )
  }, [settle, user.id, user.name])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            icon={<EllipsisVertical />}
            label={`Actions for ${user.name}`}
            variant="ghost"
            size="sm"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="min-w-60">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem
            icon={<ShieldCheck />}
            disabled={self}
            onSelect={() => {
              setRole(currentRole)
              setOpen('role')
            }}
          >
            Change platform role
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<ArrowRightLeft />}
            disabled={self || user.banned || targetIsAdmin}
            onSelect={() => {
              setOpen('impersonate')
            }}
          >
            Impersonate
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Credentials</DropdownMenuLabel>
          <DropdownMenuItem
            icon={<KeyRound />}
            onSelect={() => {
              setPassword('')
              setOpen('password')
            }}
          >
            Set a password
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<MonitorSmartphone />}
            destructive
            onSelect={() => {
              setOpen('sessions')
            }}
          >
            Revoke every session
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          {user.banned ? (
            <DropdownMenuItem
              icon={<UserRoundCheck />}
              onSelect={() => {
                setOpen('unban')
              }}
            >
              Lift the suspension
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              icon={<Ban />}
              destructive
              disabled={self}
              onSelect={() => {
                setReason('')
                setDuration('permanent')
                setOpen('ban')
              }}
            >
              Suspend the account
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            icon={<Trash2 />}
            destructive
            disabled={self}
            onSelect={() => {
              setOpen('delete')
            }}
          >
            Delete the account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConsoleActionDialog
        open={open === 'role'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        title="Change platform role"
        description={`What ${user.name} may do on the platform itself. Workspace membership is a separate vocabulary and does not move.`}
        confirmLabel="Save role"
        confirmDisabled={role === currentRole}
        onConfirm={changeRole}
      >
        {/* Radio cards rather than a select, and not only because three options with a sentence
            each read better opened than closed: a Radix select popover carries `--z-dropdown`,
            which sits *below* `--z-overlay`, so a select opened inside a dialog renders behind
            that dialog's own scrim and cannot be clicked at all. Measured on this panel. The
            layering is `src/components/ui/select.tsx`'s to fix and is reported with this item;
            what belongs here is a control that needs no layer of its own. */}
        <Field label="Platform role">
          <RadioGroup
            aria-label="Platform role"
            value={role}
            onValueChange={(next) => {
              setRole(next as ShellPlatformRole)
            }}
          >
            {PLATFORM_ROLE_ORDER.map((name) => {
              const descriptor = PLATFORM_ROLE_VOCABULARY[name]
              const Icon = descriptor.icon
              return (
                <RadioCard
                  key={name}
                  value={name}
                  icon={<Icon className="size-4" />}
                  label={descriptor.label}
                  description={descriptor.summary}
                  meta={
                    name === currentRole ? (
                      <span className="text-caption font-medium text-ink-3">
                        Current
                      </span>
                    ) : undefined
                  }
                />
              )
            })}
          </RadioGroup>
        </Field>
      </ConsoleActionDialog>

      <ConsoleActionDialog
        open={open === 'ban'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        title={`Suspend ${user.name}`}
        description="Every session ends immediately and the account cannot sign in again until the suspension is lifted or expires."
        confirmLabel="Suspend account"
        confirmVariant="danger"
        confirmDisabled={reason.trim().length === 0}
        onConfirm={ban}
      >
        <Field
          label="Reason"
          required
          hint="Kept on the platform audit trail for thirteen months, and shown to nobody but an admin."
        >
          <Input
            value={reason}
            maxLength={280}
            autoComplete="off"
            placeholder="Repeated abuse reports from three workspaces"
            onChange={(event) => {
              setReason(event.currentTarget.value)
            }}
          />
        </Field>
        <Field label="Duration">
          <RadioGroup
            aria-label="Suspension duration"
            value={duration}
            onValueChange={setDuration}
          >
            {BAN_DURATIONS.map((option) => (
              <RadioGroupItem
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
              />
            ))}
          </RadioGroup>
        </Field>
      </ConsoleActionDialog>

      <ConsoleActionDialog
        open={open === 'unban'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        title={`Lift the suspension on ${user.name}`}
        description="The account can sign in again from its next attempt. No previous session is restored."
        confirmLabel="Lift suspension"
        onConfirm={unban}
      />

      <ConsoleActionDialog
        open={open === 'sessions'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        title="Revoke every session"
        description={
          self
            ? 'This signs you out of every device, including the one you are reading this on.'
            : `${user.name} is signed out of every device and has to sign in again.`
        }
        confirmLabel="Revoke sessions"
        confirmVariant="danger"
        onConfirm={revokeSessions}
      />

      <ConsoleActionDialog
        open={open === 'password'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        title={`Set a password for ${user.name}`}
        description="Use this to recover a locked-out account or to shut an attacker out of a compromised one."
        confirmLabel="Set password"
        confirmDisabled={password.length === 0}
        onConfirm={setNewPassword}
      >
        <Field
          label="New password"
          required
          hint={
            self
              ? 'Every session ends when this is set — including yours.'
              : 'Every session the account holds ends when this is set.'
          }
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
      </ConsoleActionDialog>

      <ConsoleActionDialog
        open={open === 'impersonate'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        title={`Act as ${user.name}`}
        description="You will see the product exactly as this account does, for fifteen minutes."
        confirmLabel="Start impersonating"
        onConfirm={impersonate}
      >
        <ul className="flex flex-col gap-2 text-caption leading-relaxed text-ink-2">
          <li>
            A warning bar stays on every screen until you end it, and it cannot
            be dismissed.
          </li>
          <li>
            Platform actions are unavailable while you are acting as somebody
            else — the console included.
          </li>
          <li>
            Starting and ending are both written to the platform audit trail,
            with your name on them.
          </li>
        </ul>
      </ConsoleActionDialog>

      <ConsoleActionDialog
        open={open === 'delete'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        title={`Delete ${user.name}`}
        description="The account, its sessions and every credential attached to it are removed. This cannot be undone."
        confirmLabel="Delete account"
        confirmVariant="danger"
        onConfirm={remove}
      >
        <p className="text-caption leading-relaxed text-ink-2">
          Workspace content this person created stays with the workspace that
          owns it. Suspending the account instead keeps the record and takes
          away the access.
        </p>
      </ConsoleActionDialog>
    </>
  )
}
