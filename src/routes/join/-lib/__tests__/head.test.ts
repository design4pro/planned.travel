import { describe, expect, it } from 'vitest'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import { JOIN_HEADERS, joinHead } from '../head'

const meta = (matches: Parameters<typeof joinHead>[0]) =>
  joinHead(matches).meta as Array<Record<string, string>>

describe('joinHead', () => {
  it('keeps the page out of indexes and the secret out of referrers', () => {
    const tags = meta([])
    expect(tags).toContainEqual({
      name: 'robots',
      content: 'noindex, nofollow',
    })
    expect(tags).toContainEqual({ name: 'referrer', content: 'no-referrer' })
  })

  it('writes the generic title and description, in the visitor language, with no trip in them', () => {
    const messages = namespaceCatalogue('trips', Trips)
    const tags = meta([{ loaderData: { locale: 'en', messages } }])
    expect(tags).toContainEqual({ title: 'Trip invite link' })
    expect(tags).toContainEqual({
      name: 'description',
      content: 'Open this link to join a shared trip on planned.travel.',
    })
    const text = tags.flatMap((tag) => Object.values(tag)).join(' ')
    expect(text).not.toMatch(/[{}]|inviter|Lisbon/)
    expect(tags.some((tag) => tag.property === 'og:image')).toBe(false)
  })

  it('answers every response with no-store, no-referrer and noindex', () => {
    expect(JOIN_HEADERS['cache-control']).toContain('no-store')
    expect(JOIN_HEADERS['referrer-policy']).toBe('no-referrer')
    expect(JOIN_HEADERS['x-robots-tag']).toContain('noindex')
  })
})
