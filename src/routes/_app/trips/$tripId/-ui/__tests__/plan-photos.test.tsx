// @vitest-environment jsdom
import { act, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider, loadCatalogue, createTranslator } from '#/lib/i18n'
import { PlaceDialog, emptyDraft } from '../plan-actions'
import { usePlanPhotoVersions } from '../use-plan-photo-versions'
import { mapPlacesOf, planModel } from '../plan-model'
import { planBoard } from '../plan-board'
import { board, day, place, stop } from './plan-board-fixtures'

const messages = await loadCatalogue('en')
const photo = {
  source: 'legacy' as const,
  imageUrl: 'https://example.test/new.jpg',
  version: 2,
}
const current = {
  ...board([day('d1', 1, [stop('a1', 'p1', 0)])]),
  places: [{ ...place('p1'), photo }],
}

describe('planner photo projection', () => {
  it('keeps the acknowledged selection when an older refresh settles later, but resets for another trip', async () => {
    const { result, rerender } = renderHook(usePlanPhotoVersions, {
      initialProps: current,
    })
    let release: (() => void) | undefined
    const older = new Promise<void>((resolve) => {
      release = resolve
    })
    const refresh = older.then(() =>
      rerender({
        ...current,
        editable: false,
        places: [
          {
            ...place('p1'),
            photo: {
              ...photo,
              version: 1,
              imageUrl: 'https://example.test/old.jpg',
            },
          },
        ],
      }),
    )
    rerender({ ...current })
    await act(async () => {
      release?.()
      await refresh
    })
    expect(result.current.places[0]?.photo).toEqual(photo)
    expect(result.current.editable).toBe(false)
    rerender({
      ...current,
      tripId: 't2',
      places: [{ ...place('p1'), photo: { ...photo, version: 0 } }],
    })
    expect(result.current.places[0]?.photo?.version).toBe(0)
  })

  it('passes the same selection to scheduled rows, places rail rows and map details', () => {
    const order = planBoard(
      current,
      { tripId: 't1', canWrite: true, notes: [] },
      { tripId: 't1', transports: [] },
    ).serverOrder
    const model = planModel(current, order, createTranslator('en', messages))
    const row = model.rowsByPlace.get('p1')
    expect(row?.photo).toEqual(photo)
    if (!row) throw new Error('missing row')
    expect(mapPlacesOf([row], new Map())[0]?.photo).toEqual(photo)
  })

  it('shows the saved photo and explains why editing is unavailable without offering an upload input', () => {
    render(
      <I18nProvider locale="en" messages={messages}>
        <PlaceDialog
          open
          onOpenChange={() => {}}
          mode="edit"
          categories={[]}
          days={[]}
          initial={emptyDraft}
          saving={false}
          error={null}
          onSubmit={() => {}}
          photoPlace={current.places[0]}
        />
      </I18nProvider>,
    )
    const button = screen.getByRole('button', { name: 'Edit image' })
    expect(button.getAttribute('disabled')).not.toBeNull()
    const description = document.getElementById(
      button.getAttribute('aria-describedby') ?? '',
    )
    expect(description?.textContent).toBe(
      'Image uploads and editing are unavailable. The current image is kept.',
    )
    expect(document.querySelector('input[type="file"]')).toBeNull()
    expect(document.querySelector('img')?.getAttribute('src')).toBe(
      photo.imageUrl,
    )
  })
})
