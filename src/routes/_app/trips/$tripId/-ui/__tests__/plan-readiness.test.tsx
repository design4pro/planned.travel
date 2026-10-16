import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlanReadinessBoundary } from '../plan-readiness'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function View({
  loaded = false,
  ready = false,
  entry = 'one',
}: {
  loaded?: boolean
  ready?: boolean
  entry?: string | null
}) {
  return (
    <PlanReadinessBoundary entryKey={entry} loaderReady={loaded} title="Japan">
      {loaded ? (
        <div data-plan-loaded>
          <div data-map-ready={String(ready)} />
        </div>
      ) : (
        <div>pending</div>
      )}
    </PlanReadinessBoundary>
  )
}

describe('combined planner readiness', () => {
  it('keeps one splash across a slow loader and an immediately ready map', async () => {
    const view = render(<View />)
    act(() => vi.advanceTimersByTime(150))
    expect(
      view.container
        .querySelector('[data-workspace-splash]')
        ?.getAttribute('data-workspace-splash'),
    ).toBe('visible')
    await act(async () => view.rerender(<View loaded ready />))
    expect(view.container.querySelector('[data-workspace-splash]')).toBeNull()
  })
  it('does not admit either fast readiness or an inactive/preloaded route', () => {
    const view = render(<View loaded ready />)
    act(() => vi.advanceTimersByTime(150))
    expect(view.container.querySelector('[data-workspace-splash]')).toBeNull()
    view.rerender(<View entry={null} />)
    act(() => vi.advanceTimersByTime(1000))
    expect(view.container.querySelector('[data-workspace-splash]')).toBeNull()
  })
  it('starts a new admission on re-entry', () => {
    const view = render(<View loaded ready />)
    act(() => vi.advanceTimersByTime(150))
    view.rerender(<View entry="two" />)
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
  })
  it('reveals a terminal loader error instead of covering its retry control', async () => {
    const view = render(<View />)
    act(() => vi.advanceTimersByTime(150))
    await act(async () =>
      view.rerender(
        <PlanReadinessBoundary entryKey="one" loaderReady={false} title="Japan">
          <div data-plan-error>error</div>
        </PlanReadinessBoundary>,
      ),
    )
    act(() => vi.advanceTimersByTime(150))
    expect(view.container.querySelector('[data-workspace-splash]')).toBeNull()
  })
  it('does not mistake retained map DOM for a settled loader', async () => {
    const content = (
      <div data-plan-loaded>
        <div data-map-ready="true" />
      </div>
    )
    const view = render(
      <PlanReadinessBoundary entryKey="one" loaderReady={false} title="Japan">
        {content}
      </PlanReadinessBoundary>,
    )
    act(() => vi.advanceTimersByTime(150))
    expect(
      view.container
        .querySelector('[data-workspace-splash]')
        ?.getAttribute('data-workspace-splash'),
    ).toBe('visible')
    await act(async () =>
      view.rerender(
        <PlanReadinessBoundary entryKey="one" loaderReady title="Japan">
          {content}
        </PlanReadinessBoundary>,
      ),
    )
    act(() => vi.advanceTimersByTime(150))
    expect(view.container.querySelector('[data-workspace-splash]')).toBeNull()
  })
})

it('removes the admitted splash and releases covered controls on readiness without a removal timer', async () => {
  const view = render(<View />)
  act(() => vi.advanceTimersByTime(150))
  expect(view.container.querySelector('[inert]')).not.toBeNull()
  await act(async () => view.rerender(<View loaded ready />))
  expect(view.container.querySelector('[data-workspace-splash]')).toBeNull()
  expect(view.container.querySelector('[inert]')).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
})
