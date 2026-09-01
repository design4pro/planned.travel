/**
 * The User Feedback widget, in its own module so it can be loaded after the page is.
 *
 * The same reasoning as `src/lib/sentry-replay.ts`, for the same reason. In the NPM build
 * `feedbackIntegration` is an alias of `feedbackSyncIntegration`, which means the form and the
 * screenshot editor are in the import graph from the first line - a static import here would put
 * them in the entry chunk, paid for by every visitor before first paint, to serve the few who
 * write something. Reached through a dynamic `import()` it splits into its own chunk instead.
 *
 * `autoInject: false` is the load-bearing option. Left on its default the integration injects its
 * own button the moment it is added, with the SDK's English labels frozen in at that point. Off, we
 * create the button ourselves through `createWidget(overrides)` - the one API that takes per-widget
 * option overrides, and therefore the only way the form speaks the reader's language. The button it
 * returns is still Sentry's own, shadow DOM and all; what we take over is when it is created and
 * what it says. See `src/components/layout/feedback-widget.tsx`.
 */

import { addIntegration, feedbackIntegration } from '@sentry/react'

export type Feedback = ReturnType<typeof feedbackIntegration>

let feedback: Feedback | undefined

/**
 * Register the integration once and hand it back.
 *
 * Only the structural options are set here. Every label is an override on `createWidget`, because
 * these are read once at construction and the locale can change without a reload.
 */
export function startFeedback(): Feedback {
  if (feedback === undefined) {
    feedback = feedbackIntegration({
      autoInject: false,
      // This is our shell, not a Sentry panel.
      showBranding: false,
      /**
       * `sendDefaultPii` is false and nothing calls `Sentry.setUser`, so neither field is
       * prefilled and neither is required. The name buys nothing we could act on; the address is
       * the only way back to whoever wrote the report, so it is offered and left optional.
       */
      showName: false,
      showEmail: true,
      isEmailRequired: false,
      /**
       * The point of the exercise. The capture goes through `getDisplayMedia`, so the browser asks
       * before anything is read and the SDK hides the button entirely on mobile, where the API
       * exists but does not work. What follows the capture is the part worth having: crop, a
       * Highlight box for "this is the bit that is wrong", and a Hide box for anything on screen
       * that should not leave the machine.
       */
      enableScreenshot: true,
    })
    addIntegration(feedback)
  }
  return feedback
}
