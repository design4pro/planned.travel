/**
 * Every way a trip can come to hold a price, for the tests of the one rule that depends on it: a
 * trip's budget currency may only change while nothing on the trip is priced.
 *
 * One entry per kind, seeded through the public repository API where there is one, so a column the
 * repository starts requiring breaks the seed rather than silently thinning the rule's coverage.
 * Rows are written with **no currency** wherever the column is nullable, because that is the shape
 * the rule exists for: a priced row whose `NULL` currency means "the trip's own".
 */

import { createExpense, createBudgetItem, createSettlement } from '../expenses'
import { createAccommodation } from '../itinerary'
import { createPlace } from '../places'
import { createReservation } from '../reservations'
import { createTransport } from '../transports'
import { listTripDays } from '../days'
import { addTripMember, tripMemberUserIds, tripsRepository } from '../trips'
import type { TenantScope } from '../base'

export interface PricedKind {
  readonly name: string
  /** Puts exactly this kind of price on the trip, and nothing else. */
  readonly seed: (
    scope: TenantScope,
    tripId: string,
    otherUserId: string,
  ) => Promise<void>
}

/** A split or a payment may only name the trip's people, so the other traveller joins first. */
async function joinTrip(
  scope: TenantScope,
  tripId: string,
  userId: string,
): Promise<void> {
  if (!(await tripMemberUserIds(scope, tripId)).includes(userId)) {
    await addTripMember(scope, { tripId, userId, role: 'editor' })
  }
}

export const PRICED_KINDS: ReadonlyArray<PricedKind> = [
  {
    name: 'an expense',
    async seed(scope, tripId) {
      await createExpense(scope, {
        tripId,
        title: 'Dinner',
        amountMinor: 4200,
        spentOn: '2026-04-10',
      })
    },
  },
  {
    name: 'an expense with a share',
    async seed(scope, tripId, otherUserId) {
      await joinTrip(scope, tripId, otherUserId)
      await createExpense(scope, {
        tripId,
        title: 'Taxi',
        amountMinor: 1500,
        spentOn: '2026-04-10',
        participants: [{ userId: scope.ctx.userId }, { userId: otherUserId }],
      })
    },
  },
  {
    name: 'a payment',
    async seed(scope, tripId, otherUserId) {
      await joinTrip(scope, tripId, otherUserId)
      await createSettlement(scope, {
        tripId,
        fromUserId: otherUserId,
        toUserId: scope.ctx.userId,
        amountMinor: 700,
        settledOn: '2026-04-11',
      })
    },
  },
  {
    name: 'a planned item',
    async seed(scope, tripId) {
      await createBudgetItem(scope, {
        tripId,
        name: 'Food',
        plannedAmountMinor: 30_000,
      })
    },
  },
  {
    name: 'a budget target of zero',
    async seed(scope, tripId) {
      await tripsRepository.requireUpdate(scope, tripId, {
        budgetTargetMinor: 0,
      })
    },
  },
  {
    name: 'a priced place with no currency',
    async seed(scope, tripId) {
      await createPlace(scope, { tripId, name: 'Pastéis', priceMinor: 350 })
    },
  },
  {
    name: 'a priced reservation with no currency',
    async seed(scope, tripId) {
      await createReservation(scope, {
        tripId,
        title: 'Hotel do Chiado',
        priceMinor: 18_000,
      })
    },
  },
  {
    name: 'a priced transport with no currency',
    async seed(scope, tripId) {
      await createTransport(scope, {
        tripId,
        title: 'Airport train',
        mode: 'train',
        priceMinor: 450,
      })
    },
  },
  {
    name: 'a priced stay with no currency',
    async seed(scope, tripId) {
      const days = await listTripDays(scope, tripId)
      const first = days.at(0)
      if (first === undefined) {
        throw new Error('A stay needs a trip with dates.')
      }
      await createAccommodation(scope, {
        tripId,
        startDayId: first.id,
        endDayId: first.id,
        name: 'Alfama flat',
        priceMinor: 9000,
      })
    },
  },
  {
    name: 'a trip copy still in progress',
    async seed(scope, tripId) {
      await tripsRepository.requireUpdate(scope, tripId, {
        copyPendingAt: new Date(),
      })
    },
  },
]
