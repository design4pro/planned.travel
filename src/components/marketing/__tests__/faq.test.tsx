// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { FaqList } from '../faq'

import type { FaqItem } from '../faq'

afterEach(cleanup)

const ITEMS: ReadonlyArray<FaqItem> = [
  { question: 'Who can see my trip?', answer: 'Only the people you invite.' },
  { question: 'Can I get my data out?', answer: 'PDF, calendar and GeoJSON.' },
]

describe('FaqList', () => {
  it('renders one disclosure per question, collapsed by default', () => {
    const { container } = render(<FaqList items={ITEMS} />)
    const disclosures = container.querySelectorAll('details')

    expect(disclosures).toHaveLength(ITEMS.length)
    for (const disclosure of disclosures) {
      expect(disclosure.open).toBe(false)
    }
  })

  it('keeps the answer in the document while collapsed, so in-page search finds it', () => {
    render(<FaqList items={ITEMS} />)
    for (const item of ITEMS) {
      expect(screen.getByText(item.question)).toBeTruthy()
      expect(screen.getByText(item.answer)).toBeTruthy()
    }
  })

  it('uses a single column when asked, and two by default', () => {
    const { container, unmount } = render(<FaqList items={ITEMS} />)
    expect(container.firstElementChild?.className).toContain('sm:grid-cols-2')
    unmount()

    const single = render(<FaqList items={ITEMS} columns={1} />)
    expect(single.container.firstElementChild?.className).not.toContain(
      'sm:grid-cols-2',
    )
  })
})
