import { useEffect } from 'react'

import { useLocale, useTranslate } from '#/lib/i18n'
import { useTheme } from '#/lib/theme'

import type { Feedback } from '#/lib/sentry-feedback'

/**
 * "Report a problem", on every screen.
 *
 * The counterpart to `FailureFeedback`, which is offered only once something has already thrown.
 * Most of what is worth hearing about never throws: a price that reads wrong, a button that does
 * nothing, a sentence that means the opposite in Polish. None of that reaches Sentry on its own,
 * and none of it has an error panel to hang a report off.
 *
 * What the widget adds over a textarea is the screenshot. The capture is a real `getDisplayMedia`
 * screen share - the browser asks first, and the SDK hides the button on mobile, where the API is
 * implemented but does not work - and once captured it can be cropped, marked with a Highlight box
 * ("this is the bit that is wrong") and masked with a Hide box. That is the whole of the editor:
 * three rectangles, no freehand drawing.
 *
 * The button and the form are Sentry's own, rendered into a shadow DOM the page cannot reach into.
 * What this component owns is when they are created, what they say, and where they sit - see
 * `src/lib/sentry-feedback.ts` for why that requires `autoInject: false`.
 */

/**
 * Whether the browser half of the reporting was configured at build time.
 *
 * Deliberately a second copy of the constant in `error-state.tsx` rather than a shared export. The
 * value of this guard is that it folds to a literal in *this* module, so a build without a DSN
 * drops the `import()` below and the whole feedback chunk with it. Reading it across a module
 * boundary makes that depend on cross-module constant propagation instead of on the replacement
 * Vite has already done, and the failure is silent - a chunk nobody notices, shipped to everyone.
 */
const REPORTING_ENABLED =
  typeof import.meta.env.VITE_SENTRY_DSN === 'string' &&
  import.meta.env.VITE_SENTRY_DSN.length > 0

/** The chunk, in flight or resolved. */
let loading: Promise<Feedback> | undefined

/**
 * The integration, loaded once and handed to both effects below.
 *
 * One `import()` rather than one per effect: the theme has to reach the same instance the widget
 * was built from, and that is a property of this function rather than of two module resolutions
 * agreeing. The chunk itself is fetched on first call - mounting the component costs nothing until
 * one of the effects asks for it.
 */
function feedback(): Promise<Feedback> {
  loading ??= import('#/lib/sentry-feedback').then(({ startFeedback }) =>
    startFeedback(),
  )
  return loading
}

export function FeedbackWidget() {
  const t = useTranslate()
  const locale = useLocale()
  const { resolved } = useTheme()

  /**
   * `t` is memoised on the locale, so this runs once per language and not once per render. A
   * language change tears the button down and builds a new one, which is the only way the labels
   * change: the SDK reads them when the widget is constructed and never again.
   */
  useEffect(() => {
    if (!REPORTING_ENABLED) return

    let widget: ReturnType<Feedback['createWidget']> | undefined
    let cancelled = false

    void feedback().then((integration) => {
      if (cancelled) return
      widget = integration.createWidget({
        tags: { locale },
        // No `triggerAriaLabel`: it defaults to `triggerLabel`, which is exactly what WCAG 2.5.3
        // asks for - the accessible name and the visible one are the same sentence.
        triggerLabel: t('shell.feedback.triggerLabel'),
        formTitle: t('shell.feedback.formTitle'),
        messageLabel: t('shell.feedback.messageLabel'),
        messagePlaceholder: t('shell.feedback.messagePlaceholder'),
        emailLabel: t('shell.feedback.emailLabel'),
        emailPlaceholder: t('shell.feedback.emailPlaceholder'),
        isRequiredLabel: t('shell.feedback.isRequiredLabel'),
        submitButtonLabel: t('shell.feedback.submitButtonLabel'),
        cancelButtonLabel: t('shell.feedback.cancelButtonLabel'),
        confirmButtonLabel: t('shell.feedback.confirmButtonLabel'),
        addScreenshotButtonLabel: t('shell.feedback.addScreenshotButtonLabel'),
        removeScreenshotButtonLabel: t(
          'shell.feedback.removeScreenshotButtonLabel',
        ),
        highlightToolText: t('shell.feedback.highlightToolText'),
        hideToolText: t('shell.feedback.hideToolText'),
        // The label on a highlight/hide box's own delete control - the `ui`
        // primitive, not a second copy of "Remove" for the same twenty-three
        // translators to keep in step (`__tests__/copy-rules.test.ts`).
        removeHighlightText: t('ui.action.remove'),
        successMessageText: t('shell.feedback.successMessageText'),
        // The four sentences below are the ones the SDK prints when the report itself fails to
        // send. Left untranslated they arrive in English at the exact moment something has already
        // gone wrong for this reader, which is the worst place in the product to switch language.
        // `errorNoClientText` is not among them: it fires when there is no Sentry client, and this
        // component only mounts a widget when there is one.
        errorEmptyMessageText: t('shell.feedback.errorEmptyMessageText'),
        errorTimeoutText: t('shell.feedback.errorTimeoutText'),
        errorForbiddenText: t('shell.feedback.errorForbiddenText'),
        errorGenericText: t('shell.feedback.errorGenericText'),
      })
    })

    return () => {
      cancelled = true
      widget?.removeFromDom()
    }
  }, [locale, t])

  /**
   * Colour comes from our tokens through the custom properties in `styles.css`, which flip with the
   * theme on their own. This is for `color-scheme` alone - the native scrollbars and the file
   * picker inside the shadow root, which no variable of ours reaches.
   */
  useEffect(() => {
    if (!REPORTING_ENABLED) return
    void feedback().then((integration) => {
      integration.setTheme(resolved)
    })
  }, [resolved])

  return null
}
