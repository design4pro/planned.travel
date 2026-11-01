import { z } from 'zod'

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    )
  }, 'date')

/** Shared field validation; the server alone supplies the request clock. */
export const countryVisitEditSchema = z
  .strictObject({
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    firstVisitedOn: day.nullable(),
    lastVisitedOn: day.nullable(),
    note: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .transform((value) => value || null),
  })
  .refine(
    ({ firstVisitedOn, lastVisitedOn }) =>
      !firstVisitedOn || !lastVisitedOn || firstVisitedOn <= lastVisitedOn,
    { path: ['firstVisitedOn'], message: 'bounds' },
  )

export function countryVisitEditForToday(today: string) {
  return countryVisitEditSchema.superRefine((values, ctx) => {
    for (const field of ['firstVisitedOn', 'lastVisitedOn'] as const) {
      const value = values[field]
      if (value && value > today)
        ctx.addIssue({ code: 'custom', path: [field], message: 'future' })
    }
  })
}
