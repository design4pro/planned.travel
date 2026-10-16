import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import Modules from '#/lib/i18n/messages/en/modules'
import { toast } from '#/components/ui'
import { CollabSectionsMenu } from '../collab-sections-menu'

const messages = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('modules', Modules),
}
afterEach(cleanup)
function deferred() {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function setup(
  write = vi.fn().mockResolvedValue({ ok: true }),
  refresh = vi.fn().mockResolvedValue(undefined),
) {
  const sections = { conversation: true, notes: false, polls: false }
  const props = { sections, write, refresh, onWritingChange: vi.fn() }
  const view = render(
    <I18nProvider locale="en" messages={messages}>
      <CollabSectionsMenu {...props} />
    </I18nProvider>,
  )
  return { ...view, props, user: userEvent.setup() }
}
it('keeps the last enabled item keyboard reachable and explains it', async () => {
  const { user, props } = setup()
  await user.click(screen.getByRole('button', { name: /Choose sections/ }))
  const items = screen.getAllByRole('menuitemcheckbox')
  expect(items).toHaveLength(3)
  expect(items[0].getAttribute('aria-checked')).toBe('true')
  expect(items[0].getAttribute('aria-disabled')).toBe('true')
  expect(
    document.getElementById(items[0].getAttribute('aria-describedby') ?? '')
      ?.textContent,
  ).toBe('At least one section stays on.')
  await user.keyboard('{End}{ArrowDown}')
  expect(document.activeElement).toBe(items[0])
  await user.keyboard('{Enter}')
  expect(props.write).not.toHaveBeenCalled()
})
it('holds every item pending through the loader refresh without guessing the checked state', async () => {
  const writeDone = deferred()
  const refreshDone = deferred()
  const write = vi.fn(async () => {
    await writeDone.promise
    return { ok: true }
  })
  const refresh = vi.fn(() => refreshDone.promise)
  const { user, props, rerender } = setup(write, refresh)
  await user.click(screen.getByRole('button', { name: /Choose sections/ }))
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Notes' }))
  for (const item of screen.getAllByRole('menuitemcheckbox'))
    expect(item.getAttribute('aria-disabled')).toBe('true')
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Notes' })
      .getAttribute('aria-checked'),
  ).toBe('false')
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Notes' })
      .querySelector('svg.animate-spin'),
  ).toBeTruthy()
  writeDone.resolve()
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Polls' })
      .getAttribute('aria-disabled'),
  ).toBe('true')
  rerender(
    <I18nProvider locale="en" messages={messages}>
      <CollabSectionsMenu
        {...props}
        sections={{ ...props.sections, notes: true }}
      />
    </I18nProvider>,
  )
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Notes' })
      .getAttribute('aria-checked'),
  ).toBe('true')
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Notes' })
      .getAttribute('aria-disabled'),
  ).toBe('true')
  refreshDone.resolve()
  await waitFor(() =>
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Polls' })
        .getAttribute('aria-disabled'),
    ).toBe('false'),
  )
})
it.each(['data', 'throw'])(
  'shows a localised failure and rereads after a %s refusal',
  async (kind) => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const write = vi.fn(async () => {
      if (kind === 'throw') throw {}
      return { ok: false }
    })
    const { user, props } = setup(write)
    await user.click(screen.getByRole('button', { name: /Choose sections/ }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Notes' }))
    await waitFor(() => expect(props.refresh).toHaveBeenCalledOnce())
    expect(error).toHaveBeenCalledWith('That change did not save', {
      description: 'The menu shows what is saved now.',
    })
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Notes' })
        .getAttribute('aria-checked'),
    ).toBe('false')
  },
)
