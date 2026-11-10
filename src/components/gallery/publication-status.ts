export interface GalleryPublicationState {
  readonly status: 'in_review' | 'changes_requested' | 'published' | 'withdrawn'
  readonly preparation: 'pending' | 'running' | 'failed' | 'ready'
  readonly version: number
  readonly liveVersion: number | null
}

export function publicationStatus(publication: GalleryPublicationState | null) {
  if (!publication) return 'trips.gallery.publish.neverShared'
  if (publication.status === 'withdrawn')
    return 'trips.gallery.publish.withdrawn'
  const update =
    publication.liveVersion !== null &&
    publication.liveVersion !== publication.version
  if (publication.preparation === 'failed')
    return update
      ? 'trips.gallery.publish.failedUpdate'
      : 'trips.gallery.publish.preparationFailed'
  if (publication.preparation !== 'ready')
    return update
      ? 'trips.gallery.publish.preparingUpdate'
      : 'trips.gallery.publish.preparing'
  if (publication.status === 'changes_requested')
    return 'trips.gallery.publish.changesRequested'
  if (
    publication.status === 'published' &&
    publication.liveVersion === publication.version
  )
    return 'trips.gallery.publish.published'
  return update
    ? 'trips.gallery.publish.liveAndPending'
    : 'trips.gallery.publish.inReview'
}
