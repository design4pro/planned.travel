import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Settings from '#/lib/i18n/messages/en/settings'
import Shell from '#/lib/i18n/messages/en/shell'
import Trips from '#/lib/i18n/messages/en/trips'
import Ui from '#/lib/i18n/messages/en/ui'
import { NewTripDialog } from '../new-trip-dialog'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('settings', Settings),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('ui', Ui),
}

/** `createTripFn` reaches `cloudflare:workers`; the test only needs a write that does not settle. */
const server = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
const upload = vi.hoisted(() => ({ upload: vi.fn() }))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))
const navigation = vi.hoisted(() => ({ navigate: vi.fn() }))
/** The workspace role the shell carries; the dialog reads it to decide whether to link invitations. */
const shell = vi.hoisted(() => ({
  role: 'owner' as 'owner' | 'admin' | 'member',
}))
const roster = vi.hoisted(() => ({ load: vi.fn(), add: vi.fn() }))

vi.mock('../../-server/trip-lifecycle', () => ({
  createTripFn: server.create,
  updateTripFn: server.update,
}))
vi.mock('../../-server/roster', () => ({ loadWorkspaceRoster: roster.load }))
vi.mock('../../trips/$tripId/-server/people', () => ({
  addTripMemberFn: roster.add,
}))
vi.mock('#/components/modules/files/upload', () => ({
  uploadFile: upload.upload,
}))
vi.mock('@tanstack/react-router', async () => {
  const { createElement } = await import('react')
  return {
    useRouter: () => router,
    useNavigate: () => navigation.navigate,
    useRouteContext: () => ({ shell }),
    Link: ({
      to,
      children,
      target,
    }: {
      to: string
      children: React.ReactNode
      target?: string
    }) => createElement('a', { href: to, target }, children),
  }
})

beforeEach(() => {
  shell.role = 'owner'
  roster.load.mockReset()
  roster.load.mockResolvedValue([])
  roster.add.mockReset()
  navigation.navigate.mockReset()
})
afterEach(cleanup)

describe('NewTripDialog', () => {
  it('cannot be dismissed while the trip is being saved', async () => {
    server.create.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en" messages={EN}>
        <NewTripDialog />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'New trip' }))
    await user.type(await screen.findByLabelText(/Trip name/), 'Lisbon')
    await user.click(screen.getByRole('button', { name: 'Create trip' }))
    expect(server.create).toHaveBeenCalledOnce()

    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('sends a duration, with no dates, as a day count', async () => {
    server.create.mockReset()
    server.create.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en" messages={EN}>
        <NewTripDialog />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'New trip' }))
    await user.type(await screen.findByLabelText(/Trip name/), 'Open-ended')
    await user.type(await screen.findByLabelText('Duration in days'), '6')
    await user.click(screen.getByRole('button', { name: 'Create trip' }))

    expect(server.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dayCount: 6,
        startDate: '',
        endDate: '',
        reminderDays: 3,
      }),
    })
  })

  describe('with a cover image', () => {
    const cover = new File(['x'], 'beach.png', { type: 'image/png' })

    beforeEach(() => {
      server.create.mockReset()
      server.update.mockReset()
      upload.upload.mockReset()
      router.invalidate.mockReset()
    })

    async function createWithCover() {
      URL.createObjectURL = vi.fn(() => 'blob:preview')
      URL.revokeObjectURL = vi.fn()
      server.create.mockResolvedValue({ tripId: 'trip-9' })
      const user = userEvent.setup()
      render(
        <I18nProvider locale="en" messages={EN}>
          <NewTripDialog />
        </I18nProvider>,
      )
      await user.click(screen.getByRole('button', { name: 'New trip' }))
      await user.type(await screen.findByLabelText(/Trip name/), 'Lisbon')
      const input = document.querySelector('input[type="file"]')
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('no file input')
      }
      await user.upload(input, cover)
      return user
    }

    it('creates the trip, uploads the image against it, then records it as the cover', async () => {
      upload.upload.mockResolvedValue({ ok: true, file: { id: 'file-1' } })
      server.update.mockResolvedValue(undefined)
      const user = await createWithCover()

      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      await waitFor(() => {
        expect(server.update).toHaveBeenCalledWith({
          data: { tripId: 'trip-9', coverFileId: 'file-1' },
        })
      })
      expect(server.create).toHaveBeenCalledOnce()
      expect(upload.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: 'trip-9',
          file: cover,
          kind: 'image',
        }),
      )
      expect(server.create.mock.invocationCallOrder[0]).toBeLessThan(
        upload.upload.mock.invocationCallOrder[0],
      )
    })

    it('keeps the trip and offers a retry when the upload fails, without a second create', async () => {
      upload.upload.mockResolvedValue({ ok: false, code: 'x', message: 'no' })
      const user = await createWithCover()

      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      const alert = await screen.findByText(
        /could not be uploaded as its cover/,
      )
      expect(alert.textContent).toContain('“beach.png”')
      expect(
        screen.getByRole('button', { name: 'Open the trip without a cover' }),
      ).toBeTruthy()

      upload.upload.mockResolvedValue({ ok: true, file: { id: 'file-2' } })
      server.update.mockResolvedValue(undefined)
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      await waitFor(() => {
        expect(server.update).toHaveBeenCalledWith({
          data: { tripId: 'trip-9', coverFileId: 'file-2' },
        })
      })
      expect(server.create).toHaveBeenCalledOnce()
    })

    it('does not upload a stored image twice when only the cover write failed', async () => {
      upload.upload.mockResolvedValue({ ok: true, file: { id: 'file-1' } })
      server.update.mockRejectedValueOnce(new Error('boom'))
      const user = await createWithCover()

      await user.click(screen.getByRole('button', { name: 'Create trip' }))
      await screen.findByRole('button', { name: 'Try again' })

      server.update.mockResolvedValue(undefined)
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      await waitFor(() => {
        expect(server.update).toHaveBeenCalledTimes(2)
      })
      expect(upload.upload).toHaveBeenCalledOnce()
    })
  })

  describe('with people', () => {
    const ana = { userId: 'u-ana', name: 'Ana Souza', image: null }
    const ben = { userId: 'u-ben', name: 'Ben Okafor', image: null }
    const cy = { userId: 'u-cy', name: 'Cy Lindqvist', image: null }
    const di = { userId: 'u-di', name: 'Di Moreau', image: null }

    beforeEach(() => {
      server.create.mockReset()
      server.update.mockReset()
      upload.upload.mockReset()
      router.invalidate.mockReset()
      server.create.mockResolvedValue({ tripId: 'trip-7' })
      roster.load.mockResolvedValue([ana, ben, cy, di])
    })

    async function openAndName(role: typeof shell.role = 'owner') {
      shell.role = role
      const user = userEvent.setup()
      render(
        <I18nProvider locale="en" messages={EN}>
          <NewTripDialog />
        </I18nProvider>,
      )
      await user.click(screen.getByRole('button', { name: 'New trip' }))
      await user.type(await screen.findByLabelText(/Trip name/), 'Lisbon')
      return user
    }

    async function choose(
      user: ReturnType<typeof userEvent.setup>,
      ...names: Array<string>
    ) {
      await user.click(await screen.findByRole('button', { name: 'People' }))
      for (const name of names) {
        await user.click(await screen.findByRole('option', { name }))
      }
      await user.keyboard('{Escape}')
    }

    it('fetches the roster once, when the dialog opens and not before', async () => {
      const user = userEvent.setup()
      render(
        <I18nProvider locale="en" messages={EN}>
          <NewTripDialog />
        </I18nProvider>,
      )
      expect(roster.load).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'New trip' }))
      await screen.findByRole('button', { name: 'People' })

      expect(roster.load).toHaveBeenCalledOnce()
    })

    it('announces three skeleton rows while the roster loads', async () => {
      roster.load.mockReturnValue(new Promise(() => {}))
      await openAndName()

      const loading = await screen.findByRole('status', {
        name: 'Loading the people in your workspace',
      })
      expect(loading.getAttribute('aria-busy')).toBe('true')
      expect(loading.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3)
    })

    it('lists the roster and gives each chosen person a role that starts as editor', async () => {
      const user = await openAndName()

      await choose(user, 'Ana Souza', 'Ben Okafor')

      const roles = await screen.findByRole('list', {
        name: 'Chosen people and their roles',
      })
      expect(roles.textContent).toContain('Ana Souza')
      expect(
        screen.getByRole('combobox', { name: 'Role · Ana Souza' }).textContent,
      ).toContain('Editor')
      expect(
        screen.getByRole('combobox', { name: 'Role · Ben Okafor' }).textContent,
      ).toContain('Editor')
    })

    it('offers viewer but never owner', async () => {
      const user = await openAndName()
      await choose(user, 'Ana Souza')

      await user.click(
        screen.getByRole('combobox', { name: 'Role · Ana Souza' }),
      )

      expect(screen.getByRole('option', { name: 'Viewer' })).toBeTruthy()
      expect(screen.queryByRole('option', { name: 'Owner' })).toBeNull()
    })

    it('creates the trip first, then adds each person once with the chosen role', async () => {
      roster.add.mockResolvedValue({ ok: true, memberId: 'm-1' })
      const user = await openAndName()
      await choose(user, 'Ana Souza', 'Ben Okafor')
      await user.click(
        screen.getByRole('combobox', { name: 'Role · Ben Okafor' }),
      )
      await user.click(screen.getByRole('option', { name: 'Viewer' }))

      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      await waitFor(() => {
        expect(navigation.navigate).toHaveBeenCalledWith({
          to: '/trips/$tripId/plan',
          params: { tripId: 'trip-7' },
        })
      })
      expect(server.create).toHaveBeenCalledOnce()
      expect(roster.add.mock.calls).toEqual([
        [{ data: { tripId: 'trip-7', userId: 'u-ana', role: 'editor' } }],
        [{ data: { tripId: 'trip-7', userId: 'u-ben', role: 'viewer' } }],
      ])
      expect(server.create.mock.invocationCallOrder[0]).toBeLessThan(
        roster.add.mock.invocationCallOrder[0],
      )
      // Members are not part of the trip's own payload.
      expect(JSON.stringify(server.create.mock.calls[0])).not.toContain('u-ana')
    })

    it('does not call the people write when nobody was chosen', async () => {
      const user = await openAndName()
      await screen.findByRole('button', { name: 'People' })

      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      await waitFor(() => {
        expect(navigation.navigate).toHaveBeenCalled()
      })
      expect(roster.add).not.toHaveBeenCalled()
    })

    it('names everyone who was not added, keeps the trip, and continues to People', async () => {
      roster.add.mockImplementation(
        async ({ data }: { data: { userId: string } }) => {
          if (data.userId === 'u-ben') {
            return { ok: false, reason: 'not-in-workspace' }
          }
          if (data.userId === 'u-cy') {
            return { ok: false, reason: 'already-on-trip' }
          }
          if (data.userId === 'u-di') {
            throw new Error('network')
          }
          return { ok: true, memberId: 'm-1' }
        },
      )
      const user = await openAndName()
      await choose(user, 'Ana Souza', 'Ben Okafor', 'Cy Lindqvist', 'Di Moreau')

      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      const notice = await screen.findByText(
        'The trip was created, but not everyone was added',
      )
      const region = notice.closest('[tabindex="-1"]')
      expect(region).toBe(document.activeElement)
      const lines = Array.from(region?.querySelectorAll('li') ?? []).map(
        (line) => line.textContent,
      )
      expect(lines).toEqual([
        'Ben Okafor is no longer in this workspace, so was not added.',
        'Cy Lindqvist was already on this trip.',
        'Di Moreau could not be confirmed. Check People to see whether they were added.',
      ])
      expect(screen.queryByLabelText(/Trip name/)).toBeNull()
      expect(server.create).toHaveBeenCalledOnce()
      expect(navigation.navigate).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => {
        expect(navigation.navigate).toHaveBeenCalledWith({
          to: '/trips/$tripId/people',
          params: { tripId: 'trip-7' },
        })
      })
      expect(server.create).toHaveBeenCalledOnce()
    })

    it('puts the people and the cover in one notice, and keeps the people after a successful retry', async () => {
      URL.createObjectURL = vi.fn(() => 'blob:preview')
      URL.revokeObjectURL = vi.fn()
      roster.add.mockResolvedValue({ ok: false, reason: 'not-in-workspace' })
      upload.upload.mockResolvedValue({ ok: false, code: 'x', message: 'no' })
      const user = await openAndName()
      const input = document.querySelector('input[type="file"]')
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('no file input')
      }
      await user.upload(
        input,
        new File(['x'], 'beach.png', { type: 'image/png' }),
      )
      await choose(user, 'Ben Okafor')

      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      await screen.findByText(
        'The trip was created, but not everything was added',
      )
      expect(
        screen.getByText(/could not be uploaded as its cover/),
      ).toBeTruthy()
      expect(screen.getByText(/Ben Okafor is no longer/)).toBeTruthy()

      upload.upload.mockResolvedValue({ ok: true, file: { id: 'file-2' } })
      server.update.mockResolvedValue(undefined)
      // Beside a list of people the label says it retries the cover only.
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
      await user.click(
        screen.getByRole('button', { name: 'Try the cover again' }),
      )

      await waitFor(() => {
        expect(server.update).toHaveBeenCalledOnce()
      })
      await screen.findByText(
        'The trip was created, but not everyone was added',
      )
      expect(
        screen.queryByText(/could not be uploaded as its cover/),
      ).toBeNull()
      expect(screen.getByText(/Ben Okafor is no longer/)).toBeTruthy()
      expect(navigation.navigate).not.toHaveBeenCalled()
      expect(server.create).toHaveBeenCalledOnce()
      expect(roster.add).toHaveBeenCalledOnce()
    })

    it('does not let a double tap on Continue navigate twice', async () => {
      roster.add.mockResolvedValue({ ok: false, reason: 'already-on-trip' })
      router.invalidate.mockReturnValue(new Promise(() => {}))
      const user = await openAndName()
      await choose(user, 'Cy Lindqvist')
      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      const proceed = await screen.findByRole('button', { name: 'Continue' })
      await user.click(proceed)
      await user.click(proceed)

      expect(router.invalidate).toHaveBeenCalledOnce()
    })

    it('replaces the picker with a link to invitations for a workspace owner', async () => {
      roster.load.mockResolvedValue([])
      await openAndName('owner')

      expect(
        await screen.findByText(
          'You are the only person in this workspace so far.',
        ),
      ).toBeTruthy()
      const link = screen.getByRole('link', {
        name: 'Invite people to the workspace',
      })
      expect(link.getAttribute('href')).toBe('/settings/organization')
      // The form is on this page: a same-tab visit would drop what was typed.
      expect(link.getAttribute('target')).toBe('_blank')
      expect(screen.queryByRole('button', { name: 'People' })).toBeNull()
    })

    it('shows an admin the link too, and a plain member the text without it', async () => {
      roster.load.mockResolvedValue([])
      await openAndName('member')

      expect(
        await screen.findByText(
          'A workspace owner or admin can invite more people.',
        ),
      ).toBeTruthy()
      expect(screen.queryByRole('link')).toBeNull()

      cleanup()
      await openAndName('admin')
      expect(
        await screen.findByRole('link', {
          name: 'Invite people to the workspace',
        }),
      ).toBeTruthy()
    })

    it('still lets the trip be created when the roster could not be loaded', async () => {
      roster.load.mockRejectedValue(new Error('offline'))
      const user = await openAndName()

      expect(
        await screen.findByText(
          /The people in your workspace could not be loaded/,
        ),
      ).toBeTruthy()
      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      await waitFor(() => {
        expect(server.create).toHaveBeenCalledOnce()
      })
    })

    it('starts empty after Cancel, so a pick the next opening cannot show is never submitted', async () => {
      const user = await openAndName()
      await choose(user, 'Ana Souza')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      // The next opening cannot read the roster, so it shows no picker at all.
      roster.load.mockRejectedValue(new Error('offline'))
      await user.click(screen.getByRole('button', { name: 'New trip' }))
      await screen.findByText(
        /The people in your workspace could not be loaded/,
      )
      await user.type(await screen.findByLabelText(/Trip name/), 'Porto')
      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      await waitFor(() => {
        expect(server.create).toHaveBeenCalledOnce()
      })
      expect(roster.add).not.toHaveBeenCalled()
    })

    it('reads the roster again on a retry, in the same live region', async () => {
      roster.load.mockRejectedValueOnce(new Error('offline'))
      const user = await openAndName()

      const region = await screen.findByRole('status')
      expect(region.textContent).toContain(
        'The people in your workspace could not be loaded',
      )
      roster.load.mockResolvedValue([
        { userId: 'u-ana', name: 'Ana Souza', image: null },
      ])
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      expect(await screen.findByRole('button', { name: 'People' })).toBeTruthy()
      expect(roster.load).toHaveBeenCalledTimes(2)
    })

    it('keeps one live region through loading and the empty state', async () => {
      let resolve: (people: Array<never>) => void = () => {}
      roster.load.mockReturnValue(
        new Promise<Array<never>>((done) => {
          resolve = done
        }),
      )
      await openAndName('member')

      const region = await screen.findByRole('status')
      expect(region.getAttribute('aria-busy')).toBe('true')
      resolve([])

      await screen.findByText(
        'You are the only person in this workspace so far.',
      )
      expect(screen.getByRole('status')).toBe(region)
      expect(region.getAttribute('aria-busy')).toBeNull()
    })
  })
})
