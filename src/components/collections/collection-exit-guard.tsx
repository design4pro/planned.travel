import { useEffect, useRef, useState } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { registerCollectionExit } from '#/lib/collection-exit'
import { workspaceClaimState } from '#/lib/workspace-claim-store'
import { useTranslate } from '#/lib/i18n'
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui'

export function CollectionExitGuard({
  collectionId,
  dirty,
  busy,
  onDiscard,
  expiresAt,
  returnFocus,
}: {
  collectionId: string
  dirty: boolean
  busy: boolean
  onDiscard: () => void
  expiresAt?: string
  returnFocus: () => void
}) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const resolve = useRef<((leave: boolean) => void) | null>(null)
  const stay = useRef<HTMLButtonElement>(null)
  const opener = useRef<Element | null>(null)
  const current = useRef({ dirty, busy, onDiscard, expiresAt })
  current.current = { dirty, busy, onDiscard, expiresAt }

  function answer(leave: boolean) {
    if (leave) {
      current.current.dirty = false
      current.current.onDiscard()
    }
    resolve.current?.(leave)
    resolve.current = null
    setOpen(false)
  }
  function inaccessible() {
    return (
      workspaceClaimState().stale ||
      (current.current.expiresAt !== undefined &&
        Date.now() >= Date.parse(current.current.expiresAt))
    )
  }
  function confirm(): Promise<boolean> {
    if (inaccessible()) return Promise.resolve(true)
    if (current.current.busy || resolve.current) return Promise.resolve(false)
    if (!current.current.dirty) return Promise.resolve(true)
    setOpen(true)
    return new Promise((done) => {
      resolve.current = done
    })
  }
  useEffect(() => {
    const release = registerCollectionExit(confirm)
    return () => {
      release()
      resolve.current?.(false)
      resolve.current = null
    }
  }, [])
  useEffect(() => {
    if (!dirty) {
      resolve.current?.(false)
      resolve.current = null
      setOpen(false)
      return
    }
    const guard = (event: BeforeUnloadEvent) => {
      if (inaccessible() || !current.current.dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  useBlocker({
    shouldBlockFn: async ({ next }) => {
      // Authentication recovery takes precedence over a draft in an expired session.
      if (next.pathname === '/login' || next.pathname.startsWith('/login/'))
        return false
      if (next.pathname === `/collections/${collectionId}`) return false
      return !(await confirm())
    },
    enableBeforeUnload: false,
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) answer(false)
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          if (!opener.current?.isConnected) {
            event.preventDefault()
            returnFocus()
          }
        }}
        onOpenAutoFocus={(event) => {
          opener.current = document.activeElement
          event.preventDefault()
          stay.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('modules.collections.leave.title')}</DialogTitle>
          <DialogDescription>
            {t('modules.collections.leave.body')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody />
        <DialogFooter>
          <Button
            ref={stay}
            variant="secondary"
            className="h-auto min-h-11 whitespace-normal py-2"
            onClick={() => answer(false)}
          >
            {t('modules.collections.leave.stay')}
          </Button>
          <Button
            variant="danger"
            className="h-auto min-h-11 whitespace-normal py-2"
            onClick={() => answer(true)}
          >
            {t('modules.collections.leave.discard')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
