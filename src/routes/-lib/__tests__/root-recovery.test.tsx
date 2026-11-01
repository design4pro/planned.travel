import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RootErrorBoundary } from '#/components/layout/error-state'
import { loadCatalogue } from '#/lib/i18n'
import { negotiateRequestLocale } from '#/server/fns/locale'
import En from '#/lib/i18n/messages/en/shell'
import Ar from '#/lib/i18n/messages/ar/shell'
import { RootDocument, Route } from '../../__root'
import type * as I18n from '#/lib/i18n'
import type * as Router from '@tanstack/react-router'

vi.mock('#/server/fns/locale', () => ({ negotiateRequestLocale: vi.fn() }))
vi.mock('#/lib/i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  loadCatalogue: vi.fn(),
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof Router>()),
  HeadContent: () => null,
  Scripts: () => null,
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('#/components/layout/feedback-widget', () => ({
  FeedbackWidget: () => null,
}))
vi.mock('#/components/layout/app-toaster', () => ({ AppToaster: () => null }))
vi.mock('@tanstack/react-devtools', () => ({ TanStackDevtools: () => null }))

afterEach(cleanup)

async function renderFailure() {
  const loader = Route.options.loader
  if (typeof loader !== 'function') throw new Error('Missing root loader')
  // The root loader takes no arguments; the router normally supplies this context.
  const data = await loader({} as NonNullable<Parameters<typeof loader>[0]>)
  vi.spyOn(Route, 'useLoaderData').mockReturnValue(data)
  render(
    <RootDocument>
      <RootErrorBoundary
        error={new Error('private SQL diagnostic')}
        reset={vi.fn()}
      />
    </RootDocument>,
    { container: document },
  )
  return data
}

describe('root loader failure to recovery document', () => {
  it.each([
    { locale: 'en' as const, dir: 'ltr' as const, copy: En },
    { locale: 'ar' as const, dir: 'rtl' as const, copy: Ar },
  ])(
    'keeps $locale and $dir when catalogue loading fails',
    async ({ locale, dir, copy }) => {
      vi.mocked(negotiateRequestLocale).mockResolvedValue({
        locale,
        dir,
        signedIn: true,
      })
      vi.mocked(loadCatalogue).mockRejectedValue(new Error('chunk unavailable'))
      const data = await renderFailure()
      expect(data?.messages).toEqual({})
      expect(document.documentElement.lang).toBe(locale)
      expect(document.documentElement.dir).toBe(dir)
      expect(
        screen.getByRole('heading', { name: copy['error.root'] }),
      ).toBeTruthy()
      expect(screen.getByText(copy['error.body'])).toBeTruthy()
      expect(
        screen.getByRole('button', { name: copy['error.retry'] }),
      ).toBeTruthy()
      expect(
        screen.getByRole('link', { name: copy['error.dashboard'] }),
      ).toBeTruthy()
      expect(document.body.textContent).not.toContain('shell.error.')
      expect(document.body.textContent).not.toContain('private SQL diagnostic')
    },
  )

  it('keeps the ordinary catalogue and signed-in result on successful loading', async () => {
    const messages = { 'shell.error.root': En['error.root'] }
    vi.mocked(negotiateRequestLocale).mockResolvedValue({
      locale: 'ar',
      dir: 'rtl',
      signedIn: true,
    })
    vi.mocked(loadCatalogue).mockResolvedValue(messages)
    const data = await renderFailure()
    expect(data).toEqual({ locale: 'ar', dir: 'rtl', signedIn: true, messages })
    expect(screen.getByRole('heading', { name: En['error.root'] })).toBeTruthy()
  })

  it('uses readable English when negotiation itself fails', async () => {
    vi.mocked(negotiateRequestLocale).mockRejectedValue(
      new Error('negotiation unavailable'),
    )
    await renderFailure()
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
    expect(screen.getByRole('heading', { name: En['error.root'] })).toBeTruthy()
    expect(screen.getByRole('button', { name: En['error.retry'] })).toBeTruthy()
  })
})
