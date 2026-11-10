/** The bounded blog/changelog subset; Git parsing belongs to the later operator slice. */
import { z } from 'zod'
import { LOCALE_TAGS } from '#/lib/i18n/locales'

const prose = z
  .string()
  .min(1)
  .max(4000)
  .refine((value) => !/<(?:\/?[a-z]|!)/i.test(value))
export const releaseBodySchema = z
  .strictObject({
    title: prose.refine((value) => value.length <= 240),
    summary: z.array(prose).max(20),
    features: z.array(prose).max(100),
    fixes: z.array(prose).max(100),
  })
  .refine((body) => JSON.stringify(body).length <= 64000)
export type ReleaseBody = z.infer<typeof releaseBodySchema>
export const releaseLocaleSchema = z.enum(LOCALE_TAGS)
export const releaseVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/)
export const releaseIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/)
export const sourceShaSchema = z.string().regex(/^[a-f0-9]{40}$/)
export const sourceHashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const generationSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER - 1)
