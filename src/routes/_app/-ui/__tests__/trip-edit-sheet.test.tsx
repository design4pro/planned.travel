// The sheet mounts Radix-backed primitives, which need the pointer-capture and scroll stubs jsdom
// does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Pl from '#/lib/i18n/messages/pl/shell'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { TripEditSheet } from '../trip-actions'
import { tripCard } from './fixtures'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}
const PL: Catalogue = {
  ...namespaceCatalogue('shell', Pl),
  ...namespaceCatalogue('ui', Ui),
}

const server = vi.hoisted(() => ({ update: vi.fn() }))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('../../-server/trip-lifecycle', () => ({
  archiveTripFn: vi.fn(),
  copyTripFn: vi.fn(),
  deleteTripFn: vi.fn(),
  restoreTripFn: vi.fn(),
  setTripFavouriteFn: vi.fn(),
  tripDeleteSummaryFn: vi.fn(),
  updateTripFn: server.update,
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

afterEach(() => {
  cleanup()
  server.update.mockReset()
})

/** What a server function's refusal looks like once it has crossed the redaction middleware. */
function refusedWith(key: string): Error {
  return new Error(encodePublicFailure({ kind: 'refusal', message: key }))
}

async function save(locale: 'en' | 'pl', messages: Catalogue) {
  const user = userEvent.setup()
  render(
    <I18nProvider locale={locale} messages={messages}>
      <TripEditSheet
        trip={tripCard({ currency: 'EUR' })}
        open
        onOpenChange={vi.fn()}
      />
    </I18nProvider>,
  )
  await user.click(
    screen.getByRole('button', {
      name: locale === 'en' ? 'Save changes' : Pl['editTrip.submit'],
    }),
  )
}

describe('the trip edit sheet when the budget currency cannot change', () => {
  it('shows the refusal in the reader’s language, naming the currency the trip still has', async () => {
    server.update.mockRejectedValue(
      refusedWith('shell.editTrip.currencyLocked'),
    )

    await save('en', EN)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(
      'This trip already has prices in it, so its budget currency can’t be changed here. Set it back to EUR to save your other changes.',
    )
    expect(alert.textContent).not.toContain('shell.editTrip')
    expect(alert.textContent).not.toContain('{current}')
  })

  it('reads the same refusal in Polish on a Polish screen', async () => {
    server.update.mockRejectedValue(
      refusedWith('shell.editTrip.currencyLocked'),
    )

    await save('pl', PL)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Ten wyjazd ma już ceny')
    expect(alert.textContent).toContain('Ustaw z powrotem EUR')
  })

  it('keeps the sheet open and the trip unchanged on screen', async () => {
    server.update.mockRejectedValue(
      refusedWith('shell.editTrip.currencyLocked'),
    )

    await save('en', EN)

    await screen.findByRole('alert')
    expect(router.invalidate).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  it('falls back to the generic message for any other failure', async () => {
    // What the redaction middleware sends for a diagnostic: no text, only a reference.
    server.update.mockRejectedValue(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'ref-1' }),
      ),
    )

    await save('en', EN)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(Shell['editTrip.error'])
    expect(alert.textContent).not.toContain('shell.editTrip')
  })
})
