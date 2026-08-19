// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Avatar, initialsFor } from '../avatar'
import { AvatarStack } from '../avatar-stack'

afterEach(cleanup)

describe('initialsFor', () => {
  it('takes the first and last word', () => {
    expect(initialsFor('Amelia Voss')).toBe('AV')
  })

  it('handles a single name', () => {
    expect(initialsFor('Amelia')).toBe('A')
  })

  it('ignores the domain part of an email', () => {
    expect(initialsFor('amelia.voss@planned.travel')).toBe('AV')
  })

  it('never returns an empty string', () => {
    expect(initialsFor('   ')).toBe('?')
  })
})

describe('Avatar', () => {
  it('falls back to initials with the name still announced', () => {
    render(<Avatar name="Amelia Voss" />)
    expect(screen.getByText('AV')).not.toBeNull()
    expect(screen.getByText('Amelia Voss').className).toContain('sr-only')
  })

  it('gives the same person the same tint every time', () => {
    const first = render(<Avatar name="Jonas Reyes" />)
    const tint = screen.getByText('JR').parentElement?.className
    first.unmount()
    render(<Avatar name="Jonas Reyes" />)
    expect(screen.getByText('JR').parentElement?.className).toBe(tint)
  })

  it('gives two different people different tints', () => {
    render(
      <>
        <Avatar name="Jonas Reyes" />
        <Avatar name="Amelia Voss" />
      </>,
    )
    expect(screen.getByText('JR').parentElement?.className).not.toBe(
      screen.getByText('AV').parentElement?.className,
    )
  })

  it('describes presence in words, not only in colour', () => {
    render(<Avatar name="Amelia Voss" status="online" />)
    expect(
      screen.getByRole('img', { name: 'Amelia Voss is online' }),
    ).not.toBeNull()
  })

  it('applies the size variant', () => {
    render(<Avatar name="Amelia Voss" size="xl" data-testid="avatar" />)
    expect(screen.getByTestId('avatar').className).toContain('size-14')
  })
})

describe('AvatarStack', () => {
  const people = [
    { id: '1', name: 'Amelia Voss' },
    { id: '2', name: 'Jonas Reyes' },
    { id: '3', name: 'Mira Okafor' },
    { id: '4', name: 'Sam Ilves' },
    { id: '5', name: 'Nils Brandt' },
  ]

  it('announces the whole party as one group', () => {
    render(<AvatarStack people={people} max={2} />)
    expect(
      screen.getByRole('group', {
        name: 'Amelia Voss, Jonas Reyes and 3 others',
      }),
    ).not.toBeNull()
  })

  it('counts the faces it could not show', () => {
    render(<AvatarStack people={people} max={3} />)
    expect(screen.getByText('+2')).not.toBeNull()
  })

  it('drops the counter when everyone fits', () => {
    render(<AvatarStack people={people.slice(0, 2)} max={4} />)
    expect(screen.queryByText(/^\+/)).toBeNull()
    expect(
      screen.getByRole('group', { name: 'Amelia Voss, Jonas Reyes' }),
    ).not.toBeNull()
  })

  it('renders the trailing label', () => {
    render(<AvatarStack people={people.slice(0, 2)} label="2 travellers" />)
    expect(screen.getByText('2 travellers')).not.toBeNull()
  })
})
