/**
 * Session Replay, in its own module so it can be loaded after the page is.
 *
 * Replay is ~38 kB gzipped of DOM recorder. Registered inline in the client entry it lands in the
 * entry chunk, where every visitor pays for it before first paint - to record a session that, by
 * definition, has not happened yet. Reached only through a dynamic `import()`, the recorder splits
 * into its own chunk and the entry keeps the Sentry core it actually needs at startup.
 *
 * The masking is the part to read carefully. A replay is a recording of the DOM, and this DOM holds
 * trip contents, member lists, itineraries and billing state. The SDK's defaults record text; these
 * do not. `maskAllText` and `maskAllInputs` replace every character with a block and
 * `blockAllMedia` keeps images and uploaded photos out entirely, so what survives is layout, timing
 * and interaction - what someone *did* before something broke, rather than what they wrote.
 *
 * Unmasking any particular element is a deliberate, reviewable act (`data-sentry-unmask`), and
 * nothing in this codebase does it.
 */

import { addIntegration, replayIntegration } from '@sentry/react'

export function startSessionReplay(): void {
  addIntegration(
    replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  )
}
