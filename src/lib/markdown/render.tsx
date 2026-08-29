import * as React from 'react'

import { cn } from '#/lib/cn'
import { parse } from './parse'

import type {
  MarkdownAlign,
  MarkdownBlock,
  MarkdownInline,
  MarkdownTableRow,
} from './parse'

export interface MarkdownProps {
  /** The author's raw text. Parsed here, memoised on the string. */
  readonly text: string
  readonly className?: string
}

const linkClasses = [
  'text-brand underline underline-offset-2 hover:text-brand-hover',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
  'rounded-xs',
].join(' ')

/**
 * `--color-surface-inset` carries its own dark value in `tokens.css`, so the
 * code surface is declared in both themes rather than inverted from the light
 * one — which is what keeps a fenced block from turning into the one bright
 * rectangle on a dark page.
 */
const codeSurface = 'rounded-sm bg-surface-inset'

/**
 * Physical alignment in, logical alignment out: a table written in an RTL
 * locale reads from the same side the rest of that page does.
 */
const alignClasses: Record<NonNullable<MarkdownAlign>, string> = {
  left: 'text-start',
  center: 'text-center',
  right: 'text-end',
}

/**
 * Tag and treatment together, because the subset's three levels are three
 * fixed elements rather than a number interpolated into a tag name.
 */
const headings = {
  1: { tag: 'h1', className: 'text-subtitle font-semibold text-ink' },
  2: { tag: 'h2', className: 'text-body font-semibold text-ink' },
  3: { tag: 'h3', className: 'text-label font-semibold text-ink' },
} as const

/**
 * The restricted subset as React elements.
 *
 * There is no `dangerouslySetInnerHTML` here and there cannot be one: the tree
 * {@link parse} returns carries no markup, only text and structure, so every
 * character an author typed reaches the DOM through React's own escaping. A
 * body made entirely of tags renders as the characters of those tags — which is
 * what `render.test.tsx` asserts by looking for the elements they would
 * otherwise have produced.
 *
 * Styled from tokens only, and sized to sit *inside* a surface that already
 * owns the page's headings: the largest heading here is a subtitle, not a
 * title, so a note's prose never outranks the day it belongs to.
 *
 * The focus ring is stated rather than imported. `src/components/ui/shared.ts`
 * owns the same three classes, and every component takes them from there, but
 * this module sits under `src/lib/` — below the component layer, which imports
 * `src/lib/` freely — and reaching upward would close that loop. `focusRing`
 * there carries the reason `outline-solid` is load-bearing; a change to one copy
 * belongs in the other.
 */
export function Markdown({
  text,
  className,
}: MarkdownProps): React.JSX.Element | null {
  const blocks = React.useMemo(() => parse(text), [text])
  // Nothing to say renders as nothing: a note with no detail stays one line
  // tall rather than growing an empty prose block under its headline.
  if (blocks.length === 0) return null

  return (
    <div
      className={cn(
        'text-body wrap-anywhere text-ink-2 [&>*+*]:mt-3',
        className,
      )}
    >
      {blocks.map((block, index) => (
        <Block key={index} node={block} />
      ))}
    </div>
  )
}

function Block({ node }: { node: MarkdownBlock }): React.JSX.Element {
  switch (node.type) {
    case 'paragraph':
      return (
        <p>
          <Inlines nodes={node.children} />
        </p>
      )

    case 'heading': {
      const { tag: Tag, className } = headings[node.level]
      return (
        <Tag className={className}>
          <Inlines nodes={node.children} />
        </Tag>
      )
    }

    case 'list': {
      const items = node.items.map((item, index) => (
        <li key={index}>
          <Inlines nodes={item} />
        </li>
      ))
      return node.ordered ? (
        <ol className="ms-1 list-decimal space-y-1 ps-4" start={node.start}>
          {items}
        </ol>
      ) : (
        <ul className="ms-1 list-disc space-y-1 ps-4">{items}</ul>
      )
    }

    case 'code':
      return (
        <pre
          className={cn(codeSurface, 'overflow-x-auto p-3')}
          data-language={node.language ?? undefined}
        >
          <code className="font-mono text-caption text-ink-2">
            {node.value}
          </code>
        </pre>
      )

    case 'quote':
      return (
        <blockquote className="border-s-2 border-ink-3 ps-3 [&>*+*]:mt-2">
          {node.children.map((child, index) => (
            <Block key={index} node={child} />
          ))}
        </blockquote>
      )

    case 'thematicBreak':
      return <hr className="h-px border-0 bg-edge" />

    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-caption">
            <thead>
              <Row row={node.header} align={node.align} head />
            </thead>
            <tbody>
              {node.rows.map((row, index) => (
                <Row key={index} row={row} align={node.align} />
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

function Row({
  row,
  align,
  head = false,
}: {
  row: MarkdownTableRow
  align: ReadonlyArray<MarkdownAlign>
  head?: boolean
}): React.JSX.Element {
  return (
    <tr>
      {row.map((cell, index) => {
        const alignment = align[index]
        const classes = cn(
          'px-2 py-1.5 text-start',
          head
            ? 'border-b border-edge font-semibold text-ink'
            : 'border-b border-edge-faint',
          alignment === null ? undefined : alignClasses[alignment],
        )
        return head ? (
          <th key={index} className={classes} scope="col">
            <Inlines nodes={cell} />
          </th>
        ) : (
          <td key={index} className={classes}>
            <Inlines nodes={cell} />
          </td>
        )
      })}
    </tr>
  )
}

function Inlines({
  nodes,
}: {
  nodes: ReadonlyArray<MarkdownInline>
}): React.JSX.Element {
  return (
    <>
      {nodes.map((node, index) => (
        <Inline key={index} node={node} />
      ))}
    </>
  )
}

function Inline({ node }: { node: MarkdownInline }): React.JSX.Element {
  switch (node.type) {
    case 'text':
      return <>{node.value}</>

    case 'emphasis':
      return (
        <em>
          <Inlines nodes={node.children} />
        </em>
      )

    case 'strong':
      return (
        <strong className="font-semibold text-ink">
          <Inlines nodes={node.children} />
        </strong>
      )

    case 'codeSpan':
      return (
        <code className={cn(codeSurface, 'px-1 py-0.5 font-mono text-caption')}>
          {node.value}
        </code>
      )

    case 'hardBreak':
      return <br />

    case 'link':
      return (
        <a
          className={linkClasses}
          href={node.href}
          rel="noreferrer noopener"
          target="_blank"
        >
          <Inlines nodes={node.children} />
        </a>
      )
  }
}
