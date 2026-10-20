import '#/components/ui/__tests__/test-env'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import atlasCopy from '#/lib/i18n/messages/en/atlas'
import { RegionRecord } from '../region-record'

const api = vi.hoisted(() => ({
  load: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  invalidate: vi.fn(),
}))
vi.mock('#/server/fns/atlas', () => ({
  loadCountryRegionsFn: api.load,
  markRegionVisitedFn: api.add,
  unmarkRegionVisitedFn: api.remove,
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: api.invalidate }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  api.load.mockResolvedValue({ regions: [], total: 0 })
  api.invalidate.mockResolvedValue(undefined)
})
const mount = () =>
  render(
    <RegionRecord
      countryCode="DE"
      visited={false}
      headingLevel={4}
      disabled={false}
      onCountChange={vi.fn()}
      onPendingChange={vi.fn()}
    />,
  )

describe('region record', () => {
  it('adds on Enter and clears and focuses the input after success', async () => {
    api.add.mockResolvedValue({
      regions: [{ id: 'bavaria', name: 'Bavaria' }],
      total: 1,
      countryRecorded: true,
      status: 'added',
    })
    mount()
    const input = await screen.findByLabelText('Add a region in Germany')
    await waitFor(() => expect(input.hasAttribute('disabled')).toBe(false))
    await userEvent.type(input, 'Bavaria{Enter}')
    expect(
      await screen.findByRole('button', { name: 'Remove Bavaria' }),
    ).not.toBeNull()
    expect((input as HTMLInputElement).value).toBe('')
    expect(document.activeElement).toBe(input)
    expect(api.add).toHaveBeenCalledWith({
      data: { countryCode: 'DE', regionName: 'Bavaria' },
    })
  })
  it('refuses an empty or hidden name before sending, preserving the typed name on a failed add', async () => {
    api.add.mockRejectedValue(new Error('private driver details'))
    mount()
    const input = await screen.findByLabelText('Add a region in Germany')
    await userEvent.click(screen.getByRole('button', { name: 'Add region' }))
    expect(input.getAttribute('aria-invalid')).toBe('true')
    await userEvent.type(input, 'Bav\u200baria{Enter}')
    expect(api.add).not.toHaveBeenCalled()
    await userEvent.clear(input)
    await userEvent.type(input, 'Bavaria{Enter}')
    await waitFor(() => expect(api.add).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect((input as HTMLInputElement).value).toBe('Bavaria')
  })
  it('restores a row after failed remove and focuses its remove control', async () => {
    api.load.mockResolvedValue({
      regions: [{ id: 'one', name: 'Bavaria' }],
      total: 1,
    })
    api.remove.mockRejectedValue(new Error('refused'))
    mount()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove Bavaria' }),
    )
    const button = await screen.findByRole('button', { name: 'Remove Bavaria' })
    await waitFor(() => expect(document.activeElement).toBe(button))
  })
  it('announces a failed load and reloads into the input', async () => {
    api.load
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ regions: [], total: 0 })
    mount()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reload regions' }),
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText('Add a region in Germany'),
      ),
    )
  })
})

describe('region pending states and limits', () => {
  it('holds the input read-only and ignores repeated Enter while adding', async () => {
    let finish: (value: unknown) => void = () => {}
    api.add.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    mount()
    const input = await screen.findByLabelText('Add a region in Germany')
    await userEvent.type(input, 'Bavaria{Enter}{Enter}')
    expect(api.add).toHaveBeenCalledTimes(1)
    expect(input.hasAttribute('readonly')).toBe(true)
    finish({
      regions: [{ id: 'one', name: 'Bavaria' }],
      total: 1,
      countryRecorded: false,
      status: 'added',
    })
    await screen.findByRole('button', { name: 'Remove Bavaria' })
  })
  it('uses the total across all countries to refuse an add before sending', async () => {
    api.load.mockResolvedValue({ regions: [], total: 1000 })
    mount()
    const input = await screen.findByLabelText('Add a region in Germany')
    await userEvent.type(input, 'Bavaria{Enter}')
    expect(api.add).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(
      screen.getByText(
        'You have recorded 1000 regions. Remove one to add another.',
      ),
    ).not.toBeNull()
  })
  it('focuses the next remaining remove control after a successful removal', async () => {
    api.load.mockResolvedValue({
      regions: [
        { id: 'one', name: 'Bavaria' },
        { id: 'two', name: 'Berlin' },
      ],
      total: 2,
    })
    api.remove.mockResolvedValue({
      regions: [{ id: 'two', name: 'Berlin' }],
      total: 1,
    })
    mount()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove Bavaria' }),
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Remove Berlin' }),
      ),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remove Bavaria' }),
      ).toBeNull(),
    )
  })
  it('ignores a reply for a country that has been closed', async () => {
    let finish: (value: unknown) => void = () => {}
    api.load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const view = mount()
    view.rerender(
      <RegionRecord
        key="FR"
        countryCode="FR"
        visited={false}
        headingLevel={4}
        disabled={false}
        onCountChange={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    )
    await screen.findByLabelText('Add a region in France')
    finish({ regions: [{ id: 'one', name: 'Bavaria' }], total: 1 })
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remove Bavaria' }),
      ).toBeNull(),
    )
  })
})

it('keeps the loaded record and input focus when router invalidation replaces the catalogue object', async () => {
  const count = vi.fn()
  const pending = vi.fn()
  const catalogue = Object.fromEntries(
    Object.entries(atlasCopy).map(([key, value]) => [`atlas.${key}`, value]),
  )
  function tree(messages: typeof catalogue) {
    return (
      <I18nProvider locale="en" messages={messages}>
        <RegionRecord
          countryCode="DE"
          visited={true}
          headingLevel={4}
          disabled={false}
          onCountChange={count}
          onPendingChange={pending}
        />
      </I18nProvider>
    )
  }
  const view = render(tree(catalogue))
  const input = await screen.findByLabelText('Add a region in Germany')
  await waitFor(() => expect(input.hasAttribute('disabled')).toBe(false))
  input.focus()
  view.rerender(tree({ ...catalogue }))
  await waitFor(() => expect(api.load).toHaveBeenCalledTimes(1))
  expect(document.activeElement).toBe(input)
})

it('keeps a committed add when refreshing the route fails', async () => {
  api.invalidate.mockRejectedValue(new Error('route refresh failed'))
  api.add.mockResolvedValue({
    countryCode: 'DE',
    regions: [{ id: 'one', name: 'Bavaria' }],
    total: 1,
    countryRecorded: true,
    status: 'added',
  })
  mount()
  const input = await screen.findByLabelText('Add a region in Germany')
  await userEvent.type(input, 'Bavaria{Enter}')
  await screen.findByRole('button', { name: 'Remove Bavaria' })
  await waitFor(() => expect((input as HTMLInputElement).value).toBe(''))
})

it('reconciles a lost removal response instead of restoring a deleted row', async () => {
  api.load
    .mockResolvedValueOnce({
      countryCode: 'DE',
      regions: [{ id: 'one', name: 'Bavaria' }],
      total: 1,
    })
    .mockResolvedValue({ countryCode: 'DE', regions: [], total: 0 })
  api.remove.mockRejectedValue(new Error('response lost after commit'))
  mount()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Remove Bavaria' }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Remove Bavaria' })).toBeNull(),
  )
  expect(api.load).toHaveBeenCalledTimes(2)
})

it('offers reload and disables stale writes if an uncertain outcome cannot be reread', async () => {
  api.load
    .mockResolvedValueOnce({
      countryCode: 'DE',
      regions: [{ id: 'one', name: 'Bavaria' }],
      total: 1,
    })
    .mockRejectedValueOnce(new Error('reread failed'))
    .mockResolvedValue({ countryCode: 'DE', regions: [], total: 0 })
  api.remove.mockRejectedValue(new Error('response lost'))
  mount()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Remove Bavaria' }),
  )
  const reload = await screen.findByRole('button', { name: 'Reload regions' })
  await userEvent.click(reload)
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByLabelText('Add a region in Germany'),
    ),
  )
  expect(screen.queryByRole('button', { name: 'Remove Bavaria' })).toBeNull()
})

it('synchronizes both hosts after a region write without disabling or blurring the active input', async () => {
  api.load
    .mockResolvedValueOnce({ countryCode: 'DE', regions: [], total: 0 })
    .mockResolvedValueOnce({ countryCode: 'DE', regions: [], total: 0 })
    .mockResolvedValue({
      countryCode: 'DE',
      regions: [{ id: 'one', name: 'Bavaria' }],
      total: 1,
    })
  api.add.mockResolvedValue({
    countryCode: 'DE',
    regions: [{ id: 'one', name: 'Bavaria' }],
    total: 1,
    status: 'added',
    countryRecorded: false,
  })
  const count = vi.fn()
  const pending = vi.fn()
  render(
    <>
      <RegionRecord
        countryCode="DE"
        visited={true}
        headingLevel={4}
        disabled={false}
        onCountChange={count}
        onPendingChange={pending}
      />
      <RegionRecord
        countryCode="DE"
        visited={true}
        headingLevel={4}
        disabled={false}
        onCountChange={count}
        onPendingChange={pending}
      />
    </>,
  )
  const input = screen.getAllByLabelText('Add a region in Germany')[0]
  await waitFor(() => expect(input.hasAttribute('disabled')).toBe(false))
  await userEvent.type(input, 'Bavaria{Enter}')
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: 'Remove Bavaria' }),
    ).toHaveLength(2),
  )
  expect(document.activeElement).toBe(input)
})

it('refuses an accent-only name without writing and labels the region list', async () => {
  mount()
  const input = await screen.findByLabelText('Add a region in Germany')
  await userEvent.type(input, '\u0301{Enter}')
  expect(api.add).not.toHaveBeenCalled()
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByRole('list', { name: 'Regions' })).not.toBeNull()
})
