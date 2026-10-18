/**
 * The head the sign-in pages share.
 *
 * These pages carry a `?redirect=` query that can hold a secret path (a trip invite link). A
 * same-origin request from one of them (an API call, a navigation to the next auth screen) sends
 * the full URL as `Referer` under the browser default; `strict-origin` sends the origin only, and
 * still sends it, so same-origin analytics and CSRF origin checks keep working.
 */
export function signInHead() {
  return {
    meta: [{ name: 'referrer', content: 'strict-origin' }],
  }
}
