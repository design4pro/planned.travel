import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { WORLD_CENTRE } from '#/lib/atlas/layout'
import {
  ATLAS,
  SEEDED_TRIPS,
  contains,
  describeCamera,
  onRoute,
  planRoute,
  restingCamera,
  tripIdByName,
} from './helpers/places-and-maps.ts'
import type { Camera } from './helpers/places-and-maps.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'
import { settleMutations } from './helpers/settle.ts'

/**
 * `02-S3` — the opening camera, asserted where a reader sees it.
 *
 * `src/components/map/__tests__/fit-bounds.test.tsx` proves what `fitMapToBounds` hands MapLibre.
 * This file proves what MapLibre then shows: the atlas opens on the world, and the planner opens on
 * each of the three frames a trip can ask for — a country's worth of places, a single place, and none.
 * Every number is the map's own `getCenter()` / `getZoom()` / `getBounds()`, never a pixel.
 */

/**
 * `FIT_MAX_ZOOM` in `src/components/map/fit-bounds.tsx`, restated rather than imported: the claim is
 * that one place does not open at the ceiling, and a check that read the ceiling out of the code under
 * test would move with it. `fit-bounds.test.tsx` pins the constant itself.
 */
const FIT_MAX_ZOOM = 15

/**
 * The closest a single place may open and still be the neighbourhood rather than a doorway, and the
 * farthest it may open and still be a place rather than a region. `expandBounds()` widens a point to
 * 0.04°, which by the Web Mercator arithmetic should rest somewhere in the low teens on either
 * viewport; that has not been measured, because the local test environment caps Porto (below).
 *
 * The floor gives way to a lower ceiling when the planner asks for one. Outside the published basemap
 * archive the planner caps the fit at `FIT_MAX_ZOOM_UNMAPPED` (6), because the only ground there is
 * generalised coastline; measured on the local test environment, Porto opens at exactly that cap. On a
 * run with no archive at all coverage is unknown, the cap is `FIT_MAX_ZOOM`, and the floor applies.
 */
const READABLE_ZOOM = { from: 10, below: FIT_MAX_ZOOM } as const

/**
 * How far from the middle of the frame the single place may sit, as a share of the visible span.
 *
 * A share rather than degrees, because the offset is the planner's rails: `fitBounds` centres the
 * place in the *padded* frame, so the map's centre sits a fixed number of pixels off it, which is
 * 0.3° at zoom 6 and a hundredth of that at zoom 13. Measured at 1440x900 and zoom 6: 1.8%.
 */
const SINGLE_PLACE_CENTRE_SHARE = 0.25

/** The latitude where Web Mercator ends and MapLibre stops the camera from showing further. */
const MERCATOR_EDGE = 85

/**
 * Two map screens per test: `/trips` to resolve the trip by name, then the planner. Each loads MapLibre
 * or waits on the dev server, so the flat budget is one screen's — the reasoning behind
 * `ATLAS_JOURNEY_TIMEOUT_MS` in `journeys.spec.ts`.
 */
const CAMERA_JOURNEY_TIMEOUT_MS = 90_000

test.describe('02-S3 — the opening camera', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    test.setTimeout(CAMERA_JOURNEY_TIMEOUT_MS)
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('/atlas opens on the whole world at its own floor zoom', async ({
    context,
  }) => {
    await onRoute(context, ATLAS, async (page) => {
      const camera = await restingCamera(page, (seen) => {
        const [lng, lat] = seen.center
        if (Math.abs(lng - WORLD_CENTRE[0]) > 0.5) {
          return `the centre longitude is not WORLD_CENTRE's ${WORLD_CENTRE[0]}`
        }
        // MapLibre clamps the centre so the canvas never shows past the Mercator edge. On a canvas
        // taller than the world at its floor zoom (a phone: 393x659 rests at z0.048 with the centre
        // pulled to the equator) the whole height is already in frame, and that clamp — not the
        // atlas — decides the latitude.
        const wholeHeight =
          seen.bounds.north >= MERCATOR_EDGE &&
          seen.bounds.south <= -MERCATOR_EDGE
        if (!wholeHeight && Math.abs(lat - WORLD_CENTRE[1]) > 0.5) {
          return `the centre latitude is not WORLD_CENTRE's ${WORLD_CENTRE[1]}`
        }
        if (Math.abs(seen.zoom - seen.minZoom) > 0.01) {
          return 'the zoom is not the world floor the atlas sets as its minimum'
        }
        return null
      })
      annotate(camera)
    })
  })

  test('a trip that spans a country opens on every place it holds', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.spanning)
    await onRoute(context, planRoute(tripId), async (page) => {
      const camera = await restingCamera(page, (seen) => {
        const points = seen.fit?.points ?? []
        if (points.length < 2) return 'the planner framed fewer than two places'
        const outside = points.filter((point) => !contains(seen.bounds, point))
        if (outside.length > 0) {
          return `${outside.length} of ${points.length} places are outside the frame`
        }
        if (seen.zoom > (seen.fit?.maxZoom ?? FIT_MAX_ZOOM)) {
          return 'the zoom is past the ceiling the planner asked for'
        }
        if (!contains(boxOf(points), seen.center)) {
          return 'the centre is outside the rectangle the places draw'
        }
        if (seen.bounds.east - seen.bounds.west > 90) {
          return 'the frame is a hemisphere, not the country the places are in'
        }
        return null
      })
      annotate(camera)
    })
  })

  test('a trip with one place opens at a readable zoom, not the ceiling', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.single)
    await onRoute(context, planRoute(tripId), async (page) => {
      const camera = await restingCamera(page, (seen) => {
        const points = unique(seen.fit?.points ?? [])
        const [place] = points
        if (points.length !== 1) {
          return `the planner framed ${points.length} places, not one`
        }
        if (!contains(seen.bounds, place))
          return 'the place is outside the frame'
        const drift = Math.max(
          Math.abs(seen.center[0] - place[0]) /
            (seen.bounds.east - seen.bounds.west),
          Math.abs(seen.center[1] - place[1]) /
            (seen.bounds.north - seen.bounds.south),
        )
        if (drift > SINGLE_PLACE_CENTRE_SHARE) {
          return `the centre sits ${(drift * 100).toFixed(0)}% of the frame away from the place`
        }
        const from = Math.min(
          READABLE_ZOOM.from,
          seen.fit?.maxZoom ?? FIT_MAX_ZOOM,
        )
        if (seen.zoom < from || seen.zoom >= READABLE_ZOOM.below) {
          return `the zoom is outside the readable band [${from}, ${READABLE_ZOOM.below})`
        }
        return null
      })
      annotate(camera)
    })
  })

  test('a trip with no coordinates opens on the world', async ({ context }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.unmapped)
    await onRoute(context, planRoute(tripId), async (page) => {
      const camera = await restingCamera(page, (seen) => {
        if ((seen.fit?.points.length ?? 0) > 0) {
          return 'the planner found places on a trip that holds none'
        }
        // As far out as the planner allows: half the world where the canvas is wide enough, and
        // the map's own minimum zoom where it is not — a phone holds 120° at z1.2.
        const flooredOut = Math.abs(seen.zoom - seen.minZoom) <= 0.01
        if (seen.bounds.east - seen.bounds.west < 180 && !flooredOut) {
          return 'the frame spans less than half the world and the zoom is not at its floor'
        }
        if (seen.zoom > 3) return 'the zoom is regional, not the world'
        return null
      })
      annotate(camera)
    })
  })

  test('the planner does not shift after it settles, across a resize and a theme change', async ({
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'the Layout Instability API that reports a shift is Chromium-only; WebKit publishes no layout-shift entries to assert against',
    )
    const tripId = await tripIdByName(context, SEEDED_TRIPS.spanning)
    await onRoute(context, planRoute(tripId), async (page) => {
      await restingCamera(page, () => null)
      await recordShifts(page)

      const viewport = page.viewportSize()
      if (viewport === null)
        throw new Error('the page has no viewport to resize')
      // A resize reaches the map through a `ResizeObserver`, so the camera can read as resting
      // before it has started to move. The DOM going quiet first is what makes each read late
      // enough to see the frame — and every shift — the action caused.
      const settled = async (): Promise<void> => {
        await settleMutations(page)
        await restingCamera(page, () => null)
      }
      await page.setViewportSize({
        width: viewport.width - 160,
        height: viewport.height,
      })
      await settled()
      await page.emulateMedia({ colorScheme: 'dark' })
      await settled()
      await page.setViewportSize(viewport)
      await settled()

      expect(
        await readShifts(page),
        'layout shift after the settle mark',
      ).toEqual([])
    })
  })
})

/**
 * `02-S4` — a pin dropped on the planner's map becomes the ordinary create form, prefilled.
 *
 * The state machine, the listeners and the lookup budget are `planner-map-layer.test.tsx`'s claim;
 * this block proves the gesture reaches a real MapLibre canvas and ends in the real dialog. It runs
 * on the unmapped trip, whose empty map is also where the gesture is named, and which has no pin
 * under the pointer to take the click instead.
 *
 * **Nothing here submits**, for the reason `trips-core.spec.ts` gives: a created place is an
 * additive write to the workspace both browser projects share. The dialog is what this stage
 * added to the browser; the write behind it is the unchanged `createPlanPlaceFn`.
 */
test.describe('02-S4 — drop a pin on the map', () => {
  test.beforeEach(async ({ context, page, baseURL }, testInfo) => {
    test.setTimeout(CAMERA_JOURNEY_TIMEOUT_MS)
    test.skip(
      testInfo.project.name !== 'chromium',
      'the add control sits in the desktop rail; on a phone it is inside the places sheet',
    )
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  const CREATE_DIALOG = 'Add a place to this trip'

  /** The create form, opened by a drop, with the point it was dropped on. */
  async function expectPrefilledForm(page: Page): Promise<void> {
    const dialog = page.getByRole('dialog', { name: CREATE_DIALOG })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Latitude')).toHaveValue(/^-?\d+(\.\d+)?$/)
    await expect(dialog.getByLabel('Longitude')).toHaveValue(/^-?\d+(\.\d+)?$/)
    await expect(dialog.getByLabel('Name')).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('img', { name: 'New place' })).toHaveCount(0)
  }

  test('publishes one add control, one menu and one map option', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.unmapped)
    await onRoute(context, planRoute(tripId), async (page) => {
      await expect(page.locator('[data-part="add-place"]')).toHaveCount(1)
      await expect(page.locator('[data-part="add-place-menu"]')).toHaveCount(1)
      await expect(page.locator('[data-part="planner-canvas"]')).toHaveCount(1)

      await page.locator('[data-part="add-place-menu"]').click()
      await expect(
        page.locator('[data-part="add-place-option"][data-value="map"]'),
      ).toHaveCount(1)
      await page.keyboard.press('Escape')
    })
  })

  test('a context-click on the map opens the form at that point', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.unmapped)
    await onRoute(context, planRoute(tripId), async (page) => {
      await expect(
        page.getByText(
          'Right-click the map, or press and hold, to add a place right there.',
        ),
      ).toBeVisible()

      // The container is MapLibre's zero-height wrapper; the canvas inside it is what a pointer hits.
      await page
        .locator('[data-part="planner-canvas"] canvas')
        .click({ button: 'right' })
      await expectPrefilledForm(page)
    })
  })

  test('the keyboard arms the map from the menu and drops in the middle', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.unmapped)
    await onRoute(context, planRoute(tripId), async (page) => {
      await page.locator('[data-part="add-place-menu"]').focus()
      await page.keyboard.press('Enter')
      const option = page.locator(
        '[data-part="add-place-option"][data-value="map"]',
      )
      await expect(option).toBeVisible()
      await option.focus()
      await page.keyboard.press('Enter')

      await expect(
        page.getByRole('button', { name: 'Stop placing a new pin' }),
      ).toBeVisible()
      await settleMutations(page)
      await page.keyboard.press('Enter')
      await expectPrefilledForm(page)
    })
  })
})

/**
 * `02-S5` — a position pasted into either coordinate field fills both.
 *
 * The notations and their refusals are `src/lib/geo/__tests__/position.test.ts`'s claim, and the
 * focus and hint wiring is `place-dialog-paste.test.tsx`'s; this block proves a real
 * `ClipboardEvent` reaches the real dialog, and that the hint's reserved line keeps the dialog still
 * when it fills — at the pinned desktop viewport and at 360px, where the pair stacks and the widest
 * signed numbers wrap. Nothing submits, for the reason the `02-S4` block gives.
 */
test.describe('02-S5 — paste a position', () => {
  test.beforeEach(async ({ context, page, baseURL }, testInfo) => {
    test.setTimeout(CAMERA_JOURNEY_TIMEOUT_MS)
    test.skip(
      testInfo.project.name !== 'chromium',
      'the add control sits in the desktop rail — on a phone it is inside the places sheet, and the Layout Instability API that reports a shift is Chromium-only',
    )
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /** Pastes `text` onto `input` the way a browser does: a `ClipboardEvent` with a `DataTransfer`. */
  async function pasteInto(input: Locator, text: string): Promise<void> {
    await input.evaluate((element, payload) => {
      const data = new DataTransfer()
      data.setData('text/plain', payload)
      element.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      )
    }, text)
  }

  test('fills both fields from a geo: URI without moving the dialog', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.unmapped)
    await onRoute(context, planRoute(tripId), async (page) => {
      await page
        .getByRole('button', { name: 'Add a place', exact: true })
        .click()
      const dialog = page.getByRole('dialog', {
        name: 'Add a place to this trip',
      })
      await expect(dialog).toBeVisible()
      const lat = dialog.locator('[data-part="place-lat"]')
      const lng = dialog.locator('[data-part="place-lng"]')
      await expect(lat).toHaveCount(1)
      await expect(lng).toHaveCount(1)

      const cases = [
        {
          viewport: null,
          payload: 'geo:34.9671,135.7727',
          values: ['34.9671', '135.7727'],
        },
        {
          viewport: { width: 360, height: 780 },
          payload: 'geo:-33.856812,-151.215312',
          values: ['-33.856812', '-151.215312'],
        },
      ] as const

      for (const { viewport, payload, values } of cases) {
        if (viewport !== null) await page.setViewportSize(viewport)
        await settleMutations(page)
        await recordShifts(page)

        await pasteInto(lat, payload)

        await expect(lat).toHaveValue(values[0])
        await expect(lng).toHaveValue(values[1])
        await expect(lng).toBeFocused()
        await expect(dialog.getByRole('status')).toHaveText(
          `Read as latitude ${values[0]}, longitude ${values[1]}`,
        )
        await settleMutations(page)
        expect(
          await readShifts(page),
          `layout shift after pasting ${payload}`,
        ).toEqual([])
      }

      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
    })
  })
})

/**
 * `#663` — a stop and a day can be handed to a map application.
 *
 * The URL shapes are `src/lib/geo/__tests__/handoff.test.ts`'s claim; this block proves the
 * controls reach the real planner with an accessible name that says a new tab opens and an
 * `href` of the documented shape. Nothing is followed: a navigation would leave the suite.
 */
test.describe('663 — the map hand-off', () => {
  test.beforeEach(async ({ context, page, baseURL }, testInfo) => {
    test.setTimeout(CAMERA_JOURNEY_TIMEOUT_MS)
    test.skip(
      testInfo.project.name !== 'chromium',
      'the stop menu and the day footer sit in the desktop rail; on a phone they are inside the places sheet',
    )
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('a day offers directions and a stop offers both services', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.spanning)
    await onRoute(context, planRoute(tripId), async (page) => {
      const directions = page
        .getByRole('link', {
          name: /^Directions in Google Maps for .+\(opens in a new tab\)$/,
        })
        .first()
      await expect(directions).toBeVisible()
      await expect(directions).toHaveAttribute(
        'href',
        /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=/,
      )
      await expect(directions).toHaveAttribute('target', '_blank')
      await expect(directions).toHaveAttribute('rel', 'noopener noreferrer')

      await page
        .getByRole('button', { name: /^Actions for / })
        .first()
        .click()
      const google = page.getByRole('menuitem', {
        name: /^Open .+ in Google Maps \(opens in a new tab\)$/,
      })
      await expect(google).toHaveAttribute(
        'href',
        /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
      )
      await expect(
        page.getByRole('menuitem', {
          name: /^Open .+ in OpenStreetMap \(opens in a new tab\)$/,
        }),
      ).toHaveAttribute(
        'href',
        /^https:\/\/www\.openstreetmap\.org\/\?mlat=.+&mlon=/,
      )
      await page.keyboard.press('Escape')
    })
  })
})

function annotate(camera: Camera): void {
  test
    .info()
    .annotations.push({ type: 'camera', description: describeCamera(camera) })
}

function boxOf(points: ReadonlyArray<readonly [number, number]>) {
  const lngs = points.map(([lng]) => lng)
  const lats = points.map(([, lat]) => lat)
  return {
    west: Math.min(...lngs),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    north: Math.max(...lats),
  }
}

function unique(
  points: ReadonlyArray<readonly [number, number]>,
): Array<readonly [number, number]> {
  const seen = new Map<string, readonly [number, number]>()
  for (const point of points) seen.set(point.join(','), point)
  return [...seen.values()]
}

type ShiftLog = { __layoutShifts?: Array<string> }

/** Start recording every layout shift no input caused, from this moment on. */
async function recordShifts(page: Page): Promise<void> {
  await page.evaluate(() => {
    const log = window as unknown as ShiftLog
    log.__layoutShifts = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >) {
        if (!entry.hadRecentInput) {
          log.__layoutShifts?.push(
            `${entry.value.toFixed(4)} at ${entry.startTime.toFixed(0)}ms`,
          )
        }
      }
    }).observe({ type: 'layout-shift' })
  })
}

async function readShifts(page: Page): Promise<Array<string>> {
  return page.evaluate(
    () => (window as unknown as ShiftLog).__layoutShifts ?? [],
  )
}
