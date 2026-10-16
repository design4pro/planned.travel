import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import { CalendarPanel } from '../calendar-panel'

const moduleLoad = vi.hoisted(() => {
  let finish = () => {}
  const ready = new Promise<void>((resolve) => {
    finish = resolve
  })
  return { ready, finish }
})

vi.mock('../calendar-live', async () => {
  await moduleLoad.ready
  return {
    CalendarLive: () => <div role="dialog" aria-label="Live calendar" />,
  }
})
vi.mock('../calendar-download', () => ({ downloadTripCalendar: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))

it('keeps a focused, busy control while the live calendar module downloads', async () => {
  render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('modules', Modules),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <CalendarPanel tripId="trip-1" hasDates />
    </I18nProvider>,
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Live calendar link' }),
  )

  const pending = screen.getByRole('button', { name: 'Live calendar link' })
  expect(pending.getAttribute('aria-busy')).toBe('true')
  expect(pending.getAttribute('aria-disabled')).toBe('true')
  expect(document.activeElement).toBe(pending)
  expect(screen.queryByRole('dialog')).toBeNull()

  await act(async () => moduleLoad.finish())
  expect(
    await screen.findByRole('dialog', { name: 'Live calendar' }),
  ).toBeTruthy()
})
