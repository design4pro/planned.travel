/**
 * Turns a template element into the two bodies the queue's `email` job carries.
 *
 * `render()` is asynchronous — it drives React's streaming server renderer to
 * completion — which is why every caller up to the Better Auth callbacks awaits.
 * The plain-text half is derived from the rendered HTML rather than authored a
 * second time, so a URL cannot appear in one body and be missing from the other:
 * `toPlainText()` prints every `href` it walks past. Both come from
 * `@react-email/components`; nothing here imports the `react-email` CLI, which
 * is a devDependency and has no business in a Worker bundle.
 *
 * The renderer is reached through a dynamic import, and that is a measurement
 * rather than a preference. `@react-email/render`'s workerd build statically
 * imports `prettier/standalone`, `prettier/plugins/html` and `html-to-text` at
 * module scope, and it dynamically imports `react-dom/server.edge` — together
 * about 540 kB. Pulling that in statically would put all of it on the isolate's
 * cold start, because `src/server/auth/email.ts` is reachable from Better Auth
 * and therefore from every authenticated request. Behind `import()` it becomes
 * its own chunk, evaluated the first time an email is actually rendered, which
 * on this path is a queue producer and never a page render. The template
 * components stay static: they are a few hundred bytes of markup each and are
 * tree-shaken clear of the renderer.
 */

import type { ReactElement } from 'react'

/**
 * Two corrections to the default plain-text conversion.
 *
 * Headings are not shouted: an all-caps line is the plain-text equivalent of
 * the shouty transactional mail we are trying not to be. And a `Column` is
 * promoted to a block, so the two halves of a fact row land on their own lines
 * instead of colliding into `WorkspaceStudio Ostrowski`.
 */
const PLAIN_TEXT_SELECTORS = [
  { selector: 'h1', options: { uppercase: false } },
  {
    selector: 'td[data-id="__react-email-column"]',
    format: 'block',
    options: { leadingLineBreaks: 1, trailingLineBreaks: 1 },
  },
] as const

export interface RenderedEmailBody {
  readonly html: string
  readonly text: string
}

export async function renderEmailBody(
  element: ReactElement,
): Promise<RenderedEmailBody> {
  const { render, toPlainText } = await import('@react-email/components')
  // `pretty` is never passed: it routes through `prettier/standalone` at render
  // time to buy whitespace no inbox will ever show.
  const html = await render(element)
  return {
    html,
    text: toPlainText(html, { selectors: [...PLAIN_TEXT_SELECTORS] }),
  }
}
