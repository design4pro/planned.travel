import * as React from 'react'
import {
  Check,
  CircleMinus,
  Flag,
  MapPinCheck,
  Plus,
  Telescope,
  TriangleAlert,
} from 'lucide-react'

import { Button, SectionLabel } from '#/components/ui'
import {
  ConfirmDialog,
  useAction,
  useOptimistic,
} from '#/components/modules/shared'
import { useAtlasI18n } from '#/components/map'
import { cn } from '#/lib/cn'
import { countryName } from '#/lib/atlas/country-names'
import { visitSpan } from '#/lib/atlas/visit-span'
import { formatNumber } from '#/lib/format'
import { RegionRecord } from './region-record'
import { visitLine } from './visit-copy'
import {
  addCountryToBucketListFn,
  markCountryVisitedFn,
  removeCountryFromBucketListFn,
  unmarkCountryVisitedFn,
} from '#/server/fns/atlas'

import type { ConfirmRequest } from '#/components/modules/shared'
import type { Locale, Translate } from '#/lib/i18n'
import type { AtlasCountryState } from '#/server/fns/atlas'

/**
 * The two things a traveller can do to a country without planning a trip to it.
 *
 * The write path for both — `visited_countries` and a country-shaped
 * `bucket_list_items` row — has been complete and tenant-scoped since the server
 * functions landed, and until this block existed nothing in a browser could
 * reach it. Everything below is the boundary's UI half, and these are the
 * decisions in it.
 *
 * **Two affordances, two states, never a dead control.** A country is either on
 * the atlas or it is not, and either on the list or it is not, so each row says
 * which of the two it is in words and offers the *other* one as a button. The
 * alternative — a button that is present but does nothing because the state is
 * already what it would produce — is the pattern this block exists to avoid.
 *
 * **The pressed control is the only one that spins.** Each write is its own
 * `useAction`, so a pending mark cannot put a spinner on the bucket-list button.
 * Its sibling goes `disabled` for the duration instead: both writes end in a
 * router invalidation, and two of those racing means the shelf repaints twice
 * from two different answers.
 *
 * **The intention paints first, and rolls back where the reader can see it.**
 * `useOptimistic` claims the row's new state the instant the button is pressed,
 * and the claim is withdrawn immediately on failure, so the row visibly returns
 * to what it was while the message underneath says why. The claim is keyed by
 * country code, so a reader who selects somewhere else mid-flight cannot inherit
 * the claim.
 *
 * **A successful claim is held until the loader's answer replaces it, not until
 * the write returns.** Those are not the same moment and the gap between them is
 * visible. `useAction.run` resolves after `await router.invalidate()`, which
 * means the loader has *fetched* — but TanStack Router commits the new
 * `loaderData` inside a React transition, while withdrawing the claim is a
 * default-priority update that renders first, with the props the block already
 * had. Withdrawing on `run` therefore paints the pre-write row again for the
 * length of the screen's transition render — measured at ~75ms on the atlas at
 * 360px, with the success toast already on screen saying the opposite. So the
 * claim is instead held by {@link useClaimHold} until the incoming props carry
 * the value that was claimed, and dropped after {@link CLAIM_HOLD_MS} if they
 * never do, so a claim can never outlive the write that made it for good.
 *
 * **The offer a claim creates is addressed by the answer that created it.** The
 * bucket-list entry is removed by row id, and for the whole of the hold above
 * there is no row in the props to read one from — the claim says the country is
 * on the list before the loader has said which entry it is. So the id is taken
 * from the write's own answer, which is the same {@link AtlasCountryState} the
 * loader will eventually carry, and held beside the claim until the props do.
 * Without it the "Remove" the claim offers would be a control that runs nothing,
 * which is the one thing this block is here to prevent. Nothing in the block
 * ever offers a removal it cannot address: the row's control is derived from
 * {@link CountryActionsProps.bucketGoal} *or* that held answer, so when there is
 * neither, the offer is the additive one — which the server treats as
 * idempotent — rather than a press that goes nowhere.
 *
 * **Nothing moves.** The message strip under the rows is a stated box at every
 * moment of the block's life — the resting hint, a failure, and the gap between
 * them are all the same height — because this block sits above a list inside a
 * scroll container, and a strip that grows on failure pushes the list under the
 * reader's cursor at the exact moment they are reading why something did not
 * save. The box is two lines of caption where the block is wide and three where
 * it is narrow enough for the same sentence to wrap further, so the message is
 * never cut off on a phone either. For the same reason the button keeps one
 * minimum width across every label it can carry.
 *
 * **A phone gets its own composition, not a squeezed copy of the desktop one.**
 * Under 20rem of container — the card the map anchors on a 360px screen, and the
 * drawer the shelf opens there — the two rows stop stacking and sit side by
 * side, each a small card holding the state it is about and the control that
 * changes it. Stacked, the block is 360px tall and the second control lands a
 * quarter of a screen below the bottom of a surface with under 300px to give;
 * side by side it is 183px and both controls are within a hundred of its top. A
 * reader on a phone should not have to scroll a card that does not look
 * scrollable to reach the button the card exists for. The trade is the
 * explanatory caption, kept for a screen reader and dropped from the page —
 * every date it can carry is already written out in the record directly above
 * this block, and the state is in the row's own title either way. The 36px
 * glyph goes with it, because at that width it costs the title the twenty
 * pixels that keep "On the bucket list" from truncating; the state is carried
 * instead by the card's own tint, which the rest of the block already uses for
 * exactly that. From 20rem up nothing about the row changes.
 *
 * **A record with a history behind it is asked about first.** A country marked
 * from this block carries no dates and a single arrival, and taking that back is
 * the undo of a press a second ago: it goes straight through. A row that carries
 * recorded days, several arrivals or a written note is somebody's travel history
 * — the shape a trip leaves behind — and removing it goes through
 * `ConfirmDialog`, which names what is about to be lost rather than asking "are
 * you sure?". A ticked-off bucket-list entry is treated the same way, because it
 * is a record of something that happened rather than an intention.
 *
 * **The row paints the claim; the button describes the press.** The two are not
 * the same sentence and must not be read off the same value. The row's glyph,
 * title and caption follow the optimistic claim, because that is the state the
 * reader asked for. The button follows the *write in flight* — `mark.pending`
 * means the control is marking, whatever the row has already painted — and only
 * falls back to the claim when nothing is running. Deriving the button from the
 * claim is how a control ends up announcing "Remove France from your atlas,
 * busy" one frame after the reader pressed "Mark visited", and offering an
 * inverse it is `disabled` for. Label, glyph, variant and the announced progress
 * all come from that one intent, so they cannot disagree with each other either.
 *
 * **The name at rest carries the visible label; the name in flight carries the
 * verb.** While the button is at rest its accessible name begins with the words
 * printed on it, so voice control can say them and WCAG 2.5.3 holds. While it is
 * busy there is no visible label to match — the spinner has taken its place — so
 * the name becomes the sentence describing what is happening, and the same
 * sentence is passed as the loading label so the two can never drift.
 *
 * **The reader keeps their place, and is shown the reason.** `Button` disables
 * itself while it loads, so the browser drops focus from whichever control was
 * pressed; the block takes it back when the write settles, and only when the
 * drop is the one it caused. The failure strip is scrolled into view by the
 * least amount that works, because this block is mounted inside scroll
 * containers shorter than it is and a sentence below the fold is a sentence
 * nobody read. A confirmation that was open over a failed removal stands down
 * for the same reason: its overlay is the other way to hide that sentence.
 *
 * **The failure is said twice, announced once.** The toast is the announcement
 * (`sonner` owns a live region and speaks it); the strip under the rows is the
 * durable copy for a reader who looked away while the toast expired. Marking the
 * strip live as well would say the same sentence to a screen reader twice.
 */

/* -------------------------------------------------------------------- input */

/** The visit on record for this country, or `null` when there is none. */
export interface CountryActionsVisit {
  readonly firstVisitedOn: string | null
  readonly lastVisitedOn: string | null
  readonly visitCount: number
  readonly note: string | null
}

/** The country's entry on the bucket list, or `null` when it has none. */
export interface CountryActionsGoal {
  /** The row id, which is how the entry is addressed when it is removed. */
  readonly id: string
  readonly targetYear: number | null
  readonly isAchieved: boolean
}

export interface CountryActionsProps extends Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'children'
> {
  /** ISO 3166-1 alpha-2. Upper-cased here, so a map feature's case is fine. */
  readonly countryCode: string
  readonly visit: CountryActionsVisit | null
  readonly bucketGoal: CountryActionsGoal | null
  /** The heading level of the block's label, matched to its host. */
  readonly headingLevel?: 2 | 3 | 4
}

/* ------------------------------------------------------------------- layout */

/**
 * Held as class strings so every state of the block is cut from one geometry.
 * The rows do not change height between rest, pending and failure, and neither
 * does the strip below them — that is the whole point of stating it once.
 */
const layout = {
  /**
   * A container, not a breakpoint. This block is mounted in a 344px record pane
   * on a 1440px screen and in a 296px card on a 360px phone, and the question it
   * needs answered is how wide *it* is, not how wide the window is.
   */
  root: '@container min-w-0',
  /**
   * Side by side under 20rem of container, stacked above it.
   *
   * The narrow case is the map's own card on a 360px screen, which is 288px tall
   * and holds the country's facts before it gets to this block. Two stacked rows
   * put the second control a quarter of a screen below the bottom of that card;
   * two columns put both of them inside the first hundred pixels of the block,
   * which is the only arrangement in which a phone reader can press either
   * without scrolling a surface that does not look scrollable.
   */
  rows: 'mt-1 grid min-w-0 grid-cols-2 gap-2 @xs:mt-2 @xs:grid-cols-1',
  /**
   * Under 20rem: the state on one line and its control under it, in a card of
   * its own. From 20rem: the glyph, the text and the control on a single line.
   *
   * Stated as a grid rather than as `flex-wrap`, so the button either sits in
   * its own column or spans the full width — never a half-width orphan pushed
   * onto a second line by a long title. 20rem is the width at which the three
   * columns stop fighting: under it there is no room for a 36px glyph, a title
   * and a 120px control on one line without the title losing characters.
   *
   * The tint is the narrow half of what the glyph does everywhere else: at that
   * width the glyph is gone, so the card itself carries whether the state is set
   * — never alone, because the title says it in words directly inside it.
   */
  row: 'grid min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-1 rounded-lg border border-edge-faint bg-surface-2/60 p-2 transition-colors duration-base ease-out-quint @max-xs:data-[set]:border-brand-subtle @max-xs:data-[set]:bg-brand-subtle @xs:grid-cols-[auto_minmax(0,1fr)_auto] @xs:gap-x-3 @xs:gap-y-3 @xs:p-3',
  glyph:
    'hidden size-9 shrink-0 place-items-center rounded-md border border-edge-faint transition-colors duration-base ease-out-quint @xs:grid [&_svg]:size-4',
  glyphIdle: 'bg-surface text-ink-3',
  glyphSet: 'bg-brand-subtle text-brand',
  body: 'min-w-0',
  /** One line, always: a wrapped title is the other way a row changes height. */
  title: 'truncate text-label leading-4 font-semibold text-ink @xs:leading-5',
  /**
   * Two lines of caption at a stated 16px leading from 20rem of container, and
   * a line only a screen reader hears below it.
   *
   * The row's copy changes the instant a button is pressed — "A visit with no
   * trip behind it." becomes "Dates not recorded", and "Somewhere you mean to
   * go." becomes "Waiting for its turn." — and no two of those wrap to the same
   * number of lines in a 138px column. Reserving the two lines every row can
   * need makes the block one height in rest, in flight and after a failure,
   * which is the whole of §2h's second clause for this surface.
   *
   * On a phone the same two lines are the difference between the second control
   * being on the card and being under it, and every fact they carry is already
   * written out in the record above this block. So the sentence stays in the
   * accessibility tree and leaves the page: `sr-only` is a real element with no
   * size rather than a hidden one, so nothing is announced twice and nothing is
   * lost to a reader who cannot see the card in the first place.
   */
  caption:
    'sr-only text-caption leading-4 tabular-nums text-ink-2 @xs:not-sr-only @xs:mt-1 @xs:line-clamp-2 @xs:h-8',
  /**
   * One minimum width for every label the row can carry, so the optimistic flip
   * from "Mark visited" to "Remove" cannot resize the row it sits in.
   */
  action: 'w-full @xs:w-auto @xs:min-w-30',
  /**
   * A stated box at every width, whether it holds the hint, a failure or the
   * tail of one fading out — and tall enough at each width to hold the longest
   * sentence the block can be handed.
   *
   * Two lines of 16px leading is 32px, and two lines is what a 344px record pane
   * needs for the longest refusal the server writes. In the 284px card a phone
   * gets, the same sentence wraps to three, and clipping the third line is
   * clipping the half of the message that says what to do about it — so the
   * strip is 48px there. It is a container query rather than a breakpoint
   * because the block is mounted in two hosts of different widths on the same
   * screen, and it is stated per width rather than grown on demand because a
   * strip that grows when a write fails pushes the rows out from under the
   * reader's cursor at the worst possible moment (SPEC §2h).
   *
   * Every step in it is on the grid, the glyph included: a 16px icon against a
   * 16px first line needs no optical nudge to sit on the same baseline, so the
   * half-step this row used to carry bought nothing but a value off the scale.
   */
  message: 'mt-2 flex h-12 items-start gap-2 @xs:h-8',
  messageText: 'line-clamp-3 text-caption leading-4 @xs:line-clamp-2',
  messageGlyph: 'size-4 shrink-0 text-danger',
} as const

/* --------------------------------------------------------------------- copy */

interface RowCopy {
  readonly title: string
  readonly caption: string
}

/**
 * The recorded days, printed once.
 *
 * The single-day case is the date alone: this row is already headed "Visited",
 * and the sentence below has already said "recorded visit". `visitLine()` is
 * the shared reading, so the days here and the days in the record above cannot
 * disagree about a country.
 */
function spanLine(
  visit: CountryActionsVisit,
  t: Translate,
  locale: Locale,
): string {
  return visitLine(
    visitSpan(visit.firstVisitedOn, visit.lastVisitedOn),
    t,
    locale,
  )
}

/**
 * What the atlas row says.
 *
 * The optimistic case — claimed as visited with no row to read yet — is written
 * in the *same words* the row it is about to become will use. A mark made from
 * this block produces a single visit with no days recorded, which the settled
 * row prints as {@link UNRECORDED_VISIT_LABEL}; a placeholder that said the same
 * thing differently made the caption change a second time, eighty milliseconds
 * after the state had stopped changing, for a fact that had not moved.
 */
function visitCopy(
  visited: boolean,
  visit: CountryActionsVisit | null,
  t: Translate,
  locale: Locale,
): RowCopy {
  if (!visited) {
    return {
      title: t('atlas.actions.visit.absent.title'),
      caption: t('atlas.actions.visit.absent.caption'),
    }
  }
  if (visit === null) {
    return {
      title: t('atlas.actions.visit.title'),
      caption: t('atlas.record.datesUnrecorded'),
    }
  }
  const dates = spanLine(visit, t, locale)
  return {
    title: t('atlas.actions.visit.title'),
    // The tally is only worth the words when it is more than one, and the
    // record above this block already carries the count as a badge.
    caption:
      visit.visitCount > 1
        ? t('atlas.actions.visit.caption', {
            visits: t('atlas.record.visits', {
              count: visit.visitCount,
              visits: formatNumber(visit.visitCount, locale),
            }),
            dates,
          })
        : dates,
  }
}

/** What the bucket-list row says, in the same three shapes. */
function goalCopy(
  listed: boolean,
  goal: CountryActionsGoal | null,
  t: Translate,
): RowCopy {
  if (!listed) {
    return {
      title: t('atlas.actions.goal.absent.title'),
      caption: t('atlas.actions.goal.absent.caption'),
    }
  }
  if (goal === null) {
    return {
      title: t('atlas.actions.goal.title'),
      caption: t('atlas.actions.goal.waiting'),
    }
  }
  if (goal.isAchieved) {
    return {
      title: t('atlas.actions.goal.achieved.title'),
      caption: t('atlas.actions.goal.achieved.caption'),
    }
  }
  return {
    title: t('atlas.actions.goal.title'),
    caption:
      goal.targetYear === null
        ? t('atlas.actions.goal.waiting')
        : // A year is written out, never grouped: `2,027` is a quantity, and
          // every numbering system the twenty-three tags carry is `latn`.
          t('atlas.actions.goal.target', { year: String(goal.targetYear) }),
  }
}

/* ------------------------------------------------------------------- intent */

/** Which of the two rows a press came from. */
type RowName = 'visit' | 'goal'

/** Which way a row's control is pointing: the write it would send if pressed. */
type RowIntent = 'add' | 'remove'

/**
 * What the control is for, which is not always what the row currently says.
 *
 * A write in flight is the answer whenever there is one, because that is the
 * press the reader made and the sentence they are owed. Only when both writes
 * are idle does the row's own state decide, and then it is the optimistic state
 * — an idle row is a settled row, so the claim and the record agree.
 */
function rowIntent(
  adding: boolean,
  removing: boolean,
  set: boolean,
): RowIntent {
  if (adding) return 'add'
  if (removing) return 'remove'
  return set ? 'remove' : 'add'
}

/**
 * Everything the row's button says, in one object so no two of them can be read
 * off different values.
 */
interface RowControl {
  readonly intent: RowIntent
  /** Printed on the control. */
  readonly label: string
  /** The accessible name at rest. Opens with {@link label}, so 2.5.3 holds. */
  readonly restName: string
  /** The accessible name and the announced label while the write is running. */
  readonly busyName: string
}

/** The atlas row's control, in both directions. */
function visitControl(
  intent: RowIntent,
  name: string,
  t: Translate,
): RowControl {
  return intent === 'remove'
    ? {
        intent,
        label: t('atlas.actions.button.remove'),
        restName: t('atlas.actions.visit.remove.name', { name }),
        busyName: t('atlas.actions.visit.remove.busy', { name }),
      }
    : {
        intent,
        label: t('atlas.actions.button.mark'),
        restName: t('atlas.actions.visit.add.name', { name }),
        busyName: t('atlas.actions.visit.add.busy', { name }),
      }
}

/** The bucket-list row's control, in both directions. */
function goalControl(
  intent: RowIntent,
  name: string,
  t: Translate,
): RowControl {
  return intent === 'remove'
    ? {
        intent,
        label: t('atlas.actions.button.remove'),
        restName: t('atlas.actions.goal.remove.name', { name }),
        busyName: t('atlas.actions.goal.remove.busy', { name }),
      }
    : {
        intent,
        label: t('atlas.actions.button.add'),
        restName: t('atlas.actions.goal.add.name', { name }),
        busyName: t('atlas.actions.goal.add.busy', { name }),
      }
}

/**
 * True when the visit is somebody's travel history rather than the undo of a
 * press: several arrivals, a recorded day at either end, or a written note. A
 * country marked from this block has none of the three.
 */
function hasVisitHistory(visit: CountryActionsVisit): boolean {
  return (
    visit.visitCount > 1 ||
    visit.firstVisitedOn !== null ||
    visit.lastVisitedOn !== null ||
    (visit.note ?? '').trim() !== ''
  )
}

/**
 * What a confirmed removal says it is about to clear.
 *
 * The two optional clauses are keys of their own rather than English fragments
 * spliced into a translated sentence, so the bracket and the comma belong to
 * whoever is writing the language.
 */
function visitLossLine(
  visit: CountryActionsVisit,
  t: Translate,
  locale: Locale,
): string {
  const span = visitSpan(visit.firstVisitedOn, visit.lastVisitedOn)
  return t('atlas.actions.confirm.visit.body', {
    count: visit.visitCount,
    visits: formatNumber(visit.visitCount, locale),
    dates:
      span.kind === 'unrecorded'
        ? ''
        : t('atlas.actions.confirm.visit.dates', {
            span: spanLine(visit, t, locale),
          }),
    note:
      (visit.note ?? '').trim() === ''
        ? ''
        : t('atlas.actions.confirm.visit.note'),
  })
}

/* ------------------------------------------------------------- transport */

/**
 * What each engine calls "the request never left the building": Chromium's
 * "Failed to fetch", WebKit's "Load failed", Gecko's "NetworkError when
 * attempting to fetch resource".
 */
const TRANSPORT_FAILURE =
  /failed to fetch|load failed|network ?error|network request failed/i

/**
 * Wraps a write so a transport failure arrives in our own voice.
 *
 * Everything the server itself refuses already carries a sentence written to be
 * read — a plan ceiling names its metric, a collision says to try again — and
 * those are forwarded untouched. What is not written for a reader is the
 * browser's own three words for a dropped connection, and they would otherwise
 * land in the toast and in the strip under the rows verbatim. Wrapping rather
 * than repairing the rendered string keeps the toast and the strip saying the
 * same thing, which is the point of there being one message at all.
 */
function readable<TInput, TResult>(
  write: (input: TInput) => Promise<TResult>,
  offline: () => string,
): (input: TInput) => Promise<TResult> {
  return async (input: TInput): Promise<TResult> => {
    try {
      return await write(input)
    } catch (cause) {
      if (cause instanceof Error && TRANSPORT_FAILURE.test(cause.message)) {
        throw new Error(offline(), { cause })
      }
      throw cause
    }
  }
}

/**
 * The four writes, wrapped once per translator rather than once per render.
 *
 * `useAction` memoises `run` on the function it was handed, so a fresh wrapper
 * every render would hand it a new identity every time. `t` is itself memoised
 * — the provider rebuilds it only when the locale or the catalogue changes, and
 * the no-provider branch is a frozen module constant — so keying the memo on it
 * gives the same stability while letting the offline sentence be the reader's.
 */
function useWrites(t: Translate) {
  return React.useMemo(() => {
    const offline = (): string => t('atlas.actions.offline')
    return {
      mark: readable(markCountryVisitedFn, offline),
      unmark: readable(unmarkCountryVisitedFn, offline),
      addGoal: readable(addCountryToBucketListFn, offline),
      dropGoal: readable(removeCountryFromBucketListFn, offline),
    }
  }, [t])
}

/* ------------------------------------------------------------------ answers */

/** A bucket-list row the server has confirmed, and the country it is for. */
interface HeldGoal {
  readonly code: string
  readonly goal: CountryActionsGoal
}

/**
 * The bucket-list row inside a write's answer, in the shape this block holds.
 *
 * Optional at every step on purpose. The answer is a network payload, and the
 * only thing the block does with a missing one is decline to hold a row it was
 * not given — which leaves the control offering the additive write, the same
 * place it started. Narrowing to the three fields the block reads also keeps the
 * held value from carrying a name or a note that nothing here prints.
 */
function goalIn(state: AtlasCountryState | null): CountryActionsGoal | null {
  const goal = state?.bucketGoal ?? null
  if (goal === null || goal.id === '') {
    return null
  }
  return {
    id: goal.id,
    targetYear: goal.targetYear,
    isAchieved: goal.isAchieved,
  }
}

/* ----------------------------------------------------------------- presence */

/**
 * How long the outgoing message stays mounted for its exit, in step with
 * `--duration-fast` and with the transition that plays over it. A number rather
 * than a token read, because the timer lives in JavaScript and the transition
 * lives in CSS; they are stated together here so they cannot drift. Nothing
 * moves when it expires either way — the strip is a stated box, so this only
 * decides how long an invisible sentence lingers before it is dropped.
 */
const MESSAGE_EXIT_MS = 150

interface MessagePresence {
  readonly text: string
  readonly state: 'open' | 'closed'
}

/**
 * Keeps the failure mounted while it fades, so clearing it is a 150ms exit
 * rather than a text node vanishing between two frames. The strip's height is
 * fixed either way, so nothing this hook does can move the page.
 */
function useMessagePresence(error: string | null): MessagePresence {
  const [shown, setShown] = React.useState<string | null>(error)
  const state: 'open' | 'closed' = error === null ? 'closed' : 'open'

  React.useEffect(() => {
    if (error !== null) {
      setShown(error)
      return
    }
    if (shown === null) {
      return
    }
    const timer = window.setTimeout(() => setShown(null), MESSAGE_EXIT_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [error, shown])

  return { text: shown ?? '', state }
}

/* --------------------------------------------------------------- settlement */

/**
 * The longest a settled claim may stand in for an answer that never arrived.
 *
 * The claim is normally withdrawn the frame the loader's new row renders, which
 * is one transition render after the write returns — under a tenth of a second
 * on the shelf, and this ceiling is never reached. It exists for the case the
 * happy path cannot cover: a write the server accepted whose row the loader
 * does not come back with, in which case the block would otherwise paint a
 * state nothing behind it agrees with, for as long as it stayed mounted. A
 * second and a bit is long enough that no ordinary commit races it, and short
 * enough that the row corrects itself while the reader is still looking at it.
 */
const CLAIM_HOLD_MS = 1200

interface ClaimHold {
  /**
   * Resolves once the row's incoming value reads `want` — or after
   * {@link CLAIM_HOLD_MS}, whichever comes first. Awaited inside the optimistic
   * claim, so the claim is withdrawn on the far side of the loader's commit
   * rather than on the far side of the request.
   */
  readonly settled: (want: boolean) => Promise<void>
  /** Gives up whatever is being waited for, resolving it now. */
  readonly release: () => void
}

interface ClaimWaiter {
  readonly want: boolean
  readonly resolve: () => void
  readonly timer: number
}

/**
 * Watches one row's incoming value and reports when it catches up with a claim.
 *
 * `actual` is read through a ref updated in an effect, because the question is
 * asked from a promise continuation rather than from a render: by the time the
 * write has returned, the value in scope is the one the last commit carried, and
 * the only reliable "has it committed yet" is the commit itself.
 */
function useClaimHold(actual: boolean): ClaimHold {
  const actualRef = React.useRef(actual)
  const waiterRef = React.useRef<ClaimWaiter | null>(null)

  const release = React.useCallback((): void => {
    const waiter = waiterRef.current
    if (waiter === null) return
    waiterRef.current = null
    window.clearTimeout(waiter.timer)
    waiter.resolve()
  }, [])

  React.useEffect(() => {
    actualRef.current = actual
    if (waiterRef.current?.want === actual) {
      release()
    }
  }, [actual, release])

  // Unmounting is the last moment anything can be waited for: the promise has
  // to be resolved or the claim's `finally` never runs and the reducer keeps a
  // claim for a block that is gone.
  React.useEffect(() => release, [release])

  const settled = React.useCallback(
    (want: boolean): Promise<void> =>
      new Promise<void>((resolve) => {
        // A second press supersedes the first: its claim is the newer one and
        // is the one being painted, so the older claim has nothing left to say.
        release()
        if (actualRef.current === want) {
          resolve()
          return
        }
        const timer = window.setTimeout(() => {
          waiterRef.current = null
          resolve()
        }, CLAIM_HOLD_MS)
        waiterRef.current = { want, resolve, timer }
      }),
    [release],
  )

  return React.useMemo(() => ({ settled, release }), [settled, release])
}

/* -------------------------------------------------------------------- block */

const HEADINGS = { 2: 'h2', 3: 'h3', 4: 'h4' } as const

export const CountryActions = React.forwardRef<
  HTMLDivElement,
  CountryActionsProps
>(
  (
    { countryCode, visit, bucketGoal, headingLevel = 4, className, ...props },
    ref,
  ) => {
    const { locale, t } = useAtlasI18n()
    const writes = useWrites(t)
    const rowId = React.useId()
    const code = countryCode.trim().toUpperCase()
    const name = countryName(code)
    const [regionState, setRegionState] = React.useState<{
      code: string
      count: number
    }>({ code, count: 0 })
    const [regionWrite, setRegionWrite] = React.useState<{
      code: string
      pending: boolean
    }>({ code, pending: false })
    const regionCount = regionState.code === code ? regionState.count : 0
    const regionPending = regionWrite.code === code && regionWrite.pending
    const onRegionCount = React.useCallback(
      (count: number) => setRegionState({ code, count }),
      [code],
    )
    const onRegionPending = React.useCallback(
      (pending: boolean) => setRegionWrite({ code, pending }),
      [code],
    )

    const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null)
    const messageRef = React.useRef<HTMLParagraphElement | null>(null)
    const visitRef = React.useRef<HTMLButtonElement | null>(null)
    const goalRef = React.useRef<HTMLButtonElement | null>(null)
    /** Which control started the write in flight, so focus can go back to it. */
    const pressedRef = React.useRef<RowName | null>(null)

    /**
     * The claimed state of each row while a write is in flight. Keyed by the
     * country as well as the row, so a claim made for one country cannot paint
     * the next one a reader selects.
     */
    const overlay = useOptimistic<boolean>()
    const visitKey = `${code}:visit`
    const goalKey = `${code}:goal`
    const visited = overlay.get(visitKey) ?? visit !== null
    const listed = overlay.get(goalKey) ?? bucketGoal !== null

    /**
     * The bucket-list row the last successful add reported, kept for as long as
     * the props have not caught up with it.
     *
     * Held with the country it belongs to for the same reason the claims are
     * keyed by country: a row written for France must not be the row a press
     * removes after the reader has selected Japan.
     */
    const [heldGoal, setHeldGoal] = React.useState<HeldGoal | null>(null)
    /** The props are the record; the held answer only stands in for a gap. */
    const goalRow =
      bucketGoal ??
      (heldGoal !== null && heldGoal.code === code ? heldGoal.goal : null)

    /**
     * When each row's claim may be given back: the commit that carries the
     * loader's new answer, not the promise the write returned.
     */
    const visitHold = useClaimHold(visit !== null)
    const goalHold = useClaimHold(bucketGoal !== null)

    const closeConfirm = React.useCallback(() => setConfirm(null), [])

    const mark = useAction(writes.mark, {
      success: t('atlas.actions.toast.marked'),
      description: t('atlas.actions.toast.markedBody', { name }),
      failure: t('atlas.actions.toast.markFailed', { name }),
      fallback: t('atlas.actions.toast.fallback'),
    })
    const unmark = useAction(writes.unmark, {
      success: t('atlas.actions.toast.unmarked'),
      description: t('atlas.actions.toast.unmarkedBody', { name }),
      failure: t('atlas.actions.toast.unmarkFailed', { name }),
      fallback: t('atlas.actions.toast.fallback'),
      onSuccess: closeConfirm,
      // A confirmation that stays open over a failure hides the only durable
      // copy of the reason: the strip lives under the rows, behind the modal's
      // own overlay. Standing the question down puts the reader back on the row
      // they pressed, with the sentence under it and the offer still there to
      // take again.
      onError: closeConfirm,
    })
    const addGoal = useAction(writes.addGoal, {
      success: t('atlas.actions.toast.listed'),
      description: t('atlas.actions.toast.listedBody', { name }),
      failure: t('atlas.actions.toast.listFailed', { name }),
      fallback: t('atlas.actions.toast.fallback'),
    })
    const dropGoal = useAction(writes.dropGoal, {
      success: t('atlas.actions.toast.unlisted'),
      description: t('atlas.actions.toast.unlistedBody', { name }),
      failure: t('atlas.actions.toast.unlistFailed', { name }),
      fallback: t('atlas.actions.toast.fallback'),
      onSuccess: closeConfirm,
      onError: closeConfirm,
    })

    const visitPending = mark.pending || unmark.pending
    const goalPending = addGoal.pending || dropGoal.pending
    const busy = visitPending || goalPending
    const visitIntent = rowIntent(mark.pending, unmark.pending, visited)
    /**
     * The row a press on the bucket-list control would remove, which is what
     * decides whether a removal is the thing on offer at all. Reading the
     * addressable row rather than the painted one is what keeps the offer and
     * the press in step: "Remove" is shown only where there is something to
     * send it about.
     */
    const goalTarget = listed ? goalRow : null
    const goalIntent = rowIntent(
      addGoal.pending,
      dropGoal.pending,
      goalTarget !== null,
    )

    /**
     * One strip, four possible writers. Each write clears the other three before
     * it starts, so the line under the rows is always about the press the reader
     * just made rather than about one they made a minute ago.
     */
    const error =
      mark.error ?? unmark.error ?? addGoal.error ?? dropGoal.error ?? null
    const message = useMessagePresence(error)

    const resetVisit = mark.reset
    const resetUnmark = unmark.reset
    const resetAdd = addGoal.reset
    const resetDrop = dropGoal.reset

    const clearMessages = React.useCallback(() => {
      resetVisit()
      resetUnmark()
      resetAdd()
      resetDrop()
    }, [resetVisit, resetUnmark, resetAdd, resetDrop])

    const releaseVisit = visitHold.release
    const releaseGoal = goalHold.release

    // A new country is a new subject: whatever the last one failed at is not
    // this one's news, the confirmation raised for it is not this one's
    // question, and a claim still waiting for the last country's row is waiting
    // for an answer this block will never read again.
    React.useEffect(() => {
      clearMessages()
      setConfirm(null)
      releaseVisit()
      releaseGoal()
      setHeldGoal(null)
    }, [code, clearMessages, releaseVisit, releaseGoal])

    // The props are the record as soon as they carry one, so the answer that was
    // standing in for them is dropped rather than left to resurface if the entry
    // is later removed from somewhere else on the screen.
    React.useEffect(() => {
      if (bucketGoal !== null) setHeldGoal(null)
    }, [bucketGoal])

    /**
     * Brings the failure into view in whatever is clipping the block.
     *
     * This block is mounted inside two scroll containers — a 230px record pane
     * on a desktop shelf and a shorter drawer on a phone — and the strip sits
     * under two rows that already fill them, so a reader who pressed a button
     * at the top of the pane was being told why it failed a hundred pixels
     * below the fold. `nearest` moves the least it can and does nothing at all
     * when the strip is already on screen, so nothing jumps for the readers who
     * could see it anyway. It is deliberately not `smooth`: the sentence should
     * be readable on the next frame, and the stylesheet pins
     * `scroll-behavior: auto` under `prefers-reduced-motion` regardless.
     */
    React.useEffect(() => {
      if (error === null) return
      const node = messageRef.current
      // Absent in jsdom, where there is nothing to scroll in the first place.
      if (node === null || typeof node.scrollIntoView !== 'function') return
      node.scrollIntoView({ block: 'nearest' })
    }, [error])

    /**
     * Hands focus back to the control that was pressed.
     *
     * Loading buttons retain focus and block activation. This is a defensive
     * fallback for a write whose focused control nevertheless left focus on
     * `<body>`: restore the pressed control when the write settles. Anything
     * else holding focus, including a confirmation dialog or a row the reader
     * tabbed to while the write ran, keeps it.
     */
    React.useEffect(() => {
      if (busy) return
      const pressed = pressedRef.current
      if (pressed === null) return
      pressedRef.current = null
      const active = document.activeElement
      if (active !== null && active !== document.body) return
      const node = pressed === 'visit' ? visitRef.current : goalRef.current
      node?.focus()
    }, [busy])

    /**
     * One write, from the press to the moment the claim it made can be given
     * back.
     *
     * `useAction.run` answers `null` for a failure and the server's own state
     * for a success, and never rejects — so a failure gives the claim back on
     * the spot, which is the rollback the reader is owed, and a success keeps it
     * until the row it produced has actually rendered.
     *
     * The answer itself is handed to `received` before the claim is held, so a
     * row that only exists in the server's reply — the bucket-list entry's id —
     * is on hand for the whole of that hold rather than after it.
     */
    async function commit<TResult>(
      hold: ClaimHold,
      want: boolean,
      run: () => Promise<TResult | null>,
      received?: (result: TResult) => void,
    ): Promise<void> {
      const result = await run()
      if (result === null) return
      received?.(result)
      await hold.settled(want)
    }

    function runMark(): void {
      clearMessages()
      pressedRef.current = 'visit'
      void overlay.claim([[visitKey, true]], () =>
        commit(visitHold, true, () =>
          mark.run({ data: { countryCode: code } }),
        ),
      )
    }

    function runUnmark(): void {
      clearMessages()
      pressedRef.current = 'visit'
      void overlay.claim([[visitKey, false]], () =>
        commit(visitHold, false, () =>
          unmark.run({ data: { countryCode: code } }),
        ),
      )
    }

    function runAddGoal(): void {
      clearMessages()
      pressedRef.current = 'goal'
      void overlay.claim([[goalKey, true]], () =>
        commit(
          goalHold,
          true,
          () => addGoal.run({ data: { countryCode: code } }),
          (state) => {
            // The entry the server wrote, so the "Remove" this claim puts on
            // screen has the id it needs before the loader supplies one.
            const goal = goalIn(state)
            if (goal !== null) setHeldGoal({ code, goal })
          },
        ),
      )
    }

    function runDropGoal(itemId: string): void {
      clearMessages()
      pressedRef.current = 'goal'
      void overlay.claim([[goalKey, false]], () =>
        commit(
          goalHold,
          false,
          () => dropGoal.run({ data: { itemId } }),
          // The row is gone. Dropping it on success rather than on the press
          // keeps it standing if the removal is refused, so a failed press
          // leaves the offer it failed at rather than an invitation to add
          // something that is already there.
          () => setHeldGoal(null),
        ),
      )
    }

    function onVisitPress(): void {
      if (visitIntent === 'add') {
        runMark()
        return
      }
      if (visit !== null && (hasVisitHistory(visit) || regionCount > 0)) {
        setConfirm({
          title: t('atlas.actions.confirm.visit.title', { name }),
          description:
            regionCount > 0
              ? t('atlas.actions.confirm.visitRegions.body', {
                  count: regionCount,
                  country: name,
                  history: hasVisitHistory(visit)
                    ? `${visitLossLine(visit, t, locale)} `
                    : '',
                })
              : visitLossLine(visit, t, locale),
          confirmLabel: t('atlas.actions.button.remove'),
          onConfirm: runUnmark,
        })
        return
      }
      runUnmark()
    }

    function onGoalPress(): void {
      // The row this control is pointing at, which decides which write the
      // press sends. With no row to address, the press is the additive one —
      // the same write the label offers in that state, and one the server
      // treats as idempotent. No press through this control does nothing.
      const goal = goalTarget
      if (goal === null) {
        runAddGoal()
        return
      }
      const itemId = goal.id
      if (goal.isAchieved) {
        setConfirm({
          title: t('atlas.actions.confirm.goal.title', { name }),
          description: t('atlas.actions.confirm.goal.body'),
          confirmLabel: t('atlas.actions.button.remove'),
          onConfirm: () => runDropGoal(itemId),
        })
        return
      }
      runDropGoal(itemId)
    }

    const visitText = visitCopy(visited, visit, t, locale)
    const goalText = goalCopy(listed, goalRow, t)
    const Heading = HEADINGS[headingLevel]
    const visitTitleId = `${rowId}-visit`
    const goalTitleId = `${rowId}-goal`
    /** The dialog owns the spinner while it is the control being pressed. */
    const confirming = confirm !== null
    /** Busy on the control itself, which is not the same as busy in the block. */
    const visitBusy = visitPending && !confirming
    const goalBusy = goalPending && !confirming
    const visitAction = visitControl(visitIntent, name, t)
    const goalAction = goalControl(goalIntent, name, t)

    return (
      <div
        ref={ref}
        data-part="country-actions"
        data-country={code}
        data-visited={visited ? '' : undefined}
        data-listed={listed ? '' : undefined}
        className={cn(layout.root, className)}
        {...props}
      >
        <SectionLabel as={Heading}>{t('atlas.actions.label')}</SectionLabel>

        <div className={layout.rows}>
          <div
            data-part="visit-row"
            data-set={visited ? '' : undefined}
            role="group"
            aria-labelledby={visitTitleId}
            className={layout.row}
          >
            <span
              aria-hidden="true"
              className={cn(
                layout.glyph,
                visited ? layout.glyphSet : layout.glyphIdle,
              )}
            >
              {visited ? <MapPinCheck /> : <Flag />}
            </span>
            <div className={layout.body}>
              <p id={visitTitleId} className={layout.title}>
                {visitText.title}
              </p>
              <p className={layout.caption}>{visitText.caption}</p>
            </div>
            <Button
              ref={visitRef}
              variant={
                visitAction.intent === 'remove' ? 'secondary' : 'primary'
              }
              size="sm"
              icon={
                visitAction.intent === 'remove' ? <CircleMinus /> : <Check />
              }
              loading={visitBusy}
              loadingLabel={visitAction.busyName}
              disabled={goalPending || regionPending}
              aria-label={
                visitBusy ? visitAction.busyName : visitAction.restName
              }
              onClick={onVisitPress}
              className={layout.action}
            >
              {visitAction.label}
            </Button>
          </div>

          <div
            data-part="goal-row"
            data-set={listed ? '' : undefined}
            role="group"
            aria-labelledby={goalTitleId}
            className={layout.row}
          >
            <span
              aria-hidden="true"
              className={cn(
                layout.glyph,
                listed ? layout.glyphSet : layout.glyphIdle,
              )}
            >
              <Telescope />
            </span>
            <div className={layout.body}>
              <p id={goalTitleId} className={layout.title}>
                {goalText.title}
              </p>
              <p className={layout.caption}>{goalText.caption}</p>
            </div>
            <Button
              ref={goalRef}
              variant="secondary"
              size="sm"
              icon={goalAction.intent === 'remove' ? <CircleMinus /> : <Plus />}
              loading={goalBusy}
              loadingLabel={goalAction.busyName}
              disabled={visitPending || regionPending}
              aria-label={goalBusy ? goalAction.busyName : goalAction.restName}
              onClick={onGoalPress}
              className={layout.action}
            >
              {goalAction.label}
            </Button>
          </div>
        </div>

        <p ref={messageRef} data-part="message" className={layout.message}>
          {message.text === '' ? (
            <span className={cn(layout.messageText, 'text-ink-3')}>
              {t('atlas.actions.hint')}
            </span>
          ) : (
            <>
              <TriangleAlert
                aria-hidden="true"
                className={layout.messageGlyph}
              />
              <span
                data-state={message.state}
                data-motion-transform=""
                className={cn(
                  layout.messageText,
                  'text-danger',
                  // In on `animate-rise` — 220ms of `--ease-out-quint`, opacity
                  // and transform only — and out on a transition of the same
                  // curve at `--duration-fast`, rather than on the house
                  // `animate-pop-out`, whose easing is the one curve this block
                  // is asked not to use. Under `prefers-reduced-motion` the
                  // stylesheet collapses both to nothing and pins the transform
                  // flat through `data-motion-transform`.
                  'transition-[opacity,transform] duration-fast ease-out-quint',
                  'data-[state=open]:animate-rise',
                  'data-[state=closed]:translate-y-1 data-[state=closed]:opacity-0',
                )}
              >
                {message.text}
              </span>
            </>
          )}
        </p>

        <RegionRecord
          key={code}
          countryCode={code}
          visited={visited}
          headingLevel={headingLevel}
          disabled={busy}
          onCountChange={onRegionCount}
          onPendingChange={onRegionPending}
        />

        <ConfirmDialog
          request={confirm}
          pending={busy}
          onOpenChange={(open) => {
            if (!open) setConfirm(null)
          }}
        />
      </div>
    )
  },
)
CountryActions.displayName = 'CountryActions'
