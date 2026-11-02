import '#/components/ui/__tests__/test-env'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import { requestCollectionExit } from '#/lib/collection-exit'
import {
  markWorkspaceStale,
  resetWorkspaceClaim,
  setWorkspaceClaim,
} from '#/lib/workspace-claim-store'
import { CollectionActions } from '../collection-actions'

const router = vi.hoisted(() => ({
  block: (_input: { next: { pathname: string } }): Promise<boolean> =>
    Promise.resolve(false),
}))
vi.mock('@tanstack/react-router', () => ({
  useBlocker: (options: { shouldBlockFn: typeof router.block }) => {
    router.block = options.shouldBlockFn
  },
}))
const collection = {
  id: 'one',
  name: 'Someday',
  description: null,
  colour: '#2F6F5E',
}
const messages = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
}
function mount(
  update = vi.fn().mockResolvedValue(undefined),
  onSaved = vi.fn().mockResolvedValue(undefined),
  remove = vi.fn().mockResolvedValue(undefined),
) {
  return render(
    <I18nProvider locale="en" messages={messages}>
      <CollectionActions
        canManage
        collection={collection}
        readCurrent={async () => collection}
        update={update}
        summary={async () => ({
          name: collection.name,
          places: 0,
          labels: 0,
          requiresName: false,
        })}
        remove={remove}
        onSaved={onSaved}
        onDeleted={vi.fn()}
      />
    </I18nProvider>,
  )
}
async function edit() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Actions for Someday' }))
  await user.click(screen.getByRole('menuitem', { name: 'Edit details' }))
  return user
}
function unload() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}
afterEach(() => {
  cleanup()
  resetWorkspaceClaim()
})
describe('collection edit exit protection', () => {
  it('protects actual differences, including a closed editor, and permits reverted values and Cancel', async () => {
    mount()
    const user = await edit()
    expect(unload()).toBe(false)
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.type(name, '!')
    expect(unload()).toBe(true)
    await user.clear(name)
    await user.type(name, collection.name)
    expect(unload()).toBe(false)
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Temporary',
    )
    await user.clear(screen.getByRole('textbox', { name: 'Description' }))
    expect(unload()).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Pine' }))
    expect(unload()).toBe(true)
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'A note',
    )
    expect(unload()).toBe(true)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(unload()).toBe(true)
    let leaving: Promise<boolean> = Promise.resolve(true)
    act(() => {
      leaving = requestCollectionExit()
    })
    const stay = screen.getByRole('button', { name: 'Stay' })
    expect(document.activeElement).toBe(stay)
    await user.keyboard('{Escape}')
    expect(await leaving).toBe(false)
    expect(unload()).toBe(true)
    await edit()
    expect(
      screen
        .getByRole('textbox', { name: 'Description' })
        .getAttribute('value') ??
        screen.getByRole('textbox', { name: 'Description' }).textContent,
    ).toBe('A note')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(unload()).toBe(false)
  })
  it('allows filters and forced authentication recovery, but asks before a different collection or session mutation', async () => {
    mount()
    const user = await edit()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    await user.keyboard('{Escape}')
    expect(await router.block({ next: { pathname: '/collections/one' } })).toBe(
      false,
    )
    expect(await router.block({ next: { pathname: '/login' } })).toBe(false)
    let blocked: Promise<boolean> = Promise.resolve(false)
    act(() => {
      blocked = router.block({ next: { pathname: '/collections/two' } })
    })
    await user.click(screen.getByRole('button', { name: 'Stay' }))
    expect(await blocked).toBe(true)
    const mutateSession = vi.fn()
    let transition: Promise<void> = Promise.resolve()
    act(() => {
      transition = requestCollectionExit().then((leave) => {
        if (leave) mutateSession()
      })
    })
    expect(mutateSession).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Discard and leave' }))
    await transition
    expect(mutateSession).toHaveBeenCalledOnce()
    expect(unload()).toBe(false)
    await edit()
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Name',
        }) as HTMLInputElement
      ).value,
    ).toBe('Someday')
  })
  it('refuses internal exits during a save, retains protection after failure, and clears it on success', async () => {
    let reject: (error: Error) => void = () => undefined
    const update = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_done, fail) => {
            reject = fail
          }),
      )
      .mockResolvedValue(undefined)
    mount(update)
    const user = await edit()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await requestCollectionExit()).toBe(false)
    expect(await router.block({ next: { pathname: '/dashboard' } })).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Saving' }))
    expect(update).toHaveBeenCalledOnce()
    await act(async () => {
      reject(new Error('lost response'))
    })
    expect(unload()).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(unload()).toBe(false)
  })
  it('clears inaccessible drafts and ignores a save response after unmount', async () => {
    setWorkspaceClaim('workspace')
    let done: () => void = () => undefined
    const update = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          done = resolve
        }),
    )
    const onSaved = vi.fn()
    mount(update, onSaved)
    const user = await edit()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    act(() => markWorkspaceStale('workspace'))
    expect(unload()).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => {
      done()
    })
    expect(onSaved).not.toHaveBeenCalled()
    act(() => setWorkspaceClaim('other'))
    await edit()
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Name',
        }) as HTMLInputElement
      ).value,
    ).toBe('Someday')
  })
  it('clears the navigation guard before a confirmed deletion navigates away', async () => {
    mount()
    const user = await edit()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    await user.keyboard('{Escape}')
    await user.click(
      screen.getByRole('button', { name: 'Actions for Someday' }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: /Delete collection/ }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Delete collection' }),
    )
    expect(unload()).toBe(false)
    expect(await requestCollectionExit()).toBe(true)
  })
  it('keeps the edit draft when deletion fails', async () => {
    mount(undefined, undefined, vi.fn().mockRejectedValue(new Error('refused')))
    const user = await edit()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    await user.keyboard('{Escape}')
    await user.click(
      screen.getByRole('button', { name: 'Actions for Someday' }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: /Delete collection/ }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Delete collection' }),
    )
    await screen.findByRole('alert')
    expect(unload()).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await edit()
    expect(
      (screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value,
    ).toBe('Someday!')
  })
  it('drops a draft and permits authentication recovery when its session expires', async () => {
    const view = mount()
    const user = await edit()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    expect(unload()).toBe(true)
    view.rerender(
      <I18nProvider locale="en" messages={messages}>
        <CollectionActions
          canManage
          collection={collection}
          readCurrent={async () => collection}
          update={vi.fn()}
          summary={vi.fn()}
          remove={vi.fn()}
          onSaved={vi.fn()}
          onDeleted={vi.fn()}
          expiresAt={new Date(Date.now() - 1000).toISOString()}
        />
      </I18nProvider>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(unload()).toBe(false)
    expect(await requestCollectionExit()).toBe(true)
    await edit()
    expect(
      (screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value,
    ).toBe('Someday')
  })
})
