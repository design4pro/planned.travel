/**
 * Putting the chosen people on a trip that already exists.
 *
 * One `addTripMemberFn` call per person, in the order they were chosen, after the trip is created.
 * Like the cover, no step may fail the trip: the caller gets a list of who was not added and why,
 * never an exception. That is what keeps a refused person from reaching the dialog's create-failure
 * path, where a second submit would create a second trip.
 */
import { addTripMemberFn } from '../trips/$tripId/-server/people'

/** A role a trip can start a person with. Never owner: that is the creator's. */
export type StartingRole = 'editor' | 'viewer'

export interface ChosenPerson {
  readonly userId: string
  readonly name: string
  readonly role: StartingRole
}

/**
 * Why a person is not on the trip.
 *
 * `unconfirmed` is not a refusal: the call threw, so the write may have landed, and "not added"
 * would be a claim nobody can back.
 */
export type NotAddedReason =
  'not-in-workspace' | 'already-on-trip' | 'unconfirmed'

export interface NotAdded {
  readonly userId: string
  readonly name: string
  readonly reason: NotAddedReason
}

const REFUSALS: Readonly<Record<string, NotAddedReason>> = {
  'not-in-workspace': 'not-in-workspace',
  'already-on-trip': 'already-on-trip',
}

async function addOne(
  tripId: string,
  person: ChosenPerson,
): Promise<NotAdded | null> {
  try {
    const answer = await addTripMemberFn({
      data: { tripId, userId: person.userId, role: person.role },
    })
    if (answer.ok) {
      return null
    }
    // Any refusal this screen has no sentence for is reported as unconfirmed rather than guessed at.
    const reason = REFUSALS[answer.reason] ?? 'unconfirmed'
    return { userId: person.userId, name: person.name, reason }
  } catch {
    return { userId: person.userId, name: person.name, reason: 'unconfirmed' }
  }
}

export async function addPeople(
  tripId: string,
  people: ReadonlyArray<ChosenPerson>,
): Promise<Array<NotAdded>> {
  const notAdded: Array<NotAdded> = []
  for (const person of people) {
    const outcome = await addOne(tripId, person)
    if (outcome !== null) {
      notAdded.push(outcome)
    }
  }
  return notAdded
}
