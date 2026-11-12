import '#/components/ui/__tests__/test-env'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import Shell from '#/lib/i18n/messages/en/shell'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import Auth from '#/lib/i18n/messages/en/auth'
import { GalleryPreviewView } from '../preview'
import type { GalleryPreviewResult } from '#/server/community/snapshot'

const initialFields = {
  tripId: 'trip',
  publicTitle: 'A public trip',
  summary: 'All the details',
  attribution: 'Traveller',
  showDates: false,
}
const result = {
  status: 'ready' as const,
  previewId: 'opaque',
  expiresAt: Date.now() + 900000,
  document: {
    version: 1 as const,
    ...initialFields,
    countryCodes: ['PL', 'JP'],
    days: [
      {
        order: 1,
        title: '',
        places: [
          {
            name: 'Complete name',
            category: null,
            order: 0,
            coordinates: { lat: 0, lng: -0.0000001 },
          },
        ],
      },
      { order: 2, title: 'Final day', places: [] },
    ],
  },
}
// The input-only trip identifier is never part of the captured document.
const { tripId: _tripId, ...snapshot } = result.document
const ready = { ...result, document: snapshot }
const messages = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
  ...namespaceCatalogue('auth', Auth),
}
afterEach(cleanup)
function fixture(
  onPreview = vi.fn(async (): Promise<GalleryPreviewResult> => ready),
  onConfirm = vi.fn(),
) {
  render(
    <I18nProvider locale="en" messages={messages}>
      <GalleryPreviewView
        initialFields={initialFields}
        onPreview={onPreview}
        onConfirm={onConfirm}
      />
    </I18nProvider>,
  )
  return { onPreview, onConfirm }
}

it('renders every public value and explicit empties, then confirms only its opaque id', async () => {
  const user = userEvent.setup()
  const { onConfirm } = fixture()
  await user.click(
    screen.getByRole('button', { name: 'Preview what will be shared' }),
  )
  const region = await screen.findByRole('region', { name: 'Gallery preview' })
  for (const value of [
    'A public trip',
    'All the details',
    'Traveller',
    'Snapshot version',
    'PL',
    'JP',
    'Day 1',
    'Day 2',
    'Final day',
    'Complete name',
    'Category',
    'Empty',
    '-1e-7',
    'No',
  ])
    expect(region.textContent).toContain(value)
  expect(region.getAttribute('tabindex')).toBe('0')
  expect(screen.getByText(/Travellers, notes, files/)).toBeDefined()
  expect(
    screen.getByText(/personal information before confirming/),
  ).toBeDefined()
  await user.click(screen.getByRole('button', { name: 'Confirm this preview' }))
  expect(onConfirm).toHaveBeenCalledExactlyOnceWith('opaque')
  expect(document.querySelector('h2')).toBe(document.activeElement)
})

it('invalidates preview on every field edit and ignores a late response', async () => {
  let resolve: (value: GalleryPreviewResult) => void = () => {
    throw new Error('Capture not started')
  }
  fixture(
    vi.fn(
      () =>
        new Promise<GalleryPreviewResult>((done) => {
          resolve = done
        }),
    ),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Preview what will be shared' }),
  )
  expect(document.activeElement?.tagName).toBe('H2')
  fireEvent.change(screen.getByRole('textbox', { name: 'Public title' }), {
    target: { value: 'Changed' },
  })
  await act(async () => resolve(ready))
  expect(screen.queryByRole('region')).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Confirm this preview' }),
  ).toBeNull()
})

it('keeps fields and accessible focus after a failed preview, and allows retry', async () => {
  const onPreview = vi.fn(async (): Promise<GalleryPreviewResult> => ({
    status: 'capture-unavailable',
  }))
  fixture(onPreview)
  fireEvent.click(
    screen.getByRole('button', { name: 'Preview what will be shared' }),
  )
  expect(
    await screen.findByText(/We could not prepare this preview/),
  ).toBeDefined()
  expect(document.activeElement).toBe(
    screen.getByRole('status', { name: 'Gallery preview' }),
  )
  expect(
    (screen.getByRole('textbox', { name: 'Public title' }) as HTMLInputElement)
      .value,
  ).toBe(initialFields.publicTitle)
  expect(
    screen.queryByRole('button', { name: 'Confirm this preview' }),
  ).toBeNull()
  onPreview.mockResolvedValueOnce(ready)
  fireEvent.click(
    screen.getByRole('button', { name: 'Preview what will be shared' }),
  )
  expect(await screen.findByRole('region')).toBeDefined()
})

it('refuses expired confirmation even before a throttled timer fires', async () => {
  fixture(vi.fn(async () => ({ ...ready, expiresAt: 0 })))
  fireEvent.click(
    screen.getByRole('button', { name: 'Preview what will be shared' }),
  )
  const confirm = await screen.findByRole('button', {
    name: 'Confirm this preview',
  })
  expect(confirm.hasAttribute('disabled')).toBe(true)
  expect(
    screen.getByRole('status', { name: 'Gallery preview' }).textContent,
  ).toContain('This preview expired')
})

it.each(['Public title', 'Summary', 'Display name', 'Include trip dates'])(
  'clears confirmed content when %s changes',
  async (label) => {
    const user = userEvent.setup()
    fixture()
    await user.click(
      screen.getByRole('button', { name: 'Preview what will be shared' }),
    )
    await screen.findByRole('region')
    if (label === 'Include trip dates')
      await user.click(screen.getByRole('checkbox', { name: label }))
    else
      fireEvent.change(screen.getByRole('textbox', { name: label }), {
        target: { value: 'Changed value' },
      })
    expect(screen.queryByRole('region')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Confirm this preview' }),
    ).toBeNull()
  },
)

it('keeps the last entry of a 1000-place document keyboard-readable without shortening it', async () => {
  const user = userEvent.setup()
  const complete = {
    ...ready,
    document: {
      ...ready.document,
      days: [
        {
          order: 1,
          places: Array.from({ length: 1000 }, (_, order) => ({
            order,
            name: `Place ${order}`,
            category: null,
          })),
        },
      ],
    },
  }
  fixture(vi.fn(async () => complete))
  await user.click(
    screen.getByRole('button', { name: 'Preview what will be shared' }),
  )
  const region = await screen.findByRole('region')
  expect(region.textContent).toContain('Place 999')
  region.focus()
  expect(document.activeElement).toBe(region)
  await user.tab()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Confirm this preview' }),
  )
})

it('labels the length refusal, preserves the full value and focuses its error summary', async () => {
  const onPreview = vi.fn(async (): Promise<GalleryPreviewResult> => ready)
  render(
    <I18nProvider locale="en" messages={messages}>
      <GalleryPreviewView
        initialFields={{ ...initialFields, publicTitle: 'a'.repeat(121) }}
        onPreview={onPreview}
        onConfirm={vi.fn()}
      />
    </I18nProvider>,
  )
  const input = screen.getByRole('textbox', {
    name: 'Public title',
  }) as HTMLInputElement
  const form = input.closest('form')
  if (!form) throw new Error('Missing preview form')
  fireEvent.submit(form)
  expect(onPreview).not.toHaveBeenCalled()
  expect(input.value).toHaveLength(121)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(
    (input.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' '),
  ).toContain('120')
  expect(document.activeElement).toBe(
    screen.getByRole('status', { name: 'Gallery preview' }),
  )
})

it('uses the localized field refusal instead of browser-native required-field copy', async () => {
  const user = userEvent.setup()
  const { onPreview } = fixture()
  const title = screen.getByRole('textbox', { name: 'Public title' })
  fireEvent.change(title, { target: { value: '' } })
  await user.click(
    screen.getByRole('button', { name: 'Preview what will be shared' }),
  )
  expect(title.getAttribute('aria-invalid')).toBe('true')
  expect(
    screen.getByRole('status', { name: 'Gallery preview' }).textContent,
  ).toContain('Check the fields')
  expect(onPreview).not.toHaveBeenCalled()
})
