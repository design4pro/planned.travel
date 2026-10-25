// The board mounts Radix-backed primitives, which need the pointer-capture and scroll stubs jsdom
// does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { TooltipProvider } from '#/components/ui'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { ListsBoard } from '../lists-board'

import type { Catalogue } from '#/lib/i18n'
import type { ListData, PersonOption } from '../types'

/**
 * What a reader who may not write is shown on the lists screen (#1091): the lists, their items and
 * their ticks, no control that would start a write, and the reason. An archived trip is the case an
 * owner meets too, so `archived` picks the reason and `canWrite` the controls.
 *
 * The shipped English catalogue, so an unresolved key reads as a failure and not as a pass.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

vi.mock('#/server/fns/lists', () => ({
  createListItemFn: vi.fn(),
  deleteListFn: vi.fn(),
  deleteListItemFn: vi.fn(),
  resetListFn: vi.fn(),
  reorderListItemsFn: vi.fn(),
  setListItemsDoneFn: vi.fn(),
  updateListItemFn: vi.fn(),
  createListFn: vi.fn(),
  updateListFn: vi.fn(),
  loadListTemplatesFn: vi.fn(),
  applyListTemplateFn: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))

const PEOPLE: ReadonlyArray<PersonOption> = [
  { userId: 'user-1', name: 'Ada', image: null },
]

const PACKING: ListData = {
  id: 'list-1',
  name: 'Beach bag',
  kind: 'packing',
  colour: null,
  ownerUserId: null,
  weightLimitGrams: null,
  items: [
    {
      id: 'item-1',
      name: 'Sunscreen',
      category: null,
      quantity: 1,
      weightGrams: null,
      isDone: false,
      assignedTo: 'user-1',
      priority: 'normal',
    },
  ],
}

function mount(
  lists: ReadonlyArray<ListData>,
  canWrite: boolean,
  archived = false,
): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <TooltipProvider>
        <ListsBoard
          tripId="trip-1"
          lists={lists}
          people={PEOPLE}
          viewerUserId="user-1"
          canWrite={canWrite}
          archived={archived}
          newListOpen={false}
          onNewListOpenChange={() => {}}
        />
      </TooltipProvider>
    </I18nProvider>,
  )
}

afterEach(cleanup)

describe('ListsBoard', () => {
  it('draws every write control and no reason for a reader who may write', () => {
    mount([PACKING], true)

    expect(
      screen.getByRole('button', { name: 'Actions for Beach bag' }),
    ).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Actions for Sunscreen' }),
    ).not.toBeNull()
    expect(
      screen.getByRole('button', { name: /Assign Sunscreen|reassign it/u }),
    ).not.toBeNull()
    expect(screen.getByLabelText('Add an item to this list')).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'From a template' }),
    ).not.toBeNull()
    expect(screen.queryByText(/Only the trip’s owner and editors/u)).toBeNull()
  })

  it('draws the lists and their ticks, and no control that starts a write, for a reader who may not', () => {
    mount([PACKING], false)

    expect(screen.getByText('Beach bag')).not.toBeNull()
    expect(screen.getByText('Sunscreen')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Actions for/u })).toBeNull()
    expect(screen.queryByRole('button', { name: /reassign it/u })).toBeNull()
    expect(screen.queryByRole('button', { name: /Reorder/u })).toBeNull()
    expect(screen.queryByLabelText('Add an item to this list')).toBeNull()
    expect(screen.queryByRole('button', { name: 'From a template' })).toBeNull()
    expect(
      screen
        .getByRole('checkbox', { name: 'Tick off Sunscreen' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  it('says why, for a viewer, and offers no way to start a list on an empty board', () => {
    mount([], false)

    expect(
      screen.getByText(
        'You can read these lists. Only the trip’s owner and editors can change them.',
      ),
    ).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'New list' })).toBeNull()
  })

  it('does not point a reader of an empty list at a composer they are not given', () => {
    mount([{ ...PACKING, items: [] }], false)

    expect(screen.getByText('This list is empty')).not.toBeNull()
    expect(screen.queryByText(/the field below/u)).toBeNull()
  })

  it('points a writer of an empty list at the composer', () => {
    mount([{ ...PACKING, items: [] }], true)

    expect(screen.getByText(/the field below/u)).not.toBeNull()
  })

  it('says the trip is archived, whoever the reader is', () => {
    mount([PACKING], false, true)

    expect(
      screen.getByText(
        'This trip is archived, so its lists are read-only. Restore the trip to change them.',
      ),
    ).not.toBeNull()
    expect(screen.queryByText(/Only the trip’s owner and editors/u)).toBeNull()
  })
})
