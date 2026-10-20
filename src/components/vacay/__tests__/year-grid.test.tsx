import '#/components/ui/__tests__/test-env'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import En from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import Ar from '#/lib/i18n/messages/ar/modules'
import ArUi from '#/lib/i18n/messages/ar/ui'
import { YearGrid } from '../year-grid'
import type { GridSnapshot, YearGridProps } from '../year-grid'

const initial: GridSnapshot = {
  entries: [],
  remainingDays: 25,
  blockWeekends: false,
  companyHolidaysEnabled: true,
  companyHolidays: [],
}
function mount(overrides: Partial<YearGridProps> = {}, rtl = false) {
  const props = {
    year: 2026,
    today: '2026-08-03',
    initial,
    ink: '#fff',
    others: new Map(),
    write: vi.fn().mockResolvedValue({ ok: true }),
    reread: vi.fn().mockResolvedValue(initial),
    refresh: vi.fn(),
    ...overrides,
  }
  render(
    <I18nProvider
      locale={rtl ? 'ar' : 'en'}
      messages={{
        ...namespaceCatalogue('modules', rtl ? Ar : En),
        ...namespaceCatalogue('ui', rtl ? ArUi : Ui),
      }}
    >
      <YearGrid {...props} />
    </I18nProvider>,
  )
  return props
}
afterEach(cleanup)
const byDay = (month: number, number: number) =>
  document
    .querySelectorAll('table[role="grid"]')
    [month].querySelectorAll<HTMLButtonElement>('button')[number - 1]!

describe('year grid', () => {
  it.each([
    [0, 'Sunday', 4, 2, 8],
    [1, 'Monday', 3, 3, 9],
    [6, 'Saturday', 5, 1, 7],
  ])(
    'renders the week starting %i with real weekday shading and focus',
    (weekStartsOn, first, column, home, end) => {
      mount({ weekStartsOn })
      const january = document.querySelector('table[role="grid"]')!
      expect(january.querySelector('th')?.getAttribute('abbr')).toBe(first)
      expect(
        Array.from(byDay(0, 1).closest('tr')!.children).indexOf(
          byDay(0, 1).closest('td')!,
        ),
      ).toBe(column)
      for (const day of [1, 2, 3, 4, 5, 6, 7]) {
        expect(byDay(7, day).classList.contains('bg-surface-inset')).toBe(
          [1, 2].includes(day),
        )
      }
      byDay(7, 5).focus()
      fireEvent.keyDown(document.activeElement!, { key: 'Home' })
      expect(document.activeElement).toBe(byDay(7, home))
      byDay(7, 5).focus()
      fireEvent.keyDown(document.activeElement!, { key: 'End' })
      expect(document.activeElement).toBe(byDay(7, end))
    },
  )
  it('has one stop and moves real focus across months, weeks and year limits', () => {
    mount()
    expect(
      document.querySelectorAll('table button[tabindex="0"]'),
    ).toHaveLength(1)
    const jan31 = byDay(0, 31)
    jan31.focus()
    fireEvent.keyDown(jan31, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(byDay(1, 1))
    fireEvent.keyDown(document.activeElement!, { key: 'PageDown' })
    expect(document.activeElement).toBe(byDay(2, 1))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(byDay(2, 8))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(byDay(2, 1))
    fireEvent.keyDown(document.activeElement!, { key: 'PageUp' })
    expect(document.activeElement).toBe(byDay(1, 1))
    fireEvent.keyDown(document.activeElement!, { key: 'PageDown' })
    expect(document.activeElement).toBe(byDay(2, 1))
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(document.activeElement).toBe(byDay(1, 23))
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(byDay(2, 1))
    byDay(0, 1).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(byDay(0, 1))
    byDay(11, 31).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(byDay(11, 31))
  })
  it('reverses horizontal keys in RTL', () => {
    mount({}, true)
    byDay(0, 31).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(byDay(1, 1))
  })
  it('keeps a blocked day focusable and explains activation visibly and politely', async () => {
    mount({ initial: { ...initial, blockWeekends: true } })
    const cell = byDay(7, 1)
    expect(cell.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(cell)
    expect(screen.getByRole('status').textContent).toContain(
      'weekends are blocked',
    )
    expect(cell.getAttribute('aria-describedby')).toBe('vacay-day-status')
    expect(cell.disabled).toBe(false)
  })
  it('offers only clear on an existing blocked entry and restores focus', async () => {
    const hand = userEvent.setup({ delay: null })
    const props = mount({
      initial: {
        ...initial,
        blockWeekends: true,
        entries: [{ date: '2026-08-01', kind: 'vacation' }],
      },
    })
    const cell = byDay(7, 1)
    await hand.click(cell)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', {
        name: /Sick day/,
      }),
    ).toBeNull()
    await hand.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Clear this day',
      }),
    )
    await waitFor(() =>
      expect(props.write).toHaveBeenCalledWith('2026-08-01', null),
    )
    expect(document.activeElement).toBe(cell)
  })
  it('ignores a second activation while a day is in flight', async () => {
    let finish: ((value: { ok: boolean }) => void) | undefined
    const props = mount({
      write: vi.fn(
        () =>
          new Promise<{ ok: boolean }>((resolve) => {
            finish = resolve
          }),
      ),
    })
    fireEvent.click(byDay(7, 3))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^Leave\s*Uses/,
      }),
    )
    fireEvent.click(byDay(7, 3))
    expect(props.write).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    finish?.({ ok: true })
    await waitFor(() =>
      expect(byDay(7, 3).getAttribute('aria-busy')).toBeNull(),
    )
  })
  it('reconciles a lost response as success and does not offer retry', async () => {
    mount({
      write: vi.fn().mockRejectedValue(new TypeError('Network')),
      reread: vi.fn().mockResolvedValue({
        ...initial,
        remainingDays: 24,
        entries: [{ date: '2026-08-03', kind: 'vacation' }],
      }),
    })
    fireEvent.click(byDay(7, 3))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^Leave\s*Uses/,
      }),
    )
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('24 days left'),
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(byDay(7, 3).getAttribute('aria-label')).toContain('Leave')
  })
  it('reverts and offers one retry for transport failure after a current read', async () => {
    mount({ write: vi.fn().mockRejectedValue(new TypeError('Network')) })
    const cell = byDay(7, 3)
    fireEvent.click(cell)
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^Leave\s*Uses/,
      }),
    )
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('3 Aug 2026'),
    )
    expect(
      within(screen.getByRole('alert')).getByRole('button', {
        name: 'Try again',
      }),
    ).toBeTruthy()
    expect(cell.getAttribute('aria-label')).not.toContain('Leave')
    expect(document.activeElement).toBe(cell)
  })
  it('uses theme-aware ink for marked days without a stored colour', () => {
    mount({
      initial: {
        ...initial,
        entries: [{ date: '2026-08-03', kind: 'vacation' }],
      },
    })
    expect(byDay(7, 3).style.color).toBe('var(--color-brand-on)')
  })
  it.each([true, false])(
    'reconciles before recovery when both requests failed (committed=%s)',
    async (committed) => {
      const write = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Offline'))
        .mockResolvedValue({ ok: true })
      const saved = {
        ...initial,
        remainingDays: 24,
        entries: [{ date: '2026-08-03', kind: 'vacation' }],
      }
      const reread = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Offline'))
        .mockResolvedValueOnce(committed ? saved : initial)
        .mockResolvedValue(saved)
      mount({ write, reread })
      fireEvent.click(byDay(7, 3))
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: /^Leave\s*Uses/,
        }),
      )
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
      fireEvent.click(
        within(screen.getByRole('alert')).getByRole('button', {
          name: 'Try again',
        }),
      )
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
      expect(write).toHaveBeenCalledTimes(committed ? 1 : 2)
      expect(reread).toHaveBeenCalledTimes(committed ? 2 : 3)
      expect(byDay(7, 3).getAttribute('aria-label')).toContain('Leave')
    },
  )
  it('keeps both optimistic fills when the second day settles before the first', async () => {
    const completions = new Map<string, (value: { ok: boolean }) => void>()
    const reread = vi
      .fn()
      .mockResolvedValueOnce({
        ...initial,
        entries: [{ date: '2026-08-04', kind: 'sick' }],
      })
      .mockResolvedValueOnce({
        ...initial,
        entries: [
          { date: '2026-08-03', kind: 'vacation' },
          { date: '2026-08-04', kind: 'sick' },
        ],
      })
    mount({
      write: (date) =>
        new Promise<{ ok: boolean }>((resolve) =>
          completions.set(date, resolve),
        ),
      reread,
    })
    fireEvent.click(byDay(7, 3))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^Leave\s*Uses/,
      }),
    )
    fireEvent.click(byDay(7, 4))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^Sick day/,
      }),
    )
    completions.get('2026-08-04')?.({ ok: true })
    await waitFor(() =>
      expect(byDay(7, 4).getAttribute('aria-busy')).toBeNull(),
    )
    expect(byDay(7, 3).getAttribute('aria-label')).toContain('Leave')
    expect(byDay(7, 3).getAttribute('aria-busy')).toBe('true')
    expect(byDay(7, 4).getAttribute('aria-label')).toContain('Sick day')
    completions.get('2026-08-03')?.({ ok: true })
    await waitFor(() =>
      expect(byDay(7, 3).getAttribute('aria-busy')).toBeNull(),
    )
    expect(byDay(7, 4).getAttribute('aria-label')).toContain('Sick day')
  })
})
