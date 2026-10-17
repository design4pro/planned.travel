import '#/components/ui/__tests__/test-env'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nProvider } from '#/lib/i18n'
import {
  namespaceCatalogue,
  namespaceTranslate,
} from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import Modules from '#/lib/i18n/messages/en/modules'
import type { MessageData } from '../types'
import type { CollabScreenData } from '../collab-screen'
import { CollabScreen } from '../collab-screen'
import { collabSummary } from '../collab-summary'

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: async () => {} }),
}))
vi.mock('#/server/fns/collab-thread', () => ({
  deleteMessageFn: vi.fn(),
  editMessageFn: vi.fn(),
  loadOlderMessagesFn: vi.fn(),
  postMessageFn: vi.fn(),
  toggleReactionFn: vi.fn(),
}))
vi.mock('#/server/fns/collab-notes', () => ({
  createNoteFn: vi.fn(),
  updateNoteFn: vi.fn(),
  deleteNoteFn: vi.fn(),
}))
vi.mock('#/server/fns/collab-polls', () => ({
  createPollFn: vi.fn(),
  castVoteFn: vi.fn(),
  closePollFn: vi.fn(),
  deletePollFn: vi.fn(),
}))
afterEach(cleanup)

const t = namespaceTranslate('trips', Trips)
const catalogue = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('modules', Modules),
}

/** The newest 50 of a longer thread: the window the loader returns. */
const window50: ReadonlyArray<MessageData> = Array.from(
  { length: 50 },
  (_, index) => ({
    id: `m${index}`,
    userId: 'u',
    body: `message ${index}`,
    createdAt: `2026-10-16T09:${String(index).padStart(2, '0')}:00Z`,
    editedAt: null,
    replyToId: null,
    reactions: [],
  }),
)
const base: CollabScreenData = {
  sections: { conversation: true, notes: true, polls: true },
  messages: window50,
  messageCount: 400,
  notes: [],
  polls: [],
  people: [],
  viewerUserId: 'u',
  timeZone: 'UTC',
}

function panelCount(data: CollabScreenData) {
  render(
    <I18nProvider locale="en" messages={catalogue}>
      <CollabScreen
        data={data}
        tripId="trip"
        canModerate={false}
        ownWrite={{ current: false }}
      />
    </I18nProvider>,
  )
  return screen.queryByText('400')
}

describe('the conversation count', () => {
  it('prints the whole thread in the header, not the loaded window', () => {
    expect(collabSummary(base, t, 'en')).toBe(
      '400 messages · 0 notes · 0 polls',
    )
  })

  it('prints the whole thread in the panel, not the loaded window', () => {
    expect(panelCount(base)).not.toBeNull()
    expect(screen.queryByText('50')).toBeNull()
  })

  it('agrees between header and panel and keeps the singular form', () => {
    const one = { ...base, messages: window50.slice(0, 1), messageCount: 1 }
    expect(collabSummary(one, t, 'en')).toBe('1 message · 0 notes · 0 polls')
  })

  it('prints no conversation count while the conversation is off', () => {
    const off = {
      ...base,
      sections: { conversation: false, notes: true, polls: true },
      messageCount: null,
    }
    expect(collabSummary(off, t, 'en')).toBe('0 notes · 0 polls')
    expect(panelCount(off)).toBeNull()
  })

  it('says nothing is shared only when nothing exists anywhere', () => {
    const empty = { ...base, messages: [], messageCount: 0 }
    expect(collabSummary(empty, t, 'en')).toBe('Nothing shared yet')
  })
})
