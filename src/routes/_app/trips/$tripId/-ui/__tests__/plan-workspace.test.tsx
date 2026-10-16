import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { PlanReadinessBoundary } from '../plan-readiness'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { PlanWorkspace, usePlanWorkspace } from '../plan-workspace'
import {
  plannerLayoutPreference,
  plannerDaysPreference,
  isDayExpanded,
} from '../plan-layout'

const MESSAGES = await loadCatalogue('en')

function Workspace({
  tripId = 'one',
  ready = false,
  direction = 'ltr',
}: {
  tripId?: string
  ready?: boolean
  direction?: 'ltr' | 'rtl'
}) {
  const layout = usePlanWorkspace(tripId, direction)
  return (
    <I18nProvider locale="en" messages={MESSAGES}>
      <PlanReadinessBoundary entryKey={tripId} loaderReady title="Japan">
        <PlanWorkspace
          layout={layout}
          tripTitle="Japan"
          itinerary={<div>days</div>}
          ideas={<div>ideas</div>}
          addButton={null}
          railFooter={null}
          scheduledCount="1"
          placesCount="2"
          mobileSummary="summary"
          resizeLeftLabel="Resize itinerary"
          resizeRightLabel="Resize places"
        >
          <div data-map-ready={String(ready)} />
          <output aria-label="padding">{layout.padding.left}</output>
        </PlanWorkspace>
      </PlanReadinessBoundary>
    </I18nProvider>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: !query.includes('reduced-motion'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('workspace restoration', () => {
  it('restores widths before reveal, shares them with the camera, and separates trips', () => {
    plannerLayoutPreference.write('one', { left: 390, right: 300 })
    const view = render(<Workspace />)
    expect(
      screen
        .getByRole('separator', { name: 'Resize itinerary' })
        .getAttribute('aria-valuenow'),
    ).toBe('390')
    expect(screen.getByLabelText('padding').textContent).toBe('422')
    expect(
      view.container.querySelector('[data-plan-loaded]')?.getAttribute('style'),
    ).toContain('--plan-left: 390px')
    view.rerender(<Workspace tripId="two" />)
    expect(
      screen
        .getByRole('separator', { name: 'Resize itinerary' })
        .getAttribute('aria-valuenow'),
    ).toBe('344')
  })
  it('mirrors physical camera padding with the logical rails in RTL', () => {
    plannerLayoutPreference.write('one', { left: 390, right: 300 })
    render(<Workspace direction="rtl" />)
    expect(screen.getByLabelText('padding').textContent).toBe('400')
  })
  it('keeps server defaults hidden and restores the saved width during hydration', async () => {
    plannerLayoutPreference.write('one', { left: 380, right: 310 })
    const container = document.createElement('div')
    container.innerHTML = renderToString(<Workspace ready />)
    document.body.appendChild(container)
    expect(
      container.querySelector('[data-plan-loaded]')?.getAttribute('style'),
    ).toContain('visibility:hidden')
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, <Workspace ready />)
    })
    expect(
      container
        .querySelector('[aria-label="Resize itinerary"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('380')
    expect(
      container.querySelector('[data-plan-loaded]')?.getAttribute('style'),
    ).toContain('--plan-left: 380px')
    await act(async () => root?.unmount())
    container.remove()
  })
  it('clamps stored values and tolerates malformed or unavailable storage', () => {
    window.localStorage.setItem(
      'planned.planner-layout',
      JSON.stringify({ v: 1, entries: [['one', { left: 999, right: -1 }]] }),
    )
    expect(plannerLayoutPreference.read('one')).toEqual({
      left: 400,
      right: 280,
    })
    window.localStorage.setItem(
      'planned.planner-layout',
      JSON.stringify({
        v: 1,
        entries: [['one', { left: 'bad', right: null }]],
      }),
    )
    expect(plannerLayoutPreference.read('one')).toEqual({
      left: 344,
      right: 328,
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(plannerLayoutPreference.read('one')).toEqual({
      left: 344,
      right: 328,
    })
  })
  it('keeps explicit day folds per trip and expands new days', () => {
    plannerDaysPreference.write('one', { known: ['a', 'b'], open: ['a'] })
    expect(isDayExpanded(plannerDaysPreference.read('one'), 'a')).toBe(true)
    expect(isDayExpanded(plannerDaysPreference.read('one'), 'b')).toBe(false)
    expect(isDayExpanded(plannerDaysPreference.read('one'), 'new')).toBe(true)
    expect(isDayExpanded(plannerDaysPreference.read('two'), 'b')).toBe(true)
    expect(window.localStorage.getItem('planned.planner-days')).toBeNull()
    expect(window.sessionStorage.getItem('planned.planner-days')).not.toBeNull()
  })
})

describe('readiness splash', () => {
  it('never appears for immediate readiness', () => {
    vi.useFakeTimers()
    const view = render(<Workspace ready />)
    act(() => vi.advanceTimersByTime(150))
    expect(view.container.querySelector('[data-workspace-splash]')).toBeNull()
  })
  it('admits after 150ms and clears on terminal map readiness without a visible hold', async () => {
    vi.useFakeTimers()
    const view = render(<Workspace />)
    act(() => vi.advanceTimersByTime(149))
    expect(
      view.container
        .querySelector('[data-workspace-splash]')
        ?.getAttribute('data-workspace-splash'),
    ).toBe('waiting')
    act(() => vi.advanceTimersByTime(1))
    expect(
      view.container
        .querySelector('[data-workspace-splash]')
        ?.getAttribute('data-workspace-splash'),
    ).toBe('visible')
    await act(async () => {
      view.rerender(<Workspace ready />)
    })
    expect(view.container.querySelector('[data-workspace-splash]')).toBeNull()
  })
  it('preserves admission and immediate readiness dismissal with reduced motion', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const view = render(<Workspace />)
    act(() => vi.advanceTimersByTime(150))
    await act(async () => {
      view.rerender(<Workspace ready />)
    })
    expect(view.container.querySelector('[data-workspace-splash]')).toBeNull()
  })
})
