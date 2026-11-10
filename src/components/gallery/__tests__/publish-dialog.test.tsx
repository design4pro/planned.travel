import '#/components/ui/__tests__/test-env'
import { useState } from 'react'
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
import { GalleryPublishDialog } from '../publish-dialog'
import type {
  GalleryActionResult,
  GalleryPublication,
  GalleryPublishDialogProps,
} from '../publish-dialog'

const fields = {
  tripId: 'trip',
  publicTitle: 'Trip title',
  summary: 'Summary text',
  attribution: 'Traveller',
  showDates: false,
}
const snapshot = {
  version: 1 as const,
  publicTitle: fields.publicTitle,
  summary: fields.summary,
  attribution: fields.attribution,
  showDates: false,
  countryCodes: ['PL'],
  days: [],
}
const publication: GalleryPublication = {
  status: 'in_review',
  preparation: 'pending',
  version: 2,
  liveVersion: 1,
  slug: 'trip',
  submittedAt: '2026-11-01',
  ...fields,
}
const messages = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
  ...namespaceCatalogue('auth', Auth),
}
afterEach(cleanup)
function fixture(overrides: Partial<GalleryPublishDialogProps> = {}) {
  const props: GalleryPublishDialogProps = {
    open: true,
    onOpenChange: vi.fn(),
    initialFields: fields,
    publication: null,
    canPublish: true,
    onLoad: vi.fn(async () => null),
    onPreview: vi.fn(async () => ({
      status: 'ready' as const,
      previewId: 'preview',
      expiresAt: Date.now() + 900000,
      document: snapshot,
    })),
    onSubmit: vi.fn(async () => ({ status: 'ok' as const, publication })),
    onWithdraw: vi.fn(async () => ({
      status: 'ok' as const,
      publication: { ...publication, status: 'withdrawn' as const },
    })),
    onRetry: vi.fn(async () => ({ status: 'ok' as const, publication })),
    ...overrides,
  }
  render(
    <I18nProvider locale="en" messages={messages}>
      <GalleryPublishDialog {...props} />
    </I18nProvider>,
  )
  return props
}
it('requires exact preview confirmation and preserves text after stale submission', async () => {
  const user = userEvent.setup()
  const props = fixture({
    onSubmit: vi.fn(async () => ({ status: 'stale-preview' as const })),
  })
  expect(
    screen.getByRole('dialog').getAttribute('aria-labelledby'),
  ).toBeTruthy()
  expect(document.activeElement?.textContent).toBe(
    'Share this trip with the community',
  )
  await user.click(
    screen.getByRole('button', { name: 'Preview what will be shared' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Submit for review' }),
  )
  expect(await screen.findByText(/This trip changed/)).toBeDefined()
  expect(props.onSubmit).toHaveBeenCalledWith({
    ...fields,
    previewId: 'preview',
  })
  expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull()
  expect(
    (screen.getByRole('textbox', { name: 'Public title' }) as HTMLInputElement)
      .value,
  ).toBe('Trip title')
})
it.each([
  ['pending', 'Version 1 is live; preparing version 2 for review.'],
  ['failed', 'Version 1 is live; preparation of version 2 failed.'],
  ['ready', 'Version 1 is live; version 2 is in review.'],
] as const)('separates live and %s updates', (preparation, text) => {
  fixture({ publication: { ...publication, preparation } })
  expect(screen.getByText(text)).toBeDefined()
  expect(screen.getByRole('link').getAttribute('href')).toBe('/gallery/trip')
})
it.each(['in_review', 'published'] as const)(
  'does not link or announce %s without a live version',
  (status) => {
    fixture({
      publication: {
        ...publication,
        status,
        preparation: 'ready',
        liveVersion: null,
      },
    })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText('Published')).toBeNull()
  },
)
it('keeps non-admin explanation keyboard readable and removes mutation actions', () => {
  fixture({ canPublish: false, publication })
  const explanation = screen.getByText('A workspace admin can submit a trip.')
  expect(explanation.getAttribute('tabindex')).toBe('0')
  expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull()
})
it('focuses withdrawal cancel, returns focus on cancel, and preserves live version on failure', async () => {
  const user = userEvent.setup()
  fixture({
    publication,
    onWithdraw: vi.fn(async () => ({ status: 'storage-full' as const })),
  })
  const withdraw = screen.getByRole('button', { name: 'Withdraw' })
  await user.click(withdraw)
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Cancel' }),
  )
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(document.activeElement).toBe(withdraw)
  await user.click(withdraw)
  await user.click(screen.getByRole('button', { name: 'Confirm withdrawal' }))
  expect(await screen.findByText(/Not enough workspace storage/)).toBeDefined()
  expect(screen.getByRole('link')).toBeDefined()
  expect(document.activeElement?.textContent).toContain(
    'Not enough workspace storage',
  )
})
it('supports load failure and reload without losing fields', async () => {
  const onLoad = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(null)
  const user = userEvent.setup()
  fixture({ publication: undefined, onLoad })
  expect(
    await screen.findByText('We could not load the publication.'),
  ).toBeDefined()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(
    await screen.findByRole('textbox', { name: 'Public title' }),
  ).toBeDefined()
  expect(onLoad).toHaveBeenCalledTimes(2)
})
it('traps focus and closes with Escape', async () => {
  const user = userEvent.setup()
  const props = fixture()
  await user.tab({ shift: true })
  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  await user.tab()
  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
  expect(props.onOpenChange).toHaveBeenCalledWith(false)
})

it.each([
  [null, 'Never shared'],
  [{ ...publication, liveVersion: null, preparation: 'ready' }, 'In review'],
  [
    { ...publication, liveVersion: null, preparation: 'running' },
    'Preparing for review',
  ],
  [
    { ...publication, liveVersion: null, preparation: 'failed' },
    'Preparation failed',
  ],
  [
    {
      ...publication,
      status: 'changes_requested',
      preparation: 'ready',
      curatorNote: 'Please revise this title',
    },
    'Changes requested',
  ],
  [
    { ...publication, status: 'published', preparation: 'ready', version: 1 },
    'Published',
  ],
  [{ ...publication, status: 'withdrawn' }, 'Withdrawn'],
] as const)('renders the %s face', (value, label) => {
  fixture({ publication: value })
  expect(screen.getAllByText(label).length).toBeGreaterThan(0)
  if (value?.status === 'changes_requested') {
    expect(screen.getByText('Please revise this title')).toBeDefined()
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Public title',
        }) as HTMLInputElement
      ).value,
    ).toBe(publication.publicTitle)
  }
  if (value?.status === 'withdrawn')
    expect(screen.queryByRole('link')).toBeNull()
})
it('keeps live data and disables mutation during a pending retry', async () => {
  const user = userEvent.setup()
  let resolve: (value: GalleryActionResult) => void = () => {
    throw new Error('not started')
  }
  const onRetry = vi.fn(
    () =>
      new Promise<GalleryActionResult>((done) => {
        resolve = done
      }),
  )
  fixture({ publication: { ...publication, preparation: 'failed' }, onRetry })
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(
    screen.getByRole('button', { name: 'Try again' }).hasAttribute('disabled'),
  ).toBe(true)
  expect(screen.getByRole('link')).toBeDefined()
  await act(async () => resolve({ status: 'ok', publication }))
  expect(
    await screen.findByText(
      'Version 1 is live; preparing version 2 for review.',
    ),
  ).toBeDefined()
})
it.each([
  'quota-exceeded',
  'too-large',
  'storage-full',
  'unavailable',
] as const)(
  'preserves editable text and the live version after %s',
  async (status) => {
    const user = userEvent.setup()
    const props = fixture({
      publication: { ...publication, status: 'changes_requested' },
      onSubmit: vi.fn(async () => ({ status })),
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Public title' }), {
      target: { value: 'Edited title' },
    })
    await user.click(
      screen.getByRole('button', { name: 'Preview what will be shared' }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Submit for review' }),
    )
    expect(props.onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link')).toBeDefined()
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Public title',
        }) as HTMLInputElement
      ).value,
    ).toBe('Edited title')
  },
)
it('confirms successful link copying and handles unsupported clipboard', async () => {
  const user = userEvent.setup()
  fixture({ publication })
  await user.click(screen.getByRole('button', { name: 'Copy link' }))
  expect(await screen.findByText('Link copied')).toBeDefined()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  })
  await user.click(screen.getByRole('button', { name: 'Copy link' }))
  expect(
    await screen.findByText('We could not copy the link. Try again.'),
  ).toBeDefined()
})

it('restores focus to the opener after closing the controlled dialog', async () => {
  const user = userEvent.setup()
  const callbacks = {
    initialFields: fields,
    publication: null,
    canPublish: true,
    onLoad: async () => null,
    onPreview: vi.fn(),
    onSubmit: vi.fn(),
    onWithdraw: vi.fn(),
    onRetry: vi.fn(),
  }
  function Harness() {
    const [open, setOpen] = useState(false)
    return (
      <I18nProvider locale="en" messages={messages}>
        <button onClick={() => setOpen(true)}>Open</button>
        <GalleryPublishDialog
          {...callbacks}
          open={open}
          onOpenChange={setOpen}
        />
      </I18nProvider>
    )
  }
  render(<Harness />)
  const opener = screen.getByRole('button', { name: 'Open' })
  await user.click(opener)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
})

it('preserves edits and the live version after reload fails, invalidating confirmation', async () => {
  const user = userEvent.setup()
  fixture({
    publication: { ...publication, status: 'changes_requested' },
    onLoad: vi.fn(async () => {
      throw new Error('offline')
    }),
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Public title' }), {
    target: { value: 'Keep these edits' },
  })
  await user.click(
    screen.getByRole('button', { name: 'Preview what will be shared' }),
  )
  await screen.findByRole('button', { name: 'Submit for review' })
  await user.click(screen.getByRole('button', { name: 'Refresh' }))
  await screen.findByText('We could not load the publication.')
  expect(
    (screen.getByRole('textbox', { name: 'Public title' }) as HTMLInputElement)
      .value,
  ).toBe('Keep these edits')
  expect(screen.getByRole('link')).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull()
})

it('shows preparation of an update even while the previous review status is published', () => {
  fixture({ publication: { ...publication, status: 'published' } })
  expect(
    screen.getByText('Version 1 is live; preparing version 2 for review.'),
  ).toBeDefined()
  expect(screen.getByRole('link')).toBeDefined()
})
