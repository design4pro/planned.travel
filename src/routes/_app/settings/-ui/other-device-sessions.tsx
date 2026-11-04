import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui'
import {
  authRequestFailure,
  otherDeviceAvailability,
  registerOtherDeviceRevocation,
  settleOtherDeviceRevocation,
} from '#/lib/auth/client'
import { useTranslate } from '#/lib/i18n'
import { SettingsRow } from '../../-ui/settings-nav'
import type { OtherDeviceOutcome } from '#/lib/auth/client'

export function OtherDeviceSessions() {
  const t = useTranslate()
  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [operation, setOperation] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<OtherDeviceOutcome | null>(null)
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const feedback = useRef<HTMLParagraphElement>(null)
  const generation = useRef(0)
  useEffect(() => {
    let mounted = true
    void otherDeviceAvailability()
      .then((value) => {
        if (!mounted) return
        setAvailable(value.available)
        if (value.recovery) {
          setOperation(value.recovery.id)
          setOutcome(value.recovery)
        }
      })
      .catch(() => undefined)
    return () => {
      mounted = false
      generation.current += 1
    }
  }, [])
  useEffect(() => {
    if (open && (busy || outcome)) feedback.current?.focus()
  }, [open, busy, outcome])

  useEffect(() => {
    if (retryAt === null) return
    const timer = setTimeout(
      () => setRetryAt(null),
      Math.min(2147483647, Math.max(0, retryAt - Date.now())),
    )
    return () => clearTimeout(timer)
  }, [retryAt])

  async function confirm() {
    const started = ++generation.current
    setBusy(true)
    try {
      const intent = crypto.randomUUID()
      const id = await registerOtherDeviceRevocation(intent)
      if (started !== generation.current) return
      setOperation(id)
      const result = await settleOtherDeviceRevocation(id, intent)
      if (started === generation.current) {
        setOutcome(result)
        setRetryAt(result.retryAt ?? null)
      }
    } catch (cause) {
      if (started === generation.current) {
        setRetryAt(authRequestFailure(cause).retryAt ?? null)
        setOutcome({ status: 'refused', cleanupPending: false })
      }
    } finally {
      if (started === generation.current) setBusy(false)
    }
  }

  async function check() {
    if (!operation) return
    const started = ++generation.current
    setBusy(true)
    const result = await settleOtherDeviceRevocation(operation, null)
    if (started === generation.current) {
      setOutcome((previous) =>
        result.status === 'unknown' && previous?.status === 'committed'
          ? previous
          : result,
      )
      setRetryAt(result.retryAt ?? null)
      setBusy(false)
    }
  }

  function close() {
    setOpen(false)
    if (!busy && outcome && outcome.status !== 'unknown') {
      setOperation(null)
      setOutcome(null)
    }
  }

  if (!available) return null
  let message = ''
  if (busy) message = t('ui.status.working')
  else if (retryAt !== null) message = t('settings.passkeys.error.rateLimited')
  else if (outcome?.status === 'committed')
    message = t(
      outcome.cleanupPending
        ? 'settings.security.other.pending'
        : 'settings.security.other.committed',
    )
  else if (outcome?.status === 'refused')
    message = t('settings.security.other.refused')
  else if (outcome?.status === 'unknown')
    message = t('settings.security.other.unknown')

  return (
    <SettingsRow
      label={t('settings.security.other.label')}
      hint={t('settings.security.other.description')}
      control={
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (next) setOpen(true)
            else close()
          }}
        >
          <DialogTrigger asChild>
            <Button
              variant="danger"
              size="sm"
              shape="pill"
              disabled={retryAt !== null}
            >
              {t('settings.security.other.label')}
            </Button>
          </DialogTrigger>
          <DialogContent size="sm" hideClose>
            <DialogHeader>
              <DialogTitle>{t('settings.security.other.label')}</DialogTitle>
              <DialogDescription>
                {t('settings.security.other.description')}
              </DialogDescription>
            </DialogHeader>
            <p
              ref={feedback}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className="text-body text-ink-3"
            >
              {message}
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                {t('ui.action.close')}
              </Button>
              {operation ? (
                <Button
                  disabled={busy || retryAt !== null}
                  loading={busy}
                  onClick={() => {
                    void check()
                  }}
                >
                  {t('settings.security.other.check')}
                </Button>
              ) : null}
              {!outcome && !operation ? (
                <Button
                  variant="danger"
                  disabled={busy || retryAt !== null}
                  loading={busy}
                  onClick={() => {
                    void confirm()
                  }}
                >
                  {t('settings.security.other.label')}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    />
  )
}
