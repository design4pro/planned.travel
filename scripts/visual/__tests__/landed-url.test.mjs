/**
 * The comparison that replaced the anonymous-only list.
 *
 * There is no drift half to this test any more: the module makes no claim about `src/routes/`, so
 * there is nothing for a second model of the router to disagree with. What is asserted here is
 * behaviour — which differences are a redirect, which are noise, and that the sentence carries both
 * fixes so a reader never has to open the script to know what to do.
 */

import { describe, expect, it } from 'vitest'

import { landedUrlWarning } from '../landed-url.mjs'

describe('landedUrlWarning', () => {
  it('says nothing when the frame was taken on the screen that was asked for', () => {
    expect(
      landedUrlWarning({
        requestedUrl: 'http://localhost:3030/dashboard',
        landedUrl: 'http://localhost:3030/dashboard',
      }),
    ).toBeUndefined()
  })

  it('ignores a trailing slash, a query and a hash — none of them is a different screen', () => {
    for (const [requestedUrl, landedUrl] of [
      ['http://localhost:3030/login', 'http://localhost:3030/login/'],
      ['http://localhost:3030/login/', 'http://localhost:3030/login'],
      [
        'http://localhost:3030/login',
        'http://localhost:3030/login?redirect=%2Ftrips%2F1',
      ],
      ['http://localhost:3030/atlas', 'http://localhost:3030/atlas#top'],
      ['http://localhost:3030/', 'http://localhost:3030'],
    ]) {
      expect(
        landedUrlWarning({ requestedUrl, landedUrl }),
        landedUrl,
      ).toBeUndefined()
    }
  })

  it('ignores the origin, so a local capture and the reference demo compare as one screen', () => {
    expect(
      landedUrlWarning({
        requestedUrl: 'http://localhost:3030/pricing',
        landedUrl: 'https://demo.liketrek.com/pricing',
      }),
    ).toBeUndefined()
  })

  it('names both screens and both fixes when the pathnames differ', () => {
    const warning = landedUrlWarning({
      requestedUrl: 'http://localhost:3030/console',
      landedUrl: 'http://localhost:3030/dashboard',
    })
    expect(warning).toBeTypeOf('string')
    expect(warning).toContain('/console')
    expect(warning).toContain('/dashboard')
    // Both fixes, unconditionally: the function is told nothing about the caller's flags.
    expect(warning).toContain('--url')
    expect(warning).toContain('--auth')
  })

  it('warns on a legitimate redirect too — there is no allowlist to reintroduce', () => {
    expect(
      landedUrlWarning({
        requestedUrl: 'http://localhost:3030/trips/1',
        landedUrl: 'http://localhost:3030/trips/1/plan',
      }),
    ).toContain('/trips/1/plan')
  })

  it('does not mistake a shared prefix for the same screen', () => {
    expect(
      landedUrlWarning({
        requestedUrl: 'http://localhost:3030/login',
        landedUrl: 'http://localhost:3030/logins',
      }),
    ).toBeTypeOf('string')
  })
})
