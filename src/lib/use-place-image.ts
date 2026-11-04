import { useState } from 'react'
import type { PlacePhoto } from './place-photo'

/** Error state belongs to one URL/version; a late error cannot poison a replacement. */
export function usePlaceImage(
  legacyUrl: string | null | undefined,
  photo?: PlacePhoto,
) {
  const url = photo ? photo.imageUrl : legacyUrl
  const version = photo?.version ?? 0
  const [state, setState] = useState({ url, version, failed: false })
  const current = state.url === url && state.version === version
  if (!current) setState({ url, version, failed: false })
  return {
    url: current && state.failed ? null : url,
    onError: () =>
      setState((previous) =>
        previous.url === url && previous.version === version
          ? { url, version, failed: true }
          : previous,
      ),
  }
}
