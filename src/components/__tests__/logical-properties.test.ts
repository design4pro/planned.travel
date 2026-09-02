import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `docs/SPEC.md` §8.4 for everything outside the primitives.
 *
 * `src/components/ui/__tests__/i18n-rtl.test.tsx` already reads this rule off
 * the forty primitives, and reads it more strictly than this file does: it
 * inventories every physical transform per file and names the guard that makes
 * each one correct. What it does not do is look anywhere else. Every screen,
 * every module board and every route helper sat outside it, and 113 physical
 * utilities had collected there — a reply quote whose marker was on the wrong
 * edge in Arabic, a plan rail pinned to the physical left, a dozen `ml-auto`
 * pushes that shove the wrong way once the reader starts on the right.
 *
 * The failure mode is what makes a source rule the right tool: it is silent in
 * twenty-two of the twenty-three languages, and invisible in the one nobody has
 * open while they work.
 */

/** The primitives have their own, stricter gate; this reads everything else. */
const ROOTS = ['src/components', 'src/routes'] as const
const ALREADY_GATED = 'src/components/ui/'

/**
 * Utilities with an exact logical twin. Tailwind v4 compiles `ms-*`, `pe-*`,
 * `start-*`, `text-start`, `border-e` and `rounded-s-*` straight to logical
 * properties, so converting one is a rename and nothing else.
 *
 * A centring half is excluded: `left-1/2` lands on the same pixel in both
 * directions and has no logical spelling to move to.
 */
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

/**
 * Files whose physical sides are the design. Each reason is the same shape as
 * `sheet.tsx`'s in the primitives' gate: the thing being positioned against is
 * itself physical, so mirroring the offset would move it away from its anchor.
 */
const PHYSICAL_BY_DESIGN: Readonly<Record<string, string>> = {
  // A tooltip arrow is a rotated square with two of its four edges drawn. Which
  // two depends on the physical side the positioning library picked, and that
  // library flips the side for RTL itself — so mirroring the drawn edges would
  // swap them against a position that already moved. The same file anchors its
  // hover layer at a map coordinate, and a longitude does not mirror either.
  'src/components/atlas/country-overlay.tsx': 'tooltip arrow, map anchor',
  'src/components/atlas/country-card.tsx': 'tooltip arrow',
  'src/components/map/marker-popover.tsx': 'tooltip arrow',
  // A map pin is a teardrop with a physical tail; its corner badge is placed
  // against that shape rather than against the reading flow.
  'src/components/map/pins.tsx': 'marker geometry',
  // `CredentialOutcome = … | 'left-alone'` is a union member that happens to be
  // spelled with a hyphen. Seed provisioning code, no markup in it at all.
  'src/routes/api/dev/-seed/bootstrap.ts': 'a union member, not a class',
}

/**
 * Utilities with no logical spelling at all, so they cannot be converted — only
 * decided. `transform`, `transform-origin` and `linear-gradient()` take
 * physical keywords only.
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

/**
 * The centring half, allowed anywhere without a note.
 *
 * `-translate-x-1/2` under `left-1/2` is the one physical transform that is
 * direction-agnostic in effect: it lands on the same pixel whichever way the
 * document runs, so there is no sign to get wrong and nothing to guard.
 */
const CENTRING = '-translate-x-1/2'

/** Every other physical transform outside the primitives, and its reason. */
const DECIDED_TRANSFORM: Readonly<Record<string, ReadonlyArray<string>>> = {
  // A shimmer sweep across a skeleton. The gradient is symmetrical —
  // `from-transparent via-surface/70 to-transparent` — so a sweep that runs the
  // same physical way in Arabic is not distinguishable from one that does not,
  // and mirroring it would buy nothing.
  'src/components/layout/kit.tsx': ['-translate-x-full', 'bg-gradient-to-r'],
  // A bar that fills from the reading start. `transform-origin` has no logical
  // keyword, so the *track* carries `rtl:-scale-x-100` and turns the whole box
  // round instead — the device `ui/progress.tsx` uses for the same problem.
  'src/components/costs/split-editor.tsx': ['origin-left'],
  'src/routes/_app/trips/$tripId/-costs/rail.tsx': ['origin-left'],
}

/** The mirror that makes an `origin-left` above correct. */
const TRANSFORM_GUARD: Readonly<Record<string, string>> = {
  'src/components/costs/split-editor.tsx': 'rtl:-scale-x-100',
  'src/routes/_app/trips/$tripId/-costs/rail.tsx': 'rtl:-scale-x-100',
}

/**
 * The inline half, and the one that has already shipped a defect twice.
 *
 * `src/styles/styles.css` resets `transform: none !important` on
 * `[data-motion-transform]` under `prefers-reduced-motion`. An element that
 * carries the attribute *and* states a value as an inline `transform` therefore
 * renders that value as identity for the readers who asked for less movement —
 * which is how `ui/progress.tsx` once drew every determinate bar as a full
 * track, and how `costs/split-editor.tsx` drew every split as fully claimed and
 * `-costs/rail.tsx` every category at its full budget.
 *
 * `translate`, `scale` and `rotate` are separate CSS properties, measured
 * against the installed Tailwind 4.3.3, and the reset does not touch them. So an
 * inline `transform` is one of two mistakes: motion, which belongs in a class
 * where the reset can reach it, or a value, which must never be reset at all.
 */
const INLINE_TRANSFORM =
  /\b(?:transform|translate|scale|rotate)\s*:\s*(?:`[^`]*`|'[^']*'|"[^"]*"|[\w.%-]+)/g

/**
 * The only files allowed a bare inline `transform`.
 *
 * dnd-kit hands back a composed `translate3d(…) scaleX(…)` string from
 * `CSS.Transform.toString()`, and a drag offset is a position rather than
 * decoration: it must survive reduce-motion, and neither element carries
 * `data-motion-transform`, so the reset cannot reach it.
 */
const DRAG_OWNED: ReadonlySet<string> = new Set([
  'src/components/modules/lists/lists-board.tsx',
  'src/components/planner/stop-row.tsx',
])

interface Source {
  readonly path: string
  readonly text: string
}

function sources(): ReadonlyArray<Source> {
  const found: Array<Source> = []

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(path)
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        const relative = path.slice(path.indexOf('/src/') + 1)
        if (relative.startsWith(ALREADY_GATED)) continue
        found.push({ path: relative, text: readFileSync(path, 'utf8') })
      }
    }
  }

  for (const root of ROOTS) walk(join(process.cwd(), root))
  return found
}

/** Comments explain the exceptions; they are not the code under test. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const SOURCES = sources()

describe('logical properties outside the primitives', () => {
  it('reads the tree it means to check', () => {
    // A walk that found nothing would pass every rule below for free.
    expect(SOURCES.length).toBeGreaterThan(150)
    expect(SOURCES.map((source) => source.path)).toContain(
      'src/components/modules/collab/thread.tsx',
    )
  })

  it('uses a logical utility wherever one exists', () => {
    const physical: Array<string> = []

    for (const source of SOURCES) {
      if (source.path in PHYSICAL_BY_DESIGN) continue
      const found = code(source.text).match(PHYSICAL)
      if (found)
        physical.push(`${source.path}: ${[...new Set(found)].join(' ')}`)
    }

    expect(physical).toEqual([])
  })

  it('has decided every physical transform it cannot convert', () => {
    const undecided: Array<string> = []

    for (const source of SOURCES) {
      const found = (code(source.text).match(PHYSICAL_TRANSFORM) ?? []).filter(
        (entry) => entry !== CENTRING,
      )
      const decided = DECIDED_TRANSFORM[source.path] ?? []
      const extra = found.filter((entry) => !decided.includes(entry))
      if (extra.length > 0) {
        undecided.push(`${source.path}: ${[...new Set(extra)].join(' ')}`)
      }
    }

    expect(undecided).toEqual([])
  })

  it('mirrors the box wherever a transform origin is physical', () => {
    for (const [path, guard] of Object.entries(TRANSFORM_GUARD)) {
      const source = SOURCES.find((entry) => entry.path === path)
      expect(source, `${path} is no longer in the tree`).toBeDefined()
      expect(source?.text).toContain(guard)
    }
  })

  it('never states a value as an inline transform', () => {
    const inline: Array<string> = []

    for (const source of SOURCES) {
      if (DRAG_OWNED.has(source.path)) continue
      const found = (code(source.text).match(INLINE_TRANSFORM) ?? []).filter(
        (entry) => entry.startsWith('transform'),
      )
      if (found.length > 0) inline.push(`${source.path}: ${found.join(' ')}`)
    }

    expect(inline).toEqual([])
  })
})
