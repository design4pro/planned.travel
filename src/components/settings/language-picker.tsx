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
 *
 * Split in two so the shadow can be left off rather than turned off. Measured:
 * `tailwind-merge` reads `shadow-card` as a shadow *colour*, not a shadow size
 * — `card` is not on its size scale and `src/lib/cn.ts` registers no shadow
 * group — so `cn('shadow-card', 'shadow-none')` keeps both classes and the CSS
 * source order decides which box-shadow paints. Composing the flat treatment
 * and adding the shadow to it makes the disabled case exact instead of
 * hopeful.
 */
const CHIP_SELECTED_FLAT = 'border-brand bg-brand-subtle text-brand'
const CHIP_SELECTED = `${CHIP_SELECTED_FLAT} shadow-card`

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
 * How an option that is *not* being written looks while the group is locked.
 *
 * `opacity-60` used to carry this, and it was a contrast defect: over
 * `--color-surface` it mixes `--color-ink-2` (#403e36) down to roughly
 * rgb(140 138 134), measured at 3.40:1 against AA's 4.5:1 floor. WCAG 1.4.3
 * exempts *inactive* components, but these are not inactive — they are a live
 * control momentarily refusing a second write, for the few hundred
 * milliseconds a locale change takes, and a reader mid-sentence should not be
 * asked to accept unreadable text for it.
 *
 * Receding one ink tier says the same thing at 7.02:1 on `--color-surface`
 * (6.22:1 on `--color-surface-2`), leaves `--color-edge-strong` doing its
 * 1.4.11 job of drawing the control boundary, and pairs with `cursor-progress`
 * and the withdrawn hover and press affordances. The option actually being
 * written keeps full ink and gains a spinner: it is the one being watched.
 */
const CHIP_BUSY_UNSELECTED = 'text-ink-3'

/**
 * How the whole group looks when the host route turns it off.
 *
 * The same argument as the busy lock, one step further. `disabled:opacity-60`
 * used to carry this and measured 3.41:1 on the twenty-three unchosen options
 * — and, worse, 2.56:1 on the chosen one, so the single piece of information a
 * locked picker still has to convey, *which language is in force*, was the
 * least legible thing on it. WCAG 1.4.3 does exempt a disabled control, but
 * `src/components/ui/shared.ts` already settled the house answer for a control
 * that carries its own label (`disabledLabelled`): repaint, never fade, because
 * fading dims the label along with the fill and the result reads as a broken
 * component rather than a waiting one.
 *
 * So the unchosen options recede to the inset fill and the hairline border —
 * `--color-ink-3` on `--color-surface-2` is 6.22:1 in light and 7.01:1 in dark
 * — while the chosen one keeps its brand treatment at 6.02:1 / 6.88:1, minus
 * the shadow that makes it look raised and clickable. The group reads locked
 * because twenty-three chips went flat, not because the answer went grey.
 *
 * Distinct from the busy lock on purpose: busy keeps the `--color-surface` fill
 * and the `--color-edge-strong` boundary and adds `cursor-progress` plus a
 * spinner, because it is a control mid-write rather than a control switched
 * off.
 */
const CHIP_OFF = 'pointer-events-none'
const CHIP_REST_OFF = 'border-edge bg-surface-2 text-ink-3'

/**
 * One wrapped grid at every width, from 360px to 2560px — never a dropdown at
 * `sm`, because the whole point of the affordance is that someone stranded in
 * a script they cannot read finds their own language by shape. `auto-fill`
 * gives every chip the same width, so the block reads as a rectangle instead
 * of the ragged right edge a plain `flex-wrap` leaves. The `min(100%, …)`
 * floor is what stops the track from outgrowing a narrow container and
 * pushing a horizontal scrollbar onto the page.
 *
 * 10.5rem is measured, not chosen. Set in Geist at `--text-label`, the widest
 * of the twenty-three names is `Português (Brasil)` at 107.9px and
 * `Bahasa Indonesia` follows at 107.2px; the chip spends 24px on `px-3`, 8px on
 * its gap and 16px on the mark well, so 156px is the width at which the last
 * name stops truncating. 168px keeps 12px of slack for the moment the fallback
 * face swaps for the webfont, and it is the narrowest track on the 4px grid
 * that does — which is what turns a settings panel into four columns instead of
 * three and stops 日本語 sitting alone in a 236px box.
 */
const GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,10.5rem),1fr))] gap-2'

/**
 * The `SectionLabel`'s line box, written in the two tokens that draw it.
 *
 * `--text-micro` is 11px and `--text-micro--line-height` is 1.2, so the loaded
 * label occupies exactly 13.2px. The skeleton used to stand in for it with
 * `h-3` — 12px, 1.19px short — and, together with a "follow" placeholder that
 * sat outside the grid and so took the column's 12px gap instead of the grid's
 * 8px, left the loading shape 2.81px taller than the thing it was holding
 * space for at 1440px, 768px and 393px alike. Deriving the box from the same
 * two tokens makes the two heights equal by construction, which is the only
 * version of this that survives a change to the type scale.
 */
const LABEL_LINE_BOX =
  'h-[calc(var(--text-micro)*var(--text-micro--line-height))]'

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

  // Two rules decide where the group's single tab stop sits, and this effect
  // is only the second of them.
  //
  //   1. Inside the group the tab stop follows focus. Arrow to `fr`, tab away,
  //      tab back and you land on `fr`. That is deliberate and it is where
  //      this control parts company with the plain ARIA radio pattern: here
  //      focus is not selection, so returning the reader to the checked option
  //      would silently discard the traversal they just made. It needs no
  //      code — `focusIndex` is already moved by the arrow keys and by
  //      `onFocus`.
  //   2. When the *selection* changes, the tab stop re-anchors to it. That is
  //      this effect. It covers a commit settling and a value arriving from
  //      outside the component — a router invalidation, another tab, a reset —
  //      where the last focused index is stale rather than intentional.
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
                selected
                  ? disabled
                    ? CHIP_SELECTED_FLAT
                    : CHIP_SELECTED
                  : CHIP_REST,
                // Exactly one of the three moods, chosen from props rather
                // than from a `disabled:` variant: the state is known at
                // render time, so leaning on variant ordering to settle which
                // colour wins would be a specificity puzzle with no upside.
                disabled
                  ? [CHIP_OFF, !selected && CHIP_REST_OFF]
                  : busy
                    ? [
                        'cursor-progress',
                        !writing && !selected && CHIP_BUSY_UNSELECTED,
                      ]
                    : [
                        CHIP_INTERACTIVE,
                        selected ? CHIP_SELECTED_HOVER : CHIP_REST_HOVER,
                      ],
              )}
            >
              <span className={cn('truncate', NAME_LINE)}>
                {item.descriptor === null
                  ? followWorkspaceLabel
                  : item.descriptor.nativeName}
              </span>
              <span className="ms-auto flex min-w-0 shrink items-center gap-2">
                {item.descriptor === null ? (
                  <WorkspaceName tag={workspaceDefault} selected={selected} />
                ) : null}
                <Mark selected={selected} writing={writing} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The selection mark: a 16px well at the trailing edge that is always there.
 *
 * Reserving the box rather than inserting it on commit is what keeps a
 * selection from re-measuring the name beside it — the check and the spinner
 * both land in a slot the layout has already paid for, so `Português (Brasil)`
 * cannot be pulled into an ellipsis by being chosen. Empty when the option is
 * not selected, deliberately: an outlined ring on all twenty-four options is
 * twenty-three grey rings of noise competing with the one that matters, and
 * the state is already carried three times over by the brand border, the
 * brand-subtle fill and the brand text. The check grows in on
 * `--ease-out-quint`; under reduced motion the global rule in
 * `src/styles/styles.css` collapses that animation to nothing.
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
      className="grid size-4 shrink-0 place-items-center"
    >
      {selected ? (
        <Check
          className="size-4 animate-pop-in"
          strokeWidth={2.75}
          aria-hidden="true"
        />
      ) : null}
    </span>
  )
}

/**
 * The workspace default, always in its own script — never an English exonym.
 *
 * It carries `lang` and, for Arabic, `dir` for the same two reasons the chips
 * do: the font stack is re-ordered per script, and a screen reader must not
 * read العربية in an English voice. The auto margin that pushes this whole
 * trailing group to the far edge deliberately sits on the group instead, which
 * has no direction of its own. Both on one element is a real bug rather than a
 * nicety: `ms-auto` is `margin-inline-start`, which resolves against the
 * element's *own* direction, so `dir="rtl"` flipped it to `margin-right: auto`
 * and parked العربية against the label instead of at the end of the chip —
 * measured in the browser at 1440px before the two were split.
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
    <span
      lang={descriptor.tag}
      dir={descriptor.dir === 'rtl' ? 'rtl' : undefined}
      className={cn(
        'min-w-0 truncate text-caption',
        NAME_LINE,
        selected ? 'text-brand' : 'text-ink-3',
      )}
    >
      {descriptor.nativeName}
    </span>
  )
}

/**
 * The picker's shape while the settings loader is still running.
 *
 * A skeleton that is not the height of the thing it replaces is worse than no
 * skeleton at all: it converts one jump into two. So this is the loaded
 * picker's own markup with the text taken out, and every measurement it makes
 * is made the same way the real one makes it — the same `flex flex-col gap-3`
 * column, a label row whose height is the same `--text-micro` line box, and
 * the same `GRID` holding the same twenty-four boxes with the "follow" row
 * spanning full width *inside* the grid rather than beside it. The two agree
 * to the pixel at every width, because there is no number in here that the
 * picker does not also use.
 *
 * There is no empty state to design: the twenty-three locales are a frozen
 * table in `src/lib/i18n/locales.ts`, so an empty grid is not a state this
 * component can reach. A failed write is the host route's to report — the
 * picker's part of it is refusing the commit and releasing `pending`.
 */
export function LanguagePickerSkeleton({
  className,
}: {
  readonly className?: string
}) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-3', className)}>
      <div className={cn('flex items-center', LABEL_LINE_BOX)}>
        <Skeleton className="h-2 w-24" radius="sm" />
      </div>
      <div className={GRID}>
        <Skeleton className="col-span-full h-11" radius="md" />
        {SUPPORTED_LOCALES.map((descriptor) => (
          <Skeleton key={descriptor.tag} className="h-11" radius="md" />
        ))}
      </div>
    </div>
  )
}
