// @vitest-environment jsdom
import './test-env'

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { addDays } from 'date-fns'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { AvatarStack } from '../avatar-stack'
import { CountBadge } from '../badge'
import { Calendar } from '../calendar'
import { Chip } from '../chip'
import { DateRangePicker } from '../date-range-picker'
import { Pagination } from '../pagination'
import { Progress } from '../progress'
import { Sheet, SheetContent, SheetTitle } from '../sheet'
import { Skeleton } from '../skeleton'
import { Slider } from '../slider'
import { Spinner } from '../spinner'
import { StatCard } from '../stat-card'
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

  it('mirrors a rising delta, because a rise reads towards the start', () => {
    const { container } = render(
      <StatCard
        label="Spend"
        value="12"
        trend={{ direction: 'up', value: '+4' }}
      />,
    )
    expect(container.querySelectorAll('[data-mirror-rtl]')).toHaveLength(1)
  })

  it('leaves a flat delta alone, because a dash flips into itself', () => {
    const { container } = render(
      <StatCard
        label="Spend"
        value="12"
        trend={{ direction: 'flat', value: '0' }}
      />,
    )
    expect(container.querySelectorAll('[data-mirror-rtl]')).toHaveLength(0)
  })

  it('turns the skeleton shimmer round rather than letting it run backwards', () => {
    const { container } = render(<Skeleton data-testid="block" />)
    const block = screen.getByTestId('block')
    expect(block.className).toContain('before:animate-shimmer')
    expect(block.className).toContain('rtl:before:-scale-x-100')
    // The pulse variant is opacity only, so it has nothing to turn round.
    render(<Skeleton animation="pulse" data-testid="pulse" />, {
      container: container.appendChild(document.createElement('div')),
    })
    expect(screen.getByTestId('pulse').className).not.toContain('scale-x')
  })
})

/**
 * Numbers a primitive writes itself.
 *
 * A number the caller hands in is the caller's to format, but these four write
 * their own, and `String(n)` was ASCII digits with an ASCII group separator in
 * every locale — the wrong separator in German, and a percent sign welded to the
 * wrong end of the figure in Turkish. They go through `src/lib/format.ts`, whose
 * tables are frozen against the workerd/WebKit divergence §8.5 calls a defect,
 * and the affixes that used to be part of a template string are catalogue keys,
 * so a translator can put the sign on the side their script puts it on.
 *
 * The locales here are chosen to make the assertions readable: German groups
 * with a full stop and Turkish puts the percent sign in front, where French
 * would have needed U+202F and U+00A0 spelled out as escapes. Measured while
 * writing this: `intlLocale: 'ar'` in the frozen table resolves to CLDR's
 * `latn` numbering system, so Arabic renders `1,234` rather than `١٢٣٤` — the
 * Arabic-Indic digits belong to `ar-EG`, which we do not ship.
 */
describe('a number a primitive writes for itself', () => {
  it('puts the percent sign where the locale puts it', () => {
    render(withLocale('tr', {}, <Progress value={42} label="Budget" />))
    expect(screen.getByText('%42')).not.toBeNull()
  })

  it('groups the figure the way the locale groups', () => {
    render(
      withLocale('de', {}, <Progress value={1234} max={10000} label="B" />),
    )
    expect(screen.getByText('12 %')).not.toBeNull()
  })

  it('lets an explicit valueText win over the primitive’s own', () => {
    render(
      withLocale(
        'de',
        {},
        <Progress value={42} label="Budget" valueText="5 GB" />,
      ),
    )
    expect(screen.getByText('5 GB')).not.toBeNull()
  })

  it('takes the count badge’s cap marker from the catalogue', () => {
    render(
      withLocale(
        'de',
        { 'ui.badge.overflow': '{max}+' },
        <CountBadge count={1234} />,
      ),
    )
    expect(screen.getByText('99+')).not.toBeNull()
  })

  it('groups a count that is under the cap', () => {
    render(withLocale('de', {}, <CountBadge count={1234} max={9999} />))
    expect(screen.getByText('1.234')).not.toBeNull()
  })

  /**
   * A plural message's number is two things at once, and §8 splits them.
   *
   * `count` chooses the CLDR branch — one branch in Japanese, six in Arabic —
   * and never reaches the sentence. The figure the reader sees goes through the
   * frozen formatter first and arrives as an already-grouped string, because a
   * raw `{count}` renders ASCII digits with no separator in every one of the
   * twenty-three locales. German is the readable assertion: it groups with a
   * full stop, so `1.234` proves the formatter ran and `1234` proves it did not.
   */
  it('groups the figure in a plural message while count still picks the branch', () => {
    const from = new Date(2026, 0, 1)
    render(
      withLocale(
        'de',
        {
          'ui.dateRange.nights': {
            one: '{nights} Nacht',
            other: '{nights} Nächte',
          },
        },
        <DateRangePicker
          ariaLabel="Reisedaten"
          presets={[]}
          value={{ from, to: addDays(from, 1234) }}
        />,
      ),
    )
    expect(
      screen.getByRole('button', { name: 'Reisedaten' }).textContent,
    ).toContain('1.234 Nächte')
  })

  it('takes the singular branch from count, not from the formatted string', () => {
    const from = new Date(2026, 0, 1)
    render(
      withLocale(
        'de',
        {
          'ui.dateRange.nights': {
            one: '{nights} Nacht',
            other: '{nights} Nächte',
          },
        },
        <DateRangePicker
          ariaLabel="Reisedaten"
          presets={[]}
          value={{ from, to: addDays(from, 1) }}
        />,
      ),
    )
    expect(
      screen.getByRole('button', { name: 'Reisedaten' }).textContent,
    ).toContain('1 Nacht')
  })

  it('lets an RTL catalogue move the overflow sign to the other side', () => {
    render(
      withLocale(
        'ar',
        { ...AR, 'ui.avatar.more': '{hidden}+' },
        <AvatarStack
          people={[
            { id: '1', name: 'Mira' },
            { id: '2', name: 'Tomas' },
            { id: '3', name: 'Ana' },
          ]}
          max={1}
        />,
      ),
    )
    expect(screen.getByText('2+')).not.toBeNull()
  })

  it('groups a slider bubble, and steps aside for an explicit formatter', () => {
    const { rerender } = render(
      withLocale('de', {}, <Slider showValue value={[2500]} max={5000} />),
    )
    expect(screen.getByText('2.500')).not.toBeNull()

    rerender(
      withLocale(
        'de',
        {},
        <Slider
          showValue
          value={[2500]}
          max={5000}
          formatValue={(next) => `${next} km`}
        />,
      ) as never,
    )
    expect(screen.getByText('2500 km')).not.toBeNull()
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

  /**
   * The other half of §8.4, and the harder one.
   *
   * A transform, a `transform-origin` and a gradient direction have **no**
   * logical spelling in CSS: there is no `translate-inline`, no
   * `transform-origin: inline-start`, and `linear-gradient()` takes physical
   * keywords only. So the utilities below cannot be converted, only *decided*,
   * and each occurrence has to be one of exactly three things:
   *
   * - a **centring half** — `-translate-x-1/2` under `left-1/2`, which lands on
   *   the same pixel in both directions and needs no sign at all;
   * - a **signed custom property** resolved once from the negotiated direction,
   *   which is what `switch.tsx` and `tabs.tsx` do and why: Tailwind compiles
   *   `rtl:` to a zero-specificity `:where()`, so two competing `translate`
   *   utilities would be settled by emission order rather than by intent;
   * - a **mirrored ancestor** — an `rtl:-scale-x-100` that turns the whole
   *   symmetrical box round, which is how `progress.tsx` reverses its
   *   indeterminate sweep and `skeleton.tsx` its shimmer.
   *
   * The table is the whole inventory. A new unguarded `translate-x-*` fails
   * here, which is the only place it would fail before someone opened Arabic.
   */
  const PHYSICAL_TRANSFORM = new RegExp(
    [
      String.raw`-?translate-x-[^\s'"\`]+`,
      String.raw`\borigin-(?:left|right)\b`,
      String.raw`\bfloat-(?:left|right)\b`,
      String.raw`\bbg-(?:linear|gradient)-to-(?:l|r)\b`,
    ].join('|'),
    'g',
  )

  /** Every occurrence in the directory, and the decision that covers it. */
  const DECIDED: Readonly<Partial<Record<string, ReadonlyArray<string>>>> = {
    // Centred over the viewport; symmetrical, so no sign.
    'fab.tsx': ['-translate-x-1/2'],
    // The value bubble over a thumb, and a tick mark. Both centred.
    'slider.tsx': ['-translate-x-1/2', '-translate-x-1/2'],
    // Signed once from `dir`, so the thumb never leaves the track.
    'switch.tsx': ['translate-x-0', 'translate-x-(--thumb-travel)'],
    // Signed once from `dir`, so the pill walks with the reader.
    'tabs.tsx': ['translate-x-[calc(var(--tab-index)*var(--tab-dir)*100%)]'],
    // Read through the track's own `rtl:-scale-x-100`.
    'progress.tsx': ['origin-left'],
    // Read through the pseudo-element's own `rtl:before:-scale-x-100`.
    'skeleton.tsx': ['bg-linear-to-r'],
  }

  /** The mirror or the sign that makes an entry above correct. */
  const GUARD: Readonly<Partial<Record<string, string>>> = {
    'switch.tsx': "dir === 'rtl'",
    'tabs.tsx': "dir === 'rtl'",
    'progress.tsx': 'rtl:-scale-x-100',
    'skeleton.tsx': 'rtl:before:-scale-x-100',
  }

  for (const name of files) {
    it(`${name} has decided every physical transform it uses`, () => {
      const source = code(readFileSync(join(directory, name), 'utf8'))
      expect(source.match(PHYSICAL_TRANSFORM) ?? []).toEqual(
        DECIDED[name] ?? [],
      )
      const guard = GUARD[name]
      if (guard !== undefined) expect(source).toContain(guard)
    })
  }
})
