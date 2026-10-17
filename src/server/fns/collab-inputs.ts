/**
 * The Zod inputs the collaboration writers share, in one place.
 *
 * Plain schemas and nothing else, so the thread, notes and polls modules each import what they
 * need and none keeps its own copy of the id or body limits.
 */
import { z } from 'zod'

export const tripId = z.string().trim().min(1).max(64)
export const rowId = z.string().trim().min(1).max(64)
export const body = z.string().trim().min(1).max(4000)

const noteFields = {
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(8000),
  category: z.string().trim().max(60),
  colour: z
    .string()
    .trim()
    .max(9)
    .refine(
      (value) =>
        value === '' || /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value),
      'must be a hex colour',
    ),
  isPinned: z.boolean(),
}

export const noteInputSchema = z.object({ tripId, ...noteFields })
export const noteUpdateSchema = z.object({
  tripId,
  noteId: rowId,
  ...noteFields,
})

/**
 * A poll's options are stored as a JSON array on the row, so their ids are minted
 * here. Two options with the same label are a mistake worth refusing rather than
 * a tie nobody can read.
 */
export const pollInputSchema = z.object({
  tripId,
  question: z.string().trim().min(1).max(200),
  options: z
    .array(z.string().trim().min(1).max(120))
    .min(2)
    .max(12)
    .refine((values) => {
      const seen = new Set(values.map((value) => value.toLowerCase()))
      return seen.size === values.length
    }, 'Two options say the same thing. Give each one its own wording.'),
  allowMultiple: z.boolean(),
})

export const postMessageSchema = z.object({
  tripId,
  body,
  replyToId: z.string().trim().max(64),
})

/** The input of the message writer, as the plain function takes it. */
export type PostMessageData = z.infer<typeof postMessageSchema>

/** The cursor narrows a scoped query; callers cannot choose its scan size. */
export const olderMessagesSchema = z.strictObject({ tripId, cursor: rowId })
