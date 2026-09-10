/**
 * A restricted markdown subset, hand-rolled.
 *
 * The pinned dependency set (docs/SPEC.md §3) contains no markdown parser and
 * no HTML sanitiser, and entry 5 of the boundaries register disposes of that
 * gap by narrowing the language instead of widening the dependency set: this
 * module reads a small, closed subset and everything outside it survives as
 * the literal characters the author typed.
 *
 * Two properties do the security work, and both are structural rather than
 * defensive:
 *
 * 1. **No raw HTML passes through.** There is no node type that carries markup,
 *    so there is nothing for a sanitiser to sanitise. A `<script>` in the source
 *    is text, and the renderer escapes it the way React escapes any string.
 * 2. **A link is a link only if its scheme is on the allow-list.** `javascript:`
 *    and `data:` never reach an `href`; they stay text — see {@link safeHref}.
 *
 * `parse` is pure and returns a readonly tree with no React in it, so the same
 * tree can later be walked by a serialiser (a document export) rather than
 * parsed twice. Nothing here throws: a note written in a fuller dialect
 * somewhere else is still readable, just plainer.
 */

/** Column alignment declared by a table's delimiter row; `null` is unstated. */
export type MarkdownAlign = 'left' | 'center' | 'right' | null

export interface MarkdownText {
  readonly type: 'text'
  readonly value: string
}

export interface MarkdownEmphasis {
  readonly type: 'emphasis'
  readonly children: ReadonlyArray<MarkdownInline>
}

export interface MarkdownStrong {
  readonly type: 'strong'
  readonly children: ReadonlyArray<MarkdownInline>
}

export interface MarkdownCodeSpan {
  readonly type: 'codeSpan'
  readonly value: string
}

/** An explicit line break inside a paragraph: two trailing spaces, or `\`. */
export interface MarkdownHardBreak {
  readonly type: 'hardBreak'
}

export interface MarkdownLink {
  readonly type: 'link'
  /** Already checked against the scheme allow-list. Never `javascript:`. */
  readonly href: string
  readonly children: ReadonlyArray<MarkdownInline>
}

export type MarkdownInline =
  | MarkdownText
  | MarkdownEmphasis
  | MarkdownStrong
  | MarkdownCodeSpan
  | MarkdownHardBreak
  | MarkdownLink

export interface MarkdownParagraph {
  readonly type: 'paragraph'
  readonly children: ReadonlyArray<MarkdownInline>
}

export interface MarkdownHeading {
  readonly type: 'heading'
  readonly level: 1 | 2 | 3
  readonly children: ReadonlyArray<MarkdownInline>
}

/** One item's inline content. A list item holds no blocks in this subset. */
export type MarkdownListItem = ReadonlyArray<MarkdownInline>

export interface MarkdownList {
  readonly type: 'list'
  readonly ordered: boolean
  /** The first number of an ordered list; `1` for an unordered one. */
  readonly start: number
  readonly items: ReadonlyArray<MarkdownListItem>
}

export interface MarkdownCode {
  readonly type: 'code'
  readonly language: string | null
  readonly value: string
}

/**
 * Children are never another quote: nesting is outside the subset, so a second
 * `>` is part of the quoted text.
 */
export interface MarkdownQuote {
  readonly type: 'quote'
  readonly children: ReadonlyArray<MarkdownBlock>
}

export interface MarkdownThematicBreak {
  readonly type: 'thematicBreak'
}

/** One cell's inline content. A cell holds no blocks in this subset. */
export type MarkdownTableCell = ReadonlyArray<MarkdownInline>

/** Always the header's width: short rows are padded, long ones truncated. */
export type MarkdownTableRow = ReadonlyArray<MarkdownTableCell>

export interface MarkdownTable {
  readonly type: 'table'
  readonly align: ReadonlyArray<MarkdownAlign>
  readonly header: MarkdownTableRow
  readonly rows: ReadonlyArray<MarkdownTableRow>
}

export type MarkdownBlock =
  | MarkdownParagraph
  | MarkdownHeading
  | MarkdownList
  | MarkdownCode
  | MarkdownQuote
  | MarkdownThematicBreak
  | MarkdownTable

/** The schemes a link may carry. Everything else stays text. */
const LINK_SCHEMES: ReadonlyArray<string> = ['http:', 'https:', 'mailto:']

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+|$)([^\n]*?)[ \t]*$/
const CLOSING_HASHES = /(?:^|[ \t])#+$/
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/
const QUOTE = /^ {0,3}>[ \t]?/
const BULLET = /^ {0,3}([-*+])[ \t]+(.*)$/
const ORDERED = /^ {0,3}(\d{1,9})[.)][ \t]+(.*)$/
const BLANK = /^[ \t]*$/
const DELIMITER_CELL = /^:?-+:?$/
/** ASCII punctuation, the set a backslash may escape. */
const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/
const ALPHANUMERIC = /[\p{L}\p{N}]/u
/** Whitespace as a link destination understands it. */
const LINK_SPACE = /[ \t\n]/
const WHITESPACE = /\s/
/**
 * Everything a browser drops from a URL before it resolves the scheme: the
 * space, the C0 and C1 control characters and the delete. Written as the
 * complement of what is printable, because a range that names a control
 * character is a range with a control character in the source.
 */
const NON_PRINTABLE = /[^\u0021-\u007e\u00a1-\uffff]/g

/**
 * Read a body into a block tree.
 *
 * Pure, total, and free of React. Out-of-subset syntax degrades to the
 * characters that produced it rather than to an error.
 */
export function parse(source: string): ReadonlyArray<MarkdownBlock> {
  return parseBlocks(splitLines(source), true)
}

function splitLines(source: string): Array<string> {
  return source.replace(/\r\n?/g, '\n').split('\n')
}

/** One block, and the index of the first line after the ones it consumed. */
interface BlockRead {
  readonly block: MarkdownBlock
  readonly next: number
}

/**
 * @param quotable - false inside a quote, which is what keeps `> > x` from
 *   nesting: the inner `>` is read as text.
 */
function parseBlocks(
  lines: ReadonlyArray<string>,
  quotable: boolean,
): ReadonlyArray<MarkdownBlock> {
  const blocks: Array<MarkdownBlock> = []
  let index = 0

  while (index < lines.length) {
    if (BLANK.test(lines[index])) {
      index += 1
      continue
    }

    // A line that opens nothing opens a paragraph, which is the block every
    // other reader declines.
    const read =
      readBlockAt(lines, index, quotable) ??
      readParagraph(lines, index, quotable)

    blocks.push(read.block)
    index = read.next
  }

  return blocks
}

/** The block forms the subset knows, and nothing about the block itself. */
type BlockKind =
  'fence' | 'thematicBreak' | 'heading' | 'quote' | 'list' | 'table'

/**
 * The kind of block the line at `index` opens, or `null` when it opens none.
 *
 * The order of the branches is the grammar, and it is stated once because two
 * callers ask the same question of it: {@link readBlockAt}, which then reads the
 * block, and {@link startsBlock}, which only needs to know that the paragraph or
 * list item running into this line has to stop short of it. A form added here is
 * therefore never one that parses but fails to end the paragraph above it.
 *
 * Recognising costs the opening condition and nothing else — no reader runs, so
 * no block is read to be thrown away.
 *
 * @param quotable - false inside a quote, which is what keeps `> > x` from
 *   nesting: the inner `>` is read as text.
 */
function blockKindAt(
  lines: ReadonlyArray<string>,
  index: number,
  quotable: boolean,
): BlockKind | null {
  const line = lines[index]

  if (fenceAt(line) !== null) return 'fence'
  if (THEMATIC_BREAK.test(line)) return 'thematicBreak'
  if (headingAt(line) !== null) return 'heading'
  if (quotable && QUOTE.test(line)) return 'quote'
  if (BULLET.test(line) || ORDERED.test(line)) return 'list'
  return tableShapeAt(lines, index) === null ? null : 'table'
}

/**
 * Read the block the line at `start` opens, or `null` when it opens none, by
 * dispatching to the reader for the kind {@link blockKindAt} named.
 *
 * @param quotable - false inside a quote, which is what keeps `> > x` from
 *   nesting: the inner `>` is read as text.
 */
function readBlockAt(
  lines: ReadonlyArray<string>,
  start: number,
  quotable: boolean,
): BlockRead | null {
  const line = lines[start]

  switch (blockKindAt(lines, start, quotable)) {
    case 'fence': {
      const fence = fenceAt(line)
      if (fence !== null) {
        return readFence(lines, start, fence.marker, fence.info)
      }
      break
    }

    case 'thematicBreak':
      return { block: { type: 'thematicBreak' }, next: start + 1 }

    case 'heading': {
      const heading = headingAt(line)
      if (heading !== null) {
        return {
          block: {
            type: 'heading',
            level: heading.level,
            children: parseInline(heading.text, true),
          },
          next: start + 1,
        }
      }
      break
    }

    case 'quote':
      return readQuote(lines, start)

    case 'list':
      return readList(lines, start, quotable)

    case 'table':
      return readTable(lines, start)

    case null:
      break
  }

  // Falling out of the switch is the `null` a line that opens no block already
  // meant. The breaks in the `fence` and `heading` cases re-narrow what
  // TypeScript cannot prove is already narrow: `fenceAt` and `headingAt` are
  // pure functions of `line`, so the second call cannot disagree with the
  // first, and neither branch is reachable.
  return null
}

/** A fence's marker and info string, or `null` when the line opens no fence. */
function fenceAt(line: string): { marker: string; info: string } | null {
  const fence = FENCE.exec(line)
  if (fence === null || !isValidInfo(fence[1], fence[2])) return null
  return { marker: fence[1], info: fence[2] }
}

/**
 * A heading's level and text, or `null` when the line opens no heading — which
 * includes a run of four or more hashes, outside the subset, so that
 * {@link blockKindAt} carries on to the branches below it and reads such a line
 * as whatever they make of it.
 */
function headingAt(line: string): { level: 1 | 2 | 3; text: string } | null {
  const heading = HEADING.exec(line)
  if (heading === null) return null

  const level = headingLevel(heading[1])
  if (level === null) return null

  return { level, text: heading[2].replace(CLOSING_HASHES, '').trim() }
}

/** The subset stops at three: a deeper run of hashes is literal text. */
function headingLevel(hashes: string): 1 | 2 | 3 | null {
  if (hashes.length === 1) return 1
  if (hashes.length === 2) return 2
  if (hashes.length === 3) return 3
  return null
}

/** A backtick fence's info string may not itself contain a backtick. */
function isValidInfo(marker: string, info: string): boolean {
  return marker.startsWith('~') || !info.includes('`')
}

function readFence(
  lines: ReadonlyArray<string>,
  start: number,
  marker: string,
  info: string,
): BlockRead {
  const body: Array<string> = []
  let index = start + 1

  while (index < lines.length) {
    const closing = FENCE.exec(lines[index])
    if (
      closing !== null &&
      closing[1][0] === marker[0] &&
      closing[1].length >= marker.length &&
      closing[2].trim() === ''
    ) {
      index += 1
      break
    }
    body.push(lines[index])
    index += 1
  }

  // An unclosed fence runs to the end of the body rather than failing: the
  // author is mid-sentence, not mistaken.
  return {
    block: {
      type: 'code',
      language: info.trim().split(/\s+/)[0] || null,
      value: body.length === 0 ? '' : `${body.join('\n')}\n`,
    },
    next: index,
  }
}

function readQuote(lines: ReadonlyArray<string>, start: number): BlockRead {
  const body: Array<string> = []
  let index = start

  while (index < lines.length && QUOTE.test(lines[index])) {
    body.push(lines[index].replace(QUOTE, ''))
    index += 1
  }

  return {
    block: { type: 'quote', children: parseBlocks(body, false) },
    next: index,
  }
}

function readList(
  lines: ReadonlyArray<string>,
  start: number,
  quotable: boolean,
): BlockRead {
  const first = ORDERED.exec(lines[start])
  const ordered = first !== null
  const items: Array<Array<string>> = []
  let index = start

  while (index < lines.length) {
    const line = lines[index]
    if (BLANK.test(line)) break
    if (THEMATIC_BREAK.test(line)) break

    const item = ordered ? ORDERED.exec(line) : BULLET.exec(line)
    if (item !== null) {
      items.push([item[2]])
      index += 1
      continue
    }

    // A line that is neither a new item nor another block continues the last
    // one, which is how a wrapped item stays one item.
    if (items.length === 0 || startsBlock(lines, index, quotable)) break
    items[items.length - 1].push(line.trim())
    index += 1
  }

  return {
    block: {
      type: 'list',
      ordered,
      start: ordered ? Number(first[1]) : 1,
      items: items.map((item) => parseInline(item.join('\n'), true)),
    },
    next: index,
  }
}

/**
 * The header and delimiter cells of the table the line at `index` opens, or
 * `null` when it opens none.
 *
 * Every way a table can fail to be one is here, ahead of the row scan, so
 * recognising a table costs the two-line check and never the rows.
 */
function tableShapeAt(
  lines: ReadonlyArray<string>,
  index: number,
): { headerCells: Array<string>; delimiterCells: Array<string> } | null {
  const header = lines[index]
  if (!header.includes('|')) return null

  if (index + 1 >= lines.length) return null
  const delimiter = lines[index + 1]
  if (!delimiter.includes('-')) return null

  const headerCells = splitRow(header)
  const delimiterCells = splitRow(delimiter)
  if (delimiterCells.length !== headerCells.length) return null
  if (!delimiterCells.every((cell) => DELIMITER_CELL.test(cell))) return null

  return { headerCells, delimiterCells }
}

function readTable(
  lines: ReadonlyArray<string>,
  start: number,
): BlockRead | null {
  const shape = tableShapeAt(lines, start)
  if (shape === null) return null
  const { headerCells, delimiterCells } = shape

  const rows: Array<MarkdownTableRow> = []
  let index = start + 2

  while (index < lines.length) {
    const line = lines[index]
    if (BLANK.test(line) || !line.includes('|')) break
    rows.push(toRow(fitRow(splitRow(line), headerCells.length)))
    index += 1
  }

  return {
    block: {
      type: 'table',
      align: delimiterCells.map(alignOf),
      header: toRow(headerCells),
      rows,
    },
    next: index,
  }
}

/** A short row is padded and a long one truncated, so every row is the header's width. */
function fitRow(cells: Array<string>, width: number): Array<string> {
  const fitted = cells.slice(0, width)
  while (fitted.length < width) fitted.push('')
  return fitted
}

function toRow(cells: ReadonlyArray<string>): MarkdownTableRow {
  return cells.map((cell) => parseInline(cell, true))
}

function alignOf(cell: string): MarkdownAlign {
  const left = cell.startsWith(':')
  const right = cell.endsWith(':')
  if (left && right) return 'center'
  if (left) return 'left'
  if (right) return 'right'
  return null
}

/** Split on unescaped pipes, dropping the empty cells the outer pipes create. */
function splitRow(line: string): Array<string> {
  const trimmed = line.trim()
  const cells: Array<string> = []
  let cell = ''

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index]
    if (char === '\\' && trimmed[index + 1] === '|') {
      cell += '\\|'
      index += 1
      continue
    }
    if (char === '|') {
      cells.push(cell)
      cell = ''
      continue
    }
    cell += char
  }
  cells.push(cell)

  if (cells.length > 1 && trimmed.startsWith('|')) cells.shift()
  if (cells.length > 1 && trimmed.endsWith('|')) cells.pop()
  return cells.map((entry) => entry.trim())
}

function readParagraph(
  lines: ReadonlyArray<string>,
  start: number,
  quotable: boolean,
): BlockRead {
  const body: Array<string> = [lines[start]]
  let index = start + 1

  while (index < lines.length) {
    const line = lines[index]
    if (BLANK.test(line) || startsBlock(lines, index, quotable)) break
    body.push(line)
    index += 1
  }

  return {
    block: {
      type: 'paragraph',
      children: parseInline(body.join('\n').trim(), true),
    },
    next: index,
  }
}

/** Whether the line at `index` opens a block, and therefore ends the run before it. */
function startsBlock(
  lines: ReadonlyArray<string>,
  index: number,
  quotable: boolean,
): boolean {
  return blockKindAt(lines, index, quotable) !== null
}

/* -------------------------------------------------------------------- inline */

/**
 * @param linkable - false inside a link's own label, so a link never nests
 *   inside another one and an image is literal there rather than
 *   half-swallowed.
 */
function parseInline(
  source: string,
  linkable: boolean,
): ReadonlyArray<MarkdownInline> {
  const nodes: Array<MarkdownInline> = []
  let buffer = ''
  let index = 0

  const flush = (): void => {
    if (buffer !== '') {
      nodes.push({ type: 'text', value: buffer })
      buffer = ''
    }
  }

  while (index < source.length) {
    const char = source[index]

    if (char === '\\') {
      const next = index + 1 < source.length ? source[index + 1] : ''
      if (next === '\n') {
        flush()
        nodes.push({ type: 'hardBreak' })
        index += 2
        continue
      }
      if (ESCAPABLE.test(next)) {
        buffer += next
        index += 2
        continue
      }
      buffer += char
      index += 1
      continue
    }

    if (char === '\n') {
      // Two or more trailing spaces are the other spelling of a hard break;
      // a single newline is a soft one and stays in the text.
      const trimmed = buffer.replace(/ +$/, '')
      if (buffer.length - trimmed.length >= 2) {
        buffer = trimmed
        flush()
        nodes.push({ type: 'hardBreak' })
        index += 1
        continue
      }
      buffer += '\n'
      index += 1
      continue
    }

    if (char === '`') {
      const span = matchCodeSpan(source, index)
      if (span !== null) {
        flush()
        nodes.push({ type: 'codeSpan', value: span.value })
        index = span.end
        continue
      }
      const run = runLengthAt(source, index, '`')
      buffer += source.slice(index, index + run)
      index += run
      continue
    }

    // Images are outside the subset. Consuming the whole construct is what
    // keeps an image from degrading into a stray `!` beside a working link.
    if (linkable && char === '!' && source[index + 1] === '[') {
      const link = matchLink(source, index + 1)
      if (link !== null) {
        buffer += source.slice(index, link.end)
        index = link.end
        continue
      }
      buffer += char
      index += 1
      continue
    }

    if (linkable && char === '[') {
      const link = matchLink(source, index)
      if (link !== null) {
        const href = safeHref(link.destination)
        if (href !== null) {
          flush()
          nodes.push({
            type: 'link',
            href,
            children: parseInline(link.label, false),
          })
        } else {
          // A refused scheme is not an error and not an empty anchor: it is the
          // characters the author typed.
          buffer += source.slice(index, link.end)
        }
        index = link.end
        continue
      }
      buffer += char
      index += 1
      continue
    }

    if (char === '*' || char === '_') {
      const emphasis = matchEmphasis(source, index, char)
      if (emphasis !== null) {
        flush()
        nodes.push({
          type: emphasis.strong ? 'strong' : 'emphasis',
          children: parseInline(emphasis.inner, linkable),
        })
        index = emphasis.end
        continue
      }
      const run = runLengthAt(source, index, char)
      buffer += source.slice(index, index + run)
      index += run
      continue
    }

    buffer += char
    index += 1
  }

  flush()
  return nodes
}

function runLengthAt(source: string, index: number, marker: string): number {
  let length = 0
  while (source[index + length] === marker) length += 1
  return length
}

function matchCodeSpan(
  source: string,
  start: number,
): { value: string; end: number } | null {
  const open = runLengthAt(source, start, '`')
  let index = start + open

  while (index < source.length) {
    const next = source.indexOf('`', index)
    if (next === -1) return null
    const run = runLengthAt(source, next, '`')
    if (run === open) {
      const raw = source.slice(start + open, next).replace(/\n/g, ' ')
      return { value: stripPadding(raw), end: next + run }
    }
    index = next + run
  }

  return null
}

/**
 * CommonMark strips one space from each end of a code span when both are there
 * and something is left between them, which is how a backtick is written as a
 * code span of its own.
 */
function stripPadding(value: string): string {
  const padded =
    value.startsWith(' ') && value.endsWith(' ') && value.trim() !== ''
  return padded ? value.slice(1, -1) : value
}

/**
 * Emphasis by delimiter runs rather than by a delimiter stack.
 *
 * A `**` opens strong and closes on the last two characters of the next run of
 * two or more, which is what lets a triple marker read as strong wrapping
 * emphasis. A single marker opens emphasis and closes on the next run of odd
 * length, which is what keeps the inner `**` of `*a **b** c*` out of the way.
 */
function matchEmphasis(
  source: string,
  start: number,
  marker: string,
): { inner: string; end: number; strong: boolean } | null {
  const run = runLengthAt(source, start, marker)
  const strong = run >= 2
  const openLength = strong ? 2 : 1
  const contentStart = start + openLength

  // An opener may not be followed by whitespace, or `a * b * c` becomes emphasis.
  if (contentStart >= source.length) return null
  if (WHITESPACE.test(source[contentStart])) return null
  // `_` never opens inside a word, which is what leaves `snake_case_name` alone.
  if (marker === '_' && isAlphanumeric(source[start - 1])) return null

  let index = contentStart
  while (index < source.length) {
    const next = source.indexOf(marker, index)
    if (next === -1) return null
    const length = runLengthAt(source, next, marker)
    const qualifies = strong ? length >= 2 : length % 2 === 1
    const closeStart = strong ? next + length - 2 : next
    const before = source[closeStart - 1]

    if (
      qualifies &&
      // Strictly greater: an empty run like `****` is literal, not emphasis
      // wrapped around nothing.
      closeStart > contentStart &&
      !WHITESPACE.test(before) &&
      !(marker === '_' && isAlphanumeric(source[next + length]))
    ) {
      return {
        inner: source.slice(contentStart, closeStart),
        end: closeStart + openLength,
        strong,
      }
    }
    index = next + length
  }

  return null
}

function isAlphanumeric(char: string | undefined): boolean {
  return char !== undefined && ALPHANUMERIC.test(char)
}

/**
 * Match `[label](destination)` from the `[`.
 *
 * Returns `null` for anything else — a reference link, a shortcut link, a bare
 * `[` — which is what leaves those forms as literal characters.
 */
function matchLink(
  source: string,
  start: number,
): { label: string; destination: string; end: number } | null {
  // A body of nothing but `[` would otherwise be scanned to the end once per
  // bracket. One native search says there is no closer at all.
  if (source.indexOf(']', start) === -1) return null

  let depth = 0
  let index = start

  while (index < source.length) {
    const char = source[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === '[') depth += 1
    if (char === ']') {
      depth -= 1
      if (depth === 0) break
    }
    index += 1
  }

  if (depth !== 0 || source[index] !== ']' || source[index + 1] !== '(') {
    return null
  }

  const label = source.slice(start + 1, index)
  let cursor = index + 2
  while (LINK_SPACE.test(source[cursor] ?? '')) cursor += 1

  let destination = ''
  if (source[cursor] === '<') {
    const close = source.indexOf('>', cursor + 1)
    if (close === -1) return null
    destination = source.slice(cursor + 1, close)
    cursor = close + 1
  } else {
    let parens = 0
    while (cursor < source.length) {
      const char = source[cursor]
      if (char === '\\' && cursor + 1 < source.length) {
        destination += source[cursor + 1]
        cursor += 2
        continue
      }
      if (LINK_SPACE.test(char)) break
      if (char === '(') parens += 1
      if (char === ')') {
        if (parens === 0) break
        parens -= 1
      }
      destination += char
      cursor += 1
    }
  }

  // An optional title, which the subset reads only in order to skip it.
  while (LINK_SPACE.test(source[cursor] ?? '')) cursor += 1
  const quote = source[cursor]
  if (quote === '"' || quote === "'") {
    const close = source.indexOf(quote, cursor + 1)
    if (close === -1) return null
    cursor = close + 1
    while (LINK_SPACE.test(source[cursor] ?? '')) cursor += 1
  }

  if (source[cursor] !== ')') return null
  return { label, destination, end: cursor + 1 }
}

/**
 * The scheme allow-list, applied before a destination can become an `href`.
 *
 * Control characters go before the test because a browser drops them too: a
 * check that reads `java&#9;script:` as an unknown scheme while the navigator
 * reads it as `javascript:` is the shape every one of these bypasses has had.
 * A destination with no scheme at all — a relative path, a bare fragment — is
 * refused for the same reason the allow-list exists: the subset only ever
 * links out.
 */
function safeHref(destination: string): string | null {
  const cleaned = destination.replace(NON_PRINTABLE, '')
  const colon = cleaned.indexOf(':')
  if (colon === -1) return null

  const scheme = cleaned.slice(0, colon + 1).toLowerCase()
  return LINK_SCHEMES.includes(scheme) ? cleaned : null
}
