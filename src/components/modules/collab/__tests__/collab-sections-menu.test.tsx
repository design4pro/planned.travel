import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import Modules from '#/lib/i18n/messages/en/modules'
import PolishTrips from '#/lib/i18n/messages/pl/trips'
import PolishModules from '#/lib/i18n/messages/pl/modules'
import { encodePublicFailure } from '#/lib/errors'
import { toast } from '#/components/ui'
import { CollabSectionsMenu } from '../collab-sections-menu'

const routerEvents = vi.hoisted(() => ({
  rendered: null as (() => void) | null,
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    subscribe: (_event: string, callback: () => void) => {
      routerEvents.rendered = callback
      return () => {
        routerEvents.rendered = null
      }
    },
  }),
}))

const messages = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('modules', Modules),
}
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'elementFromPoint')
})
function deferred() {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function setup(
  write = vi.fn().mockResolvedValue({ ok: true }),
  refresh = vi.fn().mockResolvedValue(undefined),
) {
  const sections = { conversation: true, notes: false, polls: false }
  const props = { sections, write, refresh, onWritingChange: vi.fn() }
  const view = render(
    <I18nProvider locale="en" messages={messages}>
      <CollabSectionsMenu {...props} />
    </I18nProvider>,
  )
  return { ...view, props, user: userEvent.setup() }
}
it('keeps the last enabled item keyboard reachable and explains it', async () => {
  const { user, props } = setup()
  await user.click(screen.getByRole('button', { name: /Choose sections/ }))
  const items = screen.getAllByRole('menuitemcheckbox')
  expect(items).toHaveLength(3)
  expect(items[0].getAttribute('aria-checked')).toBe('true')
  expect(items[0].getAttribute('aria-disabled')).toBe('true')
  expect(
    document.getElementById(items[0].getAttribute('aria-describedby') ?? '')
      ?.textContent,
  ).toBe('At least one section stays on.')
  await user.keyboard('{End}{ArrowDown}')
  expect(document.activeElement).toBe(items[0])
  await user.keyboard('{Enter}')
  expect(props.write).not.toHaveBeenCalled()
})
it('holds every item pending through the loader refresh without guessing the checked state', async () => {
  const writeDone = deferred()
  const refreshDone = deferred()
  const write = vi.fn(async () => {
    await writeDone.promise
    return { ok: true }
  })
  const refresh = vi.fn(() => refreshDone.promise)
  const { user, props, rerender } = setup(write, refresh)
  await user.click(screen.getByRole('button', { name: /Choose sections/ }))
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Notes' }))
  for (const item of screen.getAllByRole('menuitemcheckbox'))
    expect(item.getAttribute('aria-disabled')).toBe('true')
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Notes' })
      .getAttribute('aria-checked'),
  ).toBe('false')
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Notes' })
      .querySelector('svg.animate-spin'),
  ).toBeTruthy()
  writeDone.resolve()
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Polls' })
      .getAttribute('aria-disabled'),
  ).toBe('true')
  rerender(
    <I18nProvider locale="en" messages={messages}>
      <CollabSectionsMenu
        {...props}
        sections={{ ...props.sections, notes: true }}
      />
    </I18nProvider>,
  )
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Notes' })
      .getAttribute('aria-checked'),
  ).toBe('true')
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Notes' })
      .getAttribute('aria-disabled'),
  ).toBe('true')
  refreshDone.resolve()
  await waitFor(() =>
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Polls' })
        .getAttribute('aria-disabled'),
    ).toBe('false'),
  )
})
it.each(['data', 'throw'])(
  'shows a localised failure and rereads after a %s refusal',
  async (kind) => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const write = vi.fn(async () => {
      if (kind === 'throw') throw {}
      return { ok: false }
    })
    const { user, props } = setup(write)
    await user.click(screen.getByRole('button', { name: /Choose sections/ }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Notes' }))
    await waitFor(() => expect(props.refresh).toHaveBeenCalledOnce())
    expect(error).toHaveBeenCalledWith('That change did not save', {
      description: 'The menu shows what is saved now.',
    })
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Notes' })
        .getAttribute('aria-checked'),
    ).toBe('false')
  },
)

it.each(['transport', 'refusal'] as const)(
  'localizes an unknown %s failure while preserving authored refusals',
  async (kind) => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const write = vi.fn(async () => {
      if (kind === 'transport') throw new TypeError('Failed to fetch')
      throw new Error(
        encodePublicFailure({ kind: 'refusal', message: 'Authored refusal' }),
      )
    })
    const refresh = vi.fn().mockResolvedValue(undefined)
    render(
      <I18nProvider
        locale="pl"
        messages={{
          ...namespaceCatalogue('trips', PolishTrips),
          ...namespaceCatalogue('modules', PolishModules),
        }}
      >
        <CollabSectionsMenu
          sections={{ conversation: true, notes: false, polls: false }}
          write={write}
          refresh={refresh}
          onWritingChange={vi.fn()}
        />
      </I18nProvider>,
    )
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', {
        name: PolishTrips['collab.sections.trigger'],
      }),
    )
    await user.click(
      screen.getByRole('menuitemcheckbox', {
        name: PolishModules['field.notes'],
      }),
    )
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(error).toHaveBeenCalledWith(PolishTrips['collab.sections.failed'], {
      description:
        kind === 'transport'
          ? PolishTrips['collab.sections.failedBody']
          : 'Authored refusal',
    })
  },
)

it.each(['top', 'bottom', 'none'] as const)(
  'returns Escape focus and reveals it only when obscured (%s)',
  async (obstruction) => {
    const { user } = setup()
    const trigger = screen.getByRole('button', { name: /Choose sections/ })
    const reveal = vi.spyOn(trigger, 'scrollIntoView')
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 37,
      y: 0,
      top: 0,
      bottom: 44,
      left: 37,
      right: 216,
      width: 179,
      height: 44,
      toJSON: () => ({}),
    })
    const blocker = document.createElement('header')
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn((_x: number, y: number) => {
        const blocked =
          (obstruction === 'top' && y < 22) ||
          (obstruction === 'bottom' && y > 22)
        return blocked ? blocker : trigger
      }),
    })
    await user.click(trigger)
    reveal.mockClear()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    if (obstruction !== 'none')
      expect(reveal).toHaveBeenCalledWith({
        block: 'center',
        behavior: 'instant',
      })
    else expect(reveal).not.toHaveBeenCalled()
  },
)

it('does not scroll or take focus back when it changes before the close frame', async () => {
  const { user } = setup()
  const trigger = screen.getByRole('button', { name: /Choose sections/ })
  await user.click(trigger)
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }),
  )
  const reveal = vi.spyOn(trigger, 'scrollIntoView')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  const other = document.createElement('button')
  document.body.appendChild(other)
  try {
    other.focus()
    act(() => frames.forEach((callback) => callback(performance.now())))
    expect(document.activeElement).toBe(other)
    expect(reveal).not.toHaveBeenCalled()
  } finally {
    other.remove()
  }
})

it('restores Escape focus without starting browser smooth scrolling on each opening', async () => {
  const { user } = setup()
  const trigger = screen.getByRole('button', { name: /Choose sections/ })
  const focus = vi.spyOn(trigger, 'focus')
  for (let cycle = 0; cycle < 2; cycle++) {
    await user.click(trigger)
    focus.mockClear()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(
      focus.mock.calls.every(([options]) => options?.preventScroll === true),
    ).toBe(true)
  }
})

it('does not retain Escape focus ownership for a later outside dismissal', async () => {
  const { user } = setup()
  const trigger = screen.getByRole('button', { name: /Choose sections/ })
  await user.click(trigger)
  await user.keyboard('{Escape}')
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  await user.click(trigger)
  const focus = vi.spyOn(trigger, 'focus')
  await new Promise((resolve) => setTimeout(resolve, 0))
  fireEvent.pointerDown(document.body, { button: 2, pointerType: 'mouse' })
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  expect(focus).not.toHaveBeenCalledWith({ preventScroll: true })
})

it('reveals returned focus after a later router scroll restoration', async () => {
  const { user } = setup()
  const trigger = screen.getByRole('button', { name: /Choose sections/ })
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
    x: 37,
    y: 0,
    top: 0,
    bottom: 44,
    left: 37,
    right: 216,
    width: 179,
    height: 44,
    toJSON: () => ({}),
  })
  const reveal = vi.spyOn(trigger, 'scrollIntoView')
  let obscured = false
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => (obscured ? document.body : trigger),
  })
  await user.click(trigger)
  await user.keyboard('{Escape}')
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  reveal.mockClear()
  obscured = true
  act(() => routerEvents.rendered?.())
  await new Promise((resolve) => requestAnimationFrame(resolve))
  expect(reveal).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' })
})
