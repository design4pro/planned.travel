import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { NoteDialog } from '../../collab/note-dialog'
import { PollDialog } from '../../collab/poll-dialog'
import { ListDialog, ItemDialog } from '../../lists/list-dialogs'
import { FileDetailsDialog } from '../../files/file-dialogs'

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))
vi.mock('#/server/fns/collab-notes', () => ({
  createNoteFn: vi.fn(),
  updateNoteFn: vi.fn(),
}))
vi.mock('#/server/fns/collab-polls', () => ({ createPollFn: vi.fn() }))
vi.mock('#/server/fns/lists', () => ({
  createListFn: vi.fn(),
  updateListFn: vi.fn(),
  createListItemFn: vi.fn(),
  updateListItemFn: vi.fn(),
  applyListTemplateFn: vi.fn(),
  loadListTemplatesFn: vi.fn(),
}))
vi.mock('#/server/fns/files', () => ({ updateTripFileFn: vi.fn() }))

const messages = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}
const common = { tripId: 'trip', open: true, onOpenChange: vi.fn() }
const cases = [
  ['note title', <NoteDialog {...common} categories={[]} canWrite />, /Title/],
  ['list name', <ListDialog {...common} people={[]} />, /Name/],
  [
    'item name',
    <ItemDialog {...common} listId="list" people={[]} categories={[]} />,
    /Item/,
  ],
  ['poll question', <PollDialog {...common} canWrite />, /Question/],
  ['poll option', <PollDialog {...common} canWrite />, /Option 1/],
  [
    'filename',
    <FileDetailsDialog
      {...common}
      file={{
        id: 'file',
        filename: 'Ticket.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10,
        kind: 'ticket',
        description: null,
        uploadedBy: 'user',
        createdAt: '2026-01-01T00:00:00Z',
      }}
    />,
    /Name/,
  ],
] as const

afterEach(cleanup)

it.each(cases)(
  'explains an invisible-only %s beside its field',
  async (_name, form, label) => {
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en" messages={messages}>
        {form}
      </I18nProvider>,
    )
    const field = screen.getByLabelText(label)
    await user.clear(field)
    await user.type(field, '\u200B')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    const describedBy = field.getAttribute('aria-describedby')?.split(' ') ?? []
    const description = describedBy
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ')
    expect(description).toMatch(/visible character|name/i)
    if (!_name.startsWith('poll')) {
      expect(
        document
          .querySelector('button[type="submit"]')
          ?.getAttribute('disabled'),
      ).not.toBeNull()
    }
  },
)
