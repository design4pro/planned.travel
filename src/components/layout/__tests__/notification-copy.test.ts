import { describe, expect, it } from 'vitest'

import { createStoredTranslator, createTranslator } from '#/lib/i18n'
import en from '#/lib/i18n/messages/en/shell'
import {
  eventOf,
  notificationCopy,
  paramsFrom,
} from '../notification-copy'

import type { Catalogue, Locale } from '#/lib/i18n'
import type { StoredNotification } from '../notification-copy'

/**
 * The promise `src/server/repos/notifications.ts` makes in its own docstring —
 * "a notification written a year ago still renders in the reader's current
 * language" — is only true if the render path resolves the stored key against
 * the reader's catalogue. These tests are that claim, made checkable.
 *
 * The Polish bag below is a fixture, not a translation: `messages/pl/` belongs
 * to a translation item (`docs/SPEC.md` §8, ownership), and what is under test
 * is the mechanism, not anyone's wording.
 */

/** The shipped English namespace, keyed the way a merged catalogue is. */
const ENGLISH: Catalogue = Object.fromEntries(
  Object.entries(en).map(([key, message]) => [`shell.${key}`, message]),
)

const POLISH: Catalogue = {
  ...ENGLISH,
  'shell.notification.trip.invited.title':
    'Zaproszono Cię do wyjazdu {tripTitle}',
  'shell.notification.trip.invited.body': '{actorName} dodał Cię do wyjazdu.',
  'shell.notification.trip.starting_soon.title': {
    one: '{tripTitle} zaczyna się za {days} dzień',
    few: '{tripTitle} zaczyna się za {days} dni',
    many: '{tripTitle} zaczyna się za {days} dni',
    other: '{tripTitle} zaczyna się za {days} dnia',
  },
  'shell.notification.fallback.title': 'Coś się zmieniło w Twojej przestrzeni',
}

function render(row: StoredNotification, locale: Locale, bag: Catalogue) {
  return notificationCopy(row, {
    locale,
    t: createTranslator(locale, bag),
    tStored: createStoredTranslator(locale, bag),
  })
}

const INVITED: StoredNotification = {
  titleKey: 'trip.invited',
  titleParams: { tripTitle: 'Tokyo & Kyoto', actorName: 'Mika Tanaka' },
  bodyKey: 'trip.invited',
  bodyParams: { tripTitle: 'Tokyo & Kyoto', actorName: 'Mika Tanaka' },
}

describe('a stored row renders in the reader’s language', () => {
  it('resolves the event key against the English catalogue', () => {
    expect(render(INVITED, 'en', ENGLISH)).toEqual({
      title: 'You were invited to Tokyo & Kyoto',
      body: 'Mika Tanaka added you to the trip.',
    })
  })

  it('resolves the same row against another catalogue', () => {
    expect(render(INVITED, 'pl', POLISH)).toEqual({
      title: 'Zaproszono Cię do wyjazdu Tokyo & Kyoto',
      body: 'Mika Tanaka dodał Cię do wyjazdu.',
    })
  })

  it('never renders the stored key itself', () => {
    const copy = render(INVITED, 'en', ENGLISH)
    expect(copy.title).not.toContain('trip.invited')
    expect(copy.title).not.toContain('shell.')
  })

  it('accepts a legacy key that still carries its .title suffix', () => {
    expect(eventOf('trip.invited.title')).toBe('trip.invited')
    expect(eventOf('trip.invited.body')).toBe('trip.invited')
    expect(eventOf('trip.invited')).toBe('trip.invited')
    expect(
      render({ ...INVITED, titleKey: 'trip.invited.title' }, 'en', ENGLISH)
        .title,
    ).toBe('You were invited to Tokyo & Kyoto')
  })
})

describe('a count in a stored row picks the locale’s plural branch', () => {
  const soon = (days: string | number): StoredNotification => ({
    titleKey: 'trip.starting_soon',
    titleParams: { tripTitle: 'Tokyo & Kyoto', days },
    bodyKey: 'trip.starting_soon',
    bodyParams: { tripTitle: 'Tokyo & Kyoto', days },
  })

  it('selects `one` in English for a single day', () => {
    expect(render(soon(1), 'en', ENGLISH).title).toBe(
      'Tokyo & Kyoto starts in 1 day',
    )
  })

  it('selects `other` in English for several', () => {
    expect(render(soon(7), 'en', ENGLISH).title).toBe(
      'Tokyo & Kyoto starts in 7 days',
    )
  })

  it('selects Polish `few` for three, which English has no branch for', () => {
    expect(render(soon(3), 'pl', POLISH).title).toBe(
      'Tokyo & Kyoto zaczyna się za 3 dni',
    )
  })

  it('reads a numeric string, because the column is JSON text', () => {
    expect(render(soon('1'), 'en', ENGLISH).title).toBe(
      'Tokyo & Kyoto starts in 1 day',
    )
  })
})

describe('numbers in a stored row are formatted for the locale', () => {
  it('groups a JSON number the way the locale groups', () => {
    expect(paramsFrom({ days: 1234 }, 'en')).toEqual({
      days: '1,234',
      count: 1234,
    })
    expect(paramsFrom({ days: 1234 }, 'de')).toEqual({
      days: '1.234',
      count: 1234,
    })
  })

  it('leaves a title that merely looks numeric alone', () => {
    expect(paramsFrom({ tripTitle: '2026' }, 'en')).toEqual({
      tripTitle: '2026',
    })
  })

  it('drops a null or boolean rather than printing it', () => {
    expect(paramsFrom({ a: null, b: true, c: 'kept' }, 'en')).toEqual({
      c: 'kept',
    })
  })

  it('survives an absent params record', () => {
    expect(paramsFrom(null, 'en')).toEqual({})
  })
})

describe('a row the catalogue cannot render degrades, never to English', () => {
  it('falls back when the event is unknown', () => {
    const copy = render(
      {
        titleKey: 'trip.teleported',
        titleParams: null,
        bodyKey: 'trip.teleported',
        bodyParams: null,
      },
      'pl',
      POLISH,
    )
    expect(copy.title).toBe('Coś się zmieniło w Twojej przestrzeni')
    // The English fallback body is not in POLISH's overrides, so this proves
    // the shape rather than the wording: what matters is that it is not the key.
    expect(copy.body).not.toContain('shell.')
  })

  it('falls back when a placeholder has no value, rather than showing the token', () => {
    const copy = render(
      {
        titleKey: 'trip.invited',
        titleParams: { actorName: 'Mika Tanaka' },
        bodyKey: 'trip.invited',
        bodyParams: { actorName: 'Mika Tanaka' },
      },
      'en',
      ENGLISH,
    )
    expect(copy.title).not.toContain('{tripTitle}')
    expect(copy.title).toBe('Something changed in your workspace')
    expect(copy.body).toBe('Mika Tanaka added you to the trip.')
  })

  it('keeps a resolved title when only the body is unrenderable', () => {
    const copy = render(
      {
        titleKey: 'trip.invited',
        titleParams: { tripTitle: 'Tokyo & Kyoto' },
        bodyKey: 'trip.invited',
        bodyParams: { tripTitle: 'Tokyo & Kyoto' },
      },
      'en',
      ENGLISH,
    )
    expect(copy.title).toBe('You were invited to Tokyo & Kyoto')
    expect(copy.body).toBeNull()
  })
})
