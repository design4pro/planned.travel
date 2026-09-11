// The picker mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { TimezoneClock } from '../timezone-clock'

import type { Catalogue } from '#/lib/i18n'

/**
 * The half of the widget that needs a DOM.
 *
 * The arithmetic — the offset, the ordering, the label, the tick delay — belongs
 * to `src/lib/clock-zones.ts` and is covered there without rendering anything.
 * What is asserted here is what only a mounted component has: which rows the two
 * default states draw, what a zone the runtime refuses looks like on screen, and
 * the tick — that it lands on the boundary rather than a minute after the mount,
 * that a hidden document is not woken once a minute, and that an unmount leaves
 * nothing running.
 */

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

/** The dashboard's own day, which fixes the date the offsets are read on. */
const TODAY = '2026-08-20'

/** 09:30:30 UTC — deliberately half a minute short of a boundary. */
const AT = Date.UTC(2026, 7, 20, 9, 30, 30)

/**
 * The zone the browser reports as the reader's own, read from the same place the
 * component reads it. Asked rather than hard-coded: which zone a test machine
 * sits in is the machine's business, and a test that pinned one would be passing
 * or failing on that rather than on the widget.
 */
const HOME = Intl.DateTimeFormat().resolvedOptions().timeZone

function mount(props: {
  zones: ReadonlyArray<string> | null
  onZonesChange?: (next: ReadonlyArray<string>) => void
}) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <TimezoneClock
        zones={props.zones}
        onZonesChange={props.onZonesChange ?? (() => {})}
        today={TODAY}
      />
    </I18nProvider>,
  )
}

/** The zone of every row the widget drew, in the order it drew them. */
function rows(): Array<string> {
  return [...document.querySelectorAll('[data-part="clock-row"]')].map(
    (row) => row.getAttribute('data-zone') ?? '',
  )
}

/**
 * A row's text, which is where the wall clock is asserted from.
 *
 * Read as a whole rather than matched exactly, because the separator `Intl` puts
 * before `PM` is a narrow no-break space in a current ICU and an ordinary one in
 * an older build. The minute is the claim; the whitespace between it and the
 * meridiem is the platform's.
 */
function textOf(zone: string): string {
  return (
    document.querySelector(`[data-part="clock-row"][data-zone="${zone}"]`)
      ?.textContent ?? ''
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AT)
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('the reference column’s clock', () => {
  it('draws a row per pinned zone, earliest first, each with its own wall clock', () => {
    mount({ zones: ['Asia/Tokyo', 'America/New_York', 'Europe/Paris'] })

    // Ordered by how far ahead of the reader they are, which is the order the
    // day moves in rather than the order they were pinned in.
    expect(rows()).toEqual(['America/New_York', 'Europe/Paris', 'Asia/Tokyo'])
    expect(screen.getByText('New York')).toBeTruthy()
    // 09:30 UTC in August: Tokyo is nine hours ahead of UTC all year round, and
    // Paris two in summer.
    expect(textOf('Asia/Tokyo')).toContain('6:30')
    expect(textOf('Europe/Paris')).toContain('11:30')
  })

  it('takes the reader’s own zone when nothing was ever chosen', () => {
    mount({ zones: null })
    expect(rows()).toEqual([HOME])
  })

  it('draws the designed nothing for a reader who removed the last row', () => {
    mount({ zones: [] })

    expect(rows()).toEqual([])
    expect(screen.getByText('No time zones pinned')).toBeTruthy()
  })

  it('hands back the remaining zones when a row is removed', () => {
    const onZonesChange = vi.fn()
    mount({ zones: ['Asia/Tokyo', 'Europe/Paris'], onZonesChange })

    // Dispatched rather than driven through `userEvent`, whose own timer budget
    // fights the fake clock this widget is measured against.
    fireEvent.click(screen.getByRole('button', { name: 'Remove Tokyo' }))

    expect(onZonesChange).toHaveBeenCalledWith(['Europe/Paris'])
  })

  /**
   * The one failure the stage names by hand: a stored identifier this runtime
   * will not format. It has to be visible and removable rather than thrown — a
   * `RangeError` inside a formatter here takes the whole dashboard with it.
   */
  it('names a zone the runtime refuses, and offers the way out', () => {
    const onZonesChange = vi.fn()
    mount({ zones: ['Europe/Paris', 'Mars/Olympus_Mons'], onZonesChange })

    expect(
      screen.getByText('This device does not know Mars/Olympus_Mons'),
    ).toBeTruthy()
    // The readable row is still drawn: one bad name costs its own row, never the
    // widget.
    expect(rows()).toEqual(['Europe/Paris'])

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Mars/Olympus_Mons' }),
    )
    expect(onZonesChange).toHaveBeenCalledWith(['Europe/Paris'])
  })

  /**
   * The divider is asserted on the element rather than in pixels, because the
   * bug it guards against is a selector one that no jsdom layout would show:
   * `not-last:` compiles to `:not(:last-child)`, which resolves against the
   * element's own parent. A row carrying the variant while sitting alone inside
   * its own `<li>` is always that `<li>`'s last child, so the hairline never
   * draws however many zones are pinned. What has to hold is that the variant
   * sits on the list items the `<ul>` orders — including the unknown-zone one,
   * which is a plain block rather than a `PanelRow`.
   */
  it('carries the hairline on the list items the ul orders, unknown zones included', () => {
    mount({ zones: ['Asia/Tokyo', 'Europe/Paris', 'Mars/Olympus_Mons'] })

    const items = [...document.querySelectorAll('ul > li')]
    expect(items).toHaveLength(3)
    for (const item of items) {
      expect(item.className).toContain('not-last:border-b')
    }
  })

  it('moves on the minute boundary rather than a minute after the mount', () => {
    mount({ zones: ['Asia/Tokyo'] })
    expect(textOf('Asia/Tokyo')).toContain('6:30')

    // One millisecond short of the boundary this mount fell 30 s inside. A fixed
    // 60_000 delay would still be showing 18:30 for another 30 s here.
    act(() => {
      vi.advanceTimersByTime(29_999)
    })
    expect(textOf('Asia/Tokyo')).toContain('6:30')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(textOf('Asia/Tokyo')).toContain('6:31')
  })

  it('stops while the document is hidden, and catches up on the way back', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    mount({ zones: ['Asia/Tokyo'] })

    visibility.mockReturnValue('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(vi.getTimerCount()).toBe(0)

    // Five minutes of a tab nobody was looking at, and not one wake-up.
    act(() => {
      vi.advanceTimersByTime(5 * 60_000)
    })
    expect(textOf('Asia/Tokyo')).toContain('6:30')

    visibility.mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(textOf('Asia/Tokyo')).toContain('6:35')
  })

  it('leaves no timer behind when it goes away', () => {
    const view = mount({ zones: ['Asia/Tokyo'] })
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
