import { useEffect, useId, useRef, useState } from 'react'
import { useBlocker } from '@tanstack/react-router'
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { backupCodesFile } from '../-lib/two-factor'

export function TwoFactorCodes({
  codes,
  onDone,
}: {
  codes: ReadonlyArray<string>
  onDone: () => void
}) {
  const t = useTranslate()
  const [stored, setStored] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const gateId = useId()
  useEffect(() => {
    heading.current?.focus()
  }, [])
  // Explicit browser guard also covers document navigations outside the router.
  useEffect(() => {
    if (stored) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [stored])
  const blocker = useBlocker({
    shouldBlockFn: () => !stored,
    enableBeforeUnload: false,
    withResolver: true,
  })
  async function copy() {
    try {
      await navigator.clipboard.writeText(backupCodesFile(codes))
      setAnnouncement(t('settings.twoFactor.codes.copied'))
    } catch {
      setAnnouncement(t('settings.twoFactor.codes.copyFailed'))
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([backupCodesFile(codes)], { type: 'text/plain;charset=utf-8' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'planned.travel-backup-codes.txt'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      <Card data-sentry-block className="flex flex-col gap-4 p-5">
        <h3 ref={heading} tabIndex={-1} className="font-display text-title">
          {t('settings.twoFactor.codes.title')}
        </h3>
        <p>{t('settings.twoFactor.codes.body')}</p>
        <ul
          dir="ltr"
          className="grid grid-cols-1 gap-2 font-mono sm:grid-cols-2"
        >
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button
            className="h-auto min-h-11 whitespace-normal py-2"
            variant="secondary"
            onClick={() => void copy()}
          >
            {t('settings.twoFactor.codes.copyAll')}
          </Button>
          <Button
            className="h-auto min-h-11 whitespace-normal py-2"
            variant="secondary"
            onClick={download}
          >
            {t('settings.twoFactor.codes.download')}
          </Button>
        </div>
        <p role="status" aria-live="polite">
          {announcement}
        </p>
        <p className="text-caption text-ink-3">
          {t('settings.twoFactor.codes.lost')}
        </p>
        <Field
          label={t('settings.twoFactor.codes.stored')}
          orientation="horizontal"
        >
          <Checkbox
            checked={stored}
            onCheckedChange={(value) => setStored(value === true)}
          />
        </Field>
        <p id={gateId} className="text-caption text-ink-3">
          {stored ? null : t('settings.twoFactor.codes.gate')}
        </p>
        <Button
          className="h-auto min-h-11 whitespace-normal py-2"
          aria-disabled={!stored}
          aria-describedby={gateId}
          onClick={() => {
            if (stored) onDone()
          }}
        >
          {t('settings.twoFactor.codes.done')}
        </Button>
      </Card>
      <Dialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('settings.twoFactor.codes.leave.title')}
            </DialogTitle>
            <DialogDescription>
              {t('settings.twoFactor.codes.leave.body')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button
              className="h-auto min-h-11 whitespace-normal py-2"
              variant="secondary"
              onClick={() => blocker.reset?.()}
            >
              {t('settings.twoFactor.codes.leave.stay')}
            </Button>
            <Button
              className="h-auto min-h-11 whitespace-normal py-2"
              variant="danger"
              onClick={() => blocker.proceed?.()}
            >
              {t('settings.twoFactor.codes.leave.go')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
