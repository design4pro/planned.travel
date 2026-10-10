import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { TooltipProvider } from '#/components/ui'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import En from '#/lib/i18n/messages/en/modules'
import Pl from '#/lib/i18n/messages/pl/modules'
import { PresenceBar } from '../presence-bar'

import type { Catalogue } from '#/lib/i18n'
import type { PresenceMember } from '#/server/do/protocol'

const room = vi.hoisted(() => ({ peers: [] as Array<unknown> }))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock('../use-trip-room', () => ({
  useTripRoom: () => ({
    status: 'live',
    peers: room.peers,
    you: null,
    version: 0,
    changes: 0,
    reconnect: vi.fn(),
  }),
}))

afterEach(cleanup)

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
