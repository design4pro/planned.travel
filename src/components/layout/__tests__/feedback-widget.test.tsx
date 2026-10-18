// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

import plShell from '#/lib/i18n/messages/pl/shell'
import plUi from '#/lib/i18n/messages/pl/ui'
import enShell from '#/lib/i18n/messages/en/shell'

import type { Locale } from '#/lib/i18n'

/**
 * What this component owns, and therefore what is worth asserting.
 *
 * The button, the form and the screenshot editor are Sentry's, inside a shadow root no test can
 * reach into and no assertion here would be about our code anyway. What is ours is the four
 * decisions the SDK cannot take for itself: that the widget is built at all, in the reader's
 * language, with the reader's theme, and that it is taken down again - on unmount and, less
 * obviously, on every language change, because the SDK reads its labels once at construction and
 * never looks at them again.
 *
 * Both the DSN guard and the labels are read at module evaluation time, so every case re-evaluates
 * the module with `vi.resetModules()` after stubbing the environment. That also means `#/lib/i18n`
 * has to be imported from inside the same reset: a provider from one module instance publishes a
 * context the hook in another instance cannot see.
 */

const { createWidget, removeFromDom, setTheme, startFeedback } = vi.hoisted(
  () => ({
    createWidget: vi.fn(),
    removeFromDom: vi.fn(),
    setTheme: vi.fn(),
    startFeedback: vi.fn(),
  }),
)

vi.mock('#/lib/sentry-feedback', () => ({ startFeedback }))

/** Where the router says the visitor is; the widget reads nothing else from it. */
const route = vi.hoisted(() => ({ href: '/trips' }))
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { href: string } }) => unknown
  }) => select({ location: { href: route.href } }),
}))

/** Shape only - nothing here reaches Sentry, and no key is validated. */
const DSN = 'https://public@o0.ingest.sentry.io/1'

interface MountOptions {
  readonly locale?: Locale
  readonly dsn?: string
  readonly theme?: 'light' | 'dark'
}

async function mount({ locale = 'pl', dsn = DSN, theme }: MountOptions = {}) {
  // Written before the module is evaluated: the theme store reads storage once, on first subscribe.
  if (theme !== undefined) window.localStorage.setItem('planned.theme', theme)

  vi.resetModules()
  vi.stubEnv('VITE_SENTRY_DSN', dsn)

  const [{ FeedbackWidget }, { I18nProvider, loadCatalogue }] =
    await Promise.all([import('../feedback-widget'), import('#/lib/i18n')])

  const view = render(
    <I18nProvider locale={locale} messages={await loadCatalogue(locale)}>
      <FeedbackWidget />
    </I18nProvider>,
  )

  /** Re-render in another language, through the same module instance. */
  const speak = async (next: Locale) => {
    view.rerender(
      <I18nProvider locale={next} messages={await loadCatalogue(next)}>
        <FeedbackWidget />
      </I18nProvider>,
    )
  }

  return { ...view, speak }
}

/** The single object passed to `createWidget`, after the effect has run. */
async function widgetOptions(): Promise<Record<string, unknown>> {
  await waitFor(() => {
    expect(createWidget).toHaveBeenCalled()
  })
  return createWidget.mock.calls.at(-1)?.[0] as Record<string, unknown>
}

beforeEach(() => {
  // The doubles are created once, outside every case, so both their history and their behaviour
  // have to be re-established here - `restoreMocks` does neither for a bare `vi.fn()`.
  vi.clearAllMocks()
  route.href = '/trips'
  createWidget.mockReturnValue({ removeFromDom })
  startFeedback.mockReturnValue({ createWidget, setTheme })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  window.localStorage.clear()
})

describe('FeedbackWidget', () => {
  it('builds the widget in the reader’s language and tags it with the locale', async () => {
    await mount({ locale: 'pl' })

    const options = await widgetOptions()
    expect(options.tags).toEqual({ locale: 'pl' })
    expect(options.triggerLabel).toBe(plShell['feedback.triggerLabel'])
    expect(options.formTitle).toBe(plShell['feedback.formTitle'])
    expect(options.submitButtonLabel).toBe(
      plShell['feedback.submitButtonLabel'],
    )
    expect(options.errorGenericText).toBe(plShell['feedback.errorGenericText'])
  })

  it('labels a highlight box with the shared primitive, not a second copy of it', async () => {
    await mount({ locale: 'pl' })

    expect((await widgetOptions()).removeHighlightText).toBe(
      plUi['action.remove'],
    )
  })

  it('leaves the accessible name and the no-client error to the SDK', async () => {
    await mount({ locale: 'pl' })

    const options = await widgetOptions()
    // Unset on purpose: the SDK falls back to `triggerLabel`, which is the visible label (WCAG
    // 2.5.3). `errorNoClientText` cannot fire here - without a client there is no widget.
    expect(options).not.toHaveProperty('triggerAriaLabel')
    expect(options).not.toHaveProperty('errorNoClientText')
  })

  it('rebuilds the widget when the language changes', async () => {
    const { speak } = await mount({ locale: 'pl' })
    await widgetOptions()

    await speak('en')

    await waitFor(() => {
      expect(createWidget).toHaveBeenCalledTimes(2)
    })
    // The old button is gone rather than left behind next to the new one.
    expect(removeFromDom).toHaveBeenCalledTimes(1)
    expect((await widgetOptions()).triggerLabel).toBe(
      enShell['feedback.triggerLabel'],
    )
  })

  it('takes the button down with the component', async () => {
    const { unmount } = await mount()
    await widgetOptions()

    unmount()

    expect(removeFromDom).toHaveBeenCalledTimes(1)
  })

  it('hands the resolved theme to the SDK', async () => {
    await mount({ theme: 'dark' })

    await waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith('dark')
    })
  })

  it('loads nothing at all without a DSN', async () => {
    const { container } = await mount({ dsn: '' })

    // A microtask boundary, so a chunk that was going to load would have.
    await Promise.resolve()
    expect(startFeedback).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe('')
  })

  it.each([
    '/join/the-secret',
    '/login?redirect=%2Fjoin%2Fthe-secret',
    '/login?callbackURL=%252Fjoin%252Fthe-secret',
  ])(
    'offers no button on %s, where a screenshot could carry the link',
    async (href) => {
      route.href = href
      await mount()

      // The theme effect still loads the SDK, so once it has run the build step has had its turn.
      await waitFor(() => {
        expect(setTheme).toHaveBeenCalled()
      })
      expect(createWidget).not.toHaveBeenCalled()
    },
  )

  it('builds the button again once the visitor leaves the join location', async () => {
    route.href = '/join/the-secret'
    const { speak } = await mount()
    await waitFor(() => {
      expect(setTheme).toHaveBeenCalled()
    })
    expect(createWidget).not.toHaveBeenCalled()

    route.href = '/trips'
    await speak('pl')

    await waitFor(() => {
      expect(createWidget).toHaveBeenCalledTimes(1)
    })
  })
})
