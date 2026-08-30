import { describe, expect, it } from 'vitest'

import { consoleTranslate as t } from '#/lib/i18n/__tests__/console-translate'
import { describeUserAgent } from '../user-agent'

/**
 * The console's session list identifies a device by this string, and an operator revoking one is
 * matching it against "the laptop I left at the office". Every real user-agent begins `Mozilla/5.0`,
 * every Chromium browser also says `Chrome`, and every WebKit browser also says `Safari`, so the
 * order of the tests inside this function is the whole of its correctness.
 */
describe('describeUserAgent', () => {
  const agents: ReadonlyArray<readonly [string, string]> = [
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Chrome on macOS',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      'Safari on macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      'Safari on iPhone',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      'Edge on Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
      'Firefox on Windows',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      'Chrome on Android',
    ],
    [
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Chrome on ChromeOS',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/115.0.0.0',
      'Opera on Windows',
    ],
  ]

  it('names the browser and the platform for the agents this product actually sees', () => {
    for (const [agent, expected] of agents) {
      expect(describeUserAgent(t, agent), agent).toBe(expected)
    }
  })

  it('prefers the narrower browser name over the one every browser also claims', () => {
    // Edge says `Chrome` and `Safari` as well; Android's Chrome says `Safari` too. A wrong order
    // here labels every device in the list "Safari" and the column stops distinguishing anything.
    expect(describeUserAgent(t, 'Edg/131 Chrome/131 Safari/537.36')).toBe(
      'Edge',
    )
    expect(describeUserAgent(t, 'Chrome/131 Safari/537.36')).toBe('Chrome')
  })

  it('reports what it could not read rather than guessing', () => {
    expect(describeUserAgent(t, null)).toBe('Unrecognised device')
    expect(describeUserAgent(t, '   ')).toBe('Unrecognised device')
    expect(describeUserAgent(t, 'curl/8.4.0')).toBe('Unrecognised device')
  })

  it('answers with whichever half it could read', () => {
    expect(describeUserAgent(t, 'something (iPhone)')).toBe('iPhone')
    expect(describeUserAgent(t, 'Firefox/133.0')).toBe('Firefox')
  })
})
