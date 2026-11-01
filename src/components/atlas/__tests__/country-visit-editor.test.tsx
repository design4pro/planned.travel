import '#/components/ui/__tests__/test-env'
import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CountryVisitEditor } from '../country-visit-editor'

const api = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  invalidate: vi.fn(),
}))
vi.mock('#/server/fns/atlas', () => ({
  loadCountryVisitFn: api.load,
  updateCountryVisitFn: api.save,
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: api.invalidate }),
}))
const visit = { firstVisitedOn: null, lastVisitedOn: null, note: null }
const mount = () =>
  render(
    <CountryVisitEditor
      countryCode="FR"
      disabled={false}
      onPendingChange={() => {}}
    />,
  )
async function open() {
  await userEvent.click(screen.getByRole('button', { name: 'Edit visit' }))
  return screen.findByLabelText('First visit')
}
beforeEach(() => {
  vi.clearAllMocks()
  api.load.mockResolvedValue({ country: { visit }, today: '2026-08-20' })
  api.save.mockResolvedValue({ country: { visit }, errors: null })
  api.invalidate.mockResolvedValue(undefined)
})
it('loads the server clock, cancels without writing and restores focus', async () => {
  mount()
  const field = await open()
  expect(field.getAttribute('max')).toBe('2026-08-20')
  await waitFor(() => expect(document.activeElement).toBe(field))
  await userEvent.type(screen.getByLabelText('Note'), 'draft')
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(api.save).not.toHaveBeenCalled()
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Edit visit' }),
    ),
  )
})
it('validates bounds, future dates and note length before any write', async () => {
  mount()
  const first = await open()
  fireEvent.change(first, { target: { value: '2026-08-21' } })
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  expect(await screen.findByText('Use today or an earlier date.')).toBeTruthy()
  fireEvent.change(first, { target: { value: '2026-08-19' } })
  fireEvent.change(screen.getByLabelText('Last visit'), {
    target: { value: '2026-08-18' },
  })
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  expect(
    await screen.findByText('First visit must be on or before last visit.'),
  ).toBeTruthy()
  fireEvent.change(first, { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Note'), {
    target: { value: 'x'.repeat(2001) },
  })
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  expect(await screen.findByText('Use at most 2,000 characters.')).toBeTruthy()
  expect(api.save).not.toHaveBeenCalled()
})
it('holds pending, retains draft on failure and permits an idempotent retry', async () => {
  let reject: (reason: Error) => void = () => {}
  api.save.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail
    }),
  )
  mount()
  await open()
  await userEvent.type(screen.getByLabelText('Note'), 'Paris')
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  expect(screen.getByLabelText('Note').getAttribute('readonly')).not.toBeNull()
  expect(
    screen.getByRole('button', { name: 'Cancel' }).getAttribute('disabled'),
  ).not.toBeNull()
  reject(new Error('offline'))
  await waitFor(() =>
    expect(screen.getByLabelText('Note').getAttribute('readonly')).toBeNull(),
  )
  expect((screen.getByLabelText('Note') as HTMLTextAreaElement).value).toBe(
    'Paris',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  expect(api.save).toHaveBeenLastCalledWith({
    data: {
      countryCode: 'FR',
      firstVisitedOn: null,
      lastVisitedOn: null,
      note: 'Paris',
    },
  })
  await waitFor(() => expect(api.invalidate).toHaveBeenCalled())
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Edit visit' }),
    ),
  )
})
it('a reply from a closed country cannot apply its draft to another country', async () => {
  let resolve: (value: unknown) => void = () => {}
  api.load.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    }),
  )
  const ui = render(
    <CountryVisitEditor
      key="FR"
      countryCode="FR"
      disabled={false}
      onPendingChange={() => {}}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Edit visit' }))
  ui.rerender(
    <CountryVisitEditor
      key="JP"
      countryCode="JP"
      disabled={false}
      onPendingChange={() => {}}
    />,
  )
  resolve({
    country: { visit: { ...visit, note: 'France draft' } },
    today: '2026-08-20',
  })
  await open()
  expect((screen.getByLabelText('Note') as HTMLTextAreaElement).value).toBe('')
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  expect(api.save).toHaveBeenLastCalledWith({
    data: {
      countryCode: 'JP',
      firstVisitedOn: null,
      lastVisitedOn: null,
      note: null,
    },
  })
})

it('refuses a native date field with incomplete calendar input rather than clearing it', async () => {
  mount()
  const first = await open()
  Object.defineProperty(first, 'validity', {
    configurable: true,
    value: { badInput: true },
  })
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  expect(
    await screen.findByText('Enter a real date in YYYY-MM-DD format.'),
  ).toBeTruthy()
  expect(api.save).not.toHaveBeenCalled()
})

it('refreshes Atlas after a save completes for a closed country without replacing the new draft', async () => {
  let resolve: (value: unknown) => void = () => {}
  api.save.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    }),
  )
  const ui = render(
    <CountryVisitEditor
      key="FR"
      countryCode="FR"
      disabled={false}
      onPendingChange={() => {}}
    />,
  )
  await open()
  await userEvent.type(screen.getByLabelText('Note'), 'Paris')
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  ui.rerender(
    <CountryVisitEditor
      key="JP"
      countryCode="JP"
      disabled={false}
      onPendingChange={() => {}}
    />,
  )
  await open()
  await userEvent.type(screen.getByLabelText('Note'), 'Tokyo')
  resolve({ country: { visit: { ...visit, note: 'Paris' } }, errors: null })
  await waitFor(() => expect(api.invalidate).toHaveBeenCalled())
  expect((screen.getByLabelText('Note') as HTMLTextAreaElement).value).toBe(
    'Tokyo',
  )
})

it('restores focus after retrying a failed post-save refresh without saving again', async () => {
  api.invalidate.mockRejectedValueOnce(new Error('offline'))
  api.invalidate.mockRejectedValueOnce(new Error('still offline'))
  mount()
  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  const retry = await screen.findByRole('button', { name: /Reload/ })
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Edit visit' }),
    ),
  )
  await userEvent.tab()
  expect(document.activeElement).toBe(retry)
  await userEvent.keyboard('{Enter}')
  await waitFor(() => expect(api.invalidate).toHaveBeenCalledTimes(2))
  expect(document.activeElement).toBe(retry)
  expect(screen.getByRole('button', { name: /Reload/ })).toBe(retry)
  await userEvent.keyboard('{Enter}')
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /Reload/ })).toBeNull(),
  )
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Edit visit' }),
  )
  expect(api.save).toHaveBeenCalledTimes(1)
  expect(api.invalidate).toHaveBeenCalledTimes(3)
})

it('preserves focus moved away while a refresh retry is pending', async () => {
  let finish: () => void = () => {}
  api.invalidate.mockRejectedValueOnce(new Error('offline'))
  api.invalidate.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve
    }),
  )
  mount()
  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  await userEvent.click(await screen.findByRole('button', { name: /Reload/ }))
  const edit = screen.getByRole('button', { name: 'Edit visit' })
  edit.focus()
  await userEvent.keyboard('{Enter}')
  const first = await screen.findByLabelText('First visit')
  await waitFor(() => expect(document.activeElement).toBe(first))
  finish()
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /Reload/ })).toBeNull(),
  )
  expect(document.activeElement).toBe(first)
  expect(api.save).toHaveBeenCalledTimes(1)
})

it('returns a focused refresh retry to the first field of a reopened draft', async () => {
  api.invalidate.mockRejectedValueOnce(new Error('offline'))
  mount()
  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  await screen.findByRole('button', { name: /Reload/ })
  const first = await open()
  await waitFor(() => expect(document.activeElement).toBe(first))
  const retry = screen.getByRole('button', { name: /Reload/ })
  retry.focus()
  await userEvent.keyboard('{Enter}')
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /Reload/ })).toBeNull(),
  )
  expect(document.activeElement).toBe(first)
  expect(api.save).toHaveBeenCalledTimes(1)
})

it('disables refresh retry while reopening or saving the editor', async () => {
  api.invalidate.mockRejectedValueOnce(new Error('offline'))
  mount()
  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  const retry = await screen.findByRole('button', { name: /Reload/ })
  let finishLoad: (value: unknown) => void = () => {}
  api.load.mockReturnValueOnce(
    new Promise((resolve) => {
      finishLoad = resolve
    }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Edit visit' }))
  expect(retry.getAttribute('disabled')).not.toBeNull()
  await userEvent.click(retry)
  expect(api.invalidate).toHaveBeenCalledTimes(1)
  finishLoad({ country: { visit }, today: '2026-08-20' })
  await screen.findByLabelText('First visit')
  await waitFor(() => expect(retry.getAttribute('disabled')).toBeNull())
  let finishSave: (value: unknown) => void = () => {}
  api.save.mockReturnValueOnce(
    new Promise((resolve) => {
      finishSave = resolve
    }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  expect(retry.getAttribute('disabled')).not.toBeNull()
  await userEvent.click(retry)
  expect(api.invalidate).toHaveBeenCalledTimes(1)
  finishSave({ country: { visit }, errors: null })
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /Reload/ })).toBeNull(),
  )
})

it('blocks refresh retry during an external action and permits it after unlocking', async () => {
  api.invalidate.mockRejectedValueOnce(new Error('offline'))
  const ui = mount()
  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))
  const retry = await screen.findByRole('button', { name: /Reload/ })
  ui.rerender(
    <CountryVisitEditor
      countryCode="FR"
      disabled={true}
      onPendingChange={() => {}}
    />,
  )
  expect(retry.getAttribute('disabled')).not.toBeNull()
  await userEvent.click(retry)
  expect(api.invalidate).toHaveBeenCalledTimes(1)
  expect(api.save).toHaveBeenCalledTimes(1)
  ui.rerender(
    <CountryVisitEditor
      countryCode="FR"
      disabled={false}
      onPendingChange={() => {}}
    />,
  )
  expect(retry.getAttribute('disabled')).toBeNull()
  retry.focus()
  await userEvent.keyboard('{Enter}')
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /Reload/ })).toBeNull(),
  )
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Edit visit' }),
  )
  expect(api.invalidate).toHaveBeenCalledTimes(2)
  expect(api.save).toHaveBeenCalledTimes(1)
})
