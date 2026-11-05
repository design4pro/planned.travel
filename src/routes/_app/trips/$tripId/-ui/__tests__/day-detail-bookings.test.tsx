import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { board, day } from './plan-board-fixtures'
import type { BookingRow } from '#/server/fns/reservations'

const read = vi.hoisted(() => vi.fn())
vi.mock('#/server/fns/reservations', () => ({ loadBookingDeskFn: read }))
const { useDayDetailBookings } = await import('../use-day-detail-bookings')
function deferred<T>() {
  let resolve!: (result: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const payload = board([day('d1', 1, []), day('d2', 2, [])])
const rows: ReadonlyArray<BookingRow> = [
  {
    id: 'r1',
    dayId: 'd1',
    type: 'activity',
    status: 'confirmed',
    title: 'Reservation',
    provider: null,
    location: null,
    confirmationNumber: null,
    url: null,
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    guests: null,
    priceMinor: null,
    currency: null,
    notes: null,
    assignmentId: null,
    hasLedgerLine: false,
    importedAt: null,
    transportId: null,
    stay: null,
  },
]
beforeEach(() => {
  read.mockReset()
})

it('reads lazily and reuses completed memory cache across minimising and reopening', async () => {
  read.mockResolvedValue({ found: true, bookings: rows })
  const h = renderHook(({ id }) => useDayDetailBookings(payload, id), {
    initialProps: { id: null as string | null },
  })
  expect(read).not.toHaveBeenCalled()
  h.rerender({ id: 'd1' })
  await waitFor(() => expect(h.result.current.loading).toBe(false))
  h.rerender({ id: null })
  h.rerender({ id: 'd2' })
  expect(h.result.current.rows).toEqual(rows)
  expect(read).toHaveBeenCalledTimes(1)
})

it.each(['close', 'replace', 'board'] as const)(
  'discards late results after %s',
  async (action) => {
    const old = deferred<{ found: true; bookings: ReadonlyArray<BookingRow> }>()
    read
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ found: true, bookings: [] })
    const h = renderHook(({ id, p }) => useDayDetailBookings(p, id), {
      initialProps: { id: 'd1' as string | null, p: payload },
    })
    h.rerender({
      id: action === 'close' ? null : 'd2',
      p: action === 'board' ? { ...payload } : payload,
    })
    await act(async () => old.resolve({ found: true, bookings: rows }))
    expect(h.result.current.rows).toEqual([])
    if (action === 'close') {
      h.rerender({ id: 'd1', p: payload })
      await waitFor(() => expect(h.result.current.loading).toBe(false))
      expect(read).toHaveBeenCalledTimes(2)
    }
  },
)

it('invalidates with the board, retains known content on network failure, and retries', async () => {
  read
    .mockResolvedValueOnce({ found: true, bookings: rows })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ found: true, bookings: [] })
  const h = renderHook(({ p }) => useDayDetailBookings(p, 'd1'), {
    initialProps: { p: payload },
  })
  await waitFor(() => expect(h.result.current.rows).toEqual(rows))
  h.rerender({ p: { ...payload } })
  await waitFor(() => expect(h.result.current.error).toBe(true))
  expect(h.result.current.rows).toEqual(rows)
  act(() => h.result.current.retry())
  await waitFor(() => expect(h.result.current.error).toBe(false))
  await waitFor(() => expect(h.result.current.loading).toBe(false))
  expect(h.result.current.rows).toEqual([])
})

it('clears prior content when the reader refuses access', async () => {
  read
    .mockResolvedValueOnce({ found: true, bookings: rows })
    .mockResolvedValue({ found: false })
  const h = renderHook(({ p }) => useDayDetailBookings(p, 'd1'), {
    initialProps: { p: payload },
  })
  await waitFor(() => expect(h.result.current.rows).toEqual(rows))
  h.rerender({ p: { ...payload } })
  await waitFor(() => expect(h.result.current.error).toBe(true))
  expect(h.result.current.rows).toEqual([])
})

it('a remount for another reader never receives the old pending response', async () => {
  const old = deferred<{ found: true; bookings: ReadonlyArray<BookingRow> }>()
  read
    .mockReturnValueOnce(old.promise)
    .mockResolvedValue({ found: true, bookings: [] })
  function Probe() {
    const result = useDayDetailBookings(payload, 'd1')
    return <output>{result.rows.map((row) => row.id).join(',')}</output>
  }
  const h = render(<Probe key="workspace1-user1-editor" />)
  h.rerender(<Probe key="workspace2-user2-viewer" />)
  await act(async () => old.resolve({ found: true, bookings: rows }))
  expect(screen.getByRole('status').textContent).toBe('')
})

it('cuts off completed data on a permission change before effects and does not retain it after an error', async () => {
  read
    .mockResolvedValueOnce({ found: true, bookings: rows })
    .mockRejectedValue(new Error('offline'))
  const viewerRenders: Array<ReadonlyArray<BookingRow>> = []
  const h = renderHook(
    ({ scope }) => {
      const result = useDayDetailBookings(payload, 'd1', scope)
      if (scope === 'viewer') viewerRenders.push(result.rows)
      return result
    },
    { initialProps: { scope: 'editor' } },
  )
  await waitFor(() => expect(h.result.current.rows).toEqual(rows))
  const staleRetry = h.result.current.retry
  h.rerender({ scope: 'viewer' })
  expect(viewerRenders.every((rendered) => rendered.length === 0)).toBe(true)
  await waitFor(() => expect(h.result.current.error).toBe(true))
  expect(h.result.current.rows).toEqual([])
  act(() => staleRetry())
  expect(read).toHaveBeenCalledTimes(2)
})

it('clears a closed cache across permission changes and cannot resurrect the former scope', async () => {
  read
    .mockResolvedValueOnce({ found: true, bookings: rows })
    .mockResolvedValue({ found: true, bookings: [] })
  const h = renderHook(
    ({ id, scope }) => useDayDetailBookings(payload, id, scope),
    { initialProps: { id: 'd1' as string | null, scope: 'editor' } },
  )
  await waitFor(() => expect(h.result.current.rows).toEqual(rows))
  h.rerender({ id: null, scope: 'viewer' })
  expect(h.result.current.rows).toEqual([])
  h.rerender({ id: null, scope: 'editor' })
  expect(read).toHaveBeenCalledTimes(1)
  h.rerender({ id: 'd1', scope: 'editor' })
  await waitFor(() => expect(h.result.current.loading).toBe(false))
  expect(read).toHaveBeenCalledTimes(2)
  expect(h.result.current.rows).toEqual([])
})

it('rejects a deferred response after editor to viewer to editor without remounting', async () => {
  const old = deferred<{ found: true; bookings: ReadonlyArray<BookingRow> }>()
  read
    .mockReturnValueOnce(old.promise)
    .mockResolvedValue({ found: true, bookings: [] })
  const h = renderHook(
    ({ scope }) => useDayDetailBookings(payload, 'd1', scope),
    { initialProps: { scope: 'editor' } },
  )
  h.rerender({ scope: 'viewer' })
  h.rerender({ scope: 'editor' })
  await waitFor(() => expect(h.result.current.loading).toBe(false))
  await act(async () => old.resolve({ found: true, bookings: rows }))
  expect(h.result.current.rows).toEqual([])
  expect(read).toHaveBeenCalledTimes(3)
})
