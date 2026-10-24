import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { TooltipProvider } from '#/components/ui'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import En from '#/lib/i18n/messages/en/modules'
import EnShell from '#/lib/i18n/messages/en/shell'
import Pl from '#/lib/i18n/messages/pl/modules'
import { PresenceBar } from '../presence-bar'

import type { Catalogue } from '#/lib/i18n'
import type { PresenceMember } from '#/server/do/protocol'

const room = vi.hoisted(() => ({
  peers: [] as Array<unknown>,
  status: 'live' as string,
  reconnect: undefined as unknown as () => void,
  open: undefined as unknown as () => void,
  opening: false,
}))

vi.mock('#/components/layout/use-open-current-workspace', () => ({
  useOpenCurrentWorkspace: () => ({ opening: room.opening, open: room.open }),
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock('../use-trip-room', () => ({
  useTripRoom: () => ({
    status: room.status,
    peers: room.peers,
    you: null,
    version: 0,
    changes: 0,
    reconnect: room.reconnect,
  }),
}))

beforeEach(() => {
  room.status = 'live'
  room.peers = []
  room.reconnect = vi.fn()
  room.open = vi.fn()
  room.opening = false
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

function member(
  connectionId: string,
  userId: string,
  name: string | null,
): PresenceMember {
  return {
    connectionId,
    user: {
      id: userId,
      name,
      initials: name === null ? '?' : 'AL',
      hue: 10,
      avatarUrl: null,
    },
    joinedAt: 0,
    lastSeenAt: 0,
    focus: null,
  }
}

function mount(locale: 'en' | 'pl', messages: Catalogue): void {
  render(
    <I18nProvider locale={locale} messages={messages}>
      <TooltipProvider>
        <PresenceBar tripId="trip-1" />
      </TooltipProvider>
    </I18nProvider>,
  )
}

describe('the presence bar for a person with no display name', () => {
  it('names them from the catalogue and draws a neutral avatar', () => {
    room.peers = [member('c1', 'u1', null)]
    mount('en', namespaceCatalogue('modules', En))

    expect(screen.getByText('Unnamed member')).toBeTruthy()
    expect(screen.getByText('?')).toBeTruthy()
  })

  it('words the name in the reader’s own language', () => {
    room.peers = [member('c1', 'u1', null)]
    mount('pl', namespaceCatalogue('modules', Pl))

    expect(screen.getByText(Pl['collab.presence.unnamed'])).toBeTruthy()
    expect(screen.queryByText('Unnamed member')).toBeNull()
  })

  it('uses the same label in the “tabs open” copy', async () => {
    room.peers = [member('c1', 'u1', null), member('c2', 'u1', null)]
    mount('en', namespaceCatalogue('modules', En))

    const trigger = screen.getByText('Unnamed member').closest('span[tabindex]')
    expect(trigger).not.toBeNull()
    const { default: userEvent } = await import('@testing-library/user-event')
    await userEvent.setup().hover(trigger as Element)

    expect(
      (await screen.findAllByText('Unnamed member — 2 tabs open')).length,
    ).toBeGreaterThan(0)
  })

  it('keeps showing a real name as it is', () => {
    room.peers = [member('c1', 'u1', 'Ada Lovelace')]
    mount('en', namespaceCatalogue('modules', En))

    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(screen.queryByText('Unnamed member')).toBeNull()
  })
})

describe('the presence bar in a tab whose workspace was changed in another tab', () => {
  function mountStale(): void {
    room.status = 'workspace-changed'
    mount('en', {
      ...namespaceCatalogue('modules', En),
      ...namespaceCatalogue('shell', EnShell),
    })
  }

  it('says why live updates stopped, as visible text, in the one polite status region', () => {
    mountStale()

    const status = screen.getByRole('status')
    expect(status.textContent).toBe(En['presence.workspaceChanged.title'])
    expect(status.getAttribute('aria-live')).toBeNull()
    expect(screen.getByText(En['presence.workspaceChanged.body'])).toBeTruthy()
  })

  it('is not the offline or the retrying look', () => {
    mountStale()

    const status = screen.getByRole('status')
    expect(status.className).toContain('bg-info-soft')
    expect(status.className).not.toContain('bg-surface-2')
    expect(status.className).not.toContain('bg-warning-soft')
    expect(status.querySelector('[data-motion-loop]')).toBeNull()
  })

  it('offers the current workspace and no reconnect', () => {
    mountStale()

    expect(
      screen.queryByRole('button', { name: En['presence.reconnect'] }),
    ).toBeNull()
    fireEvent.click(
      screen.getByRole('button', {
        name: EnShell['session.openCurrentWorkspace'],
      }),
    )

    expect(room.open).toHaveBeenCalledTimes(1)
    expect(room.reconnect).not.toHaveBeenCalled()
  })

  it('does not promise that everything still saves', () => {
    mountStale()

    expect(document.body.textContent).not.toContain(En['presence.offline.body'])
    expect(document.body.textContent).not.toContain(
      En['presence.reconnecting.body'],
    )
  })

  it('shows the button busy while the page is leaving, so a slow reload is not tapped twice', () => {
    room.opening = true
    mountStale()

    // A busy button's name is the loading label, so it is found by its state.
    const button = document.querySelector('button[aria-busy="true"]')
    expect(button?.getAttribute('aria-disabled')).toBe('true')
    expect(button?.textContent).toContain(
      EnShell['session.openCurrentWorkspace'],
    )
  })

  it('leaves the focus and any field where they were', () => {
    const field = document.createElement('textarea')
    document.body.appendChild(field)
    field.focus()

    mountStale()

    expect(document.activeElement).toBe(field)
  })

  describe('with text the reader has not sent', () => {
    function typeUnsent(): HTMLTextAreaElement {
      const field = document.createElement('textarea')
      field.value = 'See you at the station at 9'
      document.body.appendChild(field)
      return field
    }

    it('asks before it reloads, and keeps the text if the reader does not go on', () => {
      const field = typeUnsent()
      mountStale()

      fireEvent.click(
        screen.getByRole('button', {
          name: EnShell['session.openCurrentWorkspace'],
        }),
      )

      expect(room.open).not.toHaveBeenCalled()
      expect(
        screen.getByText(En['presence.workspaceChanged.discard']),
      ).toBeTruthy()
      expect(field.value).toBe('See you at the station at 9')
    })

    it('reloads on the second, explicit press', () => {
      typeUnsent()
      mountStale()
      fireEvent.click(
        screen.getByRole('button', {
          name: EnShell['session.openCurrentWorkspace'],
        }),
      )

      fireEvent.click(
        screen.getByRole('button', {
          name: En['presence.workspaceChanged.confirm'],
        }),
      )

      expect(room.open).toHaveBeenCalledTimes(1)
    })

    it('does not ask when the only fields are empty', () => {
      document.body.appendChild(document.createElement('textarea'))
      mountStale()

      fireEvent.click(
        screen.getByRole('button', {
          name: EnShell['session.openCurrentWorkspace'],
        }),
      )

      expect(room.open).toHaveBeenCalledTimes(1)
    })
  })
})
