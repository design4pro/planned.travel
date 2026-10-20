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
  loadCountryRegionsFn: vi.fn().mockResolvedValue({ regions: [], total: 0 }),
  markRegionVisitedFn: vi.fn(),
  unmarkRegionVisitedFn: vi.fn(),
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

/**
 * What every one of the four writes answers with: the country's whole state
 * after it, exactly as `AtlasCountryState` carries it. The bucket-list half is
 * what the block reads — an entry it has just created has no row in the props
 * until the loader commits, so the id it is removed by can only come from here.
 */
function answer(
  over: {
    visit?: { readonly visitCount: number } | null
    bucketGoal?: {
      readonly id: string
      readonly targetYear: number | null
      readonly isAchieved: boolean
    } | null
  } = {},
) {
  return {
    countryCode: 'FR',
    continent: 'Europe',
    visit:
      over.visit === undefined
        ? null
        : over.visit === null
          ? null
          : {
              id: 'visit-fr',
              countryCode: 'FR',
              continent: 'Europe',
              firstVisitedOn: null,
              lastVisitedOn: null,
              visitCount: over.visit.visitCount,
              note: null,
            },
    bucketGoal:
      over.bucketGoal === undefined || over.bucketGoal === null
        ? null
        : {
            id: over.bucketGoal.id,
            name: 'France',
            targetYear: over.bucketGoal.targetYear,
            note: null,
            isAchieved: over.bucketGoal.isAchieved,
            achievedOn: null,
          },
  }
}

/** The id the server hands back for an entry created in these tests. */
const CREATED_GOAL_ID = 'goal-created-fr'

beforeEach(() => {
  // `restoreMocks` only reaches spies, and these are plain `vi.fn()`s held
  // across the file: without this, one test's call counts are the next one's.
  vi.clearAllMocks()
  router.invalidate.mockResolvedValue(undefined)
  atlas.mark.mockResolvedValue(answer({ visit: { visitCount: 1 } }))
  atlas.unmark.mockResolvedValue(answer())
  atlas.add.mockResolvedValue(
    answer({
      bucketGoal: {
        id: CREATED_GOAL_ID,
        targetYear: null,
        isAchieved: false,
      },
    }),
  )
  atlas.drop.mockResolvedValue(answer())
})

function block(overrides: Partial<CountryActionsProps> = {}) {
  const props: CountryActionsProps = {
    countryCode: 'FR',
    visit: null,
    bucketGoal: null,
    ...overrides,
  }
  const view = render(<CountryActions {...props} />)
  return {
    ...view,
    /**
     * The loader's next answer, delivered the way the shelf delivers it: the
     * same block, re-rendered with the row the write produced. This is the
     * commit the optimistic claim is held for, and it lands one transition
     * render *after* the write itself has returned.
     */
    loader(next: Partial<CountryActionsProps>): void {
      view.rerender(<CountryActions {...props} {...next} />)
    },
  }
}

/** A visit with nothing behind it: the shape this block's own write leaves. */
const VISITED = {
  firstVisitedOn: null,
  lastVisitedOn: null,
  visitCount: 1,
  note: null,
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
    // The name opens with the words printed on the control, so voice control
    // can say them and WCAG 2.5.3 holds, and it names the country it acts on.
    expect(visitButton().getAttribute('aria-label')).toBe(
      'Mark visited, France',
    )
    expect(goalButton().getAttribute('aria-label')).toBe('Add to list, France')
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
      // press, and two captions do not wrap to the same number of lines. The
      // reservation is made where the caption is on the page, which is from
      // 20rem of container up.
      expect(node.className).toContain('@xs:h-8')
      expect(node.className).toContain('@xs:line-clamp-2')
    }
  })

  it('keeps the row itself one shape from the press to the answer', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.mark.mockReturnValue(pending.promise)
    block()
    const resting = row('visit-row').className
    const restingTitle = within(row('visit-row')).getByText(
      'Not visited',
    ).className

    await user.click(visitButton())

    // The state cue on the card is an attribute; nothing about the geometry
    // that holds the row's height may move with it.
    expect(row('visit-row').className).toBe(resting)
    expect(within(row('visit-row')).getByText('Visited').className).toBe(
      restingTitle,
    )

    pending.resolve(undefined)
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
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

describe('what the busy control announces', () => {
  /**
   * The row paints the claim the instant the button is pressed, and the button
   * must not be read off that claim: a control that says "Remove France from
   * your atlas, busy" one frame after the reader pressed "Mark visited" is
   * announcing the opposite of what it is doing, and it is `disabled` for the
   * whole window in which it offers the inverse.
   */
  it('names the additive press it is performing, not the inverse it flipped to', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.mark.mockReturnValue(pending.promise)
    block()

    await user.click(visitButton())

    const control = visitButton()
    expect(control.getAttribute('aria-busy')).toBe('true')
    expect(control.getAttribute('aria-label')).toBe('Marking France as visited')
    expect(control.textContent).toContain('Marking France as visited')
    expect(control.textContent).not.toContain('Remove')
    // The row itself is free to paint the claim; that is the other half of it.
    expect(screen.getByText('Visited')).toBeTruthy()

    pending.resolve(undefined)
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
  })

  it('names the bucket-list add it is performing, not the removal', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.add.mockReturnValue(pending.promise)
    block()

    await user.click(goalButton())

    const control = goalButton()
    expect(control.getAttribute('aria-label')).toBe(
      'Adding France to your bucket list',
    )
    expect(control.textContent).not.toContain('Remove')

    pending.resolve(undefined)
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
  })

  it('names a removal as a removal while it runs', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.unmark.mockReturnValue(pending.promise)
    block({
      visit: {
        firstVisitedOn: null,
        lastVisitedOn: null,
        visitCount: 1,
        note: null,
      },
    })

    await user.click(visitButton())

    expect(visitButton().getAttribute('aria-label')).toBe(
      'Removing France from your atlas',
    )
    expect(visitButton().textContent).not.toContain('Mark visited')

    pending.resolve(undefined)
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
  })

  it('keeps the pressed control on its own styling while it works', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.mark.mockReturnValue(pending.promise)
    block()
    const resting = visitButton().className

    await user.click(visitButton())
    // The optimistic claim must not restyle the control mid-press: the primary
    // fill would drop to the secondary hairline and back again in one press.
    expect(visitButton().className).toBe(resting)

    pending.resolve(undefined)
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
  })

  it('offers the inverse the moment the write is done, with no spinner left', async () => {
    const user = userEvent.setup()
    const view = block()

    await user.click(goalButton())

    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    // The write has landed and nothing is in flight, so the control stops
    // announcing progress — and it offers the removal, because that is what the
    // row now is. It must not fall back to "Add to list" while it waits for the
    // loader's commit to arrive.
    expect(goalButton().getAttribute('aria-busy')).toBeNull()
    expect(goalButton().getAttribute('aria-label')).toBe(
      'Remove France from your bucket list',
    )

    view.loader({
      bucketGoal: { id: 'goal-fr', targetYear: null, isAchieved: false },
    })
    expect(goalButton().getAttribute('aria-label')).toBe(
      'Remove France from your bucket list',
    )
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

/**
 * The window between the write returning and the loader's row rendering.
 *
 * `useAction.run` resolves after `await router.invalidate()`, which means the
 * loader has fetched — but the router commits the new data inside a React
 * transition, and withdrawing the claim there and then is a default-priority
 * update that renders first, with the props the block already had. Withdrawing
 * on `run` therefore paints the pre-write row again for the length of that
 * transition render, with the success toast on screen saying the opposite.
 */
describe('between the write and the loader', () => {
  it('does not flash the pre-write state back after a successful mark', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    const view = block()

    await user.click(visitButton())
    await waitFor(() => expect(success).toHaveBeenCalled())

    // The write is done, the toast is up, the loader's commit has not happened
    // yet: the row must already read the way the toast says it does.
    expect(screen.getByText('Visited')).toBeTruthy()
    expect(screen.queryByText('Not visited')).toBeNull()
    expect(visitButton().textContent).toContain('Remove')

    view.loader({ visit: VISITED })
    expect(screen.getByText('Visited')).toBeTruthy()
    expect(visitButton().getAttribute('aria-label')).toBe(
      'Remove France from your atlas',
    )
  })

  it('does not flash it back on the bucket-list row either', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    const view = block()

    await user.click(goalButton())
    await waitFor(() => expect(success).toHaveBeenCalled())

    expect(screen.getByText('On the bucket list')).toBeTruthy()
    expect(screen.queryByText('Not on the list')).toBeNull()

    view.loader({
      bucketGoal: { id: 'goal-fr', targetYear: 2028, isAchieved: false },
    })
    expect(screen.getByText('On the bucket list')).toBeTruthy()
    expect(screen.getByText('Aiming for 2028.')).toBeTruthy()
  })

  /**
   * A mark made here produces a single visit with no days behind it, and the
   * settled row prints that as "Dates not recorded". The claim says the same
   * words, so the caption does not change a second time — a tenth of a second
   * after the state stopped changing — for a fact that has not moved.
   */
  it('claims the row in the words the record will use for it', async () => {
    const user = userEvent.setup()
    const view = block()

    await user.click(visitButton())
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    const claimed = within(row('visit-row')).getByText('Dates not recorded')

    view.loader({ visit: VISITED })
    expect(within(row('visit-row')).getByText('Dates not recorded')).toBe(
      claimed,
    )
  })

  it('hands the row back to the loader as soon as its answer carries it', async () => {
    const user = userEvent.setup()
    const view = block({ visit: VISITED })

    await user.click(visitButton())
    await waitFor(() => expect(atlas.unmark).toHaveBeenCalled())

    view.loader({ visit: null })
    expect(screen.getByText('Not visited')).toBeTruthy()
    // The claim is given back, not merely agreed with: the loader's own answer
    // is what the row reads again, so the next one it sends is obeyed.
    view.loader({ visit: VISITED })
    await waitFor(() => expect(screen.getByText('Visited')).toBeTruthy())
  })

  /**
   * A claim can never outlive its write for good. If the loader comes back
   * without the row the server said it wrote, the block gives the claim up on
   * its own and shows what it was actually handed.
   */
  it('gives the claim up when the loader never confirms it', async () => {
    const user = userEvent.setup()
    block()

    await user.click(goalButton())
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    expect(screen.getByText('On the bucket list')).toBeTruthy()

    await waitFor(
      () => expect(screen.getByText('Not on the list')).toBeTruthy(),
      { timeout: 2500 },
    )
    expect(goalButton().getAttribute('aria-label')).toBe('Add to list, France')
  })

  it('drops a held claim when the reader selects another country', async () => {
    const user = userEvent.setup()
    const view = block()

    await user.click(visitButton())
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    expect(screen.getByText('Visited')).toBeTruthy()

    // A claim made for France cannot paint Japan.
    view.loader({ countryCode: 'JP' })
    expect(screen.getByText('Not visited')).toBeTruthy()
    expect(visitButton().getAttribute('aria-label')).toBe('Mark visited, Japan')
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

/**
 * The window between a successful add and the loader's commit is the one place
 * the offered removal has no row in the props to address. It lasts a transition
 * render on the happy path and the whole of the claim hold when the loader's
 * answer never carries the row — and for all of it the control is enabled and
 * says "Remove", so it has to send one.
 */
describe('an entry this block has just created', () => {
  async function addIt(): Promise<void> {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    await user.click(goalButton())
    await waitFor(() => expect(success).toHaveBeenCalled())
    success.mockRestore()
  }

  it('removes it by the id the write answered with', async () => {
    const user = userEvent.setup()
    block()
    await addIt()

    expect(goalButton().getAttribute('aria-label')).toBe(
      'Remove France from your bucket list',
    )
    expect((goalButton() as HTMLButtonElement).disabled).toBe(false)

    await user.click(goalButton())

    await waitFor(() =>
      expect(atlas.drop).toHaveBeenCalledWith({
        data: { itemId: CREATED_GOAL_ID },
      }),
    )
    // The press it offered is the press it sent: not a second add, and not
    // nothing at all.
    expect(atlas.add).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.getByText('Not on the list')).toBeTruthy(),
    )
    expect(goalButton().getAttribute('aria-label')).toBe('Add to list, France')
  })

  it('says so, on both sides of the undo', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    block()

    await user.click(goalButton())
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        'Added to your bucket list',
        expect.objectContaining({
          description: 'France is somewhere you mean to go.',
        }),
      ),
    )

    await user.click(goalButton())
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        'Removed from your bucket list',
        expect.objectContaining({
          description: 'France is no longer on the list.',
        }),
      ),
    )
  })

  it('is undone by keyboard as well as by pointer', async () => {
    const user = userEvent.setup()
    block()

    await user.tab()
    await user.tab()
    expect(document.activeElement).toBe(goalButton())
    await user.keyboard('{Enter}')
    await waitFor(() => expect(atlas.add).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(goalButton().getAttribute('aria-label')).toBe(
        'Remove France from your bucket list',
      ),
    )

    // Focus comes back to the control the write was started from, so the undo
    // is one key away rather than a tab order away.
    await waitFor(() => expect(document.activeElement).toBe(goalButton()))
    await user.keyboard(' ')
    await waitFor(() =>
      expect(atlas.drop).toHaveBeenCalledWith({
        data: { itemId: CREATED_GOAL_ID },
      }),
    )
  })

  it('prefers the row the loader brings over the one it is holding', async () => {
    const user = userEvent.setup()
    const view = block()
    await addIt()

    view.loader({
      bucketGoal: {
        id: 'goal-from-loader',
        targetYear: 2029,
        isAchieved: false,
      },
    })
    expect(screen.getByText('Aiming for 2029.')).toBeTruthy()

    await user.click(goalButton())
    await waitFor(() =>
      expect(atlas.drop).toHaveBeenCalledWith({
        data: { itemId: 'goal-from-loader' },
      }),
    )
  })

  it('offers the write it can send when the answer carried no entry', async () => {
    const user = userEvent.setup()
    atlas.add.mockResolvedValue(answer())
    block()
    await addIt()

    // Nothing to address means nothing to remove, so the control offers the
    // additive write — which the server treats as idempotent — instead of
    // pointing at a removal it could not perform.
    expect(goalButton().getAttribute('aria-label')).toBe('Add to list, France')

    await user.click(goalButton())
    await waitFor(() => expect(atlas.add).toHaveBeenCalledTimes(2))
    expect(atlas.drop).not.toHaveBeenCalled()
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

describe('where the reader is left afterwards', () => {
  /**
   * `Button` disables itself while it loads, and the browser drops focus from a
   * control the moment it is disabled. Without the block taking it back, a
   * keyboard reader who pressed "Add to list" is standing on `<body>` with no
   * way back to the row and no way to reach the sentence saying why it failed.
   */
  /**
   * jsdom lets a disabled control keep focus, where every browser takes it
   * away, so the drop is performed here rather than waited for. What is under
   * test is what the block does about it, which is the same either way.
   */
  function dropFocus(): void {
    const spare = document.createElement('button')
    document.body.appendChild(spare)
    spare.focus()
    spare.remove()
    expect(document.activeElement).toBe(document.body)
  }

  it('takes focus back to the control it was dropped from', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.add.mockReturnValue(pending.promise)
    block()

    goalButton().focus()
    await user.keyboard('{Enter}')
    expect(goalButton().getAttribute('aria-busy')).toBe('true')
    dropFocus()

    pending.resolve(undefined)
    await waitFor(() => expect(document.activeElement).toBe(goalButton()))
  })

  it('takes it back after a failure too, beside the reason', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.mark.mockReturnValue(pending.promise)
    const view = block()

    visitButton().focus()
    await user.keyboard('{Enter}')
    dropFocus()

    pending.reject(new Error('Your plan is at its ceiling.'))
    await waitFor(() => expect(document.activeElement).toBe(visitButton()))
    expect(message(view.container)?.textContent).toContain(
      'Your plan is at its ceiling.',
    )
  })

  it('leaves focus alone when something else has taken it', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.mark.mockReturnValue(pending.promise)
    block()

    await user.click(visitButton())
    // A reader who moved on while the write ran keeps where they moved to.
    const elsewhere = document.createElement('button')
    document.body.appendChild(elsewhere)
    elsewhere.focus()

    pending.resolve(undefined)
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    expect(document.activeElement).toBe(elsewhere)
    elsewhere.remove()
  })

  /**
   * The block is mounted inside scroll containers shorter than it is — a 230px
   * record pane on the desktop shelf — so the strip under the rows can be a
   * hundred pixels below the fold at the moment it is written to.
   */
  it('brings the failure into view in whatever is clipping it', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    // jsdom implements no scrolling at all, so the method is absent and the
    // block skips it; this is the browser's version of the same element.
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    atlas.add.mockRejectedValue(new Error('The server said no.'))
    const view = block()

    expect(scrollIntoView).not.toHaveBeenCalled()

    await user.click(goalButton())

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
    expect(scrollIntoView.mock.instances[0]).toBe(message(view.container))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })

    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })
})

describe('when a confirmed removal fails', () => {
  const HISTORY = {
    firstVisitedOn: '2011-07-14',
    lastVisitedOn: '2024-09-06',
    visitCount: 3,
    note: 'Paris twice.',
  }

  /**
   * The strip lives under the rows, behind the dialog's own overlay. Leaving the
   * question open over a failure means the only thing the reader can see is the
   * button they just pressed.
   */
  it('stands the question down so the reason is on screen', async () => {
    const user = userEvent.setup()
    const failure = vi.spyOn(toast, 'error')
    atlas.unmark.mockRejectedValue(new Error('The row is gone already.'))
    const view = block({ visit: HISTORY })

    await user.click(visitButton())
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Remove',
      }),
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(message(view.container)?.textContent).toContain(
      'The row is gone already.',
    )
    // The claim is withdrawn with it: the record is still on the atlas.
    expect(screen.getByText('Visited')).toBeTruthy()
    expect(visitButton().getAttribute('aria-busy')).toBeNull()
    expect(failure).toHaveBeenCalled()
  })
})

describe('on the 4px grid', () => {
  it('states every step of the message strip in whole grid units', () => {
    const view = block()
    const strip = message(view.container)

    // 8px of gap, 48px of strip on a phone and 32px from 20rem of container,
    // and a 16px glyph against a 16px first line.
    expect(strip?.className).toContain('gap-2')
    expect(strip?.className).toContain('h-12')
    expect(strip?.className).toContain('@xs:h-8')
    expect(strip?.className).toContain('mt-2')
    expect(strip?.className).not.toContain('gap-1.5')
  })

  it('holds three lines of failure where the block is narrow, two where it is not', () => {
    const view = block()
    const line = message(view.container)?.firstElementChild

    expect(line?.className).toContain('line-clamp-3')
    expect(line?.className).toContain('@xs:line-clamp-2')
  })
})

/**
 * The narrow half of the block: the 284px card the map anchors on a 360px screen
 * and the drawer the shelf opens there. jsdom has no layout and cannot evaluate
 * a container query, so what is asserted is the contract in the class strings —
 * which arrangement each width is asked for — rather than the pixels it renders
 * to. The pixels are the visual gate's job.
 */
describe('the composition a narrow host gets', () => {
  const rowsOf = (root: HTMLElement): HTMLElement => {
    const node = root.querySelector<HTMLElement>(
      '[data-part="visit-row"]',
    )?.parentElement
    if (node === null || node === undefined)
      throw new Error('no rows on screen')
    return node
  }

  it('sets the two rows side by side under 20rem and stacks them above it', () => {
    const view = block()
    const rows = rowsOf(view.container)

    // Side by side is what puts both controls inside the first hundred pixels
    // of the block, which is the whole of the difference on a 360px screen.
    expect(rows.className).toContain('grid-cols-2')
    expect(rows.className).toContain('@xs:grid-cols-1')
  })

  it('drops the 36px glyph from the narrow card and puts it back from 20rem', () => {
    block()
    const glyph = row('visit-row').firstElementChild

    expect(glyph?.className).toContain('hidden')
    expect(glyph?.className).toContain('@xs:grid')
    // Decoration either way: the title beside it is what states the row.
    expect(glyph?.getAttribute('aria-hidden')).toBe('true')
  })

  it('carries the state on the card where the glyph is not there to carry it', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    atlas.add.mockReturnValue(pending.promise)
    block({ visit: { ...VISITED } })

    expect(row('visit-row').hasAttribute('data-set')).toBe(true)
    expect(row('goal-row').hasAttribute('data-set')).toBe(false)
    expect(row('visit-row').className).toContain(
      '@max-xs:data-[set]:bg-brand-subtle',
    )

    // The cue follows the claim, so the card fills the instant it is pressed.
    await user.click(goalButton())
    expect(row('goal-row').hasAttribute('data-set')).toBe(true)

    pending.reject(new Error('The server said no.'))
    await waitFor(() =>
      expect(row('goal-row').hasAttribute('data-set')).toBe(false),
    )
  })

  it('keeps the caption a reader can hear when the page cannot hold it', () => {
    block()
    const caption = within(row('visit-row')).getByText(
      'A visit with no trip behind it.',
    )

    // `sr-only` rather than `hidden`: the sentence leaves the page on a phone
    // and stays in the accessibility tree, so nothing is lost to a reader who
    // was never going to see it.
    expect(caption.className).toContain('sr-only')
    expect(caption.className).toContain('@xs:not-sr-only')
  })

  it('gives the narrow control the whole card and a stated minimum above it', () => {
    block()
    for (const control of [visitButton(), goalButton()]) {
      expect(control.className).toContain('w-full')
      expect(control.className).toContain('@xs:w-auto')
      expect(control.className).toContain('@xs:min-w-30')
    }
  })

  it('leaves both rows named and grouped in either arrangement', () => {
    block()
    for (const part of ['visit-row', 'goal-row'] as const) {
      const group = row(part)
      const labelledBy = group.getAttribute('aria-labelledby')
      expect(group.getAttribute('role')).toBe('group')
      expect(labelledBy).toBeTruthy()
      expect(
        document.getElementById(labelledBy ?? '')?.textContent,
      ).toBeTruthy()
    }
  })
})

describe('the motion under the rows', () => {
  it('enters and leaves on the same curve, on transform and opacity only', async () => {
    const user = userEvent.setup()
    atlas.mark.mockRejectedValue(new Error('The server said no.'))
    const view = block()

    await user.click(visitButton())
    await waitFor(() =>
      expect(message(view.container)?.textContent).toContain(
        'The server said no.',
      ),
    )
    const line = view.container.querySelector('[data-state="open"]')

    // 220ms in on `--ease-out-quint`, 150ms out on the same curve — never the
    // house `animate-pop-out`, whose easing is the one curve this block is
    // asked not to use, and which scales rather than translating.
    expect(line?.className).toContain('animate-rise')
    expect(line?.className).toContain('transition-[opacity,transform]')
    expect(line?.className).toContain('duration-fast')
    expect(line?.className).toContain('ease-out-quint')
    expect(line?.className).not.toContain('animate-pop-out')
    // Pinned flat for a reader who asked for no motion.
    expect(line?.getAttribute('data-motion-transform')).toBe('')
  })
})

describe('country regions', () => {
  it('asks before unmarking a country with regions even without visit history', async () => {
    const api = await import('#/server/fns/atlas')
    vi.mocked(api.loadCountryRegionsFn).mockResolvedValueOnce({
      regions: [{ id: 'one', name: 'Brittany' }],
      total: 1,
    })
    block({
      visit: {
        firstVisitedOn: null,
        lastVisitedOn: null,
        visitCount: 1,
        note: null,
      },
    })
    await screen.findByRole('button', { name: 'Remove Brittany' })
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove France from your atlas' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain(
      '1 region you recorded in France stays on your record.',
    )
    expect(atlas.unmark).not.toHaveBeenCalled()
  })
})
