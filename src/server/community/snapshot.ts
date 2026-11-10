import { z } from 'zod'
import { hasVisibleCharacter } from '#/lib/workspace-name'

export const GALLERY_PREVIEW_TTL_MS = 15 * 60 * 1000
export const GALLERY_MAX_BYTES = 512 * 1024
const publicText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).refine(hasVisibleCharacter)
export const galleryPreviewInput = z.strictObject({
  tripId: z.string().min(1).max(128),
  publicTitle: publicText(120),
  summary: publicText(280),
  attribution: publicText(80),
  showDates: z.boolean(),
})
const place = z.strictObject({
  name: z.string(),
  category: z.string().nullable(),
  order: z.number().finite(),
  coordinates: z
    .strictObject({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
})
export const gallerySnapshotSchema = z
  .strictObject({
    version: z.literal(1),
    publicTitle: publicText(120),
    summary: publicText(280),
    attribution: publicText(80),
    showDates: z.boolean(),
    countryCodes: z.array(z.string().regex(/^[A-Z]{2}$/)),
    days: z
      .array(
        z.strictObject({
          order: z.number().int().positive(),
          date: z.string().optional(),
          title: z.string().optional(),
          places: z.array(place).max(1000),
        }),
      )
      .max(366),
  })
  .superRefine((document, ctx) => {
    if (
      !document.showDates &&
      document.days.some((day) => day.date !== undefined)
    ) {
      ctx.addIssue({ code: 'custom', message: 'Dates require consent.' })
    }
    if (
      document.days.reduce((total, day) => total + day.places.length, 0) > 1000
    ) {
      ctx.addIssue({ code: 'custom', message: 'Too many assignments.' })
    }
  })
export type GallerySnapshot = z.infer<typeof gallerySnapshotSchema>
export type GalleryPreviewInput = z.infer<typeof galleryPreviewInput>
export interface GalleryPreview {
  readonly previewId: string
  readonly expiresAt: number
  readonly document: GallerySnapshot
}
export type GalleryPreviewResult =
  | (GalleryPreview & { readonly status: 'ready' })
  | { readonly status: 'too-large' | 'capture-unavailable' }
export function parseGallerySnapshot(bytes: string): GallerySnapshot {
  if (new TextEncoder().encode(bytes).length > GALLERY_MAX_BYTES)
    throw new Error('Snapshot exceeds byte limit.')
  return gallerySnapshotSchema.parse(JSON.parse(bytes))
}
