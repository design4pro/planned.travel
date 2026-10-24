// The notice mounts a Radix dialog, which needs the pointer-capture and scroll stubs jsdom lacks.
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import {
  markWorkspaceStale,
  resetWorkspaceClaim,
  setWorkspaceClaim,
  workspaceClaimState,
} from '#/lib/workspace-claim-store'
import { WorkspaceChangedNotice } from '../workspace-changed-notice'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

const assign = vi.fn()
const originalLocation = window.location

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign },
  })
})
afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  })
  assign.mockReset()
  resetWorkspaceClaim()
})

function mount(name: string | null = 'Alpha Travel') {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <button type="button">Save trip</button>
      <WorkspaceChangedNotice organizationName={name} />
    </I18nProvider>,
  )
}

/** What a screen reader reads as the description of `element`, following `aria-describedby`. */
function descriptionOf(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim()
}

/** A refused call, as the middleware records it. */
function refuse(): void {
  act(() => {
    setWorkspaceClaim('org_a')
    markWorkspaceStale('org_a')
  })
}

describe('WorkspaceChangedNotice', () => {
  it('renders nothing while the tab is current', () => {
    mount()

    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('is a labelled alert dialog that names the workspace the tab is showing', async () => {
    mount()
    refuse()

    const dialog = await screen.findByRole('alertdialog', {
      name: 'The workspace changed in another tab',
    })
    expect(descriptionOf(dialog)).toMatch(
      /This tab is showing .*Alpha Travel.*, but the workspace was changed in another tab or window\. Nothing was saved\./,
    )
    // Neutral, and says nothing about the reader having done it.
    expect(dialog.textContent).not.toMatch(/you switched/i)
  })

  it('isolates the name and lets the sentence pick its own direction', async () => {
    mount('مساحة ألفا')
    refuse()

    const description = await screen.findByText(/Nothing was saved/)
    expect(description.getAttribute('dir')).toBe('auto')
    expect(description.textContent).toContain('\u2068مساحة ألفا\u2069')
  })

  it('falls back to the sentence without a name when the shell has none', async () => {
    mount(null)
    refuse()

    expect(
      await screen.findByText(
        'The workspace was changed in another tab or window. Nothing was saved.',
      ),
    ).toBeTruthy()
  })

  it('puts focus on "Not now", so a reflexive Enter does not reload the page under a form', async () => {
    mount()
    refuse()

    const dismiss = await screen.findByRole('button', { name: 'Not now' })
    expect(document.activeElement).toBe(dismiss)
  })

  it('reloads into the dashboard from the primary action and shows it working', async () => {
    const user = userEvent.setup()
    mount()
    refuse()

    await user.click(
      await screen.findByRole('button', { name: 'Open the current workspace' }),
    )

    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith('/dashboard')
    // Loading announces "Working" and takes the press away; "Not now" is disabled outright.
    const dialog = screen.getByRole('alertdialog')
    const buttons = Array.from(dialog.querySelectorAll('button'))
    expect(
      buttons.every(
        (button) => button.getAttribute('aria-disabled') === 'true',
      ),
    ).toBe(true)
  })

  it('closes on "Not now" without reloading, and keeps the tab stale', async () => {
    const user = userEvent.setup()
    mount()
    refuse()

    await user.click(await screen.findByRole('button', { name: 'Not now' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(assign).not.toHaveBeenCalled()
    expect(workspaceClaimState().stale).toBe(true)
  })

  it('treats Escape as "Not now"', async () => {
    mount()
    refuse()
    const dialog = await screen.findByRole('alertdialog')

    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(assign).not.toHaveBeenCalled()
  })

  it('is not dismissed by a click outside it', async () => {
    mount()
    refuse()
    await screen.findByRole('alertdialog')

    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)

    expect(screen.queryByRole('alertdialog')).not.toBeNull()
  })

  it('returns focus to the control that made the call when it closes', async () => {
    const user = userEvent.setup()
    mount()
    const save = screen.getByRole('button', { name: 'Save trip' })
    save.focus()
    refuse()

    await user.click(await screen.findByRole('button', { name: 'Not now' }))

    expect(document.activeElement).toBe(save)
  })

  it('ignores Escape once the reload has started', async () => {
    const user = userEvent.setup()
    mount()
    refuse()
    await user.click(
      await screen.findByRole('button', { name: 'Open the current workspace' }),
    )
    const dialog = screen.getByRole('alertdialog')

    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.queryByRole('alertdialog')).not.toBeNull()
  })

  it('puts focus on the main landmark when the control that made the call is gone', async () => {
    const user = userEvent.setup()
    const view = render(
      <I18nProvider locale="en" messages={EN}>
        <main>
          <button type="button">Save trip</button>
        </main>
        <WorkspaceChangedNotice organizationName="Alpha Travel" />
      </I18nProvider>,
    )
    const save = screen.getByRole('button', { name: 'Save trip' })
    save.focus()
    refuse()
    await screen.findByRole('alertdialog')
    save.remove()

    await user.click(screen.getByRole('button', { name: 'Not now' }))

    expect(document.activeElement).toBe(
      view.container.ownerDocument.querySelector('main'),
    )
  })

  describe('with text the reader has not sent', () => {
    function typeUnsent(): HTMLTextAreaElement {
      const field = document.createElement('textarea')
      field.value = 'See you at the station at 9'
      document.body.appendChild(field)
      return field
    }

    afterEach(() => {
      document.body.querySelectorAll('textarea').forEach((f) => f.remove())
    })

    it('asks before it reloads and keeps the text', async () => {
      const field = typeUnsent()
      mount()
      refuse()
      await screen.findByRole('alertdialog')

      fireEvent.click(
        screen.getByRole('button', { name: 'Open the current workspace' }),
      )

      expect(assign).not.toHaveBeenCalled()
      expect(descriptionOf(screen.getByRole('alertdialog'))).toContain(
        Modules['presence.workspaceChanged.discard'],
      )
      expect(field.value).toBe('See you at the station at 9')
    })

    it('reloads on the explicit second press', async () => {
      typeUnsent()
      mount()
      refuse()
      await screen.findByRole('alertdialog')
      fireEvent.click(
        screen.getByRole('button', { name: 'Open the current workspace' }),
      )

      fireEvent.click(
        screen.getByRole('button', {
          name: Modules['presence.workspaceChanged.confirm'],
        }),
      )

      expect(assign).toHaveBeenCalledWith('/dashboard')
    })

    it('"Not now" backs out of the question without reloading, and it asks afresh next time', async () => {
      typeUnsent()
      mount()
      refuse()
      await screen.findByRole('alertdialog')
      fireEvent.click(
        screen.getByRole('button', { name: 'Open the current workspace' }),
      )

      fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

      expect(assign).not.toHaveBeenCalled()
      refuse()
      await screen.findByRole('alertdialog')
      expect(
        screen.getByRole('button', { name: 'Open the current workspace' }),
      ).toBeTruthy()
    })
  })
})
