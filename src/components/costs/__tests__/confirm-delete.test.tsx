// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Ui from '#/lib/i18n/messages/en/ui'
import { ConfirmDeleteDialog } from '../confirm-delete'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('ui', Ui),
}

afterEach(cleanup)

async function confirmFailing(cause: Error): Promise<void> {
  const user = userEvent.setup({ delay: null })
  render(
    <I18nProvider locale="en" messages={EN}>
      <ConfirmDeleteDialog
        open
        onOpenChange={() => {}}
        title="Dinner"
        amountMinor={6_000}
        currency="EUR"
        affects={[]}
        onConfirm={async () => {
          throw cause
        }}
      />
    </I18nProvider>,
  )
  await user.click(
    screen.getByRole('button', { name: Costs['delete.confirm'] }),
  )
}

describe('the delete confirmation when the delete fails', () => {
  it('says the catalogue line, never the failure envelope, for an unexpected failure', async () => {
    await confirmFailing(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'evt_1a2b3c' }),
      ),
    )

    expect(await screen.findByText(Costs['delete.failedBody'])).toBeTruthy()
    expect(screen.queryByText(/planned-travel\/failure/)).toBeNull()
  })
})
