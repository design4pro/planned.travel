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
import { cn } from '#/lib/cn'
import { countryName } from '#/lib/atlas/country-names'
import { visitSpan } from '#/lib/atlas/visit-span'
import { pluralise } from '#/lib/format'
import {
  addCountryToBucketListFn,
  markCountryVisitedFn,
  removeCountryFromBucketListFn,
  unmarkCountryVisitedFn,
} from '#/server/fns/atlas'

import type { ConfirmRequest } from '#/components/modules/shared'

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
 * `useOptimistic` claims the row's new state the instant the button is pressed
 * and withdraws the claim when the write settles — after the invalidation on
 * success, so the row never flickers through its old value on the way to its new
 * one, and immediately on failure, so the row visibly returns to what it was
 * while the message underneath says why. The claim is keyed by country code, so
 * a reader who selects somewhere else mid-flight cannot inherit the claim.
 *
 * **Nothing moves.** The message strip under the rows is a fixed two lines of
 * caption at every moment of the block's life — the resting hint, a failure, and
 * the gap between them are all the same 32px — because this block sits above a
 * list inside a scroll container, and a strip that grows on failure pushes the
 * list under the reader's cursor at the exact moment they are reading why
 * something did not save. For the same reason the button keeps one minimum
 * width across every label it can carry.
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
  rows: 'mt-2 flex min-w-0 flex-col gap-2',
  /**
   * Glyph and text on one line, the button under them, and all three on one line
   * from 20rem of container. Stated as a grid rather than as `flex-wrap`, so the
   * button either sits in its own column or spans the full width — never a
   * half-width orphan pushed onto a second line by a long title. 20rem is the
   * width at which the three columns stop fighting: under it a 360px phone gets
   * a full-width control instead of a 90px one squeezed against a wrapped title.
   */
  row: 'grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-lg border border-edge-faint bg-surface-2/60 p-3 @xs:grid-cols-[auto_minmax(0,1fr)_auto]',
  glyph:
    'grid size-9 shrink-0 place-items-center rounded-md border border-edge-faint transition-colors duration-base ease-out-quint [&_svg]:size-4',
  glyphIdle: 'bg-surface text-ink-3',
  glyphSet: 'bg-brand-subtle text-brand',
  body: 'min-w-0',
  /** One line, always: a wrapped title is the other way a row changes height. */
  title: 'truncate text-label leading-5 font-semibold text-ink',
  /**
   * Two lines of caption at a stated 16px leading, whatever it holds.
   *
   * The row's copy changes the instant a button is pressed — "A visit with no
   * trip behind it." becomes "Recorded without a trip." — and those two do not
   * wrap to the same number of lines in a 138px column. Reserving the two lines
   * every row can need makes the block one height in rest, in flight and after a
   * failure, which is the whole of §2h's second clause for this surface.
   */
  caption:
    'mt-1 line-clamp-2 h-8 text-caption leading-4 tabular-nums text-ink-2',
  /**
   * One minimum width for every label the row can carry, so the optimistic flip
   * from "Mark visited" to "Remove" cannot resize the row it sits in.
   */
  action: 'col-span-2 w-full @xs:col-span-1 @xs:w-auto @xs:min-w-30',
  /**
   * Two lines of caption at a stated 16px leading: 32px in every state, whether
   * it holds the hint, a two-line failure or the tail of one fading out.
   *
   * Every step in it is on the grid, the glyph included: a 16px icon against a
   * 16px first line needs no optical nudge to sit on the same baseline, so the
   * half-step this row used to carry bought nothing but a value off the scale.
   */
  message: 'mt-2 flex h-8 items-start gap-2',
  messageText: 'line-clamp-2 text-caption leading-4',
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
 * `visitSpan` writes the single-day case as "Visited 4 Dec 2021", which is right
 * on a record card and wrong twice over here: under a row already headed
 * "Visited", and inside a sentence that has already said "recorded visit". Every
 * other shape it returns is a bare span and is used as it stands.
 */
function spanLine(visit: CountryActionsVisit): string {
  const span = visitSpan(visit.firstVisitedOn, visit.lastVisitedOn)
  return span.kind === 'single' ? span.date.label : span.summary
}

/**
 * What the atlas row says. The optimistic case — claimed as visited with no row
 * to read yet — states what the write is about to produce, which is a visit with
 * no dates behind it.
 */
function visitCopy(
  visited: boolean,
  visit: CountryActionsVisit | null,
): RowCopy {
  if (!visited) {
    return {
      title: 'Not visited',
      caption: 'A visit with no trip behind it.',
    }
  }
  if (visit === null) {
    return { title: 'Visited', caption: 'Recorded without a trip.' }
  }
  const dates = spanLine(visit)
  return {
    title: 'Visited',
    // The tally is only worth the words when it is more than one, and the
    // record above this block already carries the count as a badge.
    caption:
      visit.visitCount > 1
        ? `${pluralise(visit.visitCount, 'visit')} · ${dates}`
        : dates,
  }
}

/** What the bucket-list row says, in the same three shapes. */
function goalCopy(listed: boolean, goal: CountryActionsGoal | null): RowCopy {
  if (!listed) {
    return {
      title: 'Not on the list',
      caption: 'Somewhere you mean to go.',
    }
  }
  if (goal === null) {
    return { title: 'On the bucket list', caption: 'Waiting for its turn.' }
  }
  if (goal.isAchieved) {
    return {
      title: 'Ticked off the list',
      caption: 'You got there. The entry stays as the record.',
    }
  }
  return {
    title: 'On the bucket list',
    caption:
      goal.targetYear === null
        ? 'Waiting for its turn.'
        : `Aiming for ${goal.targetYear}.`,
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
function visitControl(intent: RowIntent, name: string): RowControl {
  return intent === 'remove'
    ? {
        intent,
        label: 'Remove',
        restName: `Remove ${name} from your atlas`,
        busyName: `Removing ${name} from your atlas`,
      }
    : {
        intent,
        label: 'Mark visited',
        restName: `Mark visited, ${name}`,
        busyName: `Marking ${name} as visited`,
      }
}

/** The bucket-list row's control, in both directions. */
function goalControl(intent: RowIntent, name: string): RowControl {
  return intent === 'remove'
    ? {
        intent,
        label: 'Remove',
        restName: `Remove ${name} from your bucket list`,
        busyName: `Removing ${name} from your bucket list`,
      }
    : {
        intent,
        label: 'Add to list',
        restName: `Add to list, ${name}`,
        busyName: `Adding ${name} to your bucket list`,
      }
}

/** The resting line under the rows. Replaced by a failure, never by silence. */
const HINT = 'Both take effect straight away, and both can be undone here.'

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

/** What a confirmed removal says it is about to clear. */
function visitLossLine(visit: CountryActionsVisit): string {
  const span = visitSpan(visit.firstVisitedOn, visit.lastVisitedOn)
  const dates = span.kind === 'unrecorded' ? '' : ` (${spanLine(visit)})`
  const note =
    (visit.note ?? '').trim() === '' ? '' : ', and the note you wrote with it'
  return `${pluralise(visit.visitCount, 'recorded visit')}${dates} would be cleared${note}. Your trips and saved places are not touched.`
}

/* ------------------------------------------------------------- transport */

/**
 * What each engine calls "the request never left the building": Chromium's
 * "Failed to fetch", WebKit's "Load failed", Gecko's "NetworkError when
 * attempting to fetch resource".
 */
const TRANSPORT_FAILURE =
  /failed to fetch|load failed|network ?error|network request failed/i

/** The one sentence a reader gets when the request never reached the server. */
const OFFLINE_MESSAGE =
  'Your device could not reach the server. Check the connection and try again.'

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
): (input: TInput) => Promise<TResult> {
  return async (input: TInput): Promise<TResult> => {
    try {
      return await write(input)
    } catch (cause) {
      if (cause instanceof Error && TRANSPORT_FAILURE.test(cause.message)) {
        throw new Error(OFFLINE_MESSAGE, { cause })
      }
      throw cause
    }
  }
}

/**
 * Wrapped once at module scope, not per render: `useAction` memoises `run` on
 * the function it was handed, and a fresh wrapper every render would hand it a
 * new identity every time.
 */
const markVisited = readable(markCountryVisitedFn)
const unmarkVisited = readable(unmarkCountryVisitedFn)
const addGoalToList = readable(addCountryToBucketListFn)
const dropGoalFromList = readable(removeCountryFromBucketListFn)

/* ----------------------------------------------------------------- presence */

/**
 * How long the outgoing message stays mounted for its exit, in step with
 * `--duration-fast` and with the `animate-pop-out` class that plays over it. A
 * number rather than a token read, because the timer lives in JavaScript and the
 * animation lives in CSS; they are stated together here so they cannot drift.
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
    const rowId = React.useId()
    const code = countryCode.trim().toUpperCase()
    const name = countryName(code)
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

    const closeConfirm = React.useCallback(() => setConfirm(null), [])

    const mark = useAction(markVisited, {
      success: 'Marked as visited',
      description: `${name} is on your atlas.`,
      failure: `${name} was not marked`,
      fallback: 'The change did not reach the server. Try again in a moment.',
    })
    const unmark = useAction(unmarkVisited, {
      success: 'Removed from your atlas',
      description: `${name} is no longer marked as visited.`,
      failure: `${name} was not removed`,
      fallback: 'The change did not reach the server. Try again in a moment.',
      onSuccess: closeConfirm,
      // A confirmation that stays open over a failure hides the only durable
      // copy of the reason: the strip lives under the rows, behind the modal's
      // own overlay. Standing the question down puts the reader back on the row
      // they pressed, with the sentence under it and the offer still there to
      // take again.
      onError: closeConfirm,
    })
    const addGoal = useAction(addGoalToList, {
      success: 'Added to your bucket list',
      description: `${name} is somewhere you mean to go.`,
      failure: `${name} was not added`,
      fallback: 'The change did not reach the server. Try again in a moment.',
    })
    const dropGoal = useAction(dropGoalFromList, {
      success: 'Removed from your bucket list',
      description: `${name} is no longer on the list.`,
      failure: `${name} was not removed`,
      fallback: 'The change did not reach the server. Try again in a moment.',
      onSuccess: closeConfirm,
      onError: closeConfirm,
    })

    const visitPending = mark.pending || unmark.pending
    const goalPending = addGoal.pending || dropGoal.pending
    const busy = visitPending || goalPending
    const visitIntent = rowIntent(mark.pending, unmark.pending, visited)
    const goalIntent = rowIntent(addGoal.pending, dropGoal.pending, listed)

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

    // A new country is a new subject: whatever the last one failed at is not
    // this one's news, and the confirmation raised for it is not this one's
    // question either.
    React.useEffect(() => {
      clearMessages()
      setConfirm(null)
    }, [code, clearMessages])

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
     * `Button` puts a real `disabled` attribute on itself while it loads, which
     * is right — a control that is working must not be pressed twice — but the
     * browser drops focus from a control the moment it is disabled, and it
     * lands on `<body>`. A keyboard reader who pressed "Add to list" was left
     * at the top of the document with no way back to the row, and no way to
     * reach the sentence explaining why it did not save. So when the write
     * settles the block takes focus back, and only in the case it caused:
     * anything else holding focus — the confirmation dialog, a row the reader
     * tabbed on to while the write ran — keeps it.
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

    function runMark(): void {
      clearMessages()
      pressedRef.current = 'visit'
      void overlay.claim([[visitKey, true]], () =>
        mark.run({ data: { countryCode: code } }),
      )
    }

    function runUnmark(): void {
      clearMessages()
      pressedRef.current = 'visit'
      void overlay.claim([[visitKey, false]], () =>
        unmark.run({ data: { countryCode: code } }),
      )
    }

    function runAddGoal(): void {
      clearMessages()
      pressedRef.current = 'goal'
      void overlay.claim([[goalKey, true]], () =>
        addGoal.run({ data: { countryCode: code } }),
      )
    }

    function runDropGoal(itemId: string): void {
      clearMessages()
      pressedRef.current = 'goal'
      void overlay.claim([[goalKey, false]], () =>
        dropGoal.run({ data: { itemId } }),
      )
    }

    function onVisitPress(): void {
      if (visitIntent === 'add') {
        runMark()
        return
      }
      if (visit !== null && hasVisitHistory(visit)) {
        setConfirm({
          title: `Remove ${name} from your atlas?`,
          description: visitLossLine(visit),
          confirmLabel: 'Remove',
          onConfirm: runUnmark,
        })
        return
      }
      runUnmark()
    }

    function onGoalPress(): void {
      if (goalIntent === 'add') {
        runAddGoal()
        return
      }
      if (bucketGoal === null) {
        // Pointing at a removal with no row to address. The claim that produces
        // that is only held while the add is in flight, and the intent above
        // reads the flight rather than the claim, so this is a guard against a
        // state that cannot be reached rather than a path through the block.
        return
      }
      const itemId = bucketGoal.id
      if (bucketGoal.isAchieved) {
        setConfirm({
          title: `Remove ${name} from your bucket list?`,
          description:
            'It is already ticked off, so this also removes the record that you got there. Your atlas and your trips are not touched.',
          confirmLabel: 'Remove',
          onConfirm: () => runDropGoal(itemId),
        })
        return
      }
      runDropGoal(itemId)
    }

    const visitText = visitCopy(visited, visit)
    const goalText = goalCopy(listed, bucketGoal)
    const Heading = HEADINGS[headingLevel]
    const visitTitleId = `${rowId}-visit`
    const goalTitleId = `${rowId}-goal`
    /** The dialog owns the spinner while it is the control being pressed. */
    const confirming = confirm !== null
    /** Busy on the control itself, which is not the same as busy in the block. */
    const visitBusy = visitPending && !confirming
    const goalBusy = goalPending && !confirming
    const visitAction = visitControl(visitIntent, name)
    const goalAction = goalControl(goalIntent, name)

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
        <SectionLabel as={Heading}>Your record</SectionLabel>

        <div className={layout.rows}>
          <div
            data-part="visit-row"
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
              disabled={goalPending}
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
              disabled={visitPending}
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
            <span className={cn(layout.messageText, 'text-ink-3')}>{HINT}</span>
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
                  'data-[state=open]:animate-rise data-[state=closed]:animate-pop-out',
                )}
              >
                {message.text}
              </span>
            </>
          )}
        </p>

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
