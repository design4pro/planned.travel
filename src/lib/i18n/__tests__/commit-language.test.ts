import { describe, expect, it, vi } from 'vitest'

import { commitLanguage, localeInForce } from '../commit-language'

import type { LanguageCommitDeps, LanguageOverride } from '../commit-language'
import type { Translate } from '#/lib/i18n'

/**
 * What a chip click does, measured by calling it.
 *
 * The round before this one asserted the *source* of `language.tsx` with
 * regular expressions — that a `try` appeared twice, that a particular
 * identifier was not `t`. Those pass on a rewrite that means the opposite and
 * fail on a reformat, and one of them was verifying a `catch` that could never
 * run. The logic moved to a plain function so its four collaborators can be
 * replaced and its three outcomes observed.
 */

const GERMAN = 'de'
const WORKSPACE = 'en'

/** A translator that is recognisable in an assertion without a catalogue. */
function spokenIn(tag: string): Translate {
  // `Translate` is generic over the key, so a lambda cannot satisfy it without
  // being generic itself; the rest parameter is what a contextual signature
  // cannot supply. Written as a function declaration, it can.
  function translate(key: string, ..._args: ReadonlyArray<unknown>): string {
    return `${tag}:${key}`
  }
  return translate
}

function deps(overrides: Partial<LanguageCommitDeps> = {}): LanguageCommitDeps {
  return {
    save: vi.fn(async (locale) => ({
      locale: locale === '' ? null : locale,
    })),
    refresh: vi.fn(async () => {}),
    refreshed: vi.fn(() => true),
    translatorFor: vi.fn(async (target) => spokenIn(target)),
    ...overrides,
  }
}

function request(next: LanguageOverride, previous: LanguageOverride = null) {
  return { next, previous, workspace: WORKSPACE } as const
}

describe('which row decides what the reader sees', () => {
  it('is the traveller’s own tag when they have one', () => {
    expect(localeInForce(GERMAN, WORKSPACE)).toBe(GERMAN)
  })

  it('is the workspace’s tag while they follow it', () => {
    expect(localeInForce(null, WORKSPACE)).toBe(WORKSPACE)
  })
})

describe('a click that is written and lands', () => {
  it('reports the switch and speaks it in the language it switched to', async () => {
    const commit = await commitLanguage(request(GERMAN), deps())
    expect(commit.status).toBe('switched')
    if (commit.status !== 'switched') return
    expect(commit.landed).toBe(GERMAN)
    expect(commit.inForce).toBe(GERMAN)
    // Not the outgoing locale's translator: the one sentence whose job is to
    // prove the change took effect has to be written in the change.
    expect(
      commit.speak('settings.language.saved', { language: 'Deutsch' }),
    ).toBe('de:settings.language.saved')
  })

  it('sends the clear-the-override sentinel for “follow the workspace”', async () => {
    const collaborators = deps()
    const commit = await commitLanguage(request(null, GERMAN), collaborators)
    expect(collaborators.save).toHaveBeenCalledWith('')
    expect(commit.status).toBe('switched')
    if (commit.status !== 'switched') return
    expect(commit.landed).toBeNull()
    // And the screen can then name the locale the workspace supplies.
    expect(commit.inForce).toBe(WORKSPACE)
  })

  it('follows what D1 answered rather than what the click asked for', async () => {
    // A legacy `en-GB` row is stored, and answered, as `en`.
    const commit = await commitLanguage(
      request(GERMAN),
      deps({ save: async () => ({ locale: 'en' }) }),
    )
    expect(commit.status).toBe('switched')
    if (commit.status !== 'switched') return
    expect(commit.landed).toBe('en')
    expect(commit.inForce).toBe('en')
  })

  it('re-runs the loaders before it reads the catalogue', async () => {
    const order: Array<string> = []
    await commitLanguage(
      request(GERMAN),
      deps({
        refresh: async () => {
          order.push('refresh')
        },
        translatorFor: async (target) => {
          order.push('catalogue')
          return spokenIn(target)
        },
      }),
    )
    expect(order).toEqual(['refresh', 'catalogue'])
  })
})

describe('a click the server refused', () => {
  it('restores the override that is still in D1 and never re-runs the loaders', async () => {
    const collaborators = deps({
      save: async () => {
        throw new Error('D1_ERROR: no such table')
      },
    })
    const commit = await commitLanguage(request(GERMAN, 'pl'), collaborators)
    expect(commit.status).toBe('rejected')
    if (commit.status !== 'rejected') return
    expect(commit.restore).toBe('pl')
    // Named so the failure sentence can say which language is still being read.
    expect(commit.inForce).toBe('pl')
    expect(collaborators.refresh).not.toHaveBeenCalled()
    expect(collaborators.translatorFor).not.toHaveBeenCalled()
  })

  it('restores “follow the workspace” when that is what was selected', async () => {
    const commit = await commitLanguage(
      request(GERMAN, null),
      deps({
        save: async () => {
          throw new Error('Failed to fetch')
        },
      }),
    )
    expect(commit.status).toBe('rejected')
    if (commit.status !== 'rejected') return
    expect(commit.restore).toBeNull()
    expect(commit.inForce).toBe(WORKSPACE)
  })
})

describe('a click that was written but did not finish turning the page', () => {
  it('is stale, not a success, when a match ended in its error boundary', async () => {
    // The failure the old `catch` could not see: TanStack routes a loader
    // rejection to `errorComponent` and *resolves* the invalidation, so the
    // screen used to congratulate the reader over an error panel.
    const collaborators = deps({ refreshed: () => false })
    const commit = await commitLanguage(request(GERMAN), collaborators)
    expect(commit.status).toBe('stale')
    if (commit.status !== 'stale') return
    expect(commit.landed).toBe(GERMAN)
    expect(commit.inForce).toBe(GERMAN)
    // Nothing to announce a switch with, so nothing is fetched to announce it.
    expect(collaborators.translatorFor).not.toHaveBeenCalled()
  })

  it('is stale when the incoming catalogue chunk cannot be fetched', async () => {
    const commit = await commitLanguage(
      request(GERMAN),
      deps({
        translatorFor: async () => {
          throw new Error('Failed to fetch dynamically imported module')
        },
      }),
    )
    expect(commit.status).toBe('stale')
  })

  it('is stale when the invalidation itself rejects', async () => {
    const commit = await commitLanguage(
      request(GERMAN),
      deps({
        refresh: async () => {
          throw new Error('aborted')
        },
      }),
    )
    expect(commit.status).toBe('stale')
  })

  it('keeps the selection on what was written, never on what it was before', async () => {
    const commit = await commitLanguage(
      request(GERMAN, 'pl'),
      deps({ refreshed: () => false }),
    )
    expect(commit.status).toBe('stale')
    if (commit.status !== 'stale') return
    expect(commit.landed).toBe(GERMAN)
  })
})
