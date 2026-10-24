import { useRef } from 'react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { WORKSPACE_CHANGED_KEY } from '#/lib/workspace-claim'
import {
  dismissWorkspaceNotice,
  useWorkspaceClaim,
} from '#/lib/workspace-claim-store'

import { useOpenCurrentWorkspace } from './use-open-current-workspace'

/**
 * What a tab says when the session's workspace is no longer the one it is showing.
 *
 * Another tab switched workspace, and this tab's call was refused before anything was read or
 * written (`src/lib/workspace-claim.ts`). It is an `alertdialog`: it interrupts, because the reader
 * pressed something and nothing happened, and it explains rather than recovering on their behalf.
 * Nothing reloads automatically and nothing typed is cleared - "Not now" closes it and leaves the
 * page exactly as it was. It comes back when the reader acts again (`useAction`, `messageOf`), not on a poll or
 * a link preload, which would pull focus away from what they are doing.
 *
 * Mounted once, in the authenticated shell, because the store it reads is the tab's.
 *
 * **Focus.** It lands on "Not now", the action that loses nothing: a refusal the reader did not cause
 * (a poll, a link preload) can open it while they are typing, and a reflexive Enter must not reload
 * the page under their form. Radix traps it inside, Escape is "Not now", and on
 * close `DialogContent` returns it to whatever held it when the notice opened - the control the
 * reader pressed. A click outside does not dismiss it: an alert is answered, not clicked past.
 */
export function WorkspaceChangedNotice({
  organizationName,
}: {
  /** The workspace this tab is showing. */
  organizationName: string | null
}) {
  const t = useTranslate()
  const { noticeOpen } = useWorkspaceClaim()
  const currentWorkspace = useOpenCurrentWorkspace({ guardUnsentText: true })
  const dismiss = useRef<HTMLButtonElement>(null)
  const opener = useRef<Element | null>(null)

  // Closing also forgets a pending "are you sure": the next time it opens it asks afresh.
  const closeNotice = () => {
    currentWorkspace.cancel()
    dismissWorkspaceNotice()
  }

  // The name is a proper noun in someone else's script and direction: it is interpolated and
  // isolated, never concatenated, so it cannot reorder the sentence around it.
  const body =
    organizationName === null
      ? t(WORKSPACE_CHANGED_KEY)
      : t('shell.session.workspaceChangedBody', {
          name: `\u2068${organizationName}\u2069`,
        })

  return (
    <Dialog
      open={noticeOpen}
      onOpenChange={(open) => {
        // Escape while the page is already leaving would close the dialog under a reload that
        // cannot be taken back: "Not now" is disabled then, and so is this.
        if (!open && !currentWorkspace.opening) closeNotice()
      }}
    >
      <DialogContent
        role="alertdialog"
        size="sm"
        hideClose
        // Above a dialog the reader already has open (a form the refusal interrupted), so its
        // backdrop covers that one instead of painting underneath it.
        overlayClassName="z-modal"
        onOpenAutoFocus={(event) => {
          opener.current = document.activeElement
          event.preventDefault()
          dismiss.current?.focus()
        }}
        onInteractOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          // `DialogContent` returns focus to the control the reader pressed. A refusal that replaced
          // the screen that control sat on (a route error panel) removed it, and focus would fall
          // to the document: the main landmark is the nearest stable place to start again from.
          const target = opener.current
          opener.current = null
          if (target?.isConnected !== false) return
          const landmark = document.querySelector<HTMLElement>('main')
          if (landmark === null) return
          event.preventDefault()
          landmark.tabIndex = -1
          landmark.focus()
        }}
      >
        <DialogHeader className="pe-5 sm:pe-6">
          <DialogTitle>{t('shell.session.workspaceChangedTitle')}</DialogTitle>
          <DialogDescription dir="auto">
            {body}
            {currentWorkspace.confirming
              ? ` ${t('modules.presence.workspaceChanged.discard')}`
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={dismiss}
            variant="secondary"
            shape="pill"
            onClick={closeNotice}
            disabled={currentWorkspace.opening}
          >
            {t('shell.session.workspaceChangedDismiss')}
          </Button>
          <Button
            variant={currentWorkspace.confirming ? 'danger' : 'primary'}
            shape="pill"
            onClick={currentWorkspace.open}
            loading={currentWorkspace.opening}
          >
            {currentWorkspace.confirming
              ? t('modules.presence.workspaceChanged.confirm')
              : t('shell.session.openCurrentWorkspace')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
