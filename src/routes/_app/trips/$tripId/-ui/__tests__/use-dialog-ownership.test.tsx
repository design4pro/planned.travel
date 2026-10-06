// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useDialogOwnership } from '../use-dialog-ownership'

/**
 * A write may settle after its form closed, with another dialog already open. Only the dialog that
 * was open when the write started may receive its error or be closed by it.
 */

type Dialog = { readonly kind: string }

function mount(initial: Dialog | null) {
  return renderHook(
    ({ dialog }: { dialog: Dialog | null }) => useDialogOwnership(dialog),
    { initialProps: { dialog: initial } },
  )
}

describe('useDialogOwnership', () => {
  it('owns a write while the dialog it started in is still open', () => {
    const edit = { kind: 'edit' }
    const { result } = mount(edit)

    expect(result.current.claim()()).toBe(true)
  })

  it('does not own a write that started with no dialog, even if one opens later', () => {
    const { result, rerender } = mount(null)
    const owns = result.current.claim()

    rerender({ dialog: { kind: 'edit' } })

    expect(owns()).toBe(false)
  })

  it('stops owning a write once its dialog is released', () => {
    const edit = { kind: 'edit' }
    const { result } = mount(edit)
    const owns = result.current.claim()

    result.current.release()

    expect(owns()).toBe(false)
  })

  it('does not hand a write to the dialog that opened after its own closed', () => {
    const edit = { kind: 'edit' }
    const { result, rerender } = mount(edit)
    const owns = result.current.claim()

    result.current.release()
    rerender({ dialog: null })
    rerender({ dialog: { kind: 'delete' } })

    expect(owns()).toBe(false)
  })

  it('does not hand a write to a different dialog that replaced it without a release', () => {
    const { result, rerender } = mount({ kind: 'edit' })
    const owns = result.current.claim()

    rerender({ dialog: { kind: 'delete' } })

    expect(owns()).toBe(false)
  })

  it('lets a later write own the dialog that opened after an earlier one closed', () => {
    const { result, rerender } = mount({ kind: 'edit' })
    result.current.release()
    rerender({ dialog: { kind: 'delete' } })

    expect(result.current.claim()()).toBe(true)
  })
})
