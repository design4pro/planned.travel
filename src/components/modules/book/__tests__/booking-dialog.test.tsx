// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { BookingDialog } from '../booking-dialog'

import type { Catalogue } from '#/lib/i18n'

/**
 * What the traveller is told when a booking will not save, asserted where they
 * would read it.
 *
 * `booking-form.test.ts` proves that `validateBookingDraft` and `resolve` compose
 * into a sentence; it cannot prove that *the dialog* composes them, because it
 * calls `resolve` itself. That gap is the bug's own shape — the defect was never
 * in the rule, it was in the callsite rendering the rule's answer, and a callsite
 * is only pinned by rendering it. Reverting `errorFor` to
 * `t(error.key, error.params)` turns this red and leaves the unit suite green.
 *
 * The catalogue is the shipped English one, merged across the three namespaces the
 * dialog reads. Stubbing it would defeat the point twice over: an unresolved key
 * and an un-interpolated placeholder both look like a pass when every message is
 * its own key.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

/**
 * The real module reaches `cloudflare:workers` through the request scope and the
 * real `useRouter` needs a router above it — neither has meaning in jsdom. A
 * refused draft reaches neither, which is the second assertion below.
 */
const reservations = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('#/server/fns/reservations', () => ({
  createBookingFn: reservations.create,
  updateBookingFn: reservations.update,
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

function openDialog(): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <BookingDialog
        tripId="trip-1"
        days={[]}
        currency="EUR"
        open
        onOpenChange={() => {}}
      />
    </I18nProvider>,
  )
}

/**
 * Submitted as an event rather than by clicking "Add booking".
 *
 * The dialog's save button sits in the footer, outside the `<form>` it owns, and
 * reaches it through the `form` attribute — which is how a scrolling dialog body
 * keeps its actions pinned. jsdom implements the association but not the implicit
 * submission it enables, so clicking that button dispatches nothing and every
 * assertion after it would pass against a form that was never submitted. This
 * fires what the button would.
 */
function submitTheForm(): void {
  const form = document.querySelector('form')
  if (form === null) {
    throw new Error('the booking dialog rendered no form')
  }
  fireEvent.submit(form)
}

describe('BookingDialog', () => {
  it('names the missing field in words, not by its catalogue key', () => {
    openDialog()
    submitTheForm()

    expect(screen.getByText('This booking needs a date.')).not.toBeNull()
    // The two ways this sentence has been wrong: the key interpolated verbatim,
    // and the placeholder left standing when nothing is interpolated at all.
    expect(screen.queryByText(/modules\.book\./u)).toBeNull()
    expect(screen.queryByText(/\{field\}/u)).toBeNull()
  })

  it('does not submit a draft it has just refused', () => {
    openDialog()
    submitTheForm()

    expect(reservations.create).not.toHaveBeenCalled()
  })
})
