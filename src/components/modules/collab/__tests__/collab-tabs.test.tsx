import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import Modules from '#/lib/i18n/messages/en/modules'
import { TabsContent } from '#/components/ui'
import type { CollabSectionId } from '#/lib/collab-sections'
import { CollabTabs } from '../collab-tabs'
import { CollabSkeletons } from '../collab-skeletons'

afterEach(cleanup)
const messages = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('modules', Modules),
}
function tree(visible: CollabSectionId[]) {
  return (
    <I18nProvider locale="en" messages={messages}>
      <CollabTabs visible={visible}>
        {visible.map((id) => (
          <TabsContent key={id} value={id} forceMount tabIndex={-1}>
            {id} panel
          </TabsContent>
        ))}
      </CollabTabs>
    </I18nProvider>
  )
}
it('uses registry order, roving selection, mounted panels and repairs a removed selection', async () => {
  const user = userEvent.setup()
  const view = render(tree(['polls', 'conversation', 'notes']))
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'Conversation',
    'Notes',
    'Polls',
  ])
  const first = screen.getAllByRole('tab')[0]
  first.focus()
  await user.keyboard('{ArrowRight}')
  expect(
    screen.getByRole('tab', { name: 'Notes' }).getAttribute('aria-selected'),
  ).toBe('true')
  expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3)
  for (const panel of screen.getAllByRole('tabpanel', { hidden: true }))
    expect(panel.tabIndex).toBe(-1)
  view.rerender(tree(['conversation', 'polls']))
  expect(
    screen
      .getByRole('tab', { name: 'Conversation' })
      .getAttribute('aria-selected'),
  ).toBe('true')
  expect(screen.queryByRole('tab', { name: 'Notes' })).toBeNull()
})
it('keeps the selected section while it remains visible for a draft', async () => {
  const user = userEvent.setup()
  const view = render(tree(['conversation', 'notes']))
  await user.click(screen.getByRole('tab', { name: 'Notes' }))
  view.rerender(tree(['conversation', 'notes']))
  expect(
    screen.getByRole('tab', { name: 'Notes' }).getAttribute('aria-selected'),
  ).toBe('true')
})

it('keeps all three pending section shapes mounted under the same tabs', () => {
  const { container } = render(
    <I18nProvider locale="en" messages={messages}>
      <CollabSkeletons />
    </I18nProvider>,
  )
  expect(screen.getAllByRole('tab')).toHaveLength(3)
  expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3)
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
})
