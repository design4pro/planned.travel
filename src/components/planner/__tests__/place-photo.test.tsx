// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlaceThumb } from '../place-thumb'
import { PlacePin } from '#/components/map/pins'
import { MarkerPopover } from '#/components/map/marker-popover'

const oldUrl = 'https://example.test/old.jpg'
const newUrl = 'https://example.test/new.jpg'

for (const surface of ['thumbnail', 'pin', 'details'] as const) {
  describe(surface, () => {
    function view(url: string | null, version = 1, legacyUrl = url) {
      const photo = { source: 'legacy' as const, imageUrl: url, version }
      if (surface === 'thumbnail')
        return (
          <PlaceThumb placeId="castle" imageUrl={legacyUrl} photo={photo} />
        )
      if (surface === 'pin')
        return <PlacePin name="Castle" imageUrl={legacyUrl} photo={photo} />
      return (
        <MarkerPopover
          name="Castle"
          placeId="castle"
          imageUrl={legacyUrl}
          photo={photo}
        />
      )
    }

    it('retries a changed URL and a new version after a broken image', () => {
      const { container, rerender } = render(view(oldUrl))
      const image = container.querySelector('img')
      expect(image).not.toBeNull()
      if (image) fireEvent.error(image)
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('svg')).not.toBeNull()
      rerender(view(newUrl))
      expect(container.querySelector('img')?.getAttribute('src')).toBe(newUrl)
      const replacement = container.querySelector('img')
      if (replacement) fireEvent.error(replacement)
      rerender(view(newUrl, 2))
      expect(container.querySelector('img')?.getAttribute('src')).toBe(newUrl)
    })

    it('keeps local artwork stable after remount and never shows a stale legacy URL', () => {
      const { container, rerender, unmount } = render(view(null, 1, oldUrl))
      const artwork = container.querySelector('svg')?.outerHTML
      expect(artwork).toBeDefined()
      rerender(view(null, 2))
      expect(container.querySelector('svg')?.outerHTML).toBe(artwork)
      unmount()
      const next = render(view(null, 2))
      expect(next.container.querySelector('svg')?.outerHTML).toBe(artwork)
    })
  })
}
