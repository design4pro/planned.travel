import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import { WORKSPACE_CHANGED_KEY } from '#/lib/workspace-claim'
import { ErrorPanel } from '../error-state'

import type { Catalogue } from '#/lib/i18n'

const router = vi.hoisted(() => ({ invalidate: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => router,
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const EN: Catalogue = namespaceCatalogue('shell', Shell)

const assign = vi.fn()
const originalLocation = window.location

function mount(error: unknown) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign },
  })
  return render(
    <I18nProvider locale="en" messages={EN}>
      <ErrorPanel error={error} />
    </I18nProvider>,
  )
}

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  })
  assign.mockReset()
  router.invalidate.mockReset()
})

describe('ErrorPanel for a loader a stale tab was refused', () => {
  const refusal = new Error(
    encodePublicFailure({ kind: 'refusal', message: WORKSPACE_CHANGED_KEY }),
  )

  it("says the workspace changed, in the reader's language, with no reference or report line", () => {
    mount(refusal)

    expect(
      screen.getByRole('heading', {
        name: 'The workspace changed in another tab',
      }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'The workspace was changed in another tab or window. Nothing was saved.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/reported/i)).toBeNull()
  })

  it('offers the full reload instead of a Retry that would be refused again', async () => {
    const user = userEvent.setup()
    mount(refusal)

    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Open the current workspace' }),
    )

    expect(assign).toHaveBeenCalledWith('/dashboard')
    expect(router.invalidate).not.toHaveBeenCalled()
  })

  it('keeps Retry for every other failure', () => {
    mount(new Error('boom'))

    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Open the current workspace' }),
    ).toBeNull()
  })
})
