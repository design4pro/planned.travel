// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { LegalDocument, LegalPlaceholder } from '../legal'

import type { ReactNode } from 'react'
import type { LegalSection } from '../legal'

afterEach(cleanup)

const SECTIONS: ReadonlyArray<LegalSection> = [
  { id: 'account', heading: 'Your account', body: <p>Keep it to yourself.</p> },
  {
    id: 'payment',
    heading: 'Plans and payment',
    body: (
      <p>
        Billed by <LegalPlaceholder>[processor]</LegalPlaceholder>.
      </p>
    ),
  },
]

function renderDocument(aside?: ReactNode) {
  return render(
    <LegalDocument
      eyebrow="Legal"
      title="Terms of service"
      updated="19 August 2026"
      version="1.0 (template)"
      summary={['Your trips belong to you.', 'Cancel whenever you like.']}
      sections={SECTIONS}
      aside={aside}
    />,
  )
}

describe('LegalDocument', () => {
  it('states the title, version and effective date', () => {
    renderDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Terms of service' }),
    ).toBeTruthy()
    expect(screen.getByText('Version 1.0 (template)')).toBeTruthy()
    expect(screen.getByText('Effective 19 August 2026')).toBeTruthy()
  })

  it('warns that the document is a template a lawyer must review', () => {
    renderDocument()
    expect(
      screen.getByText('This is a template, not legal advice'),
    ).toBeTruthy()
    expect(
      screen.getByText(/qualified lawyer in your jurisdiction/i),
    ).toBeTruthy()
  })

  it('never claims a certification it does not hold', () => {
    renderDocument()
    expect(
      screen.getByText(
        /Nothing here asserts a certification, audit or compliance standard/i,
      ),
    ).toBeTruthy()
  })

  it('builds a contents list whose links match the section anchors', () => {
    renderDocument()
    const contents = screen.getByRole('navigation', { name: 'On this page' })
    const links = Array.from(contents.querySelectorAll('a'))

    expect(links).toHaveLength(SECTIONS.length)
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      SECTIONS.map((section) => `#${section.id}`),
    )

    for (const section of SECTIONS) {
      expect(document.getElementById(section.id)).not.toBeNull()
    }
  })

  it('numbers each section heading and renders its body', () => {
    renderDocument()
    for (const [index, section] of SECTIONS.entries()) {
      const heading = screen.getByRole('heading', {
        level: 2,
        name: new RegExp(section.heading),
      })
      expect(heading.textContent).toContain(`${index + 1}.`)
    }
    expect(screen.getByText('Keep it to yourself.')).toBeTruthy()
    expect(screen.getByText('[processor]')).toBeTruthy()
  })

  it('renders the plain-English summary before the sections', () => {
    renderDocument()
    expect(screen.getByText('The short version')).toBeTruthy()
    expect(screen.getByText('Your trips belong to you.')).toBeTruthy()
    expect(screen.getByText('Cancel whenever you like.')).toBeTruthy()
  })

  it('places caller-supplied aside content beside the contents list', () => {
    renderDocument(<p>Sibling document</p>)
    expect(screen.getByText('Sibling document')).toBeTruthy()
  })
})
