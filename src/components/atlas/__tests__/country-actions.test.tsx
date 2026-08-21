// @vitest-environment jsdom
// The block mounts a Radix dialog for its destructive confirmation, which needs
// the pointer-capture and scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { toast } from '#/components/ui'
import { CountryActions } from '../country-actions'

import type { CountryActionsProps } from '../country-actions'

/**
 * The four writes and the router, stood in for.
 *
 * `#/server/fns/atlas` reaches the request scope through `cloudflare:workers`,
 * which does not resolve in jsdom, and `useAction` needs a router above it. Both
 * are replaced wholesale so the subject of this file is what the block does with
 * the four promises: what it paints while one is in flight, what it puts back
 * when one rejects, and what it sends when the reader presses a key.
 */
const atlas = vi.hoisted(() => ({
  mark: vi.fn(),
  unmark: vi.fn(),
  add: vi.fn(),
  drop: vi.fn(),
}))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('#/server/fns/atlas', () => ({
  markCountryVisitedFn: atlas.mark,
  unmarkCountryVisitedFn: atlas.unmark,
  addCountryToBucketListFn: atlas.add,
  removeCountryFromBucketListFn: atlas.drop,
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

/** A promise this test settles by hand, so "in flight" is a state it can hold. */
function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (cause: unknown) => void
} {
  let resolve: (value: T) => void = () => {}
  let reject: (cause: unknown) => void = () => {}
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  // `restoreMocks` only reaches spies, and these are plain `vi.fn()`s held
  // across the file: without this, one test's call counts are the next one's.
  vi.clearAllMocks()
  router.invalidate.mockResolvedValue(undefined)
  for (const fn of [atlas.mark, atlas.unmark, atlas.add, atlas.drop]) {
    fn.mockResolvedValue(undefined)
  }
})

function block(overrides: Partial<CountryActionsProps> = {}) {
  const props: CountryActionsProps = {
    countryCode: 'FR',
    visit: null,
    bucketGoal: null,
    ...overrides,
  }
  return render(<CountryActions {...props} />)
}

/** One of the block's two rows, addressed the way the map surface will. */
function row(part: 'visit-row' | 'goal-row'): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-part="${part}"]`)
  if (node === null) throw new Error(`no ${part} on screen`)
  return node
}

const visitButton = () => within(row('visit-row')).getByRole('button')
const goalButton = () => within(row('goal-row')).getByRole('button')

const message = (root: HTMLElement): HTMLElement | null =>
  root.querySelector('[data-part="message"]')

describe('at rest', () => {
  it('offers both writes, each as a real button with a stated label', () => {
    block()

    expect(screen.getByText('Not visited')).toBeTruthy()
    expect(screen.getByText('Not on the list')).toBeTruthy()
    expect(visitButton().textContent).toContain('Mark visited')
    expect(goalButton().textContent).toContain('Add to list')
    expect(visitButton().tagName).toBe('BUTTON')
    expect(goalButton().tagName).toBe('BUTTON')
  })

  it('says what the two controls do, and shows no failure', () => {
    const { container } = block()
    const strip = message(container)

    expect(strip?.textContent).toContain('Both take effect straight away')
    expect(container.querySelector('.text-danger')).toBeNull()
  })

  it('neither control is busy or disabled', () => {
    block()
    for (const control of [visitButton(), goalButton()]) {
      expect(control.getAttribute('aria-busy')).toBeNull()
      expect((control as HTMLButtonElement).disabled).toBe(false)
    }
  })
})

describe('while a write is in flight', () => {
  it('spins the pressed control only, and stands its sibling down', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.mark.mockReturnValue(pending.promise)
    block()

    await user.click(visitButton())

    expect(visitButton().getAttribute('aria-busy')).toBe('true')
    expect(goalButton().getAttribute('aria-busy')).toBeNull()
    expect((goalButton() as HTMLButtonElement).disabled).toBe(true)

    pending.resolve(undefined)
    await waitFor(() =>
      expect(visitButton().getAttribute('aria-busy')).toBeNull(),
    )
  })

  it('paints the state the write is about to produce', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.add.mockReturnValue(pending.promise)
    block()

    await user.click(goalButton())
    expect(screen.getByText('On the bucket list')).toBeTruthy()

    pending.resolve(undefined)
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
  })

  it('reserves the same two lines of caption in every row and state', () => {
    const { container } = block()
    const captions = [...container.querySelectorAll('[data-part] p + p')]
    expect(captions).toHaveLength(2)
    for (const node of captions) {
      // A stated box, not a wrapped one: the copy in these rows changes on the
      // press, and two captions do not wrap to the same number of lines.
      expect(node.className).toContain('h-8')
      expect(node.className).toContain('line-clamp-2')
    }
  })

  it('holds the strip at its resting height', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.mark.mockReturnValue(pending.promise)
    const { container } = block()
    const resting = message(container)?.className

    await user.click(visitButton())
    expect(message(container)?.className).toBe(resting)

    pending.resolve(undefined)
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
  })
})

describe('when a write lands', () => {
  it('sends the country, re-reads the loaders and says so', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    block({ countryCode: 'fr' })

    await user.click(visitButton())

    await waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1))
    // Upper-cased on the way out, whatever case the host held it in.
    expect(atlas.mark).toHaveBeenCalledWith({ data: { countryCode: 'FR' } })
    expect(success).toHaveBeenCalledWith(
      'Marked as visited',
      expect.objectContaining({ description: 'France is on your atlas.' }),
    )
  })

  it('leaves no spinner behind', async () => {
    const user = userEvent.setup()
    block()

    await user.click(goalButton())

    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    expect(goalButton().getAttribute('aria-busy')).toBeNull()
    expect((visitButton() as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('when a write fails', () => {
  it('rolls the painted state back and keeps the reason on screen', async () => {
    const user = userEvent.setup()
    const failure = vi.spyOn(toast, 'error')
    atlas.mark.mockRejectedValue(new Error('Your plan does not allow that.'))
    const { container } = block()

    await user.click(visitButton())

    await waitFor(() =>
      expect(screen.getByText('Your plan does not allow that.')).toBeTruthy(),
    )
    // The optimistic claim is withdrawn: the row is back to the invitation.
    expect(screen.getByText('Not visited')).toBeTruthy()
    expect(screen.queryByText('Visited')).toBeNull()
    expect(visitButton().textContent).toContain('Mark visited')
    expect(message(container)?.textContent).toContain(
      'Your plan does not allow that.',
    )
    expect(failure).toHaveBeenCalled()
  })

  it('never rejects, and never leaves the control spinning', async () => {
    const user = userEvent.setup()
    atlas.add.mockRejectedValue(new Error('Offline.'))
    block()

    await user.click(goalButton())

    await waitFor(() => expect(screen.getByText('Offline.')).toBeTruthy())
    expect(goalButton().getAttribute('aria-busy')).toBeNull()
    expect((goalButton() as HTMLButtonElement).disabled).toBe(false)
    expect((visitButton() as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps the strip the height it was at rest', async () => {
    const user = userEvent.setup()
    atlas.add.mockRejectedValue(new Error('Offline.'))
    const { container } = block()
    const resting = message(container)?.className

    await user.click(goalButton())

    await waitFor(() => expect(screen.getByText('Offline.')).toBeTruthy())
    expect(message(container)?.className).toBe(resting)
  })

  it("says a dropped connection in our own words, not the engine's", async () => {
    const user = userEvent.setup()
    const failure = vi.spyOn(toast, 'error')
    atlas.mark.mockRejectedValue(new Error('Failed to fetch'))
    const { container } = block()

    await user.click(visitButton())

    await waitFor(() =>
      expect(message(container)?.textContent).toContain(
        'could not reach the server',
      ),
    )
    // The toast and the strip say the same sentence, because the repair is made
    // at the write rather than on the rendered string.
    expect(failure).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        description: expect.stringContaining('could not reach the server'),
      }),
    )
    expect(container.textContent).not.toContain('Failed to fetch')
  })

  it('clears the last failure when the reader tries again', async () => {
    const user = userEvent.setup()
    atlas.add.mockRejectedValueOnce(new Error('Offline.'))
    const { container } = block()

    await user.click(goalButton())
    await waitFor(() => expect(screen.getByText('Offline.')).toBeTruthy())

    await user.click(goalButton())
    await waitFor(() =>
      expect(message(container)?.textContent).toContain(
        'Both take effect straight away',
      ),
    )
  })
})

describe('a country already on the atlas', () => {
  const VISIT = {
    firstVisitedOn: null,
    lastVisitedOn: null,
    visitCount: 1,
    note: null,
  }

  it('states the record and offers the inverse, not a dead button', () => {
    block({ visit: VISIT })

    expect(screen.getByText('Visited')).toBeTruthy()
    expect(screen.queryByText('Not visited')).toBeNull()
    expect(visitButton().getAttribute('aria-label')).toBe(
      'Remove France from your atlas',
    )
  })

  it('prints the tally and the span it was recorded over', () => {
    block({
      visit: {
        firstVisitedOn: '2011-07-14',
        lastVisitedOn: '2024-09-06',
        visitCount: 3,
        note: null,
      },
    })
    expect(screen.getByText(/3 visits/)).toBeTruthy()
    expect(screen.getByText(/14 Jul 2011/)).toBeTruthy()
  })

  it('takes a bare mark straight back off, with nothing to confirm', async () => {
    const user = userEvent.setup()
    block({ visit: VISIT })

    await user.click(visitButton())

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(atlas.unmark).toHaveBeenCalledWith({
        data: { countryCode: 'FR' },
      }),
    )
  })

  it('asks first when the row carries a history behind it', async () => {
    const user = userEvent.setup()
    block({
      visit: {
        firstVisitedOn: '2011-07-14',
        lastVisitedOn: '2024-09-06',
        visitCount: 3,
        note: 'Paris twice.',
      },
    })

    await user.click(visitButton())

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Remove France from your atlas?')
    expect(dialog.textContent).toContain('3 recorded visits')
    expect(dialog.textContent).toContain('the note you wrote')
    expect(atlas.unmark).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(atlas.unmark).toHaveBeenCalledTimes(1))
  })

  it('keeps the record when the confirmation is declined', async () => {
    const user = userEvent.setup()
    block({
      visit: {
        firstVisitedOn: '2019-04-02',
        lastVisitedOn: '2019-04-02',
        visitCount: 1,
        note: null,
      },
    })

    await user.click(visitButton())
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Keep it',
      }),
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(atlas.unmark).not.toHaveBeenCalled()
    expect(screen.getByText('Visited')).toBeTruthy()
  })
})

describe('a country already on the bucket list', () => {
  it('states it, and removes it by row id', async () => {
    const user = userEvent.setup()
    block({
      bucketGoal: { id: 'goal-fr', targetYear: 2027, isAchieved: false },
    })

    expect(screen.getByText('On the bucket list')).toBeTruthy()
    expect(screen.getByText('Aiming for 2027.')).toBeTruthy()
    expect(goalButton().getAttribute('aria-label')).toBe(
      'Remove France from your bucket list',
    )

    await user.click(goalButton())
    await waitFor(() =>
      expect(atlas.drop).toHaveBeenCalledWith({ data: { itemId: 'goal-fr' } }),
    )
  })

  it('asks before it removes one that has been ticked off', async () => {
    const user = userEvent.setup()
    block({
      bucketGoal: { id: 'goal-fr', targetYear: null, isAchieved: true },
    })

    expect(screen.getByText('Ticked off the list')).toBeTruthy()
    await user.click(goalButton())

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Remove France from your bucket list?')
    expect(atlas.drop).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(atlas.drop).toHaveBeenCalledTimes(1))
  })
})

describe('by keyboard alone', () => {
  it('reaches and fires both controls in reading order', async () => {
    const user = userEvent.setup()
    block()

    await user.tab()
    expect(document.activeElement).toBe(visitButton())
    await user.keyboard('{Enter}')
    await waitFor(() => expect(atlas.mark).toHaveBeenCalledTimes(1))

    await user.tab()
    expect(document.activeElement).toBe(goalButton())
    await user.keyboard(' ')
    await waitFor(() => expect(atlas.add).toHaveBeenCalledTimes(1))
  })

  it('leaves nothing focusable behind a disabled sibling', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.mark.mockReturnValue(pending.promise)
    block()

    await user.click(visitButton())
    await user.tab()
    expect(document.activeElement).not.toBe(goalButton())

    pending.resolve(undefined)
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
  })
})
