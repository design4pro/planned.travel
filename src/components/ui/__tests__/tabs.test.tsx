// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs'

afterEach(cleanup)

function Fixture({
  value,
  onValueChange,
  variant = 'underline',
}: {
  value?: string
  onValueChange?: (next: string) => void
  variant?: 'underline' | 'segmented'
}) {
  return (
    <Tabs
      defaultValue="plan"
      value={value}
      onValueChange={onValueChange}
      variant={variant}
      aria-label="Trip sections"
    >
      <TabsList>
        <TabsTrigger value="plan">Plan</TabsTrigger>
        <TabsTrigger value="costs">Costs</TabsTrigger>
        <TabsTrigger value="lists">Lists</TabsTrigger>
      </TabsList>
      <TabsContent value="plan">Day by day</TabsContent>
      <TabsContent value="costs">Who owes what</TabsContent>
      <TabsContent value="lists">What to pack</TabsContent>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('shows only the active panel when uncontrolled', () => {
    render(<Fixture />)
    expect(screen.getByText('Day by day')).not.toBeNull()
    expect(screen.queryByText('Who owes what')).toBeNull()
  })

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    screen.getByRole('tab', { name: 'Plan' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(
      screen.getByRole('tab', { name: 'Costs' }).getAttribute('aria-selected'),
    ).toBe('true')
    expect(screen.getByText('Who owes what')).not.toBeNull()
  })

  it('is a single tab stop that lands on the active trigger', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    // Before focus enters, the list itself holds the tab stop and no trigger does.
    expect(screen.getByRole('tablist').getAttribute('tabindex')).toBe('0')
    expect(
      screen.getByRole('tab', { name: 'Costs' }).getAttribute('tabindex'),
    ).toBe('-1')

    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: 'Plan' }),
    )
    expect(
      screen.getByRole('tab', { name: 'Costs' }).getAttribute('tabindex'),
    ).toBe('-1')
  })

  it('reports changes and respects the controlled value', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Fixture value="plan" onValueChange={onValueChange} />)
    await user.click(screen.getByRole('tab', { name: 'Lists' }))
    expect(onValueChange).toHaveBeenCalledWith('lists')
    expect(
      screen.getByRole('tab', { name: 'Plan' }).getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('places the segmented thumb on the active index with a pure transform', () => {
    const { container } = render(<Fixture variant="segmented" value="lists" />)
    const thumb = container.querySelector('[aria-hidden="true"][style]')
    expect(thumb).not.toBeNull()
    expect(thumb?.getAttribute('style')).toContain('--tab-index: 2')
    expect(thumb?.getAttribute('style')).toContain('--tab-count: 3')
    expect(thumb?.className).toContain('transition-transform')
  })

  it('does not render a thumb for the underline variant', () => {
    const { container } = render(<Fixture variant="underline" />)
    expect(container.querySelector('[aria-hidden="true"][style]')).toBeNull()
  })

  it('skips a disabled trigger', async () => {
    const user = userEvent.setup()
    render(
      <Tabs defaultValue="plan" aria-label="Trip sections">
        <TabsList>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="costs" disabled>
            Costs
          </TabsTrigger>
        </TabsList>
        <TabsContent value="plan">Day by day</TabsContent>
        <TabsContent value="costs">Who owes what</TabsContent>
      </Tabs>,
    )
    await user.click(screen.getByRole('tab', { name: 'Costs' }))
    expect(
      screen.getByRole('tab', { name: 'Plan' }).getAttribute('aria-selected'),
    ).toBe('true')
  })
})
