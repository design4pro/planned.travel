import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TripArt } from '../trip-art'

describe('decorative trip art', () => {
  it('is stable, reserved and draws no invented inter-day legs', () => {
    const points = [
      { x: 0, y: 0, startsSegment: true },
      { x: 1, y: 1, startsSegment: false },
      { x: 0.5, y: 0, startsSegment: true },
    ]
    const html = renderToStaticMarkup(<TripArt points={points} dayCount={3} />)
    expect(html).toBe(
      renderToStaticMarkup(<TripArt points={points} dayCount={3} />),
    )
    expect(html.match(/<path /g)).toHaveLength(1)
    expect(html.match(/<circle /g)).toHaveLength(4)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('width="320" height="200"')
    expect(html).not.toMatch(/NaN|Infinity|<image|<animate/)
  })
  it('has one zero-data illustration', () => {
    expect(renderToStaticMarkup(<TripArt points={[]} />)).toBe(
      renderToStaticMarkup(<TripArt points={[]} dayCount={0} />),
    )
  })
})
