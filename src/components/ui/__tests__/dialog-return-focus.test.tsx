import './test-env'
import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { Button } from '../button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '../sheet'

afterEach(cleanup)

describe('focus restoration after a Safari-style unfocused trigger click', () => {
  it.each(['dialog', 'sheet'] as const)(
    'returns %s focus to its registered trigger',
    async (kind) => {
      render(
        kind === 'dialog' ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open reference</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Reference</DialogTitle>
              <DialogDescription>Reference details</DialogDescription>
            </DialogContent>
          </Dialog>
        ) : (
          <Sheet>
            <SheetTrigger asChild>
              <Button>Open reference</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>Reference</SheetTitle>
              <SheetDescription>Reference details</SheetDescription>
            </SheetContent>
          </Sheet>
        ),
      )
      const trigger = screen.getByRole('button', { name: 'Open reference' })
      expect(document.activeElement).toBe(document.body)
      // Safari does not focus a button just because a pointer activated it.
      fireEvent.click(trigger)
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined())
      fireEvent.click(screen.getByRole('button', { name: /^Close$/ }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await waitFor(() => expect(document.activeElement).toBe(trigger))
    },
  )
})
