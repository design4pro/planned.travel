// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../dialog'
import { Button } from '../button'

afterEach(cleanup)

function Fixture({
  open,
  onOpenChange,
  hideClose = false,
}: {
  open?: boolean
  onOpenChange?: (next: boolean) => void
  hideClose?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>Invite travellers</Button>
      </DialogTrigger>
      <DialogContent size="sm" hideClose={hideClose}>
        <DialogHeader>
          <DialogTitle>Invite travellers</DialogTitle>
          <DialogDescription>
            They will be able to edit the itinerary.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>Anyone with the link can join.</DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <Button variant="primary">Send invites</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('stays shut until the trigger is pressed', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Invite travellers' }))
    expect(screen.getByRole('dialog')).not.toBeNull()
  })

  it('names and describes itself from its title and description', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Invite travellers' }))

    const dialog = screen.getByRole('dialog', { name: 'Invite travellers' })
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      'They will be able to edit the itinerary.',
    )
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Invite travellers' }))
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('offers a named close button and honours hideClose', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Invite travellers' }))
    expect(screen.getByRole('button', { name: 'Close' })).not.toBeNull()
    unmount()

    render(<Fixture hideClose />)
    await user.click(screen.getByRole('button', { name: 'Invite travellers' }))
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('closes from a DialogClose child', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Invite travellers' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('moves focus into the panel and traps it there', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Invite travellers' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('renders the panel in a size variant, above the overlay', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Invite travellers' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('max-w-sm')
    expect(dialog.className).toContain('data-[state=open]:animate-dialog-in')
  })
})
