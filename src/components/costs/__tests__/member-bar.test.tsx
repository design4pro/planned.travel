import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { MEMBER_TINTS, MemberBar } from '../member-bar'

import type { Catalogue } from '#/lib/i18n'
import type { MemberShare } from '../chart-geometry'

const EN: Catalogue = namespaceCatalogue('costs', Costs)

afterEach(cleanup)

function member(
  userId: string,
  shareMinor: number,
  name = userId,
): MemberShare {
  return { userId, name, shareMinor }
}

function renderBar(members: ReadonlyArray<MemberShare>, spentMinor: number) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <MemberBar members={members} spentMinor={spentMinor} />
    </I18nProvider>,
  )
}

/** What a screen reader reads: the text of a node with every `aria-hidden` subtree left out. */
function accessibleText(node: Node): string {
  if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') {
    return ''
  }
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }
  return [...node.childNodes].map(accessibleText).join('')
}

function rows(): Array<string> {
  return within(screen.getByRole('list', { name: 'Who it was spent on' }))
    .getAllByRole('listitem')
    .map((item) => accessibleText(item))
}

describe('MemberBar', () => {
  it('hides the bar from assistive technology', () => {
    const { container } = renderBar(
      [member('a', 600, 'Ana'), member('b', 400, 'Ben')],
      1_000,
    )

    const bar = container.querySelector('[data-part="member-bar"]')
    expect(bar?.getAttribute('aria-hidden')).toBe('true')
    expect(bar?.querySelectorAll('[data-segment]')).toHaveLength(2)
  })

  it('lists the segments in the bar’s order, each with a name and a percent', () => {
    renderBar(
      [
        member('a', 200, 'Ana'),
        member('b', 500, 'Ben'),
        member('c', 300, 'Cy'),
      ],
      1_000,
    )

    expect(rows()).toEqual(['Ben, 50%', 'Cy, 30%', 'Ana, 20%'])
  })

  it('gives the bar and the list the same segments in the same order', () => {
    const { container } = renderBar(
      [member('a', 200, 'Ana'), member('b', 500, 'Ben')],
      1_000,
    )
    const kinds = (root: Element) =>
      [...root.querySelectorAll('[data-segment]')].map((node) =>
        node.getAttribute('data-segment'),
      )

    const bar = container.querySelector('[data-part="member-bar"]')
    if (bar === null) {
      throw new Error('the member bar did not render')
    }
    expect(kinds(bar)).toEqual(kinds(screen.getByRole('list')))
    expect(kinds(screen.getByRole('list'))).toEqual([
      'member',
      'member',
      'unassigned',
    ])
  })

  it('shows the visible label and ties the list to it', () => {
    renderBar([member('a', 600, 'Ana'), member('b', 400, 'Ben')], 1_000)

    expect(screen.getByText('Who it was spent on').tagName).toBe('P')
    expect(
      screen.getByRole('list', { name: 'Who it was spent on' }),
    ).toBeDefined()
  })

  it('adds "Not assigned to anyone" last when the shares fall short', () => {
    renderBar([member('a', 600, 'Ana'), member('b', 300, 'Ben')], 1_000)

    expect(rows()).toEqual([
      'Ana, 60%',
      'Ben, 30%',
      'Not assigned to anyone, 10%',
    ])
  })

  it('groups everyone past four into "N other travellers", before the remainder', () => {
    renderBar(
      [
        member('a', 300, 'Ana'),
        member('b', 250, 'Ben'),
        member('c', 200, 'Cy'),
        member('d', 120, 'Dee'),
        member('e', 80, 'Eli'),
      ],
      1_000,
    )

    expect(rows()).toEqual([
      'Ana, 30%',
      'Ben, 25%',
      'Cy, 20%',
      '2 other travellers, 20%',
      'Not assigned to anyone, 5%',
    ])
  })

  it('has at most five rows', () => {
    renderBar(
      Array.from({ length: 9 }, (_, index) => member(`u${index}`, 50 + index)),
      1_000,
    )

    expect(rows()).toHaveLength(5)
  })

  it('does not count a member with no share among the other travellers', () => {
    renderBar(
      [
        member('a', 300, 'Ana'),
        member('b', 250, 'Ben'),
        member('c', 200, 'Cy'),
        member('d', 150, 'Dee'),
        member('e', 100, 'Eli'),
        member('f', 0, 'Flo'),
      ],
      1_000,
    )

    expect(rows()).toContain('2 other travellers, 25%')
  })

  it('shows the names it is given, already resolved, without a second copy of them', () => {
    renderBar(
      [member('me', 500, 'You'), member('gone', 500, 'Removed traveller')],
      1_000,
    )

    // A tie falls to the user id, so 'gone' comes before 'me'.
    expect(rows()).toEqual(['Removed traveller, 50%', 'You, 50%'])
  })

  it('reads a share under one percent as "<1%", spoken as "less than 1%"', () => {
    const { container } = renderBar(
      [member('a', 9_990, 'Ana'), member('b', 10, 'Ben')],
      10_000,
    )

    expect(rows()).toEqual(['Ana, 99%', 'Ben, less than 1%'])
    expect(container.textContent).toContain('<1%')
  })

  it('wraps a long name instead of cutting it off', () => {
    const name = 'Maximiliano Alessandro de la Cruz-Fernandez'
    renderBar([member('a', 600, name), member('b', 400, 'Ben')], 1_000)

    const label = screen.getByText(name)
    expect(label.className).toContain('[overflow-wrap:anywhere]')
    expect(label.className).not.toContain('truncate')
  })

  it('renders nothing below two segments: no bar, no label, no list', () => {
    const lone = renderBar([member('a', 1_000, 'Ana')], 1_000)
    expect(lone.container.innerHTML).toBe('')
    cleanup()

    const none = renderBar([member('a', 0, 'Ana')], 1_000)
    expect(none.container.innerHTML).toBe('')
    cleanup()

    const empty = renderBar([], 0)
    expect(empty.container.innerHTML).toBe('')
    expect(screen.queryByText('Who it was spent on')).toBeNull()
  })

  it('shows a member and the remainder as two segments', () => {
    renderBar([member('a', 400, 'Ana')], 1_000)

    expect(rows()).toEqual(['Ana, 40%', 'Not assigned to anyone, 60%'])
  })

  it('uses only logical properties', () => {
    const { container } = renderBar(
      [member('a', 600, 'Ana'), member('b', 400, 'Ben')],
      1_000,
    )

    expect(container.innerHTML).not.toMatch(
      /\b(?:ml|mr|pl|pr|left|right)-|text-(?:left|right)/,
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Contrast                                                                   */
/* -------------------------------------------------------------------------- */

// jsdom gives `import.meta.url` an http scheme, so the file is found from the repository root.
const TOKENS = readFileSync(
  join(process.cwd(), 'src/styles/tokens.css'),
  'utf8',
)

type Rgb = readonly [number, number, number]

function hex(value: string): Rgb {
  const digits = value.replace('#', '')
  return [0, 2, 4].map((at) =>
    Number.parseInt(digits.slice(at, at + 2), 16),
  ) as unknown as Rgb
}

function luminance([red, green, blue]: Rgb): number {
  const channel = (value: number): number => {
    const unit = value / 255
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
  )
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** `colour` at `alpha` laid over `ground`, channel by channel. */
function composite(colour: Rgb, alpha: number, ground: Rgb): Rgb {
  return colour.map(
    (value, at) => value * alpha + ground[at] * (1 - alpha),
  ) as unknown as Rgb
}

/**
 * Every `{ ... }` block of the token file that declares `--color-inverse`, each with the
 * three colours the bar uses read from that same block - the light slab and the two
 * dark declarations - so a colour is never paired with another block's ground.
 */
function inverseBlocks(): Array<{
  at: number
  ground: Rgb
  on: Rgb
  muted: Rgb
}> {
  const found: Array<{ at: number; ground: Rgb; on: Rgb; muted: Rgb }> = []
  for (const match of TOKENS.matchAll(/--color-inverse\s*:/g)) {
    const start = TOKENS.lastIndexOf('{', match.index)
    const end = TOKENS.indexOf('}', match.index)
    const block = TOKENS.slice(start, end)
    const read = (token: string): Rgb => {
      const value = block.match(
        new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`),
      )?.[1]
      if (value === undefined) {
        throw new Error(`${token} is not a hex colour in the block at ${start}`)
      }
      return hex(value)
    }
    found.push({
      at: start,
      ground: read('--color-inverse'),
      on: read('--color-inverse-on'),
      muted: read('--color-inverse-muted'),
    })
  }
  return found
}

describe('member bar contrast (WCAG 1.4.11)', () => {
  const blocks = inverseBlocks()

  it('reads the light declaration and both dark ones', () => {
    expect(blocks).toHaveLength(3)
  })

  it.each(blocks.map((block, index) => [index, block] as const))(
    'clears 3:1 against the tile ground for every tint and the outline (block %i)',
    (_index, { ground, on, muted }) => {
      for (const tint of MEMBER_TINTS) {
        expect(
          contrast(composite(on, tint, ground), ground),
          `tint ${tint}`,
        ).toBeGreaterThanOrEqual(3)
      }
      expect(contrast(muted, ground), 'outline').toBeGreaterThanOrEqual(3)
    },
  )

  it('steps the tints down, brightest first', () => {
    expect([...MEMBER_TINTS].sort((a, b) => b - a)).toEqual([...MEMBER_TINTS])
  })
})
