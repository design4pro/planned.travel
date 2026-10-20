import '#/components/ui/__tests__/test-env'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import { CollectionActions } from '../collection-actions'
import { CollectionEditDialog } from '../collection-edit-dialog'
import { CollectionDeleteDialog } from '../collection-delete-dialog'
import { StatusPicker } from '../status-picker'
import { SwatchPicker } from '#/components/modules/shared/swatch-picker'
import { REQUIRED_SWATCHES } from '#/lib/swatches'
import type { ReactNode } from 'react'

const messages = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
}
function mount(children: ReactNode) {
  return render(
    <I18nProvider locale="en" messages={messages}>
      {children}
    </I18nProvider>,
  )
}
const collection = {
  id: 'collection',
  name: 'Someday',
  description: null,
  colour: '#2F6F5E',
}
afterEach(cleanup)
describe('collection controls', () => {
  it('hides management from a plain member', () => {
    mount(
      <CollectionActions
        readCurrent={async () => collection}
        canManage={false}
        collection={collection}
        update={vi.fn()}
        remove={vi.fn()}
        summary={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('keeps an off-palette colour as a pressed current choice without writing', async () => {
    const onChange = vi.fn()
    mount(
      <SwatchPicker
        value={collection.colour}
        onChange={onChange}
        legend="Colour"
        swatches={REQUIRED_SWATCHES}
      />,
    )
    expect(
      screen
        .getByRole('button', { name: 'Current colour' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(onChange).not.toHaveBeenCalled()
  })
  it('validates the name before sending, focuses the field, and preserves values on a save refusal', async () => {
    const user = userEvent.setup()
    const update = vi.fn().mockRejectedValue(new Error('write refused'))
    mount(
      <CollectionEditDialog
        readCurrent={async () => collection}
        collection={collection}
        update={update}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        returnFocus={vi.fn()}
      />,
    )
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(update).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(name)
    expect(name.getAttribute('aria-invalid')).toBe('true')
    await user.type(name, 'Later')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('alert')
    expect((name as HTMLInputElement).value).toBe('Later')
    expect(update).toHaveBeenCalledWith({
      collectionId: 'collection',
      name: 'Later',
      description: '',
      colour: '#2F6F5E',
    })
  })
  it('does not write status on arrow keys; a refusal keeps the old value and offers retry in the card', async () => {
    const user = userEvent.setup()
    const setStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ status: 'visited' })
    const onSaved = vi.fn()
    mount(
      <StatusPicker
        readCurrent={async () => 'idea'}
        place={{ id: 'cafe', name: 'Cafe', status: 'idea' }}
        setStatus={setStatus}
        onSaved={onSaved}
      />,
    )
    const trigger = screen.getByRole('button', {
      name: 'Cafe: status Idea. Change status',
    })
    trigger.focus()
    await user.keyboard(' ')
    await screen.findByRole('menu')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(setStatus).not.toHaveBeenCalled()
    await user.click(screen.getByRole('menuitemradio', { name: 'Visited' }))
    await screen.findByRole('alert')
    expect(trigger.textContent).toBe('Idea')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('visited'))
  })
  it('re-reads the summary after a delete refusal and asks for the current name', async () => {
    const user = userEvent.setup()
    const summary = vi
      .fn()
      .mockResolvedValueOnce({
        name: 'Someday',
        places: 0,
        labels: 0,
        requiresName: false,
      })
      .mockResolvedValue({
        name: 'Someday',
        places: 1,
        labels: 0,
        requiresName: true,
      })
    const remove = vi.fn().mockRejectedValue(new Error('name needed'))
    mount(
      <CollectionDeleteDialog
        collection={collection}
        summary={summary}
        remove={remove}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        returnFocus={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Delete collection' }))
    const name = await screen.findByRole('textbox', { name: 'Collection name' })
    expect(document.activeElement).toBe(name)
    expect(
      (
        screen.getByRole('button', {
          name: 'Delete collection',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    await user.type(name, 'Someday')
    expect(
      (
        screen.getByRole('button', {
          name: 'Delete collection',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false)
    expect(summary).toHaveBeenCalledTimes(2)
  })
  it('keeps focus and the previous status while a write is pending and ignores a second activation', async () => {
    const user = userEvent.setup()
    let finish: (() => void) | undefined
    const setStatus = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    mount(
      <StatusPicker
        readCurrent={async () => 'idea'}
        place={{ id: 'cafe', name: 'Cafe', status: 'idea' }}
        setStatus={setStatus}
        onSaved={vi.fn()}
      />,
    )
    const trigger = screen.getByRole('button', { name: /Cafe: status Idea/ })
    await user.click(trigger)
    await user.click(screen.getByRole('menuitemradio', { name: 'Visited' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(trigger.getAttribute('aria-busy')).toBe('true')
    expect(trigger.textContent).toBe('Idea')
    await user.click(trigger)
    expect(setStatus).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    finish?.()
    await waitFor(() => expect(trigger.getAttribute('aria-busy')).toBe('false'))
  })
  it('reconciles a lost delete response against the collection list before leaving', async () => {
    const user = userEvent.setup()
    const summary = vi
      .fn()
      .mockResolvedValueOnce({
        name: 'Someday',
        places: 0,
        labels: 0,
        requiresName: false,
      })
      .mockRejectedValue(new Error('missing'))
    const onDeleted = vi.fn()
    mount(
      <CollectionDeleteDialog
        collection={collection}
        summary={summary}
        remove={vi.fn().mockRejectedValue(new Error('lost response'))}
        exists={async () => false}
        onClose={vi.fn()}
        onDeleted={onDeleted}
        returnFocus={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Delete collection' }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
  })
  it.each(['{Enter}', ' '])('commits a chosen status with %s', async (key) => {
    const user = userEvent.setup()
    const setStatus = vi.fn().mockResolvedValue(undefined)
    mount(
      <StatusPicker
        readCurrent={async () => 'idea'}
        place={{ id: 'cafe', name: 'Cafe', status: 'idea' }}
        setStatus={setStatus}
        onSaved={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Cafe: status Idea/ }))
    screen.getByRole('menuitemradio', { name: 'Visited' }).focus()
    await user.keyboard(key)
    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith({
        collectionPlaceId: 'cafe',
        status: 'visited',
      }),
    )
  })
  it('refuses a name longer than 200 characters before sending', async () => {
    const user = userEvent.setup()
    const update = vi.fn()
    mount(
      <CollectionEditDialog
        readCurrent={async () => collection}
        collection={collection}
        update={update}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        returnFocus={vi.fn()}
      />,
    )
    const name = screen.getByRole('textbox', { name: 'Name' })
    fireEvent.change(name, { target: { value: 'a'.repeat(201) } })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(update).not.toHaveBeenCalled()
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(name)
    expect(
      screen.getByText('A collection name can have at most 200 characters.'),
    ).toBeTruthy()
  })
  it.each(['response', 'refresh'] as const)(
    'reconciles a committed status after a lost %s without resending it',
    async (failure) => {
      const user = userEvent.setup()
      const setStatus =
        failure === 'response'
          ? vi.fn().mockRejectedValue(new Error('lost response'))
          : vi.fn().mockResolvedValue(undefined)
      const onSaved =
        failure === 'refresh'
          ? vi
              .fn()
              .mockRejectedValueOnce(new Error('refresh failed'))
              .mockResolvedValue(undefined)
          : vi.fn().mockResolvedValue(undefined)
      const readCurrent = vi.fn().mockResolvedValue('visited')
      mount(
        <StatusPicker
          place={{ id: 'cafe', name: 'Cafe', status: 'idea' }}
          setStatus={setStatus}
          onSaved={onSaved}
          readCurrent={readCurrent}
        />,
      )
      await user.click(
        screen.getByRole('button', { name: /Cafe: status Idea/ }),
      )
      await user.click(screen.getByRole('menuitemradio', { name: 'Visited' }))
      await screen.findByRole('alert')
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
      expect(setStatus).toHaveBeenCalledTimes(1)
      expect(onSaved).toHaveBeenLastCalledWith('visited')
    },
  )
  it('retains the edit draft after Escape and reopening', async () => {
    const user = userEvent.setup()
    mount(
      <CollectionActions
        canManage
        collection={collection}
        update={vi.fn()}
        remove={vi.fn()}
        summary={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
        readCurrent={async () => collection}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Actions for/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit details' }))
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'My retained draft')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: /Actions for/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit details' }))
    expect(
      (screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value,
    ).toBe('My retained draft')
  })
  it.each(['response', 'refresh'] as const)(
    'reconciles a committed edit after a lost %s without resending it',
    async (failure) => {
      const user = userEvent.setup()
      const update =
        failure === 'response'
          ? vi.fn().mockRejectedValue(new Error('lost response'))
          : vi.fn().mockResolvedValue(undefined)
      const onSaved =
        failure === 'refresh'
          ? vi
              .fn()
              .mockRejectedValueOnce(new Error('refresh failed'))
              .mockResolvedValue(undefined)
          : vi.fn().mockResolvedValue(undefined)
      const onClose = vi.fn()
      const readCurrent = vi
        .fn()
        .mockRejectedValueOnce(new Error('read unavailable'))
        .mockResolvedValue({ ...collection, name: 'Later' })
      mount(
        <CollectionEditDialog
          collection={collection}
          update={update}
          onSaved={onSaved}
          readCurrent={readCurrent}
          onClose={onClose}
          returnFocus={vi.fn()}
        />,
      )
      const name = screen.getByRole('textbox', { name: 'Name' })
      await user.clear(name)
      await user.type(name, 'Later')
      await user.click(screen.getByRole('button', { name: 'Save changes' }))
      await screen.findByRole('alert')
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      await waitFor(() => expect(readCurrent).toHaveBeenCalledTimes(1))
      expect(update).toHaveBeenCalledTimes(1)
      expect(onClose).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
      expect(update).toHaveBeenCalledTimes(1)
      expect((name as HTMLInputElement).value).toBe('Later')
    },
  )
})
