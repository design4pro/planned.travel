/**
 * The shape of a Transport's chain of stations: the one owner of how many Legs it may hold and how
 * its stations and Legs relate.
 *
 * The dialog stops offering a control at the cap, the server functions validate the payload
 * against it and the repository refuses anything that slips past both, so the three have to read
 * one declaration. This module has no imports and no Zod for that reason: the form model, a
 * Worker-side validator and the repository can all load it.
 */

/**
 * The most legs one chain may hold.
 *
 * A bound on the validated array — a payload limit — and not a statement about how many changes a
 * journey may have: the mirrored `route` patch has to stay inside the 32 KiB frame
 * `src/server/do/protocol.ts` fixes. Twelve legs is thirteen stations, which is more changes than
 * any timetable in the world asks of one ticket.
 */
export const CHAIN_MAX_LEGS = 12

/** A chain runs between at least two stations, so it holds at least one leg. */
export const CHAIN_MIN_STATIONS = 2
export const CHAIN_MIN_LEGS = CHAIN_MIN_STATIONS - 1

/** One station more than legs: thirteen stations is twelve legs. */
export const CHAIN_MAX_STATIONS = CHAIN_MAX_LEGS + 1

/** What is wrong with a chain, and the array it is wrong about. */
export interface ChainShapeIssue {
  readonly path: 'stations' | 'legs'
  readonly message: string
}

/**
 * Whether `stationCount` stations and `legCount` legs make a chain: both empty (a journey that is
 * not a chain), or N stations with exactly N−1 legs and N of two or more.
 *
 * The bounds above are the array limits; this is the arithmetic between the two arrays, which no
 * limit on either one can state. `null` means the shape holds.
 */
export function chainShapeIssue(
  stationCount: number,
  legCount: number,
): ChainShapeIssue | null {
  if (stationCount === 0 && legCount === 0) {
    return null
  }
  if (stationCount < CHAIN_MIN_STATIONS) {
    return {
      path: 'stations',
      message: `A chain runs between at least ${CHAIN_MIN_STATIONS} stations.`,
    }
  }
  if (legCount !== stationCount - 1) {
    return {
      path: 'legs',
      message: 'A chain of N stations has exactly N−1 legs.',
    }
  }
  return null
}
