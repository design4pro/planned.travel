import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '#/components/ui'
import { otherDeviceAvailability, registerOtherDeviceRevocation, settleOtherDeviceRevocation } from '#/lib/auth/client'
import { useTranslate } from '#/lib/i18n'
import { SettingsRow } from '../../-ui/settings-nav'
import type { OtherDeviceOutcome } from '#/lib/auth/client'

const RECOVERY_KEY = 'planned.other-device-operation'

export function OtherDeviceSessions() {
  const t = useTranslate()
  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [operation, setOperation] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<OtherDeviceOutcome | null>(null)
  const feedback = useRef<HTMLParagraphElement>(null)
  const generation = useRef(0)
  useEffect(() => {
    let mounted = true
    void otherDeviceAvailability().then((value) => {
      if (!mounted) return
      setAvailable(value)
      try {
        const saved = sessionStorage.getItem(RECOVERY_KEY)
        if (saved && /^[0-9a-f-]{36}$/.test(saved)) {
          setOperation(saved)
          setOutcome({ status: 'unknown', cleanupPending: false })
        }
      } catch { /* Recovery remains available for this mounted dialog. */ }
    }).catch(() => undefined)
    return () => { mounted = false; generation.current += 1 }
  }, [])
  useEffect(() => {
    if (open && (busy || outcome)) feedback.current?.focus()
  }, [open, busy, outcome])

  async function confirm() {
    const started = ++generation.current
    setBusy(true)
    try {
      const intent = crypto.randomUUID()
      const id = await registerOtherDeviceRevocation(intent)
      if (started !== generation.current) return
      setOperation(id)
      try { sessionStorage.setItem(RECOVERY_KEY, id) } catch { /* The HttpOnly receipt still permits status reconciliation. */ }
      const result = await settleOtherDeviceRevocation(id, intent)
      if (started === generation.current) setOutcome(result)
    } catch {
      if (started === generation.current) setOutcome({ status: 'refused', cleanupPending: false })
    } finally {
      if (started === generation.current) setBusy(false)
    }
  }

  async function check() {
    if (!operation) return
    const started = ++generation.current
    setBusy(true)
    const result = await settleOtherDeviceRevocation(operation, null)
    if (started === generation.current) { setOutcome(result); setBusy(false) }
  }

  if (!available) return null
  let message = t('settings.security.other.description')
  if (busy) message = t('ui.status.working')
  else if (outcome?.status === 'committed') message = t(outcome.cleanupPending ? 'settings.security.other.pending' : 'settings.security.other.committed')
  else if (outcome?.status === 'refused') message = t('settings.security.other.refused')
  else if (outcome?.status === 'unknown') message = t('settings.security.other.unknown')

  return <SettingsRow label={t('settings.security.other.label')} hint={t('settings.security.other.description')} control={
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next) }}>
      <DialogTrigger asChild><Button variant="danger" size="sm" shape="pill">{t('settings.security.other.label')}</Button></DialogTrigger>
      <DialogContent size="sm" hideClose={busy} onEscapeKeyDown={(event) => { if (busy) event.preventDefault() }} onPointerDownOutside={(event) => { if (busy) event.preventDefault() }}>
        <DialogHeader><DialogTitle>{t('settings.security.other.label')}</DialogTitle><DialogDescription>{t('settings.security.other.description')}</DialogDescription></DialogHeader>
        <p ref={feedback} tabIndex={-1} role="status" aria-live="polite" className="text-body text-ink-3">{message}</p>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{t('ui.action.close')}</Button>
          {operation ? <Button disabled={busy} loading={busy} onClick={() => { void check() }}>{t('settings.security.other.check')}</Button> : null}
          {!outcome && !operation ? <Button variant="danger" disabled={busy} loading={busy} onClick={() => { void confirm() }}>{t('settings.security.other.label')}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  } />
}
