import './test-env'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { CodeInput } from '../code-input'
import { Field } from '../field'

afterEach(cleanup)
it('keeps the sign-in control numeric, autofill-ready and associated with its field error', () => {
  const ref = createRef<HTMLInputElement>()
  render(
    <Field label="Authenticator code" error="Try a newer code">
      <CodeInput ref={ref} />
    </Field>,
  )
  const input = screen.getByLabelText('Authenticator code')
  expect(ref.current).toBe(input)
  expect(input.getAttribute('inputmode')).toBe('numeric')
  expect(input.getAttribute('autocomplete')).toBe('one-time-code')
  expect(input.hasAttribute('data-numeric')).toBe(true)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(
    document.getElementById(input.getAttribute('aria-describedby') ?? '')
      ?.textContent,
  ).toBe('Try a newer code')
})
