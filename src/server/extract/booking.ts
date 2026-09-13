/**
 * Text to staged reservations — the second half of the confirmation import's model branch.
 *
 * `./document` answered a string and knew nothing about a booking; this module knows nothing about
 * a PDF. What it owns is the set of rules that decide what a model's answer is allowed to become,
 * and the money rule is why it exists as a module rather than as a block inside the queue handler:
 *
 * - **A malformed answer is rejected whole.** Never a half-filled draft staged for a reader who
 *   would have to guess which half is the model's.
 * - **A row that does not parse is dropped, and its siblings are not.** An answer with four good
 *   rows and one unusable one stages four.
 * - **An amount that does not parse into an integer count of minor units beside an ISO-4217 code
 *   is dropped whole**, and the row is marked. Nothing is rounded, inferred from a half-recognised
 *   symbol, or carried across from another line on the page. Money is never guessed.
 *
 * A date the model invented is not detectable, and this design does not pretend it is. What it does
 * instead is make every extracted row visibly machine-written: it reaches the review list before
 * anything is written, and every row the confirm writes carries `imported_at`, which the desk
 * renders as "Unchecked import". That is ADR 0012's load-bearing consequence, stated where it is
 * implemented.
 *
 * The model arrives as an injected port, so no test in this directory touches the network.
 */

import { z } from 'zod'
import {
  RESERVATION_KINDS,
  extractReference,
  inferReservationKind,
} from '../queue/handlers/booking-import'
import { ImportRefusedError } from './document'

import type {
  ReservationKind,
  StagedReservation,
} from '../queue/handlers/booking-import'

/**
 * The slice of the `AI` binding this module uses. Injected, so no test touches the network.
 *
 * Written out rather than typed as `Ai`: that class is abstract, so a handler typed against it
 * could not be handed a fake, and the seam between a booking's rules and a non-deterministic model
 * is the one this stage most needed to be able to test.
 */
export interface BookingModel {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>
}

/**
 * The model the extraction runs on.
 *
 * An instruction-tuned 8B: the task is reading a form's worth of fields out of one page of text,
 * which is not where a larger model earns its cost, and every call is billed to us rather than to
 * the tenant it is made for (`docs/adr/0012-workers-ai-for-confirmation-extraction.md`).
 */
export const EXTRACTION_MODEL = '@cf/meta/llama-3.1-8b-instruct'

/** How many rows one document may contribute, before the handler's own cap. */
export const MAX_EXTRACTED_ROWS = 50

const INSTRUCTIONS = [
  'You read travel confirmations and answer only with JSON.',
  'Answer exactly {"bookings": [...]}, with one entry per booking the text confirms.',
  'Each entry may carry: kind (one of flight, lodging, transport, activity, other),',
  'title, startsAt, endsAt, allDay, location, notes, reference, amountMinor, currency.',
  'Dates are ISO 8601. Use the timezone the document states and omit it when it states none.',
  'amountMinor is an integer count of the currency’s minor units and currency is an ISO-4217 code.',
  'Omit both unless the document states the price clearly. Never estimate, round or convert a price.',
  'Omit any field the document does not state. Do not invent a value for it.',
  'If the text confirms no booking, answer {"bookings": []}.',
].join(' ')

/** The model's envelope. A failure here is the "rejected whole" rule. */
const answerSchema = z.object({ bookings: z.array(z.unknown()).max(500) })

/** A text-generation answer, which is where the JSON arrives as a string. */
const textAnswerSchema = z.object({ response: z.string() })

/** One row, tolerantly: a row that fails this is dropped and its siblings are kept. */
const rowSchema = z.object({
  kind: z.string().max(40).nullish(),
  title: z.string().max(200).nullish(),
  startsAt: z.string().max(64).nullish(),
  endsAt: z.string().max(64).nullish(),
  allDay: z.boolean().nullish(),
  location: z.string().max(200).nullish(),
  notes: z.string().max(2000).nullish(),
  reference: z.string().max(64).nullish(),
  // `unknown` on purpose: whatever the model put here is the money rule's input, and the rule —
  // not the schema — is what decides whether it becomes a price. `.optional()` because Zod 4 makes
  // an `unknown` key required, and a document that stated no price is the ordinary case.
  amountMinor: z.unknown().optional(),
  currency: z.unknown().optional(),
})

const CURRENCY_PATTERN = /^[A-Za-z]{3}$/

/** An offset-bearing instant: a trailing `Z` or a `±hh:mm`. Anything else floats. */
const ZONED_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/

interface Money {
  readonly priceMinor?: number
  readonly currency?: string
  /** True when the extractor saw a price it could not turn into minor units. */
  readonly dropped: boolean
}

/**
 * The money rule, alone so it can be read and tested as one.
 *
 * Both fields or neither. An amount without a currency is not a price, a currency without an
 * amount is not either, and a value that is not already an integer count of minor units is not
 * something to round — the printed string a document carries (`1.250,50` against `1,250.50`) is
 * settled by a locale-aware browser parser the server may not import, so the model is asked for
 * the integer instead and anything else is dropped.
 */
export function moneyFrom(amountMinor: unknown, currency: unknown): Money {
  const stated = amountMinor !== undefined && amountMinor !== null
  const code = typeof currency === 'string' ? currency.trim() : ''
  const usable =
    typeof amountMinor === 'number' &&
    Number.isSafeInteger(amountMinor) &&
    amountMinor >= 0 &&
    CURRENCY_PATTERN.test(code)

  if (usable) {
    return {
      priceMinor: amountMinor,
      currency: code.toUpperCase(),
      dropped: false,
    }
  }
  return { dropped: stated || code.length > 0 }
}

function kindFrom(
  stated: string | null | undefined,
  haystack: string,
): ReservationKind {
  const lowered = stated?.trim().toLowerCase() ?? ''
  const known = (RESERVATION_KINDS as ReadonlyArray<string>).includes(lowered)
  return known ? (lowered as ReservationKind) : inferReservationKind(haystack)
}

function rowToReservation(
  row: z.infer<typeof rowSchema>,
): StagedReservation | null {
  const title = row.title?.trim() ?? ''
  const location = row.location?.trim() ?? ''
  const notes = row.notes?.trim() ?? ''
  const reference = row.reference?.trim() ?? ''
  const startsAt = row.startsAt?.trim() ?? ''

  // A row that named nothing at all is the model padding its answer, not a booking.
  if (
    title.length === 0 &&
    startsAt.length === 0 &&
    location.length === 0 &&
    reference.length === 0
  ) {
    return null
  }

  const haystack = [title, notes, location, row.kind].filter(Boolean).join(' ')
  const money = moneyFrom(row.amountMinor, row.currency)

  return {
    externalId: null,
    // Empty and not a placeholder: a title nobody wrote is copy, and copy lives in the
    // 23-locale catalogue (docs/SPEC.md §9). The review list renders
    // `modules.book.import.review.untitled` for it, and the confirm resolves the same key
    // before the row is written — an extraction has no reader and no locale to do it in.
    title,
    kind: kindFrom(row.kind, haystack),
    startsAt: startsAt.length > 0 ? startsAt : null,
    endsAt: row.endsAt?.trim() ?? null,
    allDay: row.allDay ?? (startsAt.length > 0 && !startsAt.includes('T')),
    floating: startsAt.length > 0 && !ZONED_PATTERN.test(startsAt),
    location: location.length > 0 ? location : null,
    notes: notes.length > 0 ? notes : null,
    reference: reference.length > 0 ? reference : extractReference(haystack),
    ...(money.priceMinor === undefined
      ? {}
      : { priceMinor: money.priceMinor, currency: money.currency }),
    // Marked before it is written, never after: a partially read row the reader can see is a
    // review task, and the same row written silently is a wrong booking.
    ...(money.dropped || startsAt.length === 0 ? { needsReview: true } : {}),
  }
}

/**
 * The JSON an instruction-tuned model actually answers with.
 *
 * Models wrap JSON in prose and in fenced code blocks however firmly they are asked not to, so the
 * first balanced object is taken rather than the whole string. This is not trust: whatever comes
 * out still goes through {@link answerSchema}.
 */
function jsonFrom(answer: unknown): unknown {
  const text =
    typeof answer === 'string'
      ? answer
      : (textAnswerSchema.safeParse(answer).data?.response ?? null)

  if (text === null) {
    // Already structured: some models answer an object, and one less round trip through a string
    // is one less place to lose a field.
    return answer
  }

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

/**
 * The bookings a document's text confirms, or a permanent refusal.
 *
 * Answers an empty array only when the model said so explicitly; the handler turns that into the
 * designed "we could not find a booking in that file" state.
 */
export async function textToReservations(
  model: BookingModel,
  input: { readonly text: string; readonly sourceName: string },
): Promise<Array<StagedReservation>> {
  let answer: unknown
  try {
    answer = await model.run(EXTRACTION_MODEL, {
      messages: [
        { role: 'system', content: INSTRUCTIONS },
        { role: 'user', content: input.text },
      ],
      max_tokens: 2048,
    })
  } catch (cause) {
    throw new ImportRefusedError(
      'unreadable',
      `The extraction of ${input.sourceName} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
  }

  const parsed = answerSchema.safeParse(jsonFrom(answer))
  if (!parsed.success) {
    throw new ImportRefusedError(
      'unreadable',
      `The extraction of ${input.sourceName} answered a shape this import cannot read`,
    )
  }

  return parsed.data.bookings
    .slice(0, MAX_EXTRACTED_ROWS)
    .map((row) => rowSchema.safeParse(row))
    .flatMap((row) => (row.success ? [rowToReservation(row.data)] : []))
    .filter((row): row is StagedReservation => row !== null)
}
