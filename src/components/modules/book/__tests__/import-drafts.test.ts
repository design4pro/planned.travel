import { describe, expect, it } from 'vitest'

import {
  NO_IMPORT_SELECTION,
  acceptedImportRows,
  groupImportDrafts,
  importSelectionCount,
  importSelectionReducer,
  isImportRowSelected,
} from '../import-drafts'

import type { ImportFileDrafts, ImportSelection } from '../import-drafts'
import type { BookingImportDraft } from '#/server/fns/booking-import'

function draft(
  overrides: Partial<BookingImportDraft> = {},
): BookingImportDraft {
  return {
    index: 0,
    type: 'accommodation',
    title: 'Hotel Okura',
    location: null,
    reference: null,
    startDate: '2026-04-02',
    startTime: null,
    endDate: null,
    endTime: null,
    priceMinor: null,
    currency: null,
    needsReview: false,
    ...overrides,
  }
}

function file(
  jobId: string,
  count: number,
  filename = `${jobId}.pdf`,
): ImportFileDrafts {
  return {
    jobId,
    filename,
    drafts: Array.from({ length: count }, (_, index) => draft({ index })),
  }
}

describe('groupImportDrafts', () => {
  it('keeps the files that have rows, in the order they were dropped', () => {
    const groups = groupImportDrafts([file('a', 2), file('b', 1)])

    expect(groups.map((group) => group.jobId)).toEqual(['a', 'b'])
    expect(groups.map((group) => group.drafts.length)).toEqual([2, 1])
  })

  it('drops a file the engine read to nothing', () => {
    const groups = groupImportDrafts([file('a', 2), file('empty', 0)])

    expect(groups.map((group) => group.jobId)).toEqual(['a'])
  })
})

describe('importSelectionReducer', () => {
  it('starts a freshly read file with every row kept', () => {
    const selection = importSelectionReducer(NO_IMPORT_SELECTION, {
      kind: 'all',
      files: [file('a', 3), file('b', 4)],
    })

    expect(importSelectionCount(selection)).toBe(7)
    expect(acceptedImportRows(selection, 'a')).toEqual([0, 1, 2])
    expect(acceptedImportRows(selection, 'b')).toEqual([0, 1, 2, 3])
  })

  it('offers no row of a file that was read to nothing', () => {
    const selection = importSelectionReducer(NO_IMPORT_SELECTION, {
      kind: 'all',
      files: [file('empty', 0)],
    })

    expect(importSelectionCount(selection)).toBe(0)
    expect(selection.has('empty')).toBe(false)
  })

  it('removes a deselected row from the accepted set and from the count, and nothing else', () => {
    const files = [file('a', 3), file('b', 2)]
    const all = importSelectionReducer(NO_IMPORT_SELECTION, {
      kind: 'all',
      files,
    })

    const pruned = importSelectionReducer(all, {
      kind: 'toggle',
      jobId: 'a',
      index: 1,
    })

    expect(acceptedImportRows(pruned, 'a')).toEqual([0, 2])
    expect(importSelectionCount(pruned)).toBe(4)
    // The other file is untouched, and so is the state the reducer was handed.
    expect(acceptedImportRows(pruned, 'b')).toEqual([0, 1])
    expect(importSelectionCount(all)).toBe(5)
  })

  it('puts a row back when it is toggled twice', () => {
    const files = [file('a', 2)]
    const all = importSelectionReducer(NO_IMPORT_SELECTION, {
      kind: 'all',
      files,
    })
    const toggle = (state: ImportSelection): ImportSelection =>
      importSelectionReducer(state, { kind: 'toggle', jobId: 'a', index: 0 })

    expect(acceptedImportRows(toggle(toggle(all)), 'a')).toEqual([0, 1])
  })

  it('selects a row of a file nothing has been selected from yet', () => {
    const selection = importSelectionReducer(NO_IMPORT_SELECTION, {
      kind: 'toggle',
      jobId: 'a',
      index: 2,
    })

    expect(acceptedImportRows(selection, 'a')).toEqual([2])
  })

  it('keeps a reader’s deselections when a later file in the same drop answers', () => {
    // The regression this guards: a drop is staggered 20s per file, so a reader has a real window
    // to prune file A before file B lands. Rebuilding the whole map on B's arrival silently put
    // A's rejected rows back, and the confirm then wrote bookings the reader had refused.
    const arrived = importSelectionReducer(NO_IMPORT_SELECTION, {
      kind: 'arrived',
      files: [file('a', 3)],
    })
    const pruned = importSelectionReducer(arrived, {
      kind: 'toggle',
      jobId: 'a',
      index: 1,
    })

    const both = importSelectionReducer(pruned, {
      kind: 'arrived',
      files: [file('a', 3), file('b', 2)],
    })

    expect(acceptedImportRows(both, 'a')).toEqual([0, 2])
    // The file nobody has decided about arrives selected, as a freshly read file should.
    expect(acceptedImportRows(both, 'b')).toEqual([0, 1])
    expect(importSelectionCount(both)).toBe(4)
  })

  it('drops a row a partial confirm already wrote, and the file it emptied', () => {
    const arrived = importSelectionReducer(NO_IMPORT_SELECTION, {
      kind: 'arrived',
      files: [file('a', 3), file('b', 1)],
    })

    // What the dialog hands back after a partial confirm: the written rows are gone from the
    // staged list, and a file with nothing left is no longer a group at all.
    const after = importSelectionReducer(arrived, {
      kind: 'arrived',
      files: [
        { jobId: 'a', filename: 'a.pdf', drafts: [draft({ index: 2 })] },
        file('b', 0),
      ],
    })

    expect(acceptedImportRows(after, 'a')).toEqual([2])
    expect(after.has('b')).toBe(false)
    expect(importSelectionCount(after)).toBe(1)
  })

  it('still selects everything when a reader asks for it after pruning', () => {
    // `all` is the Select all button and keeps its meaning: `arrived` is the automatic path.
    const arrived = importSelectionReducer(NO_IMPORT_SELECTION, {
      kind: 'arrived',
      files: [file('a', 3)],
    })
    const pruned = importSelectionReducer(arrived, {
      kind: 'toggle',
      jobId: 'a',
      index: 0,
    })

    const all = importSelectionReducer(pruned, {
      kind: 'all',
      files: [file('a', 3)],
    })

    expect(acceptedImportRows(all, 'a')).toEqual([0, 1, 2])
  })

  it('empties every file on select none', () => {
    const all = importSelectionReducer(NO_IMPORT_SELECTION, {
      kind: 'all',
      files: [file('a', 3), file('b', 2)],
    })

    const none = importSelectionReducer(all, { kind: 'none' })

    expect(importSelectionCount(none)).toBe(0)
    expect(acceptedImportRows(none, 'a')).toEqual([])
  })
})

describe('acceptedImportRows', () => {
  it('sorts the indices a reader clicked out of order', () => {
    const clicks = [4, 0, 2].reduce<ImportSelection>(
      (state, index) =>
        importSelectionReducer(state, { kind: 'toggle', jobId: 'a', index }),
      NO_IMPORT_SELECTION,
    )

    expect(acceptedImportRows(clicks, 'a')).toEqual([0, 2, 4])
  })

  it('answers with nothing for a file the reader has not touched', () => {
    expect(acceptedImportRows(NO_IMPORT_SELECTION, 'a')).toEqual([])
  })
})

describe('isImportRowSelected', () => {
  it('is true only for a kept row of that file', () => {
    const selection = importSelectionReducer(NO_IMPORT_SELECTION, {
      kind: 'toggle',
      jobId: 'a',
      index: 1,
    })

    expect(isImportRowSelected(selection, 'a', 1)).toBe(true)
    expect(isImportRowSelected(selection, 'a', 0)).toBe(false)
    expect(isImportRowSelected(selection, 'b', 1)).toBe(false)
  })
})
