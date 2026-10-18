import { useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SimpleSelect,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'

import type { MessageKey } from '#/lib/i18n'

/** The workspace roles, as the `member.role` column spells them. */
export type MemberRole = 'owner' | 'admin' | 'member'

/** Why a role change did not happen; every arm wrote nothing. */
export type MemberRoleRefusal =
  'not-permitted' | 'last-owner' | 'not-found' | 'impersonated' | 'failed'

/** What the caller reports back. The control never sees a thrown error. */
export type MemberRoleOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: MemberRoleRefusal }

const REFUSAL_COPY: Record<MemberRoleRefusal, MessageKey> = {
  'not-permitted': 'shell.admin.members.role.notPermitted',
  'last-owner': 'shell.admin.members.role.lastOwner',
  'not-found': 'shell.admin.members.role.notFound',
  impersonated: 'shell.admin.members.role.impersonated',
  failed: 'shell.admin.members.role.failed',
}

/** How long a refusal stays up: it names the next step, so it outlives the default. */
const REFUSAL_TOAST_MS = 10_000

const ROLE_ORDER: ReadonlyArray<MemberRole> = ['owner', 'admin', 'member']

const ROLE_TONE: Record<string, 'accent' | 'brand' | 'neutral'> = {
  owner: 'accent',
  admin: 'brand',
  member: 'neutral',
}

/**
 * One row's role: a select when the caller may change it, the read-only badge when not.
 *
 * Presentation and the confirmation only. It fetches nothing and imports nothing from the server:
 * which roles the caller may grant is decided by the repository (`assignableRoles`) and arrives as
 * `assignable`, an empty list meaning the row is not theirs to change, and the change itself is
 * `onChange`, which the route wires to the server function and which reports an outcome instead of
 * throwing.
 *
 * Making someone an owner is the one change that cannot be walked back by the person who made it -
 * the new owner can demote them - so it asks first, and Cancel holds the focus. The result of every
 * change is announced through the toast region, and a refusal says why in plain words.
 */
export function MemberRoleControl({
  memberName,
  role,
  assignable,
  roleLabel,
  onChange,
}: {
  memberName: string
  /** The role the row holds now. */
  role: string
  /** Roles the caller may set on this row; empty for a row they may not change. */
  assignable: ReadonlyArray<MemberRole>
  /** The word for a role in the reader's language; an unknown token comes back as itself. */
  roleLabel: (role: string) => string
  onChange: (role: MemberRole) => PromiseLike<MemberRoleOutcome>
}) {
  const t = useTranslate()
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  if (assignable.length === 0) {
    return (
      <Badge tone={ROLE_TONE[role] ?? 'neutral'} size="sm">
        {roleLabel(role)}
      </Badge>
    )
  }

  async function commit(next: MemberRole): Promise<void> {
    setPending(true)
    try {
      const outcome = await onChange(next)
      if (outcome.ok) {
        toast.success(
          t('shell.admin.members.role.saved', {
            name: memberName,
            role: roleLabel(next),
          }),
        )
      } else {
        toast.error(t(REFUSAL_COPY[outcome.reason]), {
          duration: REFUSAL_TOAST_MS,
        })
      }
    } finally {
      setPending(false)
    }
  }

  function choose(next: string): void {
    if (next === role) return
    if (next === 'owner') {
      setConfirming(true)
      return
    }
    void commit(next as MemberRole)
  }

  return (
    <>
      <SimpleSelect
        size="sm"
        value={role}
        onValueChange={choose}
        disabled={pending}
        ariaLabel={t('shell.admin.members.role.label', { name: memberName })}
        options={ROLE_ORDER.filter((option) => assignable.includes(option)).map(
          (option) => ({ value: option, label: roleLabel(option) }),
        )}
      />

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          size="sm"
          onOpenAutoFocus={(event) => {
            // Cancel is the safe answer, so it is where the keyboard starts.
            event.preventDefault()
            cancelRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t('shell.admin.members.role.promote.title', {
                name: memberName,
              })}
            </DialogTitle>
            <DialogDescription>
              {t('shell.admin.members.role.promote.body', {
                name: memberName,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={cancelRef}
              variant="secondary"
              shape="pill"
              onClick={() => setConfirming(false)}
            >
              {t('shell.admin.members.role.promote.cancel')}
            </Button>
            <Button
              variant="primary"
              shape="pill"
              onClick={() => {
                setConfirming(false)
                void commit('owner')
              }}
            >
              {t('shell.admin.members.role.promote.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
