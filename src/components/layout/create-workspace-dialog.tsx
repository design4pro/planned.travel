import { useEffect, useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { readPublicFailure } from '#/lib/errors'
import { createWorkspaceFn } from '#/server/fns/workspace'
import { useWorkspaceResync } from './workspace-switcher'

import type { CreateWorkspaceRefusal } from '#/server/fns/workspace-writes'

/** The longest name the server accepts; the field stops the reader there rather than refusing later. */
const NAME_MAX_LENGTH = 60

/** What the dialog shows in its alert, or nothing. */
type Notice =
  | { readonly kind: 'refusal'; readonly reason: CreateWorkspaceRefusal }
  | {
      readonly kind: 'failure'
      readonly message: string
      /** True for a sentence authored on the server, which is English whatever the locale. */
      readonly authored: boolean
    }

/**
 * The dialog behind "Create workspace".
 *
 * Owned by `UserMenu` and rendered beside the menu rather than inside it: Radix unmounts a menu's
 * content when an item is chosen, so a dialog nested there would unmount as it opened.
 *
 * Every refusal is shown here and nothing is hidden or disabled beforehand, so a reader on Free is
 * shown the upgrade, and a `member` is told who can create - the menu item is the same for everyone.
 * A refusal wrote nothing, so the field keeps what was typed. A thrown failure reaches the browser
 * as an `Error` whose message is authored copy only for a refusal or a validation failure
 * (`readPublicFailure`); anything else shows `workspace.createFailed`, and only that unknown outcome
 * re-reads the router, since the answer may have been lost after the workspace was written.
 *
 * A create in flight owns the dialog: closing it would drop the answer on the floor, so it stays
 * open until the request settles (`new-trip-dialog.tsx` does the same). A workspace that was
 * written but could not be made active closes the dialog like a success and says so in a toast, so
 * the reader picks it from the menu instead of creating it a second time.
 */
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  workspaceName,
  onCloseAutoFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * The workspace the reader is in, which the upgrade refusal names: the plan gate reads that
   * workspace's plan and no other, so it is the one workspace the dialog can truthfully say is on Free.
   */
  workspaceName: string
  /** Where focus goes when the dialog closes: the menu trigger the reader opened it from. */
  onCloseAutoFocus: () => void
}) {
  const t = useTranslate()
  const formId = useId()
  const resync = useWorkspaceResync()
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  // Re-seeded on open, so the dialog never shows the last name typed or the last refusal.
  useEffect(() => {
    if (!open) return
    setName('')
    setNotice(null)
  }, [open])

  const canSubmit = name.trim().length > 0 && !pending

  async function submit(): Promise<void> {
    setPending(true)
    setNotice(null)
    let created = false
    try {
      const result = await createWorkspaceFn({ data: { name: name.trim() } })
      if (!result.ok) {
        setNotice({ kind: 'refusal', reason: result.reason })
        return
      }
      created = true
      if (!result.activated) {
        toast.error(t('shell.workspace.switchFailed'), {
          description: t('shell.workspace.switchFailedBody'),
        })
      }
    } catch (cause) {
      const failure = readPublicFailure(cause)
      setNotice({
        kind: 'failure',
        message: failure.message ?? t('shell.workspace.createFailed'),
        authored: failure.message !== undefined,
      })
      // Only an unknown outcome needs a re-read: a refusal or a validation failure wrote nothing.
      if (failure.kind === 'unexpected') await resync().catch(() => undefined)
    } finally {
      setPending(false)
    }

    if (created) {
      onOpenChange(false)
      await resync().catch(() => undefined)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        size="sm"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onCloseAutoFocus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('shell.workspace.createTitle')}</DialogTitle>
          <DialogDescription>
            {t('shell.workspace.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div role="status" className="sr-only">
            {pending ? t('ui.status.loading') : ''}
          </div>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (canSubmit) void submit()
            }}
          >
            {notice === null ? null : (
              <NoticeAlert
                notice={notice}
                workspaceName={workspaceName}
                onNavigate={() => onOpenChange(false)}
              />
            )}

            <Field label={t('shell.workspace.createName')} required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={NAME_MAX_LENGTH}
                autoComplete="off"
                required
              />
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSubmit}
            loading={pending}
          >
            {t('shell.workspace.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * A refusal says what to do and carries no number. Only the upgrade links on, to the billing screen
 * of the workspace it names: a workspace admin can act on it, and the other two cannot be fixed by
 * paying.
 */
function NoticeAlert({
  notice,
  workspaceName,
  onNavigate,
}: {
  notice: Notice
  workspaceName: string
  onNavigate: () => void
}) {
  const t = useTranslate()

  if (notice.kind === 'failure') {
    return (
      <Alert tone="danger">
        {notice.authored ? (
          <span lang="en" dir="ltr">
            {notice.message}
          </span>
        ) : (
          notice.message
        )}
      </Alert>
    )
  }

  // A refusal is the answer to the button just pressed, so it is announced at once (a `warning`
  // alert defaults to a polite status, which a screen reader may not read when it appears filled).
  const announce = { role: 'alert', 'aria-live': 'assertive' } as const

  switch (notice.reason) {
    case 'upgrade-required':
      return (
        <Alert tone="warning" {...announce}>
          <p>
            {t('shell.workspace.createUpgrade', { workspace: workspaceName })}
          </p>
          <Link
            to="/settings/billing"
            onClick={onNavigate}
            className="mt-1 inline-block font-medium text-brand underline underline-offset-4 focus-ring"
          >
            {t('shell.account.billing')}
          </Link>
        </Alert>
      )
    case 'limit-reached':
      return (
        <Alert tone="warning" {...announce}>
          {t('shell.workspace.createLimitReached')}
        </Alert>
      )
    case 'role-required':
      return (
        <Alert tone="warning" {...announce}>
          {t('shell.workspace.createRoleRequired')}
        </Alert>
      )
  }
}
