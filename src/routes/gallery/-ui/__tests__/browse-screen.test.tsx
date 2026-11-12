import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import modules from '#/lib/i18n/messages/en/modules'
import marketing from '#/lib/i18n/messages/en/marketing'
import { BrowseScreen } from '../browse-screen'
import type { Locale } from '#/lib/i18n'
import type { BrowseEntry, BrowseScreenProps } from '../browse-screen'

vi.mock('#/components/marketing/chrome', () => ({
  MarketingHeader: () => null,
  MarketingFooter: () => null,
  SkipToContent: () => null,
}))
const messages = {
  ...Object.fromEntries(
    Object.entries(modules).map(([k, v]) => [`modules.${k}`, v]),
  ),
  ...Object.fromEntries(
    Object.entries(marketing).map(([k, v]) => [`marketing.${k}`, v]),
  ),
}
const entry = (
  title: string,
  publishedAt: string,
  countryNames = ['Japan'],
): BrowseEntry => ({
  title,
  publishedAt,
  countryNames,
  slug: title.toLowerCase(),
  summary: `${title} coast`,
  attribution: 'Alex',
  dayCount: 3,
  placeCount: 4,
  art: [],
})
const items = [
  entry('Older', '2026-01-01T00:00:00Z'),
  entry('Newest', '2026-02-01T00:00:00Z', ['France']),
]
function view(props: Partial<BrowseScreenProps> = {}, locale: Locale = 'en') {
  return (
    <I18nProvider locale={locale} messages={messages}>
      <BrowseScreen
        state={{ kind: 'ready', items }}
        hrefFor={(item) => `#${item.slug}`}
        {...props}
      />
    </I18nProvider>
  )
}

describe('unmounted Gallery browse', () => {
  it('renders newest as hero once, then filters every entry including hero and countries', async () => {
    render(view())
    expect(
      screen.getAllByRole('link').map((a) => a.getAttribute('href')),
    ).toEqual(['#newest', '#older'])
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'France' } })
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link').textContent).toContain('Newest')
    expect(screen.queryByTestId('gallery-hero')).toBeNull()
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('1 trip found'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(document.activeElement).toBe(input)
    expect(screen.getAllByRole('link')).toHaveLength(2)
    fireEvent.change(input, { target: { value: 'Alex' } })
    expect(screen.getAllByRole('link')).toHaveLength(2)
    fireEvent.change(input, { target: { value: 'nothing' } })
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText(/No trips match/)).toBeTruthy()
    expect(input.getAttribute('maxlength')).toBe('200')
  })

  it('keeps filtering immediate while debouncing announcements, including a locale change', async () => {
    const { rerender } = render(view())
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'Japan' } })
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe('')
    rerender(view({}, 'pl'))
    expect(screen.getAllByRole('link')).toHaveLength(1)
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('1 trip found'),
    )
    fireEvent.change(input, { target: { value: 'newest coast' } })
    expect(screen.getAllByRole('link')[0]?.getAttribute('href')).toBe('#newest')
  })

  it('renders and searches caller-localized country names with real Polish copy', async () => {
    const localizedItems = [
      { ...items[0], countryNames: ['Japonia'] },
      { ...items[1], countryNames: ['Francja'] },
    ]
    const localizedMessages = await loadCatalogue('pl')
    const localizedView = (
      <I18nProvider locale="pl" messages={localizedMessages}>
        <BrowseScreen
          state={{ kind: 'ready', items: localizedItems }}
          hrefFor={(item) => `#${item.slug}`}
        />
      </I18nProvider>
    )
    expect(renderToStaticMarkup(localizedView)).toContain('Japonia')
    render(localizedView)
    expect(screen.getByText('Japonia')).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'JAPONIA' },
    })
    expect(
      screen.getAllByRole('link').map((a) => a.getAttribute('href')),
    ).toEqual(['#older'])
    expect(screen.queryByTestId('gallery-hero')).toBeNull()
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'Znaleziono 1 podróż',
      ),
    )
  })

  it('retries an unavailable load only through the supplied callback', () => {
    const retry = vi.fn()
    const { rerender } = render(
      view({ state: { kind: 'unavailable' }, onRetry: retry }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
    rerender(view({ state: { kind: 'loading' } }))
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1 }),
    )
    rerender(view())
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1 }),
    )
  })

  it('SSR keeps content readable and search absent until hydration', () => {
    const html = renderToStaticMarkup(view())
    expect(html).toContain('Newest')
    expect(html).not.toContain('type="search"')
    expect(html).toContain('<noscript>')
  })

  it('renders distinct empty, loading, unavailable and rate-limited faces', () => {
    const { rerender } = render(view({ state: { kind: 'ready', items: [] } }))
    expect(
      screen.getByText('The Gallery is waiting for its first trip'),
    ).toBeTruthy()
    expect(screen.queryByRole('searchbox')).toBeNull()
    rerender(view({ state: { kind: 'loading' } }))
    expect(screen.getByRole('status').textContent).toBe('Loading the Gallery')
    rerender(view({ state: { kind: 'unavailable' } }))
    expect(screen.getByText('The Gallery could not load')).toBeTruthy()
    rerender(view({ state: { kind: 'rate-limited', retryAfterSeconds: 1 } }))
    expect(
      screen.getByText('Too many requests. Try again in 1 second.'),
    ).toBeTruthy()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('uses reduced-motion opt-outs and decorative reserved art', () => {
    render(view())
    expect(screen.getByTestId('gallery-hero').className).toContain(
      'motion-reduce:transition-none',
    )
    const art = document.querySelector('svg')
    expect(art?.getAttribute('aria-hidden')).toBe('true')
    expect(art?.getAttribute('viewBox')).toBe('0 0 320 200')
  })
})
