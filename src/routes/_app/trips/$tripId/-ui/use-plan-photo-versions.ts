import { useState } from 'react'
import type { PlanBoardPayload } from '../-server/plan'

/** Retain acknowledged photos across older loader/room refreshes, never across trips. */
export function usePlanPhotoVersions(
  incoming: PlanBoardPayload,
): PlanBoardPayload {
  const [state, setState] = useState({ incoming, resolved: incoming })
  if (state.incoming === incoming) return state.resolved
  const previous = new Map(
    state.resolved.places.map((place) => [place.id, place]),
  )
  const resolved = {
    ...incoming,
    places: incoming.places.map((place) => {
      const saved = previous.get(place.id)
      if (
        state.resolved.tripId !== incoming.tripId ||
        !saved?.photo ||
        saved.photo.version <= (place.photo?.version ?? 0)
      )
        return place
      return { ...place, imageUrl: saved.imageUrl, photo: saved.photo }
    }),
  }
  setState({ incoming, resolved })
  return resolved
}
