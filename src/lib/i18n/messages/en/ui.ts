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
  /** The tail of an avatar stack's accessible name: "…, Mira and 3 others". */
  'avatar.overflow': {
    one: '{count} other',
    other: '{count} others',
  },

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
  'dateRange.nights': {
    one: '{count} night',
    other: '{count} nights',
  },
  'dateRange.nightsSelected': {
    one: '{count} night selected',
    other: '{count} nights selected',
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
