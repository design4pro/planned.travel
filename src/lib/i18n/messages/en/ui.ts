/**
 * The design system's own copy — every word `src/components/ui` says on its own
 * behalf, in the source locale.
 *
 * `docs/SPEC.md` §8 fixes the shape of this file: one flat object of keys,
 * default-exported, under `messages/<locale>/<namespace>.ts`. A screen never
 * reads these keys; the primitives do, through `useUiCopy()` in
 * `src/components/ui/copy.ts`, and every one of them is reachable as
 * `t('ui.<key>')`.
 *
 * **What belongs here.** Copy a primitive supplies when the caller does not: the
 * name on a close button, the placeholder in an empty select, the sentence a
 * screen reader hears while a control is busy. Every one of these was a
 * hard-coded English literal until this file existed, which meant a Polish
 * traveller's dialog closed with an English "Close" no matter how well the
 * screen around it was translated.
 *
 * **What does not.** Anything the caller passes in — a `Field` label, a
 * `Table` caption, an `EmptyState` title — belongs to the screen's namespace,
 * because only the screen knows what it is naming. And CLDR facts: month names,
 * weekday names and list punctuation come from `src/lib/format-tables.ts`, which
 * is frozen against the workerd/WebKit divergence §8.5 calls a defect. The keys
 * below that mention a month or a weekday carry only the *pattern* — the order
 * the parts go in — so a Japanese translator can write `{year}年{month}` without
 * anybody inventing a month name.
 *
 * **Shared keys are deliberate.** `action.close` serves `Dialog` and `Sheet`;
 * `select.placeholder` serves `Select` and `Combobox`. One key means one
 * translation and one voice, rather than two files quietly disagreeing about
 * what "Close" is in Ukrainian.
 *
 * Not here, and on purpose: the key-cap legends in `kbd.tsx`. `Esc` and `Ctrl`
 * are what is physically printed on the key, in the same class as `⇧` and `⌘`,
 * and a translated legend would name a key the reader's hardware does not have.
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  /* ------------------------------------------------------------- actions */
  /** Empties a field that already has a value. */
  'action.clear': 'Clear',
  /** Dismisses a dialog or a sheet. */
  'action.close': 'Close',
  /** Dismisses an inline alert. */
  'action.dismiss': 'Dismiss',
  /** Takes one entry off a chip or a tag list. */
  'action.remove': 'Remove',
  /** Reverses the action a toast has just announced. */
  'action.undo': 'Undo',

  /* -------------------------------------------------------------- status */
  /** Announced by a spinner that stands alone. */
  'status.loading': 'Loading',
  /** Announced while a button is mid-submit. */
  'status.working': 'Working',
  /** Announced while a combobox is waiting on results. */
  'status.searching': 'Searching',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} is online',
  'avatar.status.away': '{name} is away',
  'avatar.status.busy': '{name} is busy',
  'avatar.status.offline': '{name} is offline',
  /**
   * The tail of an avatar stack's accessible name: "…, Mira and 3 others".
   *
   * `{others}` arrives already grouped for the locale; `count` is present only
   * to pick the plural branch and is never rendered. §8's rule on numbers
   * inside messages: a raw substitution would read `1234` in every one of the
   * twenty-three locales, where German wants `1.234`.
   */
  'avatar.overflow': {
    one: '{others} other',
    other: '{others} others',
  },
  /**
   * The face at the end of a crowded stack. `{hidden}` arrives already grouped
   * in this locale's digits — the name is not `count` on purpose, because
   * `count` is reserved for the number that selects a plural branch and reaches
   * the template unformatted. The sign is on this side of it only because
   * English puts it there; an Arabic translator moves it.
   */
  'avatar.more': '+{hidden}',

  /* --------------------------------------------------------------- badge */
  /**
   * A count that has run past the badge's cap: `99+`. The number arrives
   * already grouped, and the marker's side is the translator's to choose, the
   * same way `avatar.more`'s is.
   */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Choose a date',
  'calendar.label.range': 'Choose a date range',
  'calendar.previousMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  /**
   * The month heading over one grid. `{month}` is the wide month name from the
   * frozen CLDR table and `{year}` is the bare year — reorder them freely.
   */
  'calendar.monthYear': '{month} {year}',
  /** The grid's accessible name: the month it shows, then what it is for. */
  'calendar.grid': '{month} — {label}',
  /** Announced politely when the visible month or months change. */
  'calendar.showing': 'Showing {months}',
  /** One day's accessible name. `{day}` and `{year}` are already formatted. */
  'calendar.day': '{weekday} {day} {month} {year}',

  /* ------------------------------------------------------- select family */
  /** Shown by `Select` and `Combobox` while nothing is chosen. */
  'select.placeholder': 'Select…',
  /**
   * A saved value the option list no longer offers — what a schema change or a
   * withdrawn currency leaves behind. This is the compact form, shown on the
   * control itself beside a warning glyph, so keep it short; `{value}` is the
   * stored value verbatim, which is the only handle the reader has on what was
   * dropped and is never translated.
   */
  'select.unavailable': 'Unavailable: {value}',
  /** The same fact as a sentence, for a screen reader. */
  'select.unavailableHint':
    'The saved choice {value} is no longer available. Choose another.',
  'combobox.search': 'Search',
  'combobox.empty': 'No matches',
  'combobox.clear': 'Clear selection',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Pick a date',
  'datePicker.clear': 'Clear date',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Pick dates',
  'dateRange.clear': 'Clear dates',
  'dateRange.presets': 'Quick ranges',
  'dateRange.preset.week': 'Next 7 days',
  'dateRange.preset.fortnight': 'Next 2 weeks',
  'dateRange.preset.month': 'Next 30 days',
  /** Both ends chosen. `{start}` and `{end}` are already formatted dates. */
  'dateRange.value': '{start} – {end}',
  /** The first end is chosen and the reader is still picking the second. */
  'dateRange.valuePending': '{start} — …',
  /**
   * The night count beside a chosen range, and the same figure spelled out
   * under the calendar. `{nights}` is already grouped for the locale and is the
   * only thing the reader sees; `count` selects the plural branch and stops
   * there, so `ja` gets one branch and `ar` all six without either of them
   * inheriting English digits.
   */
  'dateRange.nights': {
    one: '{nights} night',
    other: '{nights} nights',
  },
  'dateRange.nightsSelected': {
    one: '{nights} night selected',
    other: '{nights} nights selected',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Pagination',
  'pagination.first': 'First page',
  'pagination.previous': 'Previous page',
  'pagination.next': 'Next page',
  'pagination.last': 'Last page',
  /** One numbered page button. `{page}` is already grouped for the locale. */
  'pagination.page': 'Page {page}',
  /** The compact counter, for a phone. */
  'pagination.current': 'Page {page} of {pageCount}',
  /** The slice this page shows. Every number arrives already formatted. */
  'pagination.summary': 'Showing {from}–{to} of {total}',
} as const satisfies NamespaceMessages

export default messages
