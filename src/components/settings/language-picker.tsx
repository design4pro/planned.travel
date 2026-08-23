import * as React from 'react'
import { Check } from 'lucide-react'

import { SectionLabel, Skeleton, Spinner } from '#/components/ui'
import { cn } from '#/lib/cn'
import { SUPPORTED_LOCALES, localeDescriptor } from '#/lib/i18n'

import type { Locale, LocaleDescriptor } from '#/lib/i18n'

/**
 * The value that means "no personal override — follow the workspace default".
 *
 * A sentinel rather than `null` because it is a real, selectable option in the
 * group: it owns a chip, a roving index and an `aria-checked` state exactly
 * like the twenty-three languages do, and modelling it as an absence made
 * every one of those three read as a special case.
 */
export const FOLLOW_WORKSPACE = 'workspace' as const

/** What the picker can be set to: one of the shipped locales, or "follow". */
export type LocaleChoice = Locale | typeof FOLLOW_WORKSPACE

export interface LanguagePickerProps {
  /** The traveller's current choice. */
  readonly value: LocaleChoice
  /** The workspace default, named in its own script on the "follow" option. */
  readonly workspaceDefault: Locale
  /** Called once per committed change. Never fired by focus movement. */
  readonly onSelect: (choice: LocaleChoice) => void
  /**
   * The choice currently being written. While it is set the group refuses
   * every further commit, which is what makes a double click one write; the
   * chip being written shows a spinner in place of its selection mark.
   */
  readonly pending?: LocaleChoice | null
  /** Turns the whole control off — no focus, no hover, no commit. */
  readonly disabled?: boolean
  /**
   * The group's visible heading, rendered in a `SectionLabel`.
   *
   * Copy arrives already translated: this component is presentational, so the
   * host route passes `t('settings.language.label')`. It cannot call `t()`
   * itself — `MessageKey` is derived from `messages/en/*.ts`, the `settings`
   * namespace is owned by a later item, and a key that does not exist yet is a
   * compile error rather than a runtime fallback (`docs/SPEC.md` §8.2).
   */
  readonly label: string
  /** The "follow the workspace" option's text — `t('settings.language.followWorkspace')`. */
  readonly followWorkspaceLabel: string
  readonly className?: string
}

interface PickerItem {
  readonly choice: LocaleChoice
  readonly descriptor: LocaleDescriptor | null
}

const ITEMS: ReadonlyArray<PickerItem> = [
  { choice: FOLLOW_WORKSPACE, descriptor: null },
  ...SUPPORTED_LOCALES.map((descriptor) => ({
    choice: descriptor.tag,
    descriptor,
  })),
]

/**
 * Every chip is the same 44px box whatever script it holds.
 *
 * `:lang(ar)` re-tunes `--text-label--line-height` from 1.4 to 1.6 and the CJK
 * faces have taller ink than Geist, so a chip sized by its own line box would
 * be a different height per row and the grid would reflow the moment the
 * catalogue swapped. A fixed height with the content centred takes the line box
 * out of the layout entirely: `docs/SPEC.md` §2's "zero layout shift after
 * paint" is then true by construction rather than by luck. 44px is also the
 * pointer target floor (WCAG 2.2 2.5.8), so the two constraints agree.
 */
const CHIP_BASE = [
  'relative flex h-11 min-w-0 items-center gap-2 rounded-md border px-3',
  'text-label text-start select-none',
  // `translate` and `scale`, not `transform`. Tailwind v4.3 compiles
  // `-translate-y-px` and `scale-98` to the standalone `translate` and `scale`
  // properties — measured against the pinned compiler — so a transition list
  // naming `transform` eases the colours and lets the lift and the press snap.
  'transition-[color,background-color,border-color,box-shadow,translate,scale,opacity]',
  'duration-base ease-out-quint focus-ring',
].join(' ')

/**
 * `edge-strong`, not the decorative `edge` hairline. The chip's border is the
 * only thing that says where the control is — its fill is the same `surface` as
 * the panel behind it — so it is the "visual information required to identify a
 * user interface component" that WCAG 2.2 1.4.11 asks for 3:1 on. `--color-edge`
 * lands near 1.3:1 in both themes and disappears outright on the dark panel;
 * `--color-edge-strong` is the token declared for exactly this, and it is what
 * `Chip` and every field in `src/components/ui` already wear.
 */
const CHIP_REST = 'border-edge-strong bg-surface text-ink-2'

/**
 * One line box for every script, 28px tall, pinned rather than inherited.
 *
 * Two measurements put it here. `:lang(ar)` re-leads `--text-label` from 1.4 to
 * 1.6, which made the Arabic name's box 20.8px against Latin's 18.2px — and a
 * flex row centres each item by its *box*, so العربية sat 1.3px higher than
 * Català in the same row of chips. And the name is truncatable, so its box is
 * `overflow: hidden`: Noto Sans Arabic spans 2.112 em against Geist's 1.3, so
 * an 18px box would have cropped the ink of the very script it was sized for.
 * 28px clears 2.112 em at this size with room over, lands on the 4px grid, and
 * gives every script one baseline. Height parity is then a property of the
 * markup rather than of whichever face happened to load.
 */
const NAME_LINE = 'leading-7'

/**
 * The same treatment the theme cards on `/settings/appearance` wear, so a
 * selection means one thing across the settings module. Weight deliberately
 * does NOT change: `text-label` already carries 500, and swapping to 600 on
 * commit would re-measure the name and pull `Bahasa Indonesia` into an
 * ellipsis the moment it was chosen.
 */
const CHIP_SELECTED = 'border-brand bg-brand-subtle text-brand shadow-card'

/**
 * The lift is 1px and it moves the chip's own `translate`, so it paints without
 * reflowing a single neighbour. `motion-reduce:` puts the chip back on the
 * baseline for a reader who asked for no movement, leaving only the colour
 * cross-fade — which the global reduced-motion rule in `src/styles/styles.css`
 * has already collapsed to 0.01ms. The rule there resets `transform`, which in
 * Tailwind v4.3 is not the property either of these utilities writes, so the
 * variant is doing real work rather than restating the global reset.
 */
const CHIP_INTERACTIVE = [
  'hover:-translate-y-px hover:shadow-card',
  'active:translate-y-0 active:scale-98',
  'motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
].join(' ')

const CHIP_REST_HOVER = 'hover:border-ink-4 hover:bg-surface-2 hover:text-ink'
const CHIP_SELECTED_HOVER = 'hover:border-brand-hover'

/**
 * One wrapped grid at every width, from 360px to 2560px — never a dropdown at
 * `sm`, because the whole point of the affordance is that someone stranded in
 * a script they cannot read finds their own language by shape. `auto-fill`
 * gives every chip the same width, so the block reads as a rectangle instead
 * of the ragged right edge a plain `flex-wrap` leaves. The `min(100%, …)`
 * floor is what stops the track from outgrowing a narrow container and
 * pushing a horizontal scrollbar onto the page.
 */
const GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,11.5rem),1fr))] gap-2'

/** Reads the direction the *group* is laid out in, so arrows follow the eye. */
function isRtl(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView
  if (view === null) return false
  return view.getComputedStyle(element).direction === 'rtl'
}

/**
 * How many chips share the first grid row.
 *
 * The grid is `auto-fill`, so the column count is a function of the container's
 * width and no React state knows it. Measuring it at keypress time is what lets
 * ArrowDown mean "the chip below this one" instead of "the next chip", which is
 * the difference between a grid and a list wearing a grid's clothes. Index 0 is
 * the full-width "follow" row and is skipped.
 */
function columnsIn(nodes: ReadonlyArray<HTMLButtonElement | null>): number {
  const first = nodes[1]
  if (!first) return 1
  let columns = 0
  for (let index = 1; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (!node || node.offsetTop !== first.offsetTop) break
    columns += 1
  }
  // Every chip on one row means either a container wide enough to hold all
  // twenty-three, or an environment with no layout at all — jsdom reports
  // `offsetTop: 0` for everything. Both want the same answer: there is no row
  // below, so ArrowDown should behave as ArrowRight rather than firing the
  // reader to the end of the group.
  if (columns >= nodes.length - 1) return 1
  return Math.max(1, columns)
}

/**
 * The language picker: one control, twenty-four options, every state drawn.
 *
 * **It is one tab stop, not twenty-four.** `role="radiogroup"` with a roving
 * tabindex means a keyboard reader arrives on the language they are already
 * using and leaves with one more Tab, rather than pressing it two dozen times
 * to get past a settings section.
 *
 * **Focus movement is not selection.** The ARIA radio pattern normally checks
 * as it moves, which here would be twenty-three writes and twenty-three
 * language switches during one sweep of the arrow keys. Movement and commit are
 * therefore separated: arrows and Home/End move focus, Enter, Space and a click
 * commit. Each option is a real `<button>`, so both keys activate it natively.
 *
 * **Every option carries its own `lang`.** That attribute is not decoration.
 * `src/styles/styles.css` re-orders the font stack under `:lang(ja)`,
 * `:lang(ko)` and `:lang(zh-Hant)` precisely so a single chip inside an English
 * page gets its own face — and Hangul in particular cannot be reached by stack
 * order alone, because Noto Sans SC and TC both claim 한, 국 and 어 in their
 * served unicode-range. Without `lang="ko"`, 한국어 renders in the Simplified
 * Chinese face. It is also what stops a screen reader saying 日本語 in an
 * English voice.
 *
 * **`ar` carries `dir="rtl"` on the option itself, not on a span inside it.**
 * The whole chip therefore mirrors inside an otherwise left-to-right grid: the
 * name sets from the right and the selection mark sits at its trailing edge.
 * That is deliberate. `docs/SPEC.md` §8.4 asks for RTL as a designed layout
 * rather than a flipped afterthought, and an Arabic reader scanning for their
 * own language finds it faster where their eye starts. Everything inside the
 * chip is expressed in logical properties, so the same markup mirrors again —
 * correctly — once the whole document is Arabic.
 *
 * Presentational by contract: no fetching, no `src/server` import, copy in and
 * a choice out.
 */
export function LanguagePicker({
  value,
  workspaceDefault,
  onSelect,
  pending = null,
  disabled = false,
  label,
  followWorkspaceLabel,
  className,
}: LanguagePickerProps) {
  const labelId = React.useId()
  const nodes = React.useRef<Array<HTMLButtonElement | null>>([])
  const busy = pending !== null

  const setNode = React.useMemo(
    () =>
      ITEMS.map((_, index) => (node: HTMLButtonElement | null): void => {
        nodes.current[index] = node
      }),
    [],
  )

  const selectedIndex = ITEMS.findIndex((item) => item.choice === value)
  const [focusIndex, setFocusIndex] = React.useState(() =>
    Math.max(selectedIndex, 0),
  )

  // The checked option owns the tab stop, so tabbing back in returns to the
  // language in force rather than to wherever the arrows were last left.
  React.useEffect(() => {
    if (selectedIndex >= 0) setFocusIndex(selectedIndex)
  }, [selectedIndex])

  const focusAt = React.useCallback((index: number) => {
    const node = nodes.current[index]
    if (!node) return
    setFocusIndex(index)
    node.focus()
  }, [])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const last = ITEMS.length - 1
    const step = isRtl(event.currentTarget) ? -1 : 1
    const current = Math.min(Math.max(focusIndex, 0), last)

    const rowStep = (delta: number): number => {
      if (current === 0) return delta > 0 ? 1 : 0
      const raw = current + delta * columnsIn(nodes.current)
      if (raw < 1) return 0
      return Math.min(raw, last)
    }

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        focusAt((current + step + ITEMS.length) % ITEMS.length)
        break
      case 'ArrowLeft':
        event.preventDefault()
        focusAt((current - step + ITEMS.length) % ITEMS.length)
        break
      case 'ArrowDown':
        event.preventDefault()
        focusAt(rowStep(1))
        break
      case 'ArrowUp':
        event.preventDefault()
        focusAt(rowStep(-1))
        break
      case 'Home':
        event.preventDefault()
        focusAt(0)
        break
      case 'End':
        event.preventDefault()
        focusAt(last)
        break
      default:
        break
    }
  }

  const commit = (choice: LocaleChoice): void => {
    // Three guards, one job: no write while another is in flight (a double
    // click lands its second event here), none while the control is off, and
    // none that would store the value already stored.
    if (disabled || busy || choice === value) return
    onSelect(choice)
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <SectionLabel id={labelId}>{label}</SectionLabel>

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className={GRID}
      >
        {ITEMS.map((item, index) => {
          const selected = item.choice === value
          const writing = busy && item.choice === pending
          const rtl = item.descriptor?.dir === 'rtl'

          return (
            <button
              key={item.choice}
              ref={setNode[index]}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={busy && !disabled ? true : undefined}
              aria-busy={writing ? true : undefined}
              disabled={disabled}
              tabIndex={index === focusIndex ? 0 : -1}
              lang={item.descriptor?.tag}
              dir={rtl ? 'rtl' : undefined}
              data-testid={`locale-chip-${item.choice}`}
              data-selected={selected ? '' : undefined}
              onFocus={() => setFocusIndex(index)}
              onClick={() => commit(item.choice)}
              className={cn(
                CHIP_BASE,
                item.descriptor === null && 'col-span-full',
                selected ? CHIP_SELECTED : CHIP_REST,
                !busy &&
                  !disabled && [
                    CHIP_INTERACTIVE,
                    selected ? CHIP_SELECTED_HOVER : CHIP_REST_HOVER,
                  ],
                busy && 'cursor-progress',
                busy && !writing && 'opacity-60',
                'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
              )}
            >
              <Mark selected={selected} writing={writing} />
              {item.descriptor === null ? (
                <>
                  <span className={cn('truncate', NAME_LINE)}>
                    {followWorkspaceLabel}
                  </span>
                  <WorkspaceName tag={workspaceDefault} selected={selected} />
                </>
              ) : (
                <span className={cn('truncate', NAME_LINE)}>
                  {item.descriptor.nativeName}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The selection mark: a 16px well that is always there.
 *
 * Reserving the box rather than inserting it on selection is what keeps the
 * name column aligned down every row and keeps a commit from nudging its
 * neighbours — the check and the spinner both land inside a slot the layout has
 * already paid for. The check itself grows in on `--ease-out-quint`; under
 * reduced motion the global rule collapses that animation to nothing.
 */
function Mark({
  selected,
  writing,
}: {
  readonly selected: boolean
  readonly writing: boolean
}) {
  if (writing) {
    return (
      <span className="grid size-4 shrink-0 place-items-center text-brand">
        <Spinner size="xs" label={null} />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-full border',
        'transition-[background-color,border-color] duration-base ease-out-quint',
        selected
          ? 'border-brand bg-brand text-brand-on'
          : 'border-edge-strong bg-transparent',
      )}
    >
      {selected ? (
        <Check
          className="size-2.5 animate-pop-in"
          strokeWidth={3}
          aria-hidden="true"
        />
      ) : null}
    </span>
  )
}

/**
 * The workspace default, always in its own script — never an English exonym.
 *
 * The auto margin that pushes it to the far edge sits on an outer span that
 * inherits the group's direction, and `dir` sits on the inner one. Putting
 * both on the same element is a real bug rather than a nicety: `ms-auto` is
 * `margin-inline-start`, which resolves against the element's *own*
 * direction, so `dir="rtl"` flipped it to `margin-right: auto` and parked
 * العربية against the label instead of at the end of the chip — measured in
 * the browser at 1440px before this split.
 */
function WorkspaceName({
  tag,
  selected,
}: {
  readonly tag: Locale
  readonly selected: boolean
}) {
  const descriptor = localeDescriptor(tag)
  return (
    <span className="ms-auto min-w-0 shrink ps-2">
      <span
        lang={descriptor.tag}
        dir={descriptor.dir === 'rtl' ? 'rtl' : undefined}
        className={cn(
          'block truncate text-caption',
          NAME_LINE,
          selected ? 'text-brand' : 'text-ink-3',
        )}
      >
        {descriptor.nativeName}
      </span>
    </span>
  )
}

/**
 * The picker's shape while the settings loader is still running, so the panel
 * holds its height and the grid does not jump into place on arrival.
 */
export function LanguagePickerSkeleton({
  className,
}: {
  readonly className?: string
}) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-3', className)}>
      <Skeleton className="h-3 w-24" radius="sm" />
      <Skeleton className="h-11 w-full" radius="md" />
      <div className={GRID}>
        {SUPPORTED_LOCALES.map((descriptor) => (
          <Skeleton key={descriptor.tag} className="h-11" radius="md" />
        ))}
      </div>
    </div>
  )
}
