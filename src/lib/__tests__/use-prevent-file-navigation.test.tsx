import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, renderHook } from '@testing-library/react'
import { usePreventFileNavigation } from '../use-prevent-file-navigation'

afterEach(cleanup)

it('keeps another mounted caller protected when one caller unmounts', () => {
  const first = renderHook(usePreventFileNavigation)
  const second = renderHook(usePreventFileNavigation)
  first.unmount()
  for (const type of ['dragover', 'drop']) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: { types: ['Files'] },
    })
    fireEvent(window, event)
    expect(event.defaultPrevented).toBe(true)
  }
  second.unmount()
  const event = new Event('drop', { cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'] } })
  fireEvent(window, event)
  expect(event.defaultPrevented).toBe(false)
})
