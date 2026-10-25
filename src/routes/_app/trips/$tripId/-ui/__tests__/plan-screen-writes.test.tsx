import '#/components/ui/__tests__/test-env'
import * as React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import type * as RouterModule from '@tanstack/react-router'
import type * as MapModule from '#/components/map'
import type * as PlannerModule from '#/components/planner'
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
  success: vi.fn(),
  error: vi.fn(),
  click: null as
    null | ((event: { lngLat: { lng: number; lat: number } }) => void),
}))
vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof RouterModule>()),
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))
vi.mock('#/components/modules/book', () => ({ BookingDialog: () => null }))
vi.mock('../../-server/plan', () => ({
  createPlanPlaceFn: mocks.write,
  updatePlanPlaceFn: mocks.write,
  updateStopFn: mocks.write,
  deletePlanPlaceFn: mocks.write,
  unschedulePlaceFn: mocks.write,
}))
vi.mock('../../-server/day-notes', () => ({
  createDayNoteFn: mocks.write,
  updateDayNoteFn: mocks.write,
  deleteDayNoteFn: mocks.write,
}))
vi.mock('../../-server/plan-transports', () => ({}))
vi.mock('../use-trip-weather', () => ({
  useTripWeather: () => ({ viewOf: () => null, unit: 'celsius' }),
}))
vi.mock('../planner-map-layer', () => ({
  PlannerMapLayer: () => null,
  usePlannerDrop: () => ({ ready: false, editable: false }),
}))
vi.mock('#/components/planner', async (original) => {
  const actual = await original<typeof PlannerModule>()
  return {
    ...actual,
    DaySection: (props: React.ComponentProps<typeof actual.DaySection>) => (
      <section>
        <output data-testid="selection">{props.selectedPlaceId}</output>
        {props.day.rows.map((row) => (
          <div key={row.itemId}>
            <button onClick={() => props.onSelectRow?.(row)}>
              Select {row.name}
            </button>
            {props.rowActions?.(row)}
          </div>
        ))}
        <button onClick={props.onAddNote}>Add note</button>
        {props.dayTools?.(props.day)}
        {props.day.items.flatMap((item) =>
          item.kind === 'note'
            ? [
                <button
                  key={item.note.id}
                  onClick={() => props.onDeleteNote?.(item.note)}
                >
                  Delete note
                </button>,
              ]
            : [],
        )}
      </section>
    ),
  }
})
vi.mock('#/components/map', async (original) => {
  const actual = await original<typeof MapModule>()
  const canvas = document.createElement('canvas')
  const map = {
    on: (_: string, handler: typeof mocks.click) => {
      mocks.click = handler
    },
    off: () => {},
    getCanvas: () => canvas,
    easeTo: () => {},
    getZoom: () => 10,
  }
  return {
    ...actual,
    useMapInstance: () => map,
    MapCanvas: ({ children }: { children: React.ReactNode }) => (
      <>
        {React.Children.toArray(children).filter(
          (child) =>
            React.isValidElement(child) &&
            typeof child.type === 'function' &&
            child.type.name === 'MapBehaviour',
        )}
      </>
    ),
  }
})
const { PlanScreen } = await import('../plan-screen')
const messages = await loadCatalogue('en')
const polishMessages = await loadCatalogue('pl')
const payload = board([
  day('d1', 1, [stop('s1', 'p1', 0), stop('s2', 'p2', 1)]),
])

async function mount(boardPayload = payload, locale: 'en' | 'pl' = 'en') {
  return render(
    <I18nProvider
      locale={locale}
      messages={locale === 'pl' ? polishMessages : messages}
    >
      <PlanScreen
        payload={boardPayload}
        notes={notes([note('n1', 'd1', 2)])}
        transports={transports()}
        tripTitle="Trip"
      />
    </I18nProvider>,
  )
}
function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
async function menu(action: string, place = 'p1', actionsFor = 'Actions for') {
  await userEvent.click(
    screen.getAllByRole('button', { name: `${actionsFor} Place ${place}` })[0],
  )
  await userEvent.click(screen.getByRole('menuitem', { name: action }))
}
function submit() {
  const form = screen.getByRole('dialog').querySelector('form')
  if (form === null) throw new Error('Missing form')
  fireEvent.submit(form)
}
function submitButton() {
  const button = screen
    .getByRole('dialog')
    .querySelector<HTMLButtonElement>('button[type="submit"]')
  if (button === null) throw new Error('Missing submit button')
  return button
}
async function close() {
  await userEvent.keyboard('{Escape}')
}

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('>='),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  mocks.write.mockReset()
  mocks.error.mockClear()
  mocks.success.mockClear()
  mocks.invalidate.mockReset()
})

describe('planner write callers', () => {
  it('toasts a late place-save failure in Polish', async () => {
    const pending = deferred()
    mocks.write.mockReturnValue(pending.promise)
    await mount(payload, 'pl')
    await menu('Edytuj miejsce', 'p1', 'Działania dla:')
    submit()
    await close()
    await act(async () => pending.reject(new Error('Refused write')))
    expect(mocks.error).toHaveBeenCalledWith(
      'Nie udało się zapisać miejsca. Spróbuj ponownie za chwilę.',
    )
  })

  it('toasts a pinned place name in Polish', async () => {
    mocks.write.mockResolvedValue(undefined)
    await mount(payload, 'pl')
    await menu('Przesuń pinezkę', 'p1', 'Działania dla:')
    await act(async () => mocks.click?.({ lngLat: { lng: 10, lat: 20 } }))
    expect(mocks.success).toHaveBeenCalledWith('Przypięto Place p1')
  })

  it.each(
    (['place', 'timing', 'delete', 'note', 'note-delete'] as const).flatMap(
      (caller) =>
        (caller === 'delete' ? [false] : [false, true]).map((replaced) => ({
          caller,
          replaced,
        })),
    ),
  )(
    'routes successful $caller writes (replaced=$replaced)',
    async ({ caller, replaced }) => {
      const pending = deferred()
      mocks.write.mockReturnValue(pending.promise)
      await mount()
      if (caller === 'place') {
        await menu('Edit place')
        submit()
      }
      if (caller === 'timing') {
        await menu('Set a time')
        submit()
      }
      if (caller === 'delete') {
        await menu('Delete from trip')
        await userEvent.click(
          within(screen.getByRole('dialog')).getByRole('button', {
            name: 'Delete place',
          }),
        )
      }
      if (caller === 'note') {
        await userEvent.click(screen.getByRole('button', { name: 'Add note' }))
        await userEvent.type(
          screen.getByRole('textbox', { name: /^Note/ }),
          'Remember',
        )
        expect(
          (screen.getByRole('textbox', { name: /^Note/ }) as HTMLInputElement)
            .value,
        ).toBe('Remember')
        submit()
      }
      if (caller === 'note-delete') {
        await userEvent.click(
          screen.getByRole('button', { name: 'Delete note' }),
        )
        await userEvent.click(
          within(screen.getByRole('dialog')).getByRole('button', {
            name: 'Delete note',
          }),
        )
      }
      expect(mocks.write).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('dialog')).toBeTruthy()
      if (replaced) {
        await close()
        await menu('Set a time', 'p2')
      }
      const currentDialog = screen.getByRole('dialog')
      await act(async () => pending.resolve())
      if (replaced) expect(screen.getByRole('dialog')).toBe(currentDialog)
      else expect(screen.queryByRole('dialog')).toBeNull()
      expect(mocks.invalidate).toHaveBeenCalledTimes(1)
      expect(mocks.success).toHaveBeenCalledTimes(1)
    },
  )

  it.each(['open', 'closed', 'replaced'] as const)(
    'routes a failure when the owner is %s',
    async (owner) => {
      const pending = deferred()
      mocks.write.mockReturnValue(pending.promise)
      await mount()
      await menu('Edit place')
      submit()
      if (owner !== 'open') await close()
      if (owner === 'replaced') await menu('Set a time', 'p2')
      await act(async () => pending.reject(new Error('Refused write')))
      if (owner === 'open') {
        expect(screen.getByRole('alert').textContent).toContain(
          'The place could not be saved. Try it again in a moment.',
        )
        expect(mocks.error).not.toHaveBeenCalled()
      } else {
        expect(screen.queryByRole('alert')).toBeNull()
        expect(mocks.error).toHaveBeenCalledWith(
          'The place could not be saved. Try it again in a moment.',
        )
      }
    },
  )

  it('keeps the newer create busy when an older write settles', async () => {
    const first = deferred()
    const second = deferred()
    mocks.write
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    await mount()
    await menu('Edit place')
    submit()
    await close()
    // The day footer opens the existing create form with this day preselected.
    await userEvent.click(
      screen.getByRole('button', { name: /Add a place to/ }),
    )
    expect(submitButton().getAttribute('aria-busy')).not.toBe('true')
    await userEvent.type(screen.getByLabelText(/^Name/), 'New place')
    submit()
    expect(mocks.write).toHaveBeenCalledTimes(2)
    await act(async () => first.resolve())
    expect(submitButton().getAttribute('aria-busy')).toBe('true')
    submit()
    expect(mocks.write).toHaveBeenCalledTimes(2)
    await act(async () => second.resolve())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(['place', 'timing'] as const)(
    'keeps the %s draft on failure and seeds another row fresh',
    async (kind) => {
      const pending = deferred()
      mocks.write.mockReturnValue(pending.promise)
      const view = await mount()
      await menu(kind === 'place' ? 'Edit place' : 'Set a time')
      const input =
        kind === 'place'
          ? screen.getByLabelText(/^Name/)
          : screen.getByRole('textbox')
      await userEvent.clear(input)
      await userEvent.type(input, 'My draft')
      submit()
      expect((input as HTMLInputElement).value).toBe('My draft')
      await act(async () => pending.reject(new Error('Refused write')))
      expect((input as HTMLInputElement).value).toBe('My draft')
      view.rerender(
        <I18nProvider locale="en" messages={messages}>
          <PlanScreen
            payload={{
              ...payload,
              places: payload.places.map((place) => ({ ...place })),
            }}
            notes={notes([note('n1', 'd1', 2)])}
            transports={transports()}
            tripTitle="Refreshed trip"
          />
        </I18nProvider>,
      )
      expect((input as HTMLInputElement).value).toBe('My draft')
      await close()
      await menu(kind === 'place' ? 'Edit place' : 'Set a time', 'p2')
      const next =
        kind === 'place'
          ? screen.getByLabelText(/^Name/)
          : screen.getByRole('textbox')
      expect((next as HTMLInputElement).value).toBe(
        kind === 'place' ? 'Place p2' : '',
      )
    },
  )

  it('keeps a delete modal until it lands, then closes it and forgets the selected place', async () => {
    const pending = deferred()
    mocks.write.mockReturnValue(pending.promise)
    await mount()
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Place p1' }),
    )
    expect(screen.getByTestId('selection').textContent).toBe('p1')
    await menu('Delete from trip')
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete place',
      }),
    )
    await close()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Actions for Place p2' }),
    ).toBeNull()
    await act(async () => pending.resolve())
    expect(screen.getByTestId('selection').textContent).toBe('')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the place and its error in the delete dialog after a refusal', async () => {
    const pending = deferred()
    mocks.write.mockReturnValue(pending.promise)
    await mount()
    await menu('Delete from trip')
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete place',
      }),
    )
    await act(async () => pending.reject(new Error('Refused delete')))
    expect(screen.getByRole('alert').textContent).toContain(
      'The place could not be deleted. Try it again in a moment.',
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
    await close()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      screen.getAllByRole('button', { name: 'Actions for Place p1' }).length,
    ).toBeGreaterThan(0)
  })

  it('selects a landed pin without opening or closing a dialog', async () => {
    const pending = deferred()
    mocks.write.mockReturnValue(pending.promise)
    await mount()
    await menu('Move its pin')
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => mocks.click?.({ lngLat: { lng: 10, lat: 20 } }))
    expect(mocks.write).toHaveBeenCalledTimes(1)
    await menu('Set a time', 'p2')
    await act(async () => pending.resolve())
    expect(screen.getByTestId('selection').textContent).toBe('p1')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

/** What a server function's refusal looks like once the redaction middleware has wrapped it. */
function failedWith(kind: 'refusal' | 'validation' | 'unexpected'): Error {
  return new Error(
    encodePublicFailure(
      kind === 'unexpected'
        ? { kind, reference: 'ref-1' }
        : { kind, message: 'You can no longer edit this trip.' },
    ),
  )
}

/** Whether a stop's menu still offers a write, read after the dialogs that hide it are gone. */
async function offersEdit(): Promise<boolean> {
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Actions for Place p2' })[0],
  )
  const offered =
    screen.queryByRole('menuitem', { name: 'Edit place' }) !== null
  await userEvent.keyboard('{Escape}')
  return offered
}

/** The same screen as {@link mount}, as the loader hands it over once the reader is a viewer. */
function demoted(view: Awaited<ReturnType<typeof mount>>) {
  view.rerender(
    <I18nProvider locale="en" messages={messages}>
      <PlanScreen
        payload={{ ...payload, editable: false }}
        notes={notes([note('n1', 'd1', 2)], false)}
        transports={transports()}
        tripTitle="Trip"
      />
    </I18nProvider>,
  )
}

describe('a write the server refused', () => {
  it('closes the form the re-read outlived, toasts the refusal and hands focus to the itinerary', async () => {
    mocks.write.mockRejectedValue(failedWith('refusal'))
    const view = await mount()
    mocks.invalidate.mockImplementation(async () => demoted(view))
    await menu('Edit place')
    submit()
    await act(async () => {})

    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
    // The form cannot write with a permission it no longer has: it is gone, and says why.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.write).toHaveBeenCalledTimes(1)
    expect(mocks.error).toHaveBeenCalledWith(
      'You can no longer edit this trip.',
    )
    // The control that held focus is gone with the write controls.
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement?.textContent).toContain('Select Place p1')
    expect(await offersEdit()).toBe(false)
  })

  it('closes a refused day-note form the same way', async () => {
    mocks.write.mockRejectedValue(failedWith('refusal'))
    const view = await mount()
    mocks.invalidate.mockImplementation(async () => demoted(view))
    await userEvent.click(screen.getByRole('button', { name: 'Delete note' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete note',
      }),
    )
    await act(async () => {})

    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.error).toHaveBeenCalledWith(
      'You can no longer edit this trip.',
    )
  })

  it('toasts a refused late write and still re-reads', async () => {
    const pending = deferred()
    mocks.write.mockReturnValue(pending.promise)
    await mount()
    await menu('Edit place')
    submit()
    await close()
    await act(async () => pending.reject(failedWith('refusal')))
    expect(mocks.error).toHaveBeenCalledWith(
      'You can no longer edit this trip.',
    )
    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
  })

  it('rolls a refused move back, says so, and then re-reads', async () => {
    mocks.write.mockRejectedValue(failedWith('refusal'))
    const view = await mount()
    mocks.invalidate.mockImplementation(async () => demoted(view))
    await menu('Back to unplanned')
    await act(async () => {})

    expect(mocks.error).toHaveBeenCalledWith(
      'That move did not save',
      expect.objectContaining({
        description: 'You can no longer edit this trip.',
      }),
    )
    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
    expect(mocks.error.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.invalidate.mock.invocationCallOrder[0],
    )
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1')
    expect(await offersEdit()).toBe(false)
  })

  it('puts a refused move back when the re-read changes nothing', async () => {
    mocks.write.mockRejectedValue(failedWith('refusal'))
    await mount()
    await menu('Back to unplanned')
    await act(async () => {})

    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
    // Still a scheduled stop: the optimistic order was rolled back, not left to the payload.
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Actions for Place p1' })[0],
    )
    expect(
      screen.queryByRole('menuitem', { name: 'Back to unplanned' }),
    ).not.toBeNull()
  })

  it.each(['validation', 'unexpected'] as const)(
    'does not re-read after a %s failure of a write or a move',
    async (kind) => {
      mocks.write.mockRejectedValue(failedWith(kind))
      await mount()
      await menu('Back to unplanned')
      await act(async () => {})
      await menu('Edit place', 'p2')
      submit()
      await act(async () => {})

      expect(mocks.write).toHaveBeenCalledTimes(2)
      expect(mocks.invalidate).not.toHaveBeenCalled()
    },
  )

  it('shows the refusal even when the re-read itself fails', async () => {
    mocks.write.mockRejectedValue(failedWith('refusal'))
    mocks.invalidate.mockRejectedValue(new Error('offline'))
    await mount()
    await menu('Edit place')
    submit()
    await act(async () => {})

    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert').textContent).toContain(
      'You can no longer edit this trip.',
    )
  })
})
