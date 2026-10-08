/**
 * What a Transport save means to do: make a new row, or change one that exists.
 *
 * The dialog knows which it is doing, so it says so, and the save no longer has to guess from
 * whether the id happens to be found. That guess was the defect: a Transport deleted in another
 * tab was found nowhere, so an edit of it was taken for a create and the row came back.
 *
 * Binding-free like `#/lib/transport-chain`, so the dialog, the wire validator and the repository
 * read one declaration.
 */
export const TRANSPORT_SAVE_INTENTS = ['create', 'edit'] as const

export type TransportSaveIntent = (typeof TRANSPORT_SAVE_INTENTS)[number]
