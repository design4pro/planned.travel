// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Field } from '../field'
import { Input } from '../input'
import { Textarea } from '../textarea'

afterEach(cleanup)

describe('Field', () => {
  it('wires the label to the nested control without an explicit id', () => {
    render(
      <Field label="Trip name">
        <Input placeholder="Kyoto in spring" />
      </Field>,
    )
    expect(screen.getByLabelText('Trip name')).toBe(
      screen.getByPlaceholderText('Kyoto in spring'),
    )
  })

  it('describes the control with its hint', () => {
    render(
      <Field label="Budget" hint="Per traveller, before flights">
        <Input />
      </Field>,
    )
    const describedBy = screen
      .getByLabelText('Budget')
      .getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      'Per traveller, before flights',
    )
  })

  it('replaces the hint with the error and marks the control invalid', () => {
    render(
      <Field
        label="Budget"
        hint="Per traveller"
        error="Enter an amount above zero"
      >
        <Input />
      </Field>,
    )
    expect(screen.getByLabelText('Budget').getAttribute('aria-invalid')).toBe(
      'true',
    )
    expect(screen.queryByText('Per traveller')).toBeNull()
    expect(screen.queryByText('Enter an amount above zero')).not.toBeNull()
  })

  it('marks a required label and disables the nested control', () => {
    render(
      <Field label="Destination" required disabled>
        <Input />
      </Field>,
    )
    const input = screen.getByLabelText(/Destination/)
    expect((input as HTMLInputElement).disabled).toBe(true)
  })

  it('works for a textarea as well as an input', () => {
    render(
      <Field label="Notes" error="Too long">
        <Textarea />
      </Field>,
    )
    const textarea = screen.getByLabelText('Notes')
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea.getAttribute('aria-invalid')).toBe('true')
  })

  it('lets an explicit prop on the control win over the field', () => {
    render(
      <Field label="Code" error="Nope">
        <Input aria-invalid={false} />
      </Field>,
    )
    expect(screen.getByLabelText('Code').getAttribute('aria-invalid')).toBe(
      'false',
    )
  })
})
