// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { SectionLabel } from '../section-label'

afterEach(cleanup)

describe('SectionLabel', () => {
  it('shortens a label that overruns its line by default', () => {
    render(<SectionLabel>Workspace trips</SectionLabel>)
    expect(screen.getByText('Workspace trips').className).toContain('truncate')
  })

  it('wraps the label instead for a caller that reserves the height', () => {
    render(<SectionLabel truncate={false}>Workspace trips</SectionLabel>)
    expect(screen.getByText('Workspace trips').className).not.toContain(
      'truncate',
    )
  })
})
