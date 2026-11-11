import '#/components/ui/__tests__/test-env'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { encodePublicFailure } from '#/lib/errors'
import { TaxonomyEditor } from '../taxonomy-editor'

const api = vi.hoisted(() => ({
  createCategoryFn: vi.fn(),
  updateCategoryFn: vi.fn(),
  moveCategoryFn: vi.fn(),
  deleteCategoryFn: vi.fn(),
}))
vi.mock('#/server/fns/taxonomy', () => api)
const messages = await loadCatalogue('en')
const row = (id = 'c1', name = 'Museums') => ({
  id,
  name,
  colour: '#123456',
  icon: 'landmark',
  placeCount: 2,
})
const data = {
  categories: [row(), row('c2', 'Parks')],
  meter: { used: 4, limit: 256 },
}
const reload = vi.fn()
function mount(canManage = true, initial = data) {
  return render(
    <I18nProvider locale="en" messages={messages}>
      <TaxonomyEditor initial={initial} canManage={canManage} reload={reload} />
    </I18nProvider>,
  )
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  vi.resetAllMocks()
  reload.mockResolvedValue(data)
})
describe('category settings', () => {
  it('announces the category moved through the polite status', async () => {
    api.moveCategoryFn.mockResolvedValue(undefined)
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Move Museums down' }))
    await screen.findByText('Moved Museums.')
    expect(screen.getByText('Moved Museums.').getAttribute('aria-live')).toBe(
      'polite',
    )
  })

  it('shows intentional emptiness and keeps editing available at quota', async () => {
    const view = mount(true, { categories: [], meter: { used: 2, limit: 2 } })
    expect(
      screen.getByText('No categories yet. Places can stay uncategorized.'),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Add category' })
        .hasAttribute('disabled'),
    ).toBe(true)
    view.unmount()
    mount(true, { ...data, meter: { used: 4, limit: 4 } })
    expect(
      screen
        .getByRole('button', { name: 'Rename Museums' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })
  it('retains confirmed changes when the follow-up reload fails', async () => {
    api.updateCategoryFn.mockResolvedValue({
      ...row(),
      name: 'Art museums',
      colour: '#000000',
    })
    reload.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Rename Museums' }))
    await user.clear(screen.getAllByLabelText(/^Name/)[0])
    await user.type(screen.getAllByLabelText(/^Name/)[0], 'Art museums')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Art museums')
    await screen.findByText(
      'Could not confirm the saved state. Reload before trying again.',
    )
    expect(api.updateCategoryFn).toHaveBeenCalledTimes(1)
  })
  it('cancels deletion without writing and returns focus to the opener', async () => {
    const user = userEvent.setup()
    mount()
    const opener = screen.getByRole('button', { name: 'Delete Museums' })
    await user.click(opener)
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.deleteCategoryFn).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(opener)
  })
  it('rejects invisible names and invalid colors before calling the server', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByLabelText(/^Name/), '\u200b')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    expect(screen.getByLabelText(/^Name/).getAttribute('aria-invalid')).toBe(
      'true',
    )
    expect(api.createCategoryFn).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText(/^Name/))
    await user.type(screen.getByLabelText(/^Name/), 'Art')
    await user.clear(screen.getByLabelText('Colour'))
    await user.type(screen.getByLabelText('Colour'), 'bad')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    expect(screen.getByLabelText('Colour').getAttribute('aria-invalid')).toBe(
      'true',
    )
    expect(api.createCategoryFn).not.toHaveBeenCalled()
  })
  it('recognizes a lost create response after reconciliation instead of offering a duplicate', async () => {
    api.createCategoryFn.mockRejectedValue(new Error('lost response'))
    reload.mockResolvedValue({
      ...data,
      categories: [...data.categories, row('new', 'Gardens')],
    })
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByLabelText(/^Name/), 'Gardens')
    await user.clear(screen.getByLabelText('Colour'))
    await user.type(screen.getByLabelText('Colour'), '#123456')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    await screen.findByText('Gardens')
    await waitFor(() =>
      expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
        '',
      ),
    )
    expect(api.createCategoryFn).toHaveBeenCalledTimes(1)
  })
  it('recognizes a lost delete response when the category is already absent', async () => {
    api.deleteCategoryFn.mockRejectedValue(new Error('lost response'))
    reload.mockResolvedValue({ ...data, categories: [row('c2', 'Parks')] })
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Delete Museums' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.deleteCategoryFn).toHaveBeenCalledTimes(1)
  })
  it('removes revoked write controls with an explanation and preserves the draft', async () => {
    const user = userEvent.setup()
    const view = mount()
    await user.type(screen.getByLabelText(/^Name/), 'My category draft')
    view.rerender(
      <I18nProvider locale="en" messages={messages}>
        <TaxonomyEditor initial={data} canManage={false} reload={reload} />
      </I18nProvider>,
    )
    expect(
      screen.getByText(
        'Your workspace permission changed. You can still view categories.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull()
    expect(document.activeElement?.tagName).toBe('H2')
    view.rerender(
      <I18nProvider locale="en" messages={messages}>
        <TaxonomyEditor initial={data} canManage reload={reload} />
      </I18nProvider>,
    )
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
      'My category draft',
    )
  })
  it('lets members read counts without mutation controls', () => {
    mount(false)
    expect(screen.getByText('Museums')).toBeTruthy()
    expect(
      screen.getByText('Workspace owners and admins can manage categories.'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull()
  })
  it('validates names, creates and reads the resolved quota', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByLabelText(/^Name/), 'Gardens')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    await waitFor(() =>
      expect(api.createCategoryFn).toHaveBeenCalledWith({
        data: { name: 'Gardens', colour: '#3b82f6' },
      }),
    )
    expect(reload).toHaveBeenCalled()
    expect(
      screen.getByText('4 of 256 category and tag slots used'),
    ).toBeTruthy()
  })
  it('keeps edits and blocks blind create retries if reconciliation fails', async () => {
    api.createCategoryFn.mockRejectedValue(new Error('network'))
    reload.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByLabelText(/^Name/), 'Gardens')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    await screen.findByText(
      'Could not confirm the saved state. Reload before trying again.',
    )
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
      'Gardens',
    )
    expect(
      screen
        .getByRole('button', { name: 'Add category' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    expect(api.createCategoryFn).toHaveBeenCalledTimes(1)
  })
  it('confirms deletion, preserves advisory copy and restores useful focus', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Delete Museums' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(
        /Saved places using this category also become uncategorized/,
      ),
    ).toBeTruthy()
    reload.mockResolvedValue({ ...data, categories: [row('c2', 'Parks')] })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.deleteCategoryFn).toHaveBeenCalledWith({
      data: { categoryId: 'c1' },
    })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Rename Parks' }),
    )
  })
  it('keeps other rows usable while a row is pending and ignores unmounted completions', async () => {
    const request = deferred()
    api.moveCategoryFn.mockReturnValue(request.promise)
    const user = userEvent.setup()
    const view = mount()
    await user.click(screen.getByRole('button', { name: 'Move Museums down' }))
    expect(
      screen
        .getByRole('button', { name: 'Rename Parks' })
        .hasAttribute('disabled'),
    ).toBe(false)
    view.unmount()
    request.resolve()
    await Promise.resolve()
    expect(reload).not.toHaveBeenCalled()
  })
  it('keeps drafts after a refused rename and reconciles before retry', async () => {
    api.updateCategoryFn.mockRejectedValue(
      new Error(encodePublicFailure({ kind: 'refusal', message: 'Forbidden' })),
    )
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Rename Museums' }))
    const inputs = screen.getAllByLabelText(/^Name/)
    await user.clear(inputs[0])
    await user.type(inputs[0], 'Art museums')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(
      (screen.getAllByLabelText(/^Name/)[0] as HTMLInputElement).value,
    ).toBe('Art museums')
  })
})

describe('independent review reproductions', () => {
  it('preserves the active draft after repeated Rename and an independent row operation', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Rename Museums' }))
    await user.clear(screen.getAllByLabelText(/^Name/)[0])
    await user.type(screen.getAllByLabelText(/^Name/)[0], 'Unsaved draft')
    await user.click(screen.getByRole('button', { name: 'Rename Museums' }))
    api.moveCategoryFn.mockReturnValueOnce(new Promise(() => {}))
    await user.click(screen.getByRole('button', { name: 'Move Parks up' }))
    expect(
      (screen.getAllByLabelText(/^Name/)[0] as HTMLInputElement).value,
    ).toBe('Unsaved draft')
  })
  it('keeps uncertain create blocked when manual reload is superseded by another row write', async () => {
    const user = userEvent.setup()
    api.createCategoryFn.mockRejectedValue(new Error('lost response'))
    reload.mockRejectedValueOnce(new Error('offline'))
    mount()
    await user.type(screen.getByLabelText(/^Name/), 'Gardens')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    await screen.findByText(
      'Could not confirm the saved state. Reload before trying again.',
    )
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Add category' })
          .hasAttribute('disabled'),
      ).toBe(true),
    )
    let finishRead!: (value: typeof data) => void
    reload.mockReturnValueOnce(
      new Promise<typeof data>((resolve) => {
        finishRead = resolve
      }),
    )
    const move = deferred()
    api.moveCategoryFn.mockReturnValueOnce(move.promise)
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    await user.click(screen.getByRole('button', { name: 'Move Museums down' }))
    finishRead(data)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Reload' }).hasAttribute('disabled'),
      ).toBe(false),
    )
    expect(
      screen
        .getByRole('button', { name: 'Add category' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })
})
