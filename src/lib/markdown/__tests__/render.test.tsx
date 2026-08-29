// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { Markdown } from '../render'

const html = (source: string): HTMLElement =>
  render(<Markdown text={source} />).container

describe('Markdown', () => {
  it('renders each block form as the element it names', () => {
    const container = html(
      [
        '# One',
        '## Two',
        '### Three',
        '- a\n- b',
        '1. first',
        '> quoted',
        '---',
        '```ts\nconst a = 1\n```',
      ].join('\n\n'),
    )

    expect(container.querySelector('h1')?.textContent).toBe('One')
    expect(container.querySelector('h2')?.textContent).toBe('Two')
    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(container.querySelector('ol')?.getAttribute('start')).toBe('1')
    expect(container.querySelector('blockquote')?.textContent).toBe('quoted')
    expect(container.querySelector('hr')).not.toBeNull()
    expect(container.querySelector('pre > code')?.textContent).toBe(
      'const a = 1\n',
    )
  })

  /**
   * The note's prose sits inside a day that already owns the page's heading
   * levels, so a third-level heading has to stay a third-level heading.
   */
  it('renders a level-three heading as an h3', () => {
    const container = html('### Three')
    expect(container.querySelector('h3')?.textContent).toBe('Three')
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('h2')).toBeNull()
  })

  it('keeps an ordered list starting where the author started it', () => {
    const container = html('7. seven\n8. eight')
    expect(container.querySelector('ol')?.getAttribute('start')).toBe('7')
  })

  it('renders each inline form as the element it names', () => {
    const container = html('*em* **strong** `code` one  \ntwo')

    expect(container.querySelector('em')?.textContent).toBe('em')
    expect(container.querySelector('strong')?.textContent).toBe('strong')
    expect(container.querySelector('p > code')?.textContent).toBe('code')
    expect(container.querySelector('br')).not.toBeNull()
  })

  it('renders a table with a head, a body and the declared alignments', () => {
    const container = html('| a | b |\n| :-: | --: |\n| 1 | 2 |')

    expect(container.querySelectorAll('thead th')).toHaveLength(2)
    expect(container.querySelectorAll('tbody td')).toHaveLength(2)
    expect(container.querySelector('thead th')?.className).toContain(
      'text-center',
    )
    expect(container.querySelectorAll('thead th')[1].className).toContain(
      'text-end',
    )
  })

  it('renders an allow-listed link as an anchor that leaks nothing', () => {
    const anchor = html('[go](https://example.com/x)').querySelector('a')

    expect(anchor?.getAttribute('href')).toBe('https://example.com/x')
    expect(anchor?.getAttribute('rel')).toBe('noreferrer noopener')
    expect(anchor?.textContent).toBe('go')
  })

  it('renders a refused destination as plain text and no anchor at all', () => {
    const container = html(
      '[click](javascript:alert(1)) and [also](data:text/html,x)',
    )

    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('javascript:alert(1)')
  })

  /**
   * The no-`dangerouslySetInnerHTML` invariant, asserted the only way that
   * cannot be faked: render a body made entirely of markup and look for the
   * elements that markup would have produced.
   */
  it('produces none of the elements a body full of markup asks for', () => {
    const container = html(
      [
        '<script>window.pwned = true</script>',
        '<img src=x onerror="window.pwned = true">',
        '<iframe src="https://example.com"></iframe>',
        '<b>bold</b> <a href="https://example.com">anchor</a>',
        '<style>body { display: none }</style>',
      ].join('\n\n'),
    )

    for (const selector of ['script', 'img', 'iframe', 'b', 'style', 'a']) {
      expect(container.querySelector(selector)).toBeNull()
    }
    expect(container.textContent).toContain('<script>')
    expect(container.textContent).toContain('onerror=')
  })

  it('renders nothing at all for an empty body', () => {
    expect(html('').textContent).toBe('')
    expect(html('   \n  ').firstChild).toBeNull()
  })

  it('takes a className without losing its own', () => {
    const container = html('text')
    const root = container.firstElementChild
    expect(root?.className).toContain('text-body')

    const themed = render(<Markdown text="text" className="mt-4" />).container
    expect(themed.firstElementChild?.className).toContain('mt-4')
    expect(themed.firstElementChild?.className).toContain('text-body')
  })
})
