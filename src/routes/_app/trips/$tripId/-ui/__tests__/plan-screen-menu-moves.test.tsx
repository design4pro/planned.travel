// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'
import { beforeEach, expect, it, vi } from 'vitest'
import { act, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import type * as RouterModule from '@tanstack/react-router'
import type * as MapModule from '#/components/map'
import {
  board,
  day,
  note,
  notes,
  stop,
  transports,
} from './plan-board-fixtures'

const mocks = vi.hoisted(() => ({
  write: vi.fn(),
  invalidate: vi.fn(),
  error: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: mocks.error } }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof RouterModule>()),
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))
vi.mock('#/components/modules/book', () => ({ BookingDialog: () => null }))
vi.mock('../../-server/plan', () => ({ reorderPlanFn: mocks.write }))
vi.mock('../../-server/day-notes', () => ({}))
vi.mock('../../-server/plan-transports', () => ({}))
vi.mock('../use-trip-weather', () => ({
  useTripWeather: () => ({ viewOf: () => null, unit: 'celsius' }),
}))
vi.mock('../planner-map-layer', () => ({
  PlannerMapLayer: () => null,
  usePlannerDrop: () => ({ ready: false, editable: false }),
}))
vi.mock('#/components/map', async (importOriginal) => ({
  ...(await importOriginal<typeof MapModule>()),
  MapCanvas: () => null,
}))

const { PlanScreen } = await import('../plan-screen')

const messages = await loadCatalogue('en')
const longTitle = 'Kyoto and its temples '.repeat(8).trim()
type Kind = 'stop' | 'note'
function deferred() {
  let reject!: (error: Error) => void
  const promise = new Promise<void>((_, no) => {
    reject = no
  })
  return { promise, reject }
}
beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  mocks.write.mockReset().mockReturnValue(new Promise(() => {}))
  mocks.error.mockClear()
  mocks.invalidate.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('>='),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
})
function mount(timed = false, duplicate = false) {
  const destinationStops = duplicate ? [stop('s2', 'p1', 0)] : []
  if (timed) destinationStops.push(stop('s3', 'p2', 0, '11:00'))
  render(
    <I18nProvider locale="en" messages={messages}>
      <PlanScreen
        payload={board([
          day('d1', 1, [stop('s1', 'p1', 0, timed ? '09:00' : null)]),
          day('d2', 2, destinationStops, longTitle),
          day('d3', 3, [], longTitle),
          day('d4', 4, [], null),
        ])}
        notes={notes([note('n1', 'd1', 1, { time: timed ? '09:00' : null })])}
        transports={transports()}
        tripTitle="Trip"
      />
    </I18nProvider>,
  )
}
function section(id: string) {
  const element = document.querySelector<HTMLElement>(
    `[data-planner-day="${id}"]`,
  )
  if (element === null) throw new Error(`Missing day ${id}`)
  return element
}
function row(kind: Kind, dayId: string) {
  const selector =
    kind === 'stop' ? '[data-planner-item="s1"]' : '[data-planner-note="n1"]'
  const element = section(dayId).querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`Missing ${kind} on ${dayId}`)
  return element
}
async function openMenu(kind: Kind) {
  const name = kind === 'stop' ? 'Actions for Place p1' : 'Move to day'
  // Locate through existing row attributes too, so the initial failure is the behavior.
  const selector =
    kind === 'stop' ? '[data-planner-item="s1"]' : '[data-planner-note="n1"]'
  const source = document.querySelector<HTMLElement>(selector)
  if (source === null) throw new Error('Missing source row')
  await userEvent.click(within(source).getByRole('button', { name }))
  if (kind === 'stop') {
    screen.getByRole('menuitem', { name: 'Move to day' }).focus()
    await userEvent.keyboard('{ArrowRight}')
  }
}
async function move(kind: Kind) {
  await openMenu(kind)
  await userEvent.click(
    screen.getByRole('menuitem', { name: `Day 2 · ${longTitle}` }),
  )
}
function announcement() {
  const node = screen
    .getAllByRole('status')
    .find((entry) => entry.getAttribute('aria-live') === 'polite')
  if (node === undefined) throw new Error('Missing move status')
  return node
}
it.each(['stop', 'note'] as const)(
  '%s menu numbers repeated and untitled destinations',
  async (kind) => {
    mount()
    await openMenu(kind)
    for (const number of [2, 3]) {
      expect(
        screen.getByRole('menuitem', { name: `Day ${number} · ${longTitle}` })
          .textContent,
      ).toContain(`Day ${number}`)
    }
    expect(screen.getByRole('menuitem', { name: 'Day 4' })).toBeTruthy()
  },
)
it.each(['stop', 'note'] as const)(
  '%s menu announces the accepted move and focuses the remounted row',
  async (kind) => {
    mount()
    await move(kind)
    await waitFor(() =>
      expect(row(kind, 'd2').contains(document.activeElement)).toBe(true),
    )
    expect(announcement().textContent).toBe(
      `Moved ${kind === 'stop' ? 'Place p1' : 'Note n1'} to Day 2 · ${longTitle}. Saving.`,
    )
    expect(mocks.write).toHaveBeenCalledTimes(1)
  },
)

it.each(['stop', 'note'] as const)(
  '%s move preserves collapse and focuses the destination header',
  async (kind) => {
    mount()
    await userEvent.click(
      within(section('d2')).getByRole('button', {
        name: `Expand or collapse ${longTitle}`,
      }),
    )
    await move(kind)
    const header = section('d2').querySelector('[data-planner-day-header]')
    await waitFor(() => expect(document.activeElement).toBe(header))
    expect(
      section('d2')
        .querySelector('[aria-expanded]')
        ?.getAttribute('aria-expanded'),
    ).toBe('false')
  },
)
it('announces a duplicate refusal and keeps focus on the source stop', async () => {
  mount(false, true)
  await move('stop')
  await waitFor(() =>
    expect(row('stop', 'd1').contains(document.activeElement)).toBe(true),
  )
  expect(announcement().textContent).toBe(
    'Place p1 was not moved. That day already has it.',
  )
  expect(mocks.write).not.toHaveBeenCalled()
})
it.each(['stop', 'note'] as const)(
  '%s time prompt takes focus, cancellation restores the source, confirmation moves once',
  async (kind) => {
    mount(true)
    await move(kind)
    let dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(announcement().textContent).not.toContain('Moved ')
    expect(mocks.write).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(row(kind, 'd1').contains(document.activeElement)).toBe(true),
    )
    await move(kind)
    dialog = screen.getByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Move and drop the time' }),
    )
    await waitFor(() =>
      expect(row(kind, 'd2').contains(document.activeElement)).toBe(true),
    )
    expect(announcement().textContent).toContain('Moved ')
    expect(mocks.write).toHaveBeenCalledTimes(1)
    expect(
      mocks.write.mock.calls[0][0].data.days.find(
        (entry: { dayId: string }) => entry.dayId === 'd2',
      ).clearTime,
    ).toEqual([{ kind, id: kind === 'stop' ? 's1' : 'n1' }])
  },
)
it.each(['stop', 'note'] as const)(
  '%s rollback restores focus only while the moved control still owns it',
  async (kind) => {
    const pending = deferred()
    mocks.write.mockReturnValue(pending.promise)
    mount()
    await move(kind)
    await waitFor(() =>
      expect(row(kind, 'd2').contains(document.activeElement)).toBe(true),
    )
    await act(async () => pending.reject(new Error('Save failed')))
    await waitFor(() =>
      expect(row(kind, 'd1').contains(document.activeElement)).toBe(true),
    )
    expect(announcement().textContent).toBe('That move did not save')
    expect(mocks.error).toHaveBeenCalled()
  },
)
it.each(['stop', 'note'] as const)(
  '%s rollback does not steal focus after the reader moves elsewhere',
  async (kind) => {
    const pending = deferred()
    mocks.write.mockReturnValue(pending.promise)
    mount()
    await move(kind)
    await waitFor(() =>
      expect(row(kind, 'd2').contains(document.activeElement)).toBe(true),
    )
    const elsewhere = within(section('d3')).getByRole('button', {
      name: `Expand or collapse ${longTitle}`,
    })
    await userEvent.click(elsewhere)
    await act(async () => pending.reject(new Error('Save failed')))
    expect(document.activeElement).toBe(elsewhere)
    expect(row(kind, 'd1')).toBeTruthy()
  },
)

it('restores the source when rollback removes a different control of the moved stop', async () => {
  const pending = deferred()
  mocks.write.mockReturnValue(pending.promise)
  mount()
  await move('stop')
  await waitFor(() =>
    expect(row('stop', 'd2').contains(document.activeElement)).toBe(true),
  )
  await userEvent.click(
    within(row('stop', 'd2')).getByRole('button', {
      name: /Place p1, stop 1, day 2/,
    }),
  )
  await act(async () => pending.reject(new Error('Save failed')))
  await waitFor(() =>
    expect(row('stop', 'd1').contains(document.activeElement)).toBe(true),
  )
})

it.each(['stop', 'note'] as const)(
  '%s keeps the saved move and focus when refreshing the board fails',
  async (kind) => {
    mocks.write.mockResolvedValue(undefined)
    mocks.invalidate.mockRejectedValue(new Error('Refresh failed'))
    mount()
    await move(kind)
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(row(kind, 'd2').contains(document.activeElement)).toBe(true),
    )
    expect(announcement().textContent).toContain('Moved ')
    expect(announcement().textContent).not.toContain('did not save')
    expect(mocks.error).not.toHaveBeenCalled()
  },
)
