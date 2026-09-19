import { describe, expect, it } from 'vitest'

import { parse } from '../parse'

import type { MarkdownBlock, MarkdownInline } from '../parse'

/** The one shape every block-level assertion below reduces to. */
const text = (value: string): MarkdownInline => ({ type: 'text', value })

const only = (source: string): MarkdownBlock => {
  const blocks = parse(source)
  expect(blocks).toHaveLength(1)
  return blocks[0]
}

describe('parse — blocks', () => {
  it('reads a paragraph, joining its lines rather than splitting them', () => {
    expect(parse('one line\nsecond line')).toEqual([
      { type: 'paragraph', children: [text('one line\nsecond line')] },
    ])
  })

  it('separates paragraphs on a blank line', () => {
    expect(parse('first\n\nsecond')).toEqual([
      { type: 'paragraph', children: [text('first')] },
      { type: 'paragraph', children: [text('second')] },
    ])
  })

  it('reads headings one to three', () => {
    expect(parse('# One\n\n## Two\n\n### Three')).toEqual([
      { type: 'heading', level: 1, children: [text('One')] },
      { type: 'heading', level: 2, children: [text('Two')] },
      { type: 'heading', level: 3, children: [text('Three')] },
    ])
  })

  it('leaves a fourth level as literal characters, because the subset stops at three', () => {
    expect(only('#### Four')).toEqual({
      type: 'paragraph',
      children: [text('#### Four')],
    })
  })

  it('reads a fourth level over a delimiter row as the table it falls through to', () => {
    expect(only('#### a | b\n--- | ---\n1 | 2')).toEqual({
      type: 'table',
      align: [null, null],
      header: [[text('#### a')], [text('b')]],
      rows: [[[text('1')], [text('2')]]],
    })
  })

  it('ends a paragraph at a fourth level that opens a table', () => {
    expect(parse('intro\n#### a | b\n--- | ---\n1 | 2')).toEqual([
      { type: 'paragraph', children: [text('intro')] },
      {
        type: 'table',
        align: [null, null],
        header: [[text('#### a')], [text('b')]],
        rows: [[[text('1')], [text('2')]]],
      },
    ])
  })

  it('reads an unordered list under any of the three bullets', () => {
    expect(only('- a\n* b\n+ c')).toEqual({
      type: 'list',
      ordered: false,
      start: 1,
      items: [[text('a')], [text('b')], [text('c')]],
    })
  })

  it('reads an ordered list and keeps the number it starts at', () => {
    expect(only('3. three\n4. four')).toEqual({
      type: 'list',
      ordered: true,
      start: 3,
      items: [[text('three')], [text('four')]],
    })
  })

  it('reads a fenced code block with its language, verbatim', () => {
    expect(only('```ts\nconst a = *1*\n```')).toEqual({
      type: 'code',
      language: 'ts',
      value: 'const a = *1*\n',
    })
  })

  it('reads a fence with no language as a language-less block', () => {
    expect(only('```\nplain\n```')).toEqual({
      type: 'code',
      language: null,
      value: 'plain\n',
    })
  })

  it('reads a block quote', () => {
    expect(only('> quoted\n> still quoted')).toEqual({
      type: 'quote',
      children: [
        { type: 'paragraph', children: [text('quoted\nstill quoted')] },
      ],
    })
  })

  it('leaves a nested quote marker as literal characters', () => {
    expect(only('> > deeper')).toEqual({
      type: 'quote',
      children: [{ type: 'paragraph', children: [text('> deeper')] }],
    })
  })

  it('reads a thematic break from any of the three markers', () => {
    expect(parse('---\n\n***\n\n___')).toEqual([
      { type: 'thematicBreak' },
      { type: 'thematicBreak' },
      { type: 'thematicBreak' },
    ])
  })

  it('reads a pipe table with its alignments', () => {
    expect(only('| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |')).toEqual({
      type: 'table',
      align: ['left', 'center', 'right'],
      header: [[text('a')], [text('b')], [text('c')]],
      rows: [[[text('1')], [text('2')], [text('3')]]],
    })
  })

  it('reads a table written without the outer pipes', () => {
    expect(only('a | b\n--- | ---\n1 | 2')).toEqual({
      type: 'table',
      align: [null, null],
      header: [[text('a')], [text('b')]],
      rows: [[[text('1')], [text('2')]]],
    })
  })

  it('fits a ragged row to the width the header declared', () => {
    expect(only('| a | b |\n| --- | --- |\n| 1 |\n| 1 | 2 | 3 |')).toEqual({
      type: 'table',
      align: [null, null],
      header: [[text('a')], [text('b')]],
      rows: [
        [[text('1')], []],
        [[text('1')], [text('2')]],
      ],
    })
  })

  it('keeps an escaped pipe inside its cell rather than splitting on it', () => {
    expect(only('| a | b |\n| --- | --- |\n| x \\| y | 2 |')).toEqual({
      type: 'table',
      align: [null, null],
      header: [[text('a')], [text('b')]],
      rows: [[[text('x | y')], [text('2')]]],
    })
  })

  it('reads a tilde fence, whose info string may hold a backtick', () => {
    expect(only('~~~ ts\ncode `x`\n~~~')).toEqual({
      type: 'code',
      language: 'ts',
      value: 'code `x`\n',
    })
  })

  it('returns nothing for an empty or blank body', () => {
    expect(parse('')).toEqual([])
    expect(parse('   \n\n\t\n')).toEqual([])
  })
})

/** Inline assertions read the children of the single paragraph they produce. */
const inline = (source: string): ReadonlyArray<MarkdownInline> => {
  const block = only(source)
  if (block.type !== 'paragraph') {
    throw new Error(`expected a paragraph, read a ${block.type}`)
  }
  return block.children
}

describe('parse — inline', () => {
  it('reads emphasis under either marker', () => {
    expect(inline('*one* and _two_')).toEqual([
      { type: 'emphasis', children: [text('one')] },
      text(' and '),
      { type: 'emphasis', children: [text('two')] },
    ])
  })

  it('reads strong under either marker', () => {
    expect(inline('**one** and __two__')).toEqual([
      { type: 'strong', children: [text('one')] },
      text(' and '),
      { type: 'strong', children: [text('two')] },
    ])
  })

  it('reads strong wrapping emphasis, and emphasis wrapping strong', () => {
    expect(inline('***both***')).toEqual([
      {
        type: 'strong',
        children: [{ type: 'emphasis', children: [text('both')] }],
      },
    ])
    expect(inline('*a **b** c*')).toEqual([
      {
        type: 'emphasis',
        children: [
          text('a '),
          { type: 'strong', children: [text('b')] },
          text(' c'),
        ],
      },
    ])
  })

  it('leaves an underscore inside a word alone, so an identifier survives', () => {
    expect(inline('read snake_case_name here')).toEqual([
      text('read snake_case_name here'),
    ])
  })

  it('reads a code span and keeps its content out of the inline grammar', () => {
    expect(inline('use `a *b* c` here')).toEqual([
      text('use '),
      { type: 'codeSpan', value: 'a *b* c' },
      text(' here'),
    ])
  })

  it('reads a hard break from trailing spaces and from a backslash', () => {
    expect(inline('one  \ntwo\\\nthree')).toEqual([
      text('one'),
      { type: 'hardBreak' },
      text('two'),
      { type: 'hardBreak' },
      text('three'),
    ])
  })

  it('keeps a single newline as a soft break inside the text', () => {
    expect(inline('one\ntwo')).toEqual([text('one\ntwo')])
  })

  it('reads a link on each allow-listed scheme', () => {
    expect(inline('[a](https://example.com/x)')).toEqual([
      { type: 'link', href: 'https://example.com/x', children: [text('a')] },
    ])
    expect(inline('[b](http://example.com)')).toEqual([
      { type: 'link', href: 'http://example.com', children: [text('b')] },
    ])
    expect(inline('[c](mailto:hi@example.com)')).toEqual([
      { type: 'link', href: 'mailto:hi@example.com', children: [text('c')] },
    ])
  })

  it('reads inline markup inside a link label', () => {
    expect(inline('[a **b**](https://example.com)')).toEqual([
      {
        type: 'link',
        href: 'https://example.com',
        children: [text('a '), { type: 'strong', children: [text('b')] }],
      },
    ])
  })

  it('reads a link written with a title, and keeps the title out of the tree', () => {
    expect(inline('[a](https://example.com "the title")')).toEqual([
      { type: 'link', href: 'https://example.com', children: [text('a')] },
    ])
    expect(inline("[b](<https://example.com> 'the title')")).toEqual([
      { type: 'link', href: 'https://example.com', children: [text('b')] },
    ])
  })

  it('unescapes a backslash-escaped punctuation character', () => {
    expect(inline('a \\*not emphasis\\* b')).toEqual([
      text('a *not emphasis* b'),
    ])
  })

  it('reads an escaped bracket as text, and an escaped backslash as no escape', () => {
    expect(inline('\\[a](https://example.com)')).toEqual([
      text('[a](https://example.com)'),
    ])
    expect(inline('\\\\[a](https://example.com)')).toEqual([
      text('\\'),
      { type: 'link', href: 'https://example.com', children: [text('a')] },
    ])
  })

  it('reads a destination with balanced parentheses and escapes', () => {
    expect(inline('[a](https://example.com/x_(y)\\)z)')).toEqual([
      {
        type: 'link',
        href: 'https://example.com/x_(y))z',
        children: [text('a')],
      },
    ])
  })
})

describe('parse — outside the subset', () => {
  const isLink = (node: MarkdownInline): boolean => node.type === 'link'

  it('never lets a javascript: destination become a link', () => {
    const nodes = inline('[click](javascript:alert(1))')
    expect(nodes.some(isLink)).toBe(false)
    expect(nodes).toEqual([text('[click](javascript:alert(1))')])
  })

  it('never lets a data: destination become a link', () => {
    const nodes = inline('[click](data:text/html;base64,PHNjcmlwdD4=)')
    expect(nodes.some(isLink)).toBe(false)
  })

  it('sees through the tricks that hide a scheme from a naive check', () => {
    for (const destination of [
      'JaVaScRiPt:alert(1)',
      '< javascript:alert(1)>',
      '<java\tscript:alert(1)>',
      '<java\u0000script:alert(1)>',
      'vbscript:msgbox(1)',
      '/relative/path',
      '#anchor',
    ]) {
      const nodes = inline(`[click](${destination})`)
      expect(nodes.some(isLink)).toBe(false)
    }
  })

  it('reads a destination the way a browser reads one, controls dropped first', () => {
    // The strip runs before the scheme is read, so the allow-list sees what the
    // navigator would see rather than the bytes around it.
    expect(inline('[a](<\u0001https://example.com/x>)')).toEqual([
      { type: 'link', href: 'https://example.com/x', children: [text('a')] },
    ])
  })

  it('keeps raw HTML as text rather than as a node', () => {
    expect(inline('<script>alert(1)</script>')).toEqual([
      text('<script>alert(1)</script>'),
    ])
    expect(inline('a <b>bold</b> tag')).toEqual([text('a <b>bold</b> tag')])
  })

  it('keeps an image as its literal characters', () => {
    expect(inline('![alt](https://example.com/a.png)')).toEqual([
      text('![alt](https://example.com/a.png)'),
    ])
  })

  it('keeps a reference link and an autolink literal as text', () => {
    expect(inline('[label][ref]')).toEqual([text('[label][ref]')])
    expect(inline('<https://example.com>')).toEqual([
      text('<https://example.com>'),
    ])
    expect(inline('visit https://example.com today')).toEqual([
      text('visit https://example.com today'),
    ])
  })

  it('degrades unclosed emphasis to its literal characters', () => {
    expect(inline('*never closed')).toEqual([text('*never closed')])
    expect(inline('**also never closed')).toEqual([text('**also never closed')])
    expect(inline('an unclosed `backtick')).toEqual([
      text('an unclosed `backtick'),
    ])
  })

  it('degrades a half-written table to a paragraph', () => {
    expect(only('| a | b |')).toEqual({
      type: 'paragraph',
      children: [text('| a | b |')],
    })
    expect(parse('| a | b |\n| --- |')).toEqual([
      { type: 'paragraph', children: [text('| a | b |\n| --- |')] },
    ])
  })

  it('declines a backtick fence whose info string holds a backtick', () => {
    expect(parse('```js `x`\nnot code')).toEqual([
      {
        type: 'paragraph',
        children: [
          text('```js '),
          { type: 'codeSpan', value: 'x' },
          text('\nnot code'),
        ],
      },
    ])
  })

  it('closes an unclosed fence at the end of the body', () => {
    expect(only('```\nstill open')).toEqual({
      type: 'code',
      language: null,
      value: 'still open\n',
    })
  })

  it('never throws on a fragment somebody stopped halfway through', () => {
    for (const source of [
      '[',
      '](',
      '![',
      '*',
      '`',
      '|',
      '>',
      '- ',
      '```',
      '\\',
      '[a](',
      '[a](<',
      '***',
      '|||\n|-|-|',
      '1.',
      '#'.repeat(400),
      '['.repeat(400),
      '*'.repeat(400),
      ' ',
    ]) {
      expect(() => parse(source)).not.toThrow()
    }
  })

  it('parses a ten-thousand-character body inside the default timeout', () => {
    const paragraph =
      'A day in **Lisbon**, with a [link](https://example.com/a) and `code`.\n'
    const source = `# Trip\n\n${paragraph.repeat(150)}`
    expect(source.length).toBeGreaterThan(10_000)

    const blocks = parse(source)
    expect(blocks.length).toBeGreaterThan(1)
  })

  /**
   * The lookahead that ends a paragraph recognises the block that ends it
   * without reading it, so a boundary block is read exactly once — by the
   * dispatcher that keeps it. A body alternating between the three readers that
   * consume more than one line is where a lookahead reading blocks again would
   * show up first.
   */
  it('reads a boundary block a bounded number of times', () => {
    const source = 'text before\n> quoted\n```\ncode\n```\n- item\n'.repeat(400)
    expect(parse(source).length).toBeGreaterThan(1_000)
  })

  it('does not degrade into quadratic scanning on unmatched delimiters', () => {
    expect(() => parse('['.repeat(10_000))).not.toThrow()
    expect(() => parse('*'.repeat(10_000))).not.toThrow()
    expect(() => parse('`'.repeat(10_000))).not.toThrow()
    // A `]` somewhere later defeats any cheap "no closer at all" check, so
    // these reach the label and destination scans once per `[`.
    expect(() => parse('[a](b'.repeat(20_000))).not.toThrow()
    expect(() => parse('![a](b'.repeat(20_000))).not.toThrow()
    expect(() => parse('['.repeat(100_000) + ']')).not.toThrow()
    expect(() => parse('[a](b('.repeat(20_000))).not.toThrow()
    expect(() =>
      parse('['.repeat(20_000) + 'a](b'.repeat(20_000)),
    ).not.toThrow()
    // Native `indexOf` keeps these cheap until the source is long, so they are
    // sized to outrun the test timeout if the closer searches rescan per `[`.
    expect(() => parse('[a](<'.repeat(400_000))).not.toThrow()
    expect(() =>
      parse('[a](b'.repeat(320_000) + ' "' + 'x'.repeat(1_600_000)),
    ).not.toThrow()
  })
})
