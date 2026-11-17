import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import { ReleaseHistory } from '../release-history'
import type { ReleaseHistoryPage } from '#/server/fns/-lib/release-history'

const entry = {
  version: '1.0.0',
  shippedAt: 1000,
  updatedAt: 2000,
  contentLocale: 'en',
  sourceLocale: 'en' as const,
  usedFallback: true,
  title: '<script>alert(1)</script>',
  summary: ['A safer journey.'],
  features: ['Shared plans'],
  fixes: [],
}
function mount(load: () => Promise<ReleaseHistoryPage>) {
  return render(
    <I18nProvider
      locale="en"
      messages={namespaceCatalogue('settings', Settings)}
    >
      <ReleaseHistory load={load} />
    </I18nProvider>,
  )
}
afterEach(cleanup)
it('reserves pending geometry then renders the empty state', async () => {
  let resolve!: (page: ReleaseHistoryPage) => void
  mount(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  expect(screen.getByRole('status').textContent).toContain(
    'Loading release history',
  )
  resolve({ items: [], nextCursor: null })
  expect(await screen.findByText('No release notes yet')).toBeTruthy()
})
it('retries without showing raw errors and focuses the section heading', async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error('private database detail'))
    .mockResolvedValueOnce({ items: [], nextCursor: null })
  mount(load)
  const retry = await screen.findByRole('button', { name: 'Retry' })
  expect(document.body.textContent).not.toContain('private database detail')
  retry.focus()
  fireEvent.click(retry)
  await screen.findByText('No release notes yet')
  expect(document.activeElement).toBe(
    screen.getByRole('heading', { name: 'Release history' }),
  )
})
it('preserves entries on pagination errors, renders inert whole-entry prose and focuses the final append', async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce({ items: [entry], nextCursor: 'page-2' })
    .mockRejectedValueOnce(new Error('storage'))
    .mockResolvedValueOnce({
      items: [{ ...entry, version: '0.9.0' }],
      nextCursor: null,
    })
  const view = mount(load)
  await screen.findByRole('article')
  expect(view.container.querySelector('article')?.getAttribute('lang')).toBe(
    'en',
  )
  expect(view.container.querySelector('article')?.getAttribute('dir')).toBe(
    'ltr',
  )
  expect(view.container.querySelector('script')).toBeNull()
  expect(screen.getByText('These notes are available in English.')).toBeTruthy()
  expect(screen.getByText(/Notes updated/)).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Fixes' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show older releases' }))
  const retry = await screen.findByRole('button', { name: 'Retry' })
  expect(screen.getAllByRole('article')).toHaveLength(1)
  retry.focus()
  fireEvent.click(retry)
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
  expect(document.activeElement).toBe(
    screen.getByRole('heading', { name: 'Version 0.9.0' }),
  )
  expect(screen.getByRole('status').textContent).toContain(
    '1 older release loaded',
  )
})

it('retains the older-releases control and focus when another page remains', async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce({ items: [entry], nextCursor: 'page-2' })
    .mockResolvedValueOnce({
      items: [{ ...entry, version: '0.9.0' }],
      nextCursor: 'page-3',
    })
  mount(load)
  const older = await screen.findByRole('button', {
    name: 'Show older releases',
  })
  older.focus()
  fireEvent.click(older)
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
  expect(document.activeElement).toBe(older)
  expect(load.mock.calls[1]?.[0]).toEqual({ locale: 'en', cursor: 'page-2' })
})

it('does not announce a previous append as successful when a later page fails', async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce({ items: [entry], nextCursor: 'page-2' })
    .mockResolvedValueOnce({
      items: [{ ...entry, version: '0.9.0' }],
      nextCursor: 'page-3',
    })
    .mockRejectedValueOnce(new Error('storage unavailable'))
  mount(load)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Show older releases' }),
  )
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
  expect(screen.getByRole('status').textContent).toContain(
    '1 older release loaded',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Show older releases' }))
  await screen.findByRole('button', { name: 'Retry' })
  expect(screen.getByRole('status').textContent).toBe('')
})

it('moves focus to recovery when a pending pagination request rejects', async () => {
  let rejectPage: (reason: Error) => void = () => {
    throw new Error('Pagination request has not started')
  }
  const load = vi
    .fn()
    .mockResolvedValueOnce({ items: [entry], nextCursor: 'page-2' })
    .mockImplementationOnce(
      () =>
        new Promise<ReleaseHistoryPage>((_resolve, reject) => {
          rejectPage = reject
        }),
    )
    .mockRejectedValueOnce(new Error('still unavailable'))
  mount(load)
  const older = await screen.findByRole('button', {
    name: 'Show older releases',
  })
  older.focus()
  fireEvent.click(older)
  rejectPage(new Error('unavailable'))
  const retry = await screen.findByRole('button', { name: 'Retry' })
  await waitFor(() => expect(document.activeElement).toBe(retry))
  expect(screen.getAllByRole('article')).toHaveLength(1)
  fireEvent.click(retry)
  await waitFor(() => expect(retry.getAttribute('disabled')).toBeNull())
  expect(document.activeElement).toBe(retry)
  expect(screen.getAllByRole('article')).toHaveLength(1)
})
