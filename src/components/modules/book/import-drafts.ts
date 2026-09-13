/**
 * The pure half of the import dialog: which rows a reader has kept, and which file each came from.
 *
 * A separate module from the dialog that renders it, and free of React and of anything under
 * `server/` at run time, for the reason `./grouping` is: the selection is the part worth testing
 * and a test for it should not need a DOM, let alone a Worker runtime.
 *
 * The staged row is **not** mapped here. `bookingImportDrafts` in `src/server/fns/booking-import.ts`
 * owns that, because the confirm takes indices and writes from the same mapping — a second reading
 * of a row on the client is a reading a reader could approve and not get. What is left is the two
 * things only the dialog knows: a reader can drop five files at once, so the rows need grouping by
 * the file they came from, and a reader can deselect any of them before pressing Add.
 */
import type { BookingImportDraft } from '#/server/fns/booking-import'

/** One file's staged answer, as the dialog holds it. */
export interface ImportFileDrafts {
  readonly jobId: string
  readonly filename: string
  readonly drafts: ReadonlyArray<BookingImportDraft>
}

/**
 * Accepted row indices per job id.
 *
 * Keyed by job rather than flattened, because the confirm is one call per file and its `accept`
 * array is indices into *that* file's staged record. A flat set of row ids would have to be taken
 * apart again at exactly the moment it matters.
 */
export type ImportSelection = ReadonlyMap<string, ReadonlySet<number>>

export type ImportSelectionAction =
  /** Everything in `files` — what the Select all button asks for. */
  | { readonly kind: 'all'; readonly files: ReadonlyArray<ImportFileDrafts> }
  /**
   * The rows a file arrives with, without disturbing the files already on screen.
   *
   * A drop of five files answers one file at a time, so this runs again every time a later one
   * lands — and by then a reader may already have unticked rows in an earlier one. Rebuilding the
   * whole map there would silently put those rows back and write bookings the reader rejected.
   */
  | {
      readonly kind: 'arrived'
      readonly files: ReadonlyArray<ImportFileDrafts>
    }
  | { readonly kind: 'none' }
  | { readonly kind: 'toggle'; readonly jobId: string; readonly index: number }

/** The starting state, and what `none` returns to. */
export const NO_IMPORT_SELECTION: ImportSelection = new Map()

/**
 * The files that have something to review, each with its rows.
 *
 * A file the engine read to nothing is dropped rather than shown as an empty group: its own outcome
 * state names the file and offers another, which is a better answer than a heading with no rows
 * under it.
 */
export function groupImportDrafts(
  files: ReadonlyArray<ImportFileDrafts>,
): Array<ImportFileDrafts> {
  return files.filter((file) => file.drafts.length > 0)
}

function selectEverything(
  files: ReadonlyArray<ImportFileDrafts>,
): ImportSelection {
  return new Map(
    groupImportDrafts(files).map((file) => [
      file.jobId,
      new Set(file.drafts.map((draft) => draft.index)),
    ]),
  )
}

/**
 * The selection after one reader action.
 *
 * `toggle` and `arrived` are the actions that read the previous state. `toggle` rebuilds just the
 * one job's set: a reader who deselects a row changes that row's membership and the count, and
 * nothing else — not the order of the groups, not the other files, not the rows already written by
 * a partial confirm. `arrived` leaves every file a reader has already seen exactly as they left it.
 */
export function importSelectionReducer(
  state: ImportSelection,
  action: ImportSelectionAction,
): ImportSelection {
  switch (action.kind) {
    case 'all':
      return selectEverything(action.files)
    case 'arrived':
      return new Map(
        groupImportDrafts(action.files).map((file) => {
          const offered = file.drafts.map((draft) => draft.index)
          const kept = state.get(file.jobId)
          // A file nothing has been decided about yet arrives fully selected. One a reader has
          // already pruned keeps their decision, minus any row no longer on offer: a partial
          // confirm takes the rows it wrote out of the list, and a selection still naming them
          // would send them a second time.
          return [
            file.jobId,
            kept === undefined
              ? new Set(offered)
              : new Set(offered.filter((index) => kept.has(index))),
          ]
        }),
      )
    case 'none':
      return NO_IMPORT_SELECTION
    case 'toggle': {
      const next = new Map(state)
      const kept = new Set(state.get(action.jobId) ?? [])
      if (kept.has(action.index)) {
        kept.delete(action.index)
      } else {
        kept.add(action.index)
      }
      next.set(action.jobId, kept)
      return next
    }
  }
}

export function isImportRowSelected(
  selection: ImportSelection,
  jobId: string,
  index: number,
): boolean {
  return selection.get(jobId)?.has(index) === true
}

/** What the confirm button counts, across every file in the dialog. */
export function importSelectionCount(selection: ImportSelection): number {
  let total = 0
  for (const kept of selection.values()) {
    total += kept.size
  }
  return total
}

/**
 * One file's accepted indices, ascending — the `accept` array the confirm sends.
 *
 * Sorted because a `Set` preserves insertion order and a reader's clicks do not arrive in row
 * order; the server writes in the order it is given, and a desk that lists a trip's bookings out of
 * sequence for no reason is a worse desk.
 */
export function acceptedImportRows(
  selection: ImportSelection,
  jobId: string,
): Array<number> {
  return [...(selection.get(jobId) ?? [])].sort((left, right) => left - right)
}
