// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import Ui from '#/lib/i18n/messages/en/ui'
import { MEDIA_SM_UP } from '#/lib/breakpoints'
import { NoteDialog } from '../note-dialog'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('ui', Ui),
}

const NOTE = {
  body: 'Ferry tickets',
  detail: '',
  time: '',
  icon: 'sticky-note',
} as const

function dialog() {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <NoteDialog
        open
        onOpenChange={() => {}}
        mode="create"
        initial={NOTE}
        saving={false}
        error={null}
        onSubmit={() => {}}
      />
    </I18nProvider>,
  )
}

/**
 * Which layout the note editor is written in.
 *
 * The claim under test is that the JS query and the CSS variant name the *same*
 * boundary. They are two halves of one decision — the query mounts either the
 * side-by-side layout or the tab strip, and `sm:grid-cols-2` is what actually puts
 * the write pane beside the preview — and the mutation this is aimed at is `640px`
 * for `sm`'s `40rem`, which is only correct at the default font size. Above it a
 * reader who has raised their browser's font-size preference got the two-pane
 * branch rendered into a grid that is still one column wide: the preview stacked
 * under a full-width textarea, and no tabs to escape it with.
 */
describe('the layout the note editor is written in', () => {
  /** jsdom has one viewport, so the boundary is told rather than resized into. */
  function answer(matches: boolean): Array<string> {
    const asked: Array<string> = []
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      asked.push(query)
      return {
        matches: query === MEDIA_SM_UP ? matches : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList
    })
    return asked
  }

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('asks about the same boundary the grid’s `sm:` variant uses', () => {
    const asked = answer(true)

    dialog()

    // That the constant is `rem` is `breakpoints.test.ts`'s subject. What only
    // this test can see is that the dialog asks about `sm` at all, rather than
    // about some other boundary that happens to be spelled in `rem` too.
    expect(asked).toEqual([MEDIA_SM_UP])
  })

  it('puts the preview behind a tab only below that boundary', () => {
    answer(false)
    dialog()
    expect(screen.getByRole('tab', { name: 'Write' })).toBeTruthy()

    cleanup()
    answer(true)
    dialog()
    expect(screen.queryByRole('tab', { name: 'Write' })).toBeNull()
  })
})
