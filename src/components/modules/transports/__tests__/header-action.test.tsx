// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render as mount, screen } from '@testing-library/react'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { NewListAction } from '../../lists/lists-board'
import { NewTransportAction } from '../leg-dialog'

// The real modules reach `cloudflare:workers`, which has no meaning in jsdom.
// Neither button calls a server function, so the mocks stay empty.
vi.mock('#/server/fns/lists', () => ({}))
vi.mock('#/server/fns/transports', () => ({}))

afterEach(cleanup)

const MESSAGES = await loadCatalogue('en')

function render(ui: React.ReactElement) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      {ui}
    </I18nProvider>,
  )
}

/**
 * Every page-header action is `size="sm" shape="pill"` (DESIGN.md, Buttons), so
 * the header keeps its height when the reader switches trip tabs. Transports
 * once fell through to the `md` default and made the header jump (#665).
 */
describe('page-header actions', () => {
  it.each([
    ['NewTransportAction', NewTransportAction],
    ['NewListAction', NewListAction],
  ] as const)('%s renders at the header-action size', (_, Action) => {
    render(<Action onClick={() => {}} />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('h-8')
    expect(button.className).toContain('rounded-full')
  })
})
