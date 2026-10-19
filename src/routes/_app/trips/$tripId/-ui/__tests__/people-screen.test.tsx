// The dialogs mount Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import Ui from '#/lib/i18n/messages/en/ui'
import { GuestNameDialog, GuestRow, MergeGuestDialog } from '../people-screen'

import type { ReactNode } from 'react'
import type { Catalogue } from '#/lib/i18n'

// The screen's module imports the server functions, which reach `cloudflare:workers`; the pieces
// under test call none of them.
vi.mock('../../-server/people', () => ({}))
vi.mock('../../-server/invite', () => ({}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => {},
  useRouter: () => ({}),
}))

const EN: Catalogue = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('ui', Ui),
}

const ANNA = {
  kind: 'guest',
  guestId: 'guest-anna',
  displayName: 'Anna',
  colour: null,
} as const

const MAREK = {
  kind: 'member',
  memberId: 'member-marek',
  userId: 'user-marek',
  role: 'editor',
  colour: null,
  name: 'Marek',
  image: null,
} as const

function inEnglish(children: ReactNode) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      {children}
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('a guest row', () => {
  function row(canManage: boolean) {
    return inEnglish(
      <ul>
        <GuestRow
          guest={ANNA}
          index={0}
          canManage={canManage}
          busy={null}
          onRename={() => {}}
          onMerge={() => {}}
          onRemove={() => {}}
        />
      </ul>,
    )
  }

  it('names the guest and marks them as a guest', () => {
    row(false)

    // The avatar names the guest too, so the claim is about the row rather than one text node.
    const item = screen.getByRole('listitem')
    expect(item.textContent).toContain('Anna')
    expect(item.textContent).toContain('Guest')
  })

  it('offers an owner three controls, each labelled with the guest’s name', () => {
    row(true)

    expect(screen.getByRole('button', { name: 'Rename Anna' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Anna is now…' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Remove Anna from this trip' }),
    ).toBeTruthy()
  })

  it('offers anybody else no control at all', () => {
    row(false)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})

describe('the rename dialog', () => {
  it('shows a refusal on the field and submits the edited name', () => {
    const onConfirm = vi.fn()
    inEnglish(
      <GuestNameDialog
        guest={ANNA}
        onOpenChange={() => {}}
        busy={false}
        refusal="There is already a guest called Marek on this trip"
        failure={null}
        onEdit={() => {}}
        onConfirm={onConfirm}
      />,
    )

    const field = screen.getByLabelText('Their name')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(
      screen.getByText('There is already a guest called Marek on this trip'),
    ).toBeTruthy()

    fireEvent.change(field, { target: { value: 'Ania' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    expect(onConfirm).toHaveBeenCalledWith('Ania')
  })

  it('disarms the submit on a blank name', () => {
    inEnglish(
      <GuestNameDialog
        guest={ANNA}
        onOpenChange={() => {}}
        busy={false}
        refusal={undefined}
        failure={null}
        onEdit={() => {}}
        onConfirm={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('Their name'), {
      target: { value: '   ' },
    })

    expect(
      screen.getByRole('button', { name: 'Rename' }).hasAttribute('disabled'),
    ).toBe(true)
  })
})

describe('the merge dialog', () => {
  it('keeps the irreversible confirm disarmed until somebody is chosen', () => {
    const onConfirm = vi.fn()
    inEnglish(
      <MergeGuestDialog
        guest={ANNA}
        members={[MAREK]}
        onOpenChange={() => {}}
        busy={false}
        failure={null}
        onConfirm={onConfirm}
        onCloseAutoFocus={() => {}}
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: 'Anna is now one of the people on this trip',
      }),
    ).toBeTruthy()
    const merge = screen.getByRole('button', { name: 'Merge' })
    expect(merge.hasAttribute('disabled')).toBe(true)

    fireEvent.click(merge)

    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('the merge dialog, once somebody is chosen', () => {
  it('names who inherits, and arms the confirm for them', async () => {
    const onConfirm = vi.fn()
    inEnglish(
      <MergeGuestDialog
        guest={ANNA}
        members={[MAREK]}
        onOpenChange={() => {}}
        busy={false}
        failure={null}
        onConfirm={onConfirm}
        onCloseAutoFocus={() => {}}
      />,
    )

    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'Choose somebody on this trip' }),
    )
    await user.click(await screen.findByRole('option', { name: /Marek/ }))

    expect(
      screen.getByText('Marek inherits everything assigned to Anna.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
    expect(onConfirm).toHaveBeenCalledWith('member-marek')
  })
})
