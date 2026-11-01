import { useEffect, useRef, useState } from 'react'
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
  Spinner,
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

const CONFIRM_BODY: Record<MemberRole, MessageKey> = {
  owner: 'shell.admin.members.role.promote.body',
  admin: 'shell.admin.members.role.demote.admin',
  member: 'shell.admin.members.role.demote.member',
}

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
 * Promotions to owner and reductions of your own authority ask first, with Cancel focused.
 * Every result is announced through the toast region; refusals explain why in plain words.
 */
export function MemberRoleControl({
  memberName,
  isSelf,
  role,
  assignable,
  roleLabel,
  onChange,
}: {
  memberName: string
  isSelf: boolean
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
  const [confirming, setConfirming] = useState<MemberRole | null>(null)
  const inFlight = useRef(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)

  // The trigger is disabled while a request is in flight, and a disabled element cannot hold focus:
  // the keyboard user would land on the page and start again from the top. Hand focus back once the
  // control is enabled again.
  useEffect(() => {
    if (pending || !restoreFocus.current) return
    restoreFocus.current = false
    triggerRef.current?.focus()
  }, [pending])

  if (assignable.length === 0) {
    return (
      <Badge tone={ROLE_TONE[role] ?? 'neutral'} size="sm">
        {roleLabel(role)}
      </Badge>
    )
  }

  async function commit(next: MemberRole): Promise<void> {
    if (inFlight.current) return
    inFlight.current = true
    restoreFocus.current = true
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
      inFlight.current = false
      setPending(false)
    }
  }

  function choose(next: string): void {
    if (inFlight.current || next === role) return
    if (
      next === 'owner' ||
      (isSelf &&
        ROLE_ORDER.indexOf(next as MemberRole) >
          ROLE_ORDER.indexOf(role as MemberRole))
    ) {
      setConfirming(next as MemberRole)
      return
    }
    void commit(next as MemberRole)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <SimpleSelect
          ref={triggerRef}
          size="sm"
          value={role}
          onValueChange={choose}
          disabled={pending}
          ariaLabel={t('shell.admin.members.role.label', { name: memberName })}
          options={ROLE_ORDER.filter((option) =>
            assignable.includes(option),
          ).map((option) => ({ value: option, label: roleLabel(option) }))}
        />

        {pending ? (
          <Spinner size="sm" label={t('shell.admin.members.role.pending')} />
        ) : null}
      </div>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
      >
        <DialogContent
          size="sm"
          onOpenAutoFocus={(event) => {
            // Cancel is the safe answer, so it is where the keyboard starts.
            event.preventDefault()
            cancelRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            // The dialog would return focus to the select option the promotion was picked from, which
            // is gone by now. The trigger is the next stop; while a request is pending it is disabled
            // and the effect above hands focus back once it settles.
            event.preventDefault()
            triggerRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(
                confirming === 'owner'
                  ? 'shell.admin.members.role.promote.title'
                  : 'shell.admin.members.role.demote.title',
                {
                  name: memberName,
                },
              )}
            </DialogTitle>
            <DialogDescription>
              {t(CONFIRM_BODY[confirming ?? 'member'], { name: memberName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={cancelRef}
              variant="secondary"
              shape="pill"
              onClick={() => setConfirming(null)}
            >
              {t('shell.admin.members.role.promote.cancel')}
            </Button>
            <Button
              variant="primary"
              shape="pill"
              onClick={() => {
                if (confirming === null) return
                void commit(confirming)
                setConfirming(null)
              }}
            >
              {t(
                confirming === 'owner'
                  ? 'shell.admin.members.role.promote.confirm'
                  : 'shell.admin.members.role.demote.confirm',
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
