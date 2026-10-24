/**
 * The state a Transport dialog is in once a save has been refused because the transport is gone.
 *
 * Somebody deleted it - another tab, another member - while the dialog was open. The refusal is the
 * product working, so it is a state of the dialog rather than an error toast: it names what
 * happened in the reader's language, the typed draft stays where it is, and the one action left is
 * Close, because a save could only be refused again. The two tabs of the dialog (the form and the
 * connection search) both show it, so the sentence and the check that finds it live here.
 */
import { useCallback } from 'react'

import { Alert } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { transportRefusalOf } from '#/lib/transport-refusals'

/**
 * The sentence for a thrown value when it is the "transport is gone" refusal, otherwise `null`.
 * It is `useAction`'s `refusal` option, which keeps the key out of the toast and the inline error.
 */
export function useGoneSentence(): (cause: unknown) => string | null {
  const t = useTranslate()
  return useCallback(
    (cause) => {
      const key = transportRefusalOf(cause)
      return key === null ? null : t(key)
    },
    [t],
  )
}

/**
 * The alert's id, so the Close button can be described by it: focus moves there when the state
 * appears, and a screen reader announces the control it lands on, which would cut the alert short.
 * One dialog is open at a time, and only one of its two tabs shows the alert.
 */
export const TRANSPORT_GONE_ALERT_ID = 'transport-gone-alert'

/** The alert itself: a title that says what happened and a body that says what to do. */
export function TransportGoneAlert() {
  const t = useTranslate()
  return (
    <Alert
      id={TRANSPORT_GONE_ALERT_ID}
      data-part="transport-gone"
      tone="danger"
      title={t('modules.transports.refusal.goneTitle')}
    >
      {t('modules.transports.refusal.gone')}
    </Alert>
  )
}
