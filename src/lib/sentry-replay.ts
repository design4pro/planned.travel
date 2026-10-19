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

import { holdsJoinPath, scrubTelemetry } from '#/lib/sentry-scrub'

/**
 * Nothing about a join URL is recorded beyond its (redacted) address. No request detail is captured
 * unless `networkDetailAllowUrls` lists it, and it lists nothing; the deny entry keeps that true if
 * somebody ever adds a broad allow pattern.
 */
const JOIN_URL = /\/join\//i

const onJoinLocation = () => holdsJoinPath(window.location.href)

/**
 * Calls `listener` after every change of the address, router navigations included: they use
 * `pushState` and `replaceState`, which fire no event of their own.
 */
function watchLocation(listener: () => void): void {
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method]
    window.history[method] = function patched(
      this: History,
      ...args: Parameters<History[typeof method]>
    ) {
      original.apply(this, args)
      listener()
    }
  }
  window.addEventListener('popstate', listener)
  window.addEventListener('hashchange', listener)
}

/**
 * The recorder never runs on a join location: the page itself, and a sign-in page whose `redirect`
 * or `callbackURL` carries the link. Masking hides text, not attributes, and a link on that page
 * holds the secret in its `href`; the recorder's Meta event holds the address. No SDK hook reaches
 * either, so the only safe recording of these pages is none.
 *
 * Once it has been off for a join location it stays off until the next document load, which is
 * where every way into or out of the flow ends (a pasted link, `window.location.assign` after
 * joining). The cost, stated in `docs/DEPLOY.md` section 17: a session that opens a join link
 * is not replayed for the rest of that page load, and uses no replay quota for it.
 */
export function startSessionReplay(): void {
  const replay = replayIntegration({
    maskAllText: true,
    maskAllInputs: true,
    blockAllMedia: true,
    networkDetailDenyUrls: [JOIN_URL],
    /**
     * Applies to the custom events the SDK writes itself - navigations, requests, breadcrumbs,
     * performance spans - and, as a second line behind the stop below, drops every event while
     * the address holds a join path.
     */
    beforeAddRecordingEvent: (event) =>
      onJoinLocation() ? null : scrubTelemetry(event),
  })
  let state: 'idle' | 'recording' | 'retired' = 'idle'

  const sync = () => {
    if (onJoinLocation()) {
      if (state === 'recording') void replay.stop({ flush: false })
      state = 'retired'
    } else if (state === 'idle') {
      addIntegration(replay)
      state = 'recording'
    }
  }

  watchLocation(sync)
  sync()
}
