/** Render-only selection, with no storage keys, private descriptors or provider metadata. */
export interface PlacePhoto {
  readonly version: number
  readonly source: 'legacy' | 'fallback'
  readonly imageUrl: string | null
}
