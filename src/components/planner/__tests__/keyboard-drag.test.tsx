// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render as mount, screen } from '@testing-library/react'
import { DndContext, closestCenter } from '@dnd-kit/core'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { DaySection } from '../day-section'
import { IdeasList } from '../ideas-list'
import { IDEAS_CONTAINER, ideaItemId } from '../ordering'
import { usePlanDnd } from '../plan-dnd'

import { stopsOf } from '../types'

import type { PlanOrder, PlanTarget } from '../ordering'
import type {
  PlannerCategory,
  PlannerDay,
  PlannerItem,
  PlannerRow,
} from '../types'

/** A day's sequence, with `rows` derived so the two can never disagree. */
function sequence(
  items: ReadonlyArray<PlannerItem>,
): Pick<PlannerDay, 'items' | 'rows'> {
  return { items, rows: stopsOf(items) }
}

/**
 * Keyboard drag and drop, driven the way a reader drives it.
 *
 * This is the test the planner needed most: the drag handle advertises itself as a
 * sortable control, and a control that says that and then does nothing is worse than
 * no control at all. So the whole gesture is exercised through the real wiring —
 * `usePlanDnd` plus the real rails — rather than through a mock: focus the handle,
 * press space, walk the arrow keys across days, press space again, and check both
 * the move that was committed and the words a screen reader was given.
 *
 * jsdom has no layout, and `@dnd-kit` decides where the arrow keys land entirely
 * from rectangles, so {@link layout} stamps a believable vertical stack onto the
 * measured elements. Everything else is the production path.
 */

/** `DaySection` reads the message layer for its note affordances. See `rails.test.tsx`. */
const MESSAGES = await loadCatalogue('en')

function render(ui: React.ReactElement) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      {ui}
    </I18nProvider>,
  )
}

const CATEGORIES: ReadonlyArray<PlannerCategory> = [
  { id: 'c-food', name: 'Food', colour: '#b26b08', icon: 'utensils' },
]

function categoryFor(categoryId: string | null): PlannerCategory | undefined {
  return CATEGORIES.find((entry) => entry.id === categoryId)
}

function row(overrides: Partial<PlannerRow> & { placeId: string }): PlannerRow {
  return {
    itemId: `a-${overrides.placeId}`,
    assignmentId: `a-${overrides.placeId}`,
    name: 'A place',
    location: 'Somewhere',
    time: null,
    duration: null,
    categoryId: 'c-food',
    imageUrl: null,
    rating: null,
    note: null,
    reservationStatus: 'none',
    lng: 139.7,
    lat: 35.7,
    visited: false,
    dayNumber: 1,
    ...overrides,
  }
}

const DAY_ONE: PlannerDay = {
  dayId: 'd1',
  dayNumber: 1,
  title: 'Asakusa and the river',
  dateLabel: null,
  stays: [],
  ...sequence([
    { kind: 'stop', row: row({ placeId: 'p1', name: 'Sensō-ji' }) },
    { kind: 'stop', row: row({ placeId: 'p2', name: 'Tokyo Skytree' }) },
  ]),
}

const DAY_TWO: PlannerDay = {
  dayId: 'd2',
  dayNumber: 2,
  title: 'Kyoto by train',
  dateLabel: null,
  stays: [],
  ...sequence([
    {
      kind: 'stop',
      row: row({ placeId: 'p3', name: 'Fushimi Inari', dayNumber: 2 }),
    },
  ]),
}

/** An empty day, the drop target a sortable list on its own gets wrong. */
const DAY_THREE: PlannerDay = {
  dayId: 'd3',
  dayNumber: 3,
  title: 'Nothing planned yet',
  dateLabel: null,
  stays: [],
  ...sequence([]),
}

const IDEAS: ReadonlyArray<PlannerRow> = [
  row({
    placeId: 'p9',
    itemId: ideaItemId('p9'),
    assignmentId: null,
    name: 'Ichiran Shibuya',
    dayNumber: null,
  }),
]

const ORDER: PlanOrder = {
  days: [
    { dayId: 'd1', itemIds: ['a-p1', 'a-p2'] },
    { dayId: 'd2', itemIds: ['a-p3'] },
    { dayId: 'd3', itemIds: [] },
  ],
  ideaIds: [ideaItemId('p9')],
}

const ROWS_BY_ITEM: ReadonlyMap<string, PlannerRow> = new Map(
  [...DAY_ONE.rows, ...DAY_TWO.rows, ...IDEAS].map((entry) => [
    entry.itemId,
    entry,
  ]),
)

interface BoardProps {
  readonly onMove: (itemId: string, target: PlanTarget) => void
}

function Board({ onMove }: BoardProps) {
  const dnd = usePlanDnd({
    order: ORDER,
    rowsByItem: ROWS_BY_ITEM,
    days: [DAY_ONE, DAY_TWO, DAY_THREE],
    onMove,
  })

  return (
    <DndContext
      id="plan-board"
      sensors={dnd.sensors}
      collisionDetection={closestCenter}
      onDragStart={dnd.onDragStart}
      onDragEnd={dnd.onDragEnd}
      onDragCancel={dnd.onDragCancel}
      accessibility={{
        announcements: dnd.announcements,
        screenReaderInstructions: dnd.screenReaderInstructions,
      }}
    >
      <div data-testid="dragging">{dnd.draggingId ?? 'none'}</div>
      <DaySection day={DAY_ONE} categoryFor={categoryFor} />
      <DaySection day={DAY_TWO} categoryFor={categoryFor} />
      <DaySection day={DAY_THREE} categoryFor={categoryFor} />
      <IdeasList
        rows={IDEAS}
        total={IDEAS.length}
        categoryFor={categoryFor}
        query=""
        onQueryChange={() => {}}
      />
    </DndContext>
  )
}

/**
 * Gives every list and row a rectangle, top to bottom in document order.
 *
 * `@dnd-kit`'s keyboard coordinate getter picks the next droppable purely from
 * rectangles, and jsdom reports every one of them as 0×0 at the origin — which
 * makes every target equidistant and the arrow keys meaningless.
 */
function layout(container: HTMLElement): void {
  const ROW = 56
  const GAP = 8
  const boxes: Array<[Element, number, number]> = []
  let top = 0

  for (const list of container.querySelectorAll('ul')) {
    const rows = [...list.querySelectorAll(':scope > li')]
    const listTop = top
    for (const entry of rows) {
      boxes.push([entry, top, ROW])
      top += ROW
    }
    boxes.push([list, listTop, Math.max(ROW, top - listTop)])
    top += GAP
  }

  for (const [element, boxTop, height] of boxes) {
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: boxTop,
        bottom: boxTop + height,
        left: 0,
        right: 320,
        width: 320,
        height,
        x: 0,
        y: boxTop,
        toJSON: () => ({}),
      }),
    })
  }
}

/**
 * Every announcement `@dnd-kit` makes, in order.
 *
 * Read from the live region rather than from the announcement callbacks, because
 * what matters is what actually reached the region — and a `textContent` snapshot
 * cannot be taken after the fact: the lift announcement is replaced by the first
 * "now over" in the same tick.
 */
function record(): ReadonlyArray<string> {
  const said: Array<string> = []
  const region = document.querySelector('[id^="DndLiveRegion"]')
  if (region === null) throw new Error('no live region was rendered')

  const observer = new MutationObserver(() => {
    const text = region.textContent
    if (text !== '' && said.at(-1) !== text) said.push(text)
  })
  observer.observe(region, {
    childList: true,
    characterData: true,
    subtree: true,
  })
  return said
}

/** One key, then the macrotask `@dnd-kit` waits for before it listens again. */
async function press(
  target: Element,
  key: string,
  code?: string,
): Promise<void> {
  fireEvent.keyDown(target, code === undefined ? { key } : { key, code })
  await tick()
}

async function tick(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 5)
  })
}

/** Arrow-keys down until the reader is told they are over `text`. */
async function pressDownUntil(
  said: ReadonlyArray<string>,
  text: string,
): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    await press(document.body, 'ArrowDown', 'ArrowDown')
    if ((said.at(-1) ?? '').includes(text)) return
  }
  throw new Error(`never heard "${text}". Heard: ${said.join(' | ')}`)
}

function handleFor(name: string): HTMLElement {
  return screen.getByRole('button', { name: `Reorder ${name}` })
}

describe('keyboard drag', () => {
  it('lifts a stop, says so, and marks the handle pressed', async () => {
    const onMove = vi.fn()
    const { container } = render(<Board onMove={onMove} />)
    layout(container)
    const said = record()

    const handle = handleFor('Sensō-ji')
    handle.focus()
    await press(handle, ' ', 'Space')

    expect(handle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('dragging').textContent).toBe('a-p1')
    expect(said[0]).toContain('Picked up Sensō-ji')
    expect(said[0]).toContain('on Day 1 — Asakusa and the river')
    expect(said[0]).toContain('escape cancels')
  })

  it('walks the arrow keys into the next day and drops there', async () => {
    const onMove = vi.fn()
    const { container } = render(<Board onMove={onMove} />)
    layout(container)
    const said = record()

    const handle = handleFor('Sensō-ji')
    handle.focus()
    await press(handle, ' ', 'Space')
    await pressDownUntil(said, 'Day 2 — Kyoto by train')
    await press(document.body, ' ', 'Space')

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove.mock.calls[0][0]).toBe('a-p1')
    expect(onMove.mock.calls[0][1]).toEqual({ container: 'd2', index: 0 })
    expect(said.at(-1)).toBe(
      'Moved Sensō-ji to Day 2 — Kyoto by train. Saving.',
    )
    expect(screen.getByTestId('dragging').textContent).toBe('none')
  })

  it('names an empty day rather than "the board" when the drag is over one', async () => {
    const onMove = vi.fn()
    const { container } = render(<Board onMove={onMove} />)
    layout(container)
    const said = record()

    const handle = handleFor('Fushimi Inari')
    handle.focus()
    await press(handle, ' ', 'Space')
    await pressDownUntil(said, 'Day 3 — Nothing planned yet')
    await press(document.body, ' ', 'Space')

    expect(onMove).toHaveBeenCalledWith('a-p3', { container: 'd3', index: 0 })
    expect(said.join(' | ')).not.toContain('the board')
  })

  it('drops a stop into the ideas column, which unschedules it', async () => {
    const onMove = vi.fn()
    const { container } = render(<Board onMove={onMove} />)
    layout(container)
    const said = record()

    const handle = handleFor('Fushimi Inari')
    handle.focus()
    await press(handle, ' ', 'Space')
    await pressDownUntil(said, 'Ideas')
    await press(document.body, ' ', 'Space')

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove.mock.calls[0][1].container).toBe(IDEAS_CONTAINER)
  })

  it('puts the stop back on escape, and says where it went back to', async () => {
    const onMove = vi.fn()
    const { container } = render(<Board onMove={onMove} />)
    layout(container)
    const said = record()

    const handle = handleFor('Sensō-ji')
    handle.focus()
    await press(handle, ' ', 'Space')
    await press(document.body, 'ArrowDown', 'ArrowDown')
    await press(document.body, 'Escape', 'Escape')

    expect(onMove).not.toHaveBeenCalled()
    expect(screen.getByTestId('dragging').textContent).toBe('none')
    expect(said.at(-1)).toBe(
      'Cancelled. Sensō-ji is back on Day 1 — Asakusa and the river.',
    )
  })

  it('lifts on Enter as well as space', async () => {
    const onMove = vi.fn()
    const { container } = render(<Board onMove={onMove} />)
    layout(container)
    const said = record()

    const handle = handleFor('Tokyo Skytree')
    handle.focus()
    await press(handle, 'Enter', 'Enter')

    expect(handle.getAttribute('aria-pressed')).toBe('true')
    expect(said[0]).toContain('Picked up Tokyo Skytree')
  })

  /**
   * The regression that made the handle look dead.
   *
   * `@dnd-kit` reads `KeyboardEvent.code`, which a synthesised key event does not
   * have to carry — `new KeyboardEvent('keydown', { key: ' ' })` reports `''`. The
   * pointer sensor never reads `code`, which is why pointer dragging worked while
   * every scripted or bridged keypress on the handle did nothing at all.
   */
  it('works for key events that carry no physical code', async () => {
    const onMove = vi.fn()
    const { container } = render(<Board onMove={onMove} />)
    layout(container)
    const said = record()

    const codeless = (key: string): KeyboardEvent =>
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })

    expect(codeless(' ').code).toBe('')

    const handle = handleFor('Sensō-ji')
    handle.focus()
    handle.dispatchEvent(codeless(' '))
    await tick()

    expect(handle.getAttribute('aria-pressed')).toBe('true')
    expect(said[0]).toContain('Picked up Sensō-ji')

    for (let step = 0; step < 8; step += 1) {
      document.body.dispatchEvent(codeless('ArrowDown'))
      await tick()
      if ((said.at(-1) ?? '').includes('Day 2 — Kyoto by train')) break
    }
    expect(said.at(-1)).toContain('Day 2 — Kyoto by train')

    document.body.dispatchEvent(codeless(' '))
    await tick()

    expect(onMove).toHaveBeenCalledWith('a-p1', { container: 'd2', index: 0 })
  })
})
