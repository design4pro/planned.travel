// @vitest-environment jsdom
import './test-env'

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { Calendar } from '../calendar'
import { Chip } from '../chip'
import { Pagination } from '../pagination'
import { Sheet, SheetContent, SheetTitle } from '../sheet'
import { Spinner } from '../spinner'
import { Switch } from '../switch'
import { Tabs, TabsList, TabsTrigger } from '../tabs'

import type { ReactNode } from 'react'
import type { Catalogue, Locale } from '#/lib/i18n'

afterEach(cleanup)

/**
 * What this file locks in, and why each half of it exists.
 *
 * **Copy.** `docs/SPEC.md` §8 gives the design system the `ui` namespace, and
 * every word these primitives say on their own behalf now comes out of it
 * through `useUiI18n()`. Two things have to stay true: a primitive rendered
 * under an `I18nProvider` says what that catalogue says, and a primitive
 * rendered with no provider at all still renders — nineteen sibling test files
 * and the module suites in `src/components/atlas` do exactly that, and a
 * primitive that demanded a provider would break every one of them.
 *
 * **Direction.** §8.4 calls RTL a designed layout rather than a flipped
 * afterthought. Most of that is bought with logical properties, which is a
 * source-level property and is checked as one at the bottom of this file. What
 * logical properties cannot express is a transform, so the three primitives that
 * animate along the inline axis — the switch thumb, the segmented tab pill and
 * the progress fill — carry an explicit sign, and the calendar's horizontal
 * arrow keys have to follow the reading direction rather than the screen.
 */

/** A stand-in catalogue: only the keys a test actually reads. */
function withLocale(
  locale: Locale,
  messages: Catalogue,
  children: ReactNode,
): ReactNode {
  return (
    <I18nProvider locale={locale} messages={messages}>
      {children}
    </I18nProvider>
  )
}

const PL: Catalogue = {
  'ui.action.remove': 'Usuń',
  'ui.status.loading': 'Wczytywanie',
  'ui.calendar.monthYear': '{month} {year}',
  'ui.calendar.grid': '{month} — {label}',
  'ui.calendar.label.date': 'Wybierz datę',
  'ui.calendar.previousMonth': 'Poprzedni miesiąc',
  'ui.calendar.nextMonth': 'Następny miesiąc',
  'ui.calendar.showing': 'Widoczne: {months}',
  'ui.calendar.day': '{weekday} {day} {month} {year}',
}

const AR: Catalogue = {
  ...PL,
  'ui.pagination.label': 'ترقيم الصفحات',
  'ui.pagination.previous': 'الصفحة السابقة',
  'ui.pagination.next': 'الصفحة التالية',
  'ui.pagination.page': 'صفحة {page}',
}

const march = new Date(2026, 2, 1)

describe('a primitive with no provider above it', () => {
  it('still renders, in the source locale', () => {
    render(<Spinner />)
    expect(screen.getByText('Loading').className).toContain('sr-only')
  })

  it('lets an explicit prop win over the source copy', () => {
    render(
      <Chip onRemove={() => {}} removeLabel="Remove Kyoto">
        Kyoto
      </Chip>,
    )
    expect(screen.getByRole('button', { name: 'Remove Kyoto' })).not.toBeNull()
  })
})

describe('a primitive under a provider', () => {
  it('says what that catalogue says', () => {
    render(withLocale('pl', PL, <Spinner />))
    expect(screen.getByText('Wczytywanie')).not.toBeNull()
  })

  it('renders the key, never English, for a message the locale lacks', () => {
    render(withLocale('pl', {}, <Spinner />))
    expect(screen.getByText('ui.status.loading')).not.toBeNull()
  })
})

describe('Calendar names', () => {
  it('come from the frozen CLDR table for the active locale', () => {
    render(withLocale('pl', PL, <Calendar defaultMonth={march} />))
    expect(screen.getByText('marzec 2026')).not.toBeNull()
    expect(screen.getByText('pon.')).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'niedziela 15 marzec 2026' }),
    ).not.toBeNull()
  })

  it('are English under the source locale, from the same table', () => {
    render(<Calendar defaultMonth={march} />)
    expect(screen.getByText('March 2026')).not.toBeNull()
    expect(screen.getByText('Mon')).not.toBeNull()
  })
})

describe('the inline axis under dir="rtl"', () => {
  it('walks the calendar forward with ArrowLeft', async () => {
    const user = userEvent.setup()
    render(
      withLocale(
        'ar',
        AR,
        <Calendar defaultMonth={march} selected={new Date(2026, 2, 9)} />,
      ),
    )
    const day = (n: number) =>
      screen.getByRole('button', {
        name: new RegExp(`\\s${n}\\s`),
      })

    day(9).focus()
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement?.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(day(10))
  })

  it('sends the switch thumb the other way', () => {
    const { rerender } = render(
      withLocale('pl', PL, <Switch checked data-testid="switch" />),
    )
    const thumb = () =>
      screen.getByTestId('switch').firstElementChild as HTMLElement
    expect(thumb().style.getPropertyValue('--thumb-travel')).toBe('1rem')

    rerender(
      withLocale('ar', AR, <Switch checked data-testid="switch" />) as never,
    )
    expect(thumb().style.getPropertyValue('--thumb-travel')).toBe('-1rem')
  })

  it('sends the segmented tab pill the other way', () => {
    const tabs = (
      <Tabs variant="segmented" defaultValue="b">
        <TabsList data-testid="list">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    const { rerender } = render(withLocale('pl', PL, tabs))
    const thumb = () =>
      screen.getByTestId('list').firstElementChild as HTMLElement
    expect(thumb().style.getPropertyValue('--tab-dir')).toBe('1')

    rerender(withLocale('ar', AR, tabs) as never)
    expect(thumb().style.getPropertyValue('--tab-dir')).toBe('-1')
  })
})

describe('a sheet anchored to the inline end', () => {
  const sheet = (
    <Sheet open modal={false}>
      <SheetContent side="end" data-testid="panel" hideClose>
        <SheetTitle>Details</SheetTitle>
      </SheetContent>
    </Sheet>
  )

  it('is the physical right edge when reading runs that way', () => {
    render(withLocale('pl', PL, sheet))
    expect(screen.getByTestId('panel').className).toContain('right-0')
  })

  it('is the physical left edge under an RTL locale', () => {
    render(withLocale('ar', AR, sheet))
    expect(screen.getByTestId('panel').className).toContain('left-0')
  })
})

describe('directional glyphs', () => {
  it('carry the attribute src/styles/styles.css mirrors on', () => {
    const { container } = render(
      withLocale('ar', AR, <Pagination pageCount={9} defaultPage={4} />),
    )
    // Both arrows, and neither of the page buttons.
    expect(container.querySelectorAll('[data-mirror-rtl]')).toHaveLength(2)
  })
})

/**
 * The source-level half of §8.4.
 *
 * Tailwind v4 compiles `ms-*`, `pe-*`, `start-*`, `text-start`, `border-e` and
 * `rounded-s-*` straight to logical properties, so a primitive written in them
 * mirrors with no `[dir]` selector anywhere. This test is what stops a physical
 * one from creeping back in — the failure mode is silent in every locale but
 * Arabic, which is the one nobody has open while they work.
 */
describe('the directory itself', () => {
  const directory = join(process.cwd(), 'src/components/ui')

  /**
   * `sheet.tsx` names four *physical* edges on purpose: `vaul` needs a physical
   * `direction` on the root to know which way the drag runs, and a sheet pinned
   * to the physical left edge rounds its physical right corners in every script.
   * Its logical `start`/`end` sides are the direction-aware affordance, and the
   * two tests above check those through the rendered component instead.
   */
  const PHYSICAL_BY_DESIGN = new Set(['sheet.tsx'])

  /** Utilities with a genuine logical twin. Centring halves are not among them. */
  const PHYSICAL = new RegExp(
    [
      String.raw`\b-?(ml|mr|pl|pr)-[\w./\[\]-]+`,
      String.raw`\btext-(left|right)\b`,
      String.raw`\bborder-(l|r)\b`,
      String.raw`\brounded-(l|r|tl|tr|bl|br)-[\w./\[\]-]+`,
      String.raw`\b-?(left|right)-(?!1\/2)[\w./\[\]-]+`,
    ].join('|'),
    'g',
  )

  /** Comments explain the exceptions; they are not the code under test. */
  function code(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  }

  const files = readdirSync(directory).filter(
    (name) => name.endsWith('.tsx') || name.endsWith('.ts'),
  )

  it('reads the primitives it means to check', () => {
    expect(files.length).toBeGreaterThan(30)
    expect(files).toContain('calendar.tsx')
  })

  for (const name of files) {
    if (PHYSICAL_BY_DESIGN.has(name)) continue
    it(`${name} lays itself out logically`, () => {
      const found = code(readFileSync(join(directory, name), 'utf8')).match(
        PHYSICAL,
      )
      expect(found ?? []).toEqual([])
    })
  }
})
