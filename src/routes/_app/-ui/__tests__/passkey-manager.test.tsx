import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '#/lib/i18n'
import settings from '#/lib/i18n/messages/en/settings'
import { MAX_PASSKEYS_PER_USER } from '#/lib/auth/passkey-limit'
import { PasskeyManager } from '../passkey-manager'

import type { Catalogue } from '#/lib/i18n'
import type { PasskeySummary } from '#/lib/auth/client'

const client = vi.hoisted(() => ({
  isPasskeyEnrolmentSupported: vi.fn<() => boolean>(),
  listPasskeys: vi.fn(),
  registerPasskey: vi.fn(),
  renamePasskey: vi.fn(),
}))

vi.mock('#/lib/auth/client', () => client)

/** The shipped catalogue, namespaced the way the provider expects. */
const EN: Catalogue = Object.fromEntries(
  Object.entries(settings).map(([key, message]) => [
    `settings.${key}`,
    message,
  ]),
)

function passkey(overrides: Partial<PasskeySummary> = {}): PasskeySummary {
  return {
    id: 'pk_1',
    name: null,
    deviceType: 'multiDevice',
    backedUp: false,
    aaguid: null,
    createdAt: '2026-10-12T09:00:00.000Z',
    lastUsedAt: null,
    ...overrides,
  }
}

function failure(status: number, code: string | null = null) {
  return { ok: false as const, failure: { code, status, message: 'English' } }
}

async function mount(): Promise<void> {
  render(
    <I18nProvider locale="en" messages={EN}>
      <PasskeyManager />
    </I18nProvider>,
  )
  await screen.findByRole('heading', { name: 'Your passkeys' })
}

/** The header's button; the empty state draws a second one with the same states. */
function addButton(): HTMLElement {
  return screen.getAllByRole('button', { name: /Add a passkey|Waiting for/ })[0]
}

function renameInput(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Name this passkey' })
}

function renameButton(name: string): HTMLElement {
  return screen.getByRole('button', { name: `Rename ${name}` })
}

const FALLBACK = /^Passkey · added /

beforeEach(() => {
  vi.resetAllMocks()
  client.isPasskeyEnrolmentSupported.mockReturnValue(true)
  client.listPasskeys.mockResolvedValue({ ok: true, passkeys: [] })
})

describe('the list', () => {
  it('draws a busy list of skeletons until the request settles', async () => {
    client.listPasskeys.mockReturnValue(new Promise(() => {}))
    await mount()

    expect(screen.getByRole('list').getAttribute('aria-busy')).toBe('true')
    expect(addButton()).toHaveProperty('disabled', true)
  })

  it('has one status region from the first render, empty', async () => {
    await mount()

    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('shows the empty state under an h3 below the list heading', async () => {
    await mount()

    expect(
      await screen.findByRole('heading', { level: 3, name: 'No passkeys yet' }),
    ).toBeTruthy()
    expect(addButton()).toHaveProperty('disabled', false)
  })

  it('renders the fallback name, both badges and a never-used line', async () => {
    client.listPasskeys.mockResolvedValue({
      ok: true,
      passkeys: [passkey({ backedUp: true, deviceType: 'singleDevice' })],
    })
    await mount()

    const row = await screen.findByRole('listitem')
    expect(
      within(row)
        .getByText(/^Passkey · added /)
        .getAttribute('dir'),
    ).toBe('auto')
    expect(within(row).getByText('Synced')).toBeTruthy()
    expect(within(row).getByText('On one device only')).toBeTruthy()
    expect(within(row).getByText('Not used to sign in yet')).toBeTruthy()
  })

  it('shows a neither-badge row for a multi-device credential that is not backed up', async () => {
    client.listPasskeys.mockResolvedValue({
      ok: true,
      passkeys: [passkey({ name: 'Work phone', lastUsedAt: '2026-10-13' })],
    })
    await mount()

    const row = await screen.findByRole('listitem')
    expect(within(row).getByText('Work phone')).toBeTruthy()
    expect(within(row).queryByText('Synced')).toBeNull()
    expect(within(row).queryByText('On one device only')).toBeNull()
    expect(within(row).getByText(/^Last used /)).toBeTruthy()
  })
})

describe('a list that did not load', () => {
  it('names a rate limit and offers Try again, which reloads and moves focus to the heading', async () => {
    client.listPasskeys.mockResolvedValueOnce(failure(429))
    await mount()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Your passkeys did not load')
    expect(alert.textContent).toContain('Too many attempts')

    client.listPasskeys.mockResolvedValueOnce({ ok: true, passkeys: [] })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await screen.findByText('No passkeys yet')
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Your passkeys' }),
    )
    expect(client.listPasskeys).toHaveBeenCalledTimes(2)
  })

  it('offers Sign in again, not Try again, when the session has ended', async () => {
    client.listPasskeys.mockResolvedValue(failure(401))
    await mount()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Your session has ended')
    expect(
      within(alert).getByRole('button', { name: 'Sign in again' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('gives advice only for any other failure', async () => {
    client.listPasskeys.mockResolvedValue(failure(500))
    await mount()

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Check your connection and try again.',
    )
  })
})

describe('adding a passkey', () => {
  it('prepends the new passkey, announces it and puts focus in its rename input', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: true,
      passkey: passkey({ id: 'pk_new' }),
    })
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Passkey added'),
    )
    expect(await screen.findAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('No passkeys yet')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(renameInput()))
  })

  it('holds the button disabled with a loading label for the whole ceremony', async () => {
    let finish: (value: unknown) => void = () => {}
    client.registerPasskey.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    expect(addButton()).toHaveProperty('disabled', true)
    expect(addButton().textContent).toContain('Waiting for')
    expect(client.registerPasskey).toHaveBeenCalledTimes(1)

    finish({ ok: false, aborted: true })
    await waitFor(() => expect(addButton()).toHaveProperty('disabled', false))
  })

  it('says it quietly when the sheet was dismissed', async () => {
    client.registerPasskey.mockResolvedValue({ ok: false, aborted: true })
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    const status = screen.getByRole('status')
    await waitFor(() =>
      expect(status.textContent).toContain('No passkey was added'),
    )
    expect(status.classList.contains('text-danger')).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(addButton()))
  })

  it('gives an already-enrolled device its own sentence', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: true,
    })
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'This device already has a passkey for your account',
      ),
    )
  })

  it('says it failed, in the danger tone, and never shows the server message', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: {
        code: 'PASSKEY_IMPERSONATED',
        status: 403,
        message: 'English',
      },
    })
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    const status = screen.getByRole('status')
    await waitFor(() =>
      expect(status.textContent).toContain(
        'The passkey was not added. Try again.',
      ),
    )
    expect(status.classList.contains('text-danger')).toBe(true)
    expect(screen.queryByText('English')).toBeNull()
  })

  it('names a rate limit on the add path too', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: { code: null, status: 429, message: '' },
    })
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Too many attempts',
      ),
    )
  })

  it('offers Sign in again, with focus on it, for a session that is not fresh', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: { code: 'PASSKEY_SESSION_NOT_FRESH', status: 400, message: '' },
    })
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'For your safety, sign in again to continue.',
      ),
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Sign in again' }),
      ),
    )
  })

  it('shows the session-ended sentence, not the stale one, for a 401', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: { code: null, status: 401, message: '' },
    })
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Your session has ended',
      ),
    )
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeTruthy()
  })

  it('draws the same Add button in the empty state', async () => {
    await mount()
    await screen.findByText('No passkeys yet')

    expect(
      screen.getAllByRole('button', { name: 'Add a passkey' }),
    ).toHaveLength(2)
  })

  it('does not add a passkey twice when a reload already returned it', async () => {
    client.listPasskeys.mockResolvedValueOnce({
      ok: true,
      passkeys: [passkey({ id: 'pk_new' })],
    })
    client.registerPasskey.mockResolvedValue({
      ok: true,
      passkey: passkey({ id: 'pk_new' }),
    })
    await mount()
    await screen.findAllByRole('listitem')

    await userEvent.click(addButton())

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Passkey added'),
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('reads a list that never loaded again once a passkey was added', async () => {
    client.listPasskeys.mockResolvedValueOnce(failure(500))
    client.registerPasskey.mockResolvedValue({
      ok: true,
      passkey: passkey({ id: 'pk_new' }),
    })
    await mount()
    await screen.findByRole('alert')
    client.listPasskeys.mockResolvedValue({
      ok: true,
      passkeys: [passkey({ id: 'pk_new' })],
    })

    await userEvent.click(addButton())

    expect(await screen.findAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reads the list again after a failure that may have left a row behind', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: { code: null, status: 0, message: '' },
    })
    await mount()
    await screen.findByText('No passkeys yet')
    client.listPasskeys.mockResolvedValue({
      ok: true,
      passkeys: [passkey({ id: 'pk_written' })],
    })

    await userEvent.click(addButton())

    expect(await screen.findAllByRole('listitem')).toHaveLength(1)
    expect(client.listPasskeys).toHaveBeenCalledTimes(2)
  })

  it('does not read the list again when the sheet was only dismissed', async () => {
    client.registerPasskey.mockResolvedValue({ ok: false, aborted: true })
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    await waitFor(() => expect(addButton()).toHaveProperty('disabled', false))
    expect(client.listPasskeys).toHaveBeenCalledTimes(1)
  })

  it('announces a limit refusal in the status region, which the standing line does not do', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: { code: 'PASSKEY_LIMIT_REACHED', status: 400, message: '' },
    })
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        `You have reached the limit of ${MAX_PASSKEYS_PER_USER} passkeys`,
      ),
    )
  })

  it('keeps Sign in again on screen when signing out fails, and puts focus back on it', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: { code: 'PASSKEY_SESSION_NOT_FRESH', status: 400, message: '' },
    })
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)
    await mount()
    await screen.findByText('No passkeys yet')
    await userEvent.click(addButton())
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sign in again' }),
    )

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Check your connection and try again.',
      ),
    )
    const retry = screen.getByRole('button', { name: 'Sign in again' })
    await waitFor(() => expect(document.activeElement).toBe(retry))
    vi.unstubAllGlobals()
  })

  it('announces a second failed sign-out too, by replacing the text node in the live region', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: { code: 'PASSKEY_SESSION_NOT_FRESH', status: 400, message: '' },
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await mount()
    await screen.findByText('No passkeys yet')
    await userEvent.click(addButton())
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sign in again' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Check your connection',
      ),
    )
    const first = screen.getByRole('status').firstElementChild

    await userEvent.click(screen.getByRole('button', { name: 'Sign in again' }))

    await waitFor(() =>
      expect(screen.getByRole('status').firstElementChild).not.toBe(first),
    )
    vi.unstubAllGlobals()
  })

  it('shows one Sign in again when the list failed on an ended session and signing out fails', async () => {
    client.listPasskeys.mockResolvedValue(failure(401))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await mount()
    const alert = await screen.findByRole('alert')

    await userEvent.click(
      within(alert).getByRole('button', { name: 'Sign in again' }),
    )

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Check your connection',
      ),
    )
    const buttons = screen.getAllByRole('button', { name: 'Sign in again' })
    expect(buttons).toHaveLength(1)
    await waitFor(() => expect(document.activeElement).toBe(buttons[0]))
    vi.unstubAllGlobals()
  })

  it('returns focus to the empty-state button when that is the one pressed', async () => {
    client.registerPasskey.mockResolvedValue({ ok: false, aborted: true })
    await mount()
    await screen.findByText('No passkeys yet')
    const emptyAdd = screen.getAllByRole('button', { name: 'Add a passkey' })[1]

    await userEvent.click(emptyAdd)

    await waitFor(() => expect(document.activeElement).toBe(emptyAdd))
  })

  it('says the passkey was added when the reply was lost but the reloaded list holds the row', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: { code: null, status: 0, message: '' },
    })
    await mount()
    await screen.findByText('No passkeys yet')
    client.listPasskeys.mockResolvedValue({
      ok: true,
      passkeys: [passkey({ id: 'pk_written' })],
    })

    await userEvent.click(addButton())

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Passkey added'),
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('keeps the ceiling on screen, tied to the disabled button, and puts focus on the heading', async () => {
    client.registerPasskey.mockResolvedValue({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: { code: 'PASSKEY_LIMIT_REACHED', status: 400, message: '' },
    })
    await mount()
    await screen.findByText('No passkeys yet')

    await userEvent.click(addButton())

    // The standing line, plus its announcement in the status region.
    await waitFor(() =>
      expect(document.getElementById('passkey-add-hint')?.textContent).toBe(
        `You have reached the limit of ${MAX_PASSKEYS_PER_USER} passkeys. Remove one to add another.`,
      ),
    )
    const hint = document.getElementById('passkey-add-hint') as HTMLElement
    expect(addButton()).toHaveProperty('disabled', true)
    expect(addButton().getAttribute('aria-describedby')).toBe(hint.id)
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Your passkeys' }),
      ),
    )
  })

  it('draws the ceiling up front when the list already holds the maximum', async () => {
    client.listPasskeys.mockResolvedValue({
      ok: true,
      passkeys: Array.from({ length: MAX_PASSKEYS_PER_USER }, (_, index) =>
        passkey({ id: `pk_${index}` }),
      ),
    })
    await mount()

    await screen.findAllByRole('listitem')
    expect(addButton()).toHaveProperty('disabled', true)
    expect(screen.getByText(/You have reached the limit of/)).toBeTruthy()
  })
})

describe('a browser without passkeys', () => {
  it('disables the button and explains why, linked to it', async () => {
    client.isPasskeyEnrolmentSupported.mockReturnValue(false)
    await mount()

    const hint = await screen.findByText(
      'This browser cannot create passkeys. Try another browser or device.',
    )
    expect(addButton()).toHaveProperty('disabled', true)
    expect(addButton().getAttribute('aria-describedby')).toBe(hint.id)
  })
})

describe('naming a passkey', () => {
  async function mountWithRows(...rows: Array<PasskeySummary>): Promise<void> {
    client.listPasskeys.mockResolvedValue({ ok: true, passkeys: rows })
    await mount()
    await screen.findAllByRole('listitem')
  }

  function renamed(id: string, name: string) {
    return { ok: true, passkey: passkey({ id, name }) }
  }

  describe('right after adding', () => {
    it('opens the new row in rename mode with a visible label, an empty field and no request', async () => {
      client.registerPasskey.mockResolvedValue({
        ok: true,
        passkey: passkey({ id: 'pk_new' }),
      })
      await mount()
      await screen.findByText('No passkeys yet')

      await userEvent.click(addButton())

      const input = await screen.findByRole('textbox', {
        name: 'Name this passkey',
      })
      expect(screen.getByText('Name this passkey').tagName).toBe('LABEL')
      expect(input.getAttribute('placeholder')).toBe('Name it, like Work phone')
      expect(input.getAttribute('maxlength')).toBe('64')
      expect(input.getAttribute('dir')).toBe('auto')
      expect(input.getAttribute('enterkeyhint')).toBe('done')
      expect((input as HTMLInputElement).value).toBe('')
      await waitFor(() => expect(document.activeElement).toBe(input))
      expect(screen.getByRole('status').textContent).toBe('Passkey added')
      expect(client.renamePasskey).not.toHaveBeenCalled()
    })

    it('sends no name with the ceremony, and nothing when the name is left empty', async () => {
      client.registerPasskey.mockResolvedValue({
        ok: true,
        passkey: passkey({ id: 'pk_new' }),
      })
      await mount()
      await screen.findByText('No passkeys yet')
      await userEvent.click(addButton())
      await screen.findByRole('textbox', { name: 'Name this passkey' })

      await userEvent.keyboard('{Enter}')

      expect(client.registerPasskey).toHaveBeenCalledWith()
      expect(client.renamePasskey).not.toHaveBeenCalled()
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(screen.getByText(FALLBACK)).toBeTruthy()
    })

    it('saves the typed name and shows it', async () => {
      client.registerPasskey.mockResolvedValue({
        ok: true,
        passkey: passkey({ id: 'pk_new' }),
      })
      client.renamePasskey.mockResolvedValue(renamed('pk_new', 'Work phone'))
      await mount()
      await screen.findByText('No passkeys yet')
      await userEvent.click(addButton())
      await screen.findByRole('textbox', { name: 'Name this passkey' })

      await userEvent.keyboard('Work phone{Enter}')

      await screen.findByText('Work phone')
      expect(client.renamePasskey).toHaveBeenCalledWith('pk_new', 'Work phone')
    })

    it('leaves rename mode on a blur with nothing typed, without a request', async () => {
      client.registerPasskey.mockResolvedValue({
        ok: true,
        passkey: passkey({ id: 'pk_new' }),
      })
      await mount()
      await screen.findByText('No passkeys yet')
      await userEvent.click(addButton())
      await screen.findByRole('textbox', { name: 'Name this passkey' })

      await userEvent.click(
        screen.getByRole('heading', { name: 'Your passkeys' }),
      )

      expect(screen.queryByRole('textbox')).toBeNull()
      expect(client.renamePasskey).not.toHaveBeenCalled()
    })
  })

  describe('the Rename control', () => {
    it('is named with the passkey on every row, the fallback included', async () => {
      await mountWithRows(
        passkey({ id: 'pk_1', name: 'Work phone' }),
        passkey({ id: 'pk_2' }),
      )

      expect(renameButton('Work phone')).toBeTruthy()
      expect(
        screen.getByRole('button', { name: /^Rename Passkey · added / }),
      ).toBeTruthy()
    })

    it('opens the field with the current name and moves focus into it', async () => {
      await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))

      await userEvent.click(renameButton('Work phone'))

      expect((renameInput() as HTMLInputElement).value).toBe('Work phone')
      expect(document.activeElement).toBe(renameInput())
    })

    it('opens an unnamed passkey with an empty field, not with the fallback', async () => {
      await mountWithRows(passkey({ id: 'pk_1' }))

      await userEvent.click(
        screen.getByRole('button', { name: /^Rename Passkey · added / }),
      )

      expect((renameInput() as HTMLInputElement).value).toBe('')
    })

    it('takes focus back into the field when pressed again', async () => {
      await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))
      await userEvent.click(renameButton('Work phone'))
      renameButton('Work phone').focus()

      await userEvent.click(renameButton('Work phone'))

      expect(document.activeElement).toBe(renameInput())
    })

    it('keeps one row in rename mode at a time', async () => {
      await mountWithRows(
        passkey({ id: 'pk_1', name: 'Work phone' }),
        passkey({ id: 'pk_2', name: 'Laptop' }),
      )

      await userEvent.click(renameButton('Work phone'))
      await userEvent.click(renameButton('Laptop'))

      expect(screen.getAllByRole('textbox')).toHaveLength(1)
      expect((renameInput() as HTMLInputElement).value).toBe('Laptop')
    })
  })

  describe('committing', () => {
    it('saves a trimmed, changed name on Enter and returns focus to the Rename control', async () => {
      await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))
      client.renamePasskey.mockResolvedValue(renamed('pk_1', 'Laptop'))
      await userEvent.click(renameButton('Work phone'))

      await userEvent.clear(renameInput())
      await userEvent.type(renameInput(), '  Laptop {Enter}')

      await screen.findByText('Laptop')
      expect(client.renamePasskey).toHaveBeenCalledWith('pk_1', 'Laptop')
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(screen.getByRole('status').textContent).toBe('Name saved')
      await waitFor(() =>
        expect(document.activeElement).toBe(renameButton('Laptop')),
      )
    })

    it('saves a changed name on a blur and leaves focus where the person moved it', async () => {
      await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))
      client.renamePasskey.mockResolvedValue(renamed('pk_1', 'Laptop'))
      await userEvent.click(renameButton('Work phone'))
      await userEvent.clear(renameInput())
      await userEvent.type(renameInput(), 'Laptop')

      const heading = screen.getByRole('heading', { name: 'Your passkeys' })
      await userEvent.click(heading)

      await screen.findByText('Laptop')
      expect(client.renamePasskey).toHaveBeenCalledWith('pk_1', 'Laptop')
      expect(document.activeElement).toBe(heading)
    })

    it('sends nothing for an unchanged name, on Enter or on a blur', async () => {
      await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))

      await userEvent.click(renameButton('Work phone'))
      await userEvent.keyboard('{Enter}')
      await waitFor(() =>
        expect(document.activeElement).toBe(renameButton('Work phone')),
      )

      await userEvent.click(renameButton('Work phone'))
      await userEvent.click(
        screen.getByRole('heading', { name: 'Your passkeys' }),
      )

      expect(client.renamePasskey).not.toHaveBeenCalled()
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('sends nothing for a blank name and keeps an unnamed passkey unnamed', async () => {
      await mountWithRows(passkey({ id: 'pk_1' }))
      await userEvent.click(
        screen.getByRole('button', { name: /^Rename Passkey · added / }),
      )

      await userEvent.type(renameInput(), '   {Enter}')

      expect(client.renamePasskey).not.toHaveBeenCalled()
      expect(screen.getByText(FALLBACK)).toBeTruthy()
    })

    it('reverts on Escape, sends nothing and returns focus to the Rename control', async () => {
      await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))
      await userEvent.click(renameButton('Work phone'))
      await userEvent.type(renameInput(), ' and more')

      await userEvent.keyboard('{Escape}')

      expect(client.renamePasskey).not.toHaveBeenCalled()
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(screen.getByText('Work phone')).toBeTruthy()
      await waitFor(() =>
        expect(document.activeElement).toBe(renameButton('Work phone')),
      )
    })

    it('holds the field read-only and announces the save while it runs, and sends it once', async () => {
      await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))
      let finish: (value: unknown) => void = () => {}
      client.renamePasskey.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve
        }),
      )
      await userEvent.click(renameButton('Work phone'))
      await userEvent.type(renameInput(), '2{Enter}')

      expect(renameInput().getAttribute('readonly')).not.toBeNull()
      expect(renameInput().getAttribute('aria-busy')).toBe('true')
      expect(screen.getByRole('status').textContent).toBe('Saving the name')
      await userEvent.keyboard('{Enter}')
      expect(client.renamePasskey).toHaveBeenCalledTimes(1)

      finish(renamed('pk_1', 'Work phone2'))
      await screen.findByText('Work phone2')
    })
  })

  describe('a save that fails', () => {
    async function failWith(status: number, code: string | null = null) {
      await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))
      client.renamePasskey.mockResolvedValue(failure(status, code))
      await userEvent.click(renameButton('Work phone'))
      await userEvent.type(renameInput(), '2{Enter}')
    }

    it('keeps focus in the input, reverts the text and says so inline, never with the server message', async () => {
      await failWith(500)

      await screen.findByText('The name was not saved', { selector: 'p' })
      expect((renameInput() as HTMLInputElement).value).toBe('Work phone')
      await waitFor(() => expect(document.activeElement).toBe(renameInput()))
      expect(renameInput().getAttribute('aria-describedby') ?? '').toContain(
        '-error',
      )
      expect(screen.queryByText('English')).toBeNull()
      expect(screen.getByText('Work phone', { selector: 'span' })).toBeTruthy()
    })

    it.each([
      [403, 'PASSKEY_IMPERSONATED'],
      [404, 'PASSKEY_NOT_FOUND'],
      [0, null],
    ])('says "not saved" for a %i (%s)', async (status, code) => {
      await failWith(status, code)

      await screen.findByText('The name was not saved', { selector: 'p' })
    })

    it('names a rate limit', async () => {
      await failWith(429)

      await screen.findByText(/Too many attempts/, { selector: 'p' })
      expect(screen.queryByText('The name was not saved')).toBeNull()
    })

    it('offers Sign in again beside the row for an ended session', async () => {
      await failWith(401)

      await screen.findByText(/Your session has ended/, { selector: 'p' })
      const row = screen.getByRole('listitem')
      expect(
        within(row).getByRole('button', { name: 'Sign in again' }),
      ).toBeTruthy()
      expect(document.activeElement).toBe(renameInput())
    })

    it('can be tried again after a failure', async () => {
      await failWith(500)
      await screen.findByText('The name was not saved', { selector: 'p' })
      client.renamePasskey.mockResolvedValue(renamed('pk_1', 'Work phone2'))

      await userEvent.type(renameInput(), '2{Enter}')

      await screen.findByText('Work phone2')
      expect(client.renamePasskey).toHaveBeenCalledTimes(2)
    })

    it('announces the failure in the status region, once, without a second Sign in again', async () => {
      await failWith(401)

      await screen.findByText(/Your session has ended/, { selector: 'p' })
      const status = document.querySelector('[data-part="passkey-status"]')
      expect(status?.textContent).toMatch(/Your session has ended/)
      expect(
        screen.getAllByRole('button', { name: 'Sign in again' }),
      ).toHaveLength(1)
    })

    it('keeps Sign in again reachable: tabbing to it does not close rename mode', async () => {
      await failWith(401)
      await screen.findByText(/Your session has ended/, { selector: 'p' })

      await userEvent.tab()

      const signIn = screen.getByRole('button', { name: 'Sign in again' })
      expect(document.activeElement).toBe(signIn)
      expect(renameInput()).toBeTruthy()
    })

    it('leaves focus where the person moved it when the save was started by a blur', async () => {
      await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))
      client.renamePasskey.mockResolvedValue(failure(500))
      await userEvent.click(renameButton('Work phone'))
      await userEvent.clear(renameInput())
      await userEvent.type(renameInput(), 'Laptop')
      const heading = screen.getByRole('heading', { name: 'Your passkeys' })

      await userEvent.click(heading)

      await screen.findByText('The name was not saved', { selector: 'p' })
      expect(document.activeElement).toBe(heading)
      expect((renameInput() as HTMLInputElement).value).toBe('Work phone')
    })
  })

  it('does not make the field editable again when Rename is pressed during its save', async () => {
    await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))
    let finish: (value: unknown) => void = () => {}
    client.renamePasskey.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await userEvent.click(renameButton('Work phone'))
    await userEvent.type(renameInput(), '2')

    await userEvent.click(renameButton('Work phone'))

    expect(renameInput().getAttribute('readonly')).not.toBeNull()
    expect(client.renamePasskey).toHaveBeenCalledTimes(1)

    finish(renamed('pk_1', 'Work phone2'))
    await screen.findByText('Work phone2')
  })

  it('does not commit on the Enter that ends an IME composition', async () => {
    await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))
    await userEvent.click(renameButton('Work phone'))
    await userEvent.type(renameInput(), '2')

    fireEvent.keyDown(renameInput(), { key: 'Enter', isComposing: true })

    expect(client.renamePasskey).not.toHaveBeenCalled()
    expect(renameInput()).toBeTruthy()
  })

  it('clears the previous error while a retry runs, so the next failure is announced again', async () => {
    await mountWithRows(passkey({ id: 'pk_1', name: 'Work phone' }))
    client.renamePasskey.mockResolvedValueOnce(failure(500))
    await userEvent.click(renameButton('Work phone'))
    await userEvent.type(renameInput(), '2{Enter}')
    await screen.findByText('The name was not saved', { selector: 'p' })
    let finish: (value: unknown) => void = () => {}
    client.renamePasskey.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )

    await userEvent.type(renameInput(), '3{Enter}')

    expect(screen.queryByText('The name was not saved')).toBeNull()
    finish(failure(500))
    await screen.findByText('The name was not saved', { selector: 'p' })
  })

  it('does not hand focus to a row that finished saving after another row took rename mode', async () => {
    await mountWithRows(
      passkey({ id: 'pk_1', name: 'Work phone' }),
      passkey({ id: 'pk_2', name: 'Laptop' }),
    )
    let finish: (value: unknown) => void = () => {}
    client.renamePasskey.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await userEvent.click(renameButton('Work phone'))
    await userEvent.type(renameInput(), '2{Enter}')
    await userEvent.click(renameButton('Laptop'))

    finish(renamed('pk_1', 'Work phone2'))
    await screen.findByText('Work phone2')
    const heading = screen.getByRole('heading', { name: 'Your passkeys' })
    await userEvent.click(heading)

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.activeElement).toBe(heading)
  })
})
