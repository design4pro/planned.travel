/**
 * The two clicks that stand between a fresh browser and the reference demo's screens.
 *
 * `demo.liketrek.com` needs no credentials, but it does need to be ENTERED: without a session every
 * route renders its sign-in screen, and that screen carries a "Try the demo" button which signs a
 * throwaway demo user in and sets a session cookie that then outlives every `page.goto` in the run.
 * Once inside, a "Welcome to TREK" overlay renders on EVERY hard load — verified on `/dashboard`,
 * `/dashboard?welcome=0` and `/`, and it cannot be switched off from `localStorage` because the app
 * rewrites `demo_mode` on boot — so the frame is of the overlay unless its "Got it" button is
 * pressed on every frame.
 *
 * `capture.mjs` had one `--click`, applied to every frame, and that is one control short. The bill
 * across runs 20260830-3 and 20260830-4: two agents spent a combined selector and a second pass
 * with the viewport order reversed, one gave up and filed no pair (#110), one swapped our own
 * `e2e/.auth/demo.json` for a reference session and restored it afterwards (#171), and one filed
 * the overlay itself (#175), which the blind critic then scored as three major defects of the
 * reference. Run 20260901-1 filed our four frames and no reference at all (#138). Every one of
 * those is a defect of the capture, so the capture owns it: `--enter` once, `--dismiss` per frame.
 *
 * Both take a `page` that speaks Playwright's `Page` — `goto`, `locator(...).first()`,
 * `waitForTimeout` — so the test can hand them a stub and never launch a browser.
 */

/**
 * Sign in through a control on the screen `url` lands on, once, before any frame is taken.
 *
 * Fails loudly when the control is not there: an entry that silently did nothing leaves the
 * context without a session, and every frame after it is the sign-in wall under the name of the
 * screen that was asked for — the same wrong-page trap `--auth` refuses on our side.
 */
export async function enterThrough(
  page,
  { url, selector, settleMs, timeout = 15_000 },
) {
  await page.goto(url, { waitUntil: 'commit', timeout: 45_000 })
  const control = page.locator(selector).first()
  try {
    await control.waitFor({ state: 'visible', timeout })
  } catch {
    throw new Error(
      `--enter ${JSON.stringify(selector)} was not visible on ${page.url()} within ${timeout}ms. ` +
        `Without it there is no session, and every frame would be the sign-in screen under the ` +
        `name of ${url}. Check the selector against the screen the URL lands on.`,
    )
  }
  await control.click({ timeout })
  await page.waitForTimeout(settleMs)
}

/**
 * Press an overlay's dismiss control when it is on screen, and say whether it was.
 *
 * Absence is not an error — a screen the overlay does not cover is the frame wanted — but the
 * answer is reported per frame so the reader can tell an overlay that never appeared from one that
 * was pressed away.
 */
export async function dismissIfPresent(
  page,
  { selector, settleMs, timeout = 5_000 },
) {
  const control = page.locator(selector).first()
  try {
    await control.waitFor({ state: 'visible', timeout })
  } catch {
    return false
  }
  await control.click({ timeout })
  await page.waitForTimeout(settleMs)
  return true
}
