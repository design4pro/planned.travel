/** Restricted, lossless display projection. The exact Git commit retains all provenance. */
import { validateReleaseProse } from './prose'
import { releaseBodySchema, releaseVersionSchema } from './collections'

export const MAX_CHANGELOG_BYTES = 1_000_000

export class ReleaseSourceError extends Error {
  constructor(
    readonly line: number,
    readonly column: number,
    reason: string,
  ) {
    super(`CHANGELOG.md:${line}:${column}: ${reason}`)
  }
}

export function parseReleaseSource(markdown: string, version: string) {
  releaseVersionSchema.parse(version)
  const fail = (line: number, reason: string): never => {
    throw new ReleaseSourceError(line + 1, 1, reason)
  }
  if (new TextEncoder().encode(markdown).length > MAX_CHANGELOG_BYTES)
    fail(0, 'Source exceeds 1000000 bytes.')
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const headings = lines.flatMap((line, i) => {
    const match = /^# (\d+\.\d+\.\d+) \((\d{4}-\d{2}-\d{2})\)$/.exec(line)
    return match ? [{ index: i, version: match[1], date: match[2] }] : []
  })
  const matches = headings.filter((heading) => heading.version === version)
  if (matches.length !== 1) fail(0, 'Expected exactly one release heading.')
  const heading = matches[0]
  const end =
    headings.find((item) => item.index > heading.index)?.index ?? lines.length
  if (
    !Number.isFinite(Date.parse(heading.date)) ||
    new Date(heading.date).toISOString().slice(0, 10) !== heading.date
  )
    fail(heading.index, 'Invalid heading date.')
  const body = {
    title: version,
    summary: [] as string[],
    features: [] as string[],
    fixes: [] as string[],
  }
  const provenance: string[] = []
  let section: 'summary' | 'features' | 'fixes' | 'provenance' | null = null
  const seen = new Set<string>()
  let paragraph: string[] = []
  let cutoffRef: string | null = null
  const flush = () => {
    if (paragraph.length) body.summary.push(paragraph.join(' '))
    paragraph = []
  }
  for (let i = heading.index + 1; i < end; i++) {
    const line = lines[i]
    const cutoff =
      /^<!-- changelog-cutoff: ([a-f0-9]{7,40}) -->$/.exec(line) ??
      /^> \*\*Cutoff: `([a-f0-9]{7,40})`(?: \([^\n]*\))?\*\*$/.exec(line)
    if (cutoff) {
      flush()
      if (cutoffRef) fail(i, 'Ambiguous cutoff.')
      cutoffRef = cutoff[1]
      provenance.push(line)
      section = 'provenance'
      continue
    }
    if (line.startsWith('## ')) {
      flush()
      const sections: Record<
        string,
        'summary' | 'features' | 'fixes' | 'provenance'
      > = {
        '## Highlights': 'summary',
        '## ✨ Features': 'features',
        '## Features': 'features',
        '## 🐛 Fixes': 'fixes',
        '## Fixes': 'fixes',
        '## 👥 Contributors': 'provenance',
        '## Contributors': 'provenance',
      }
      const next = sections[line]
      if (!next || seen.has(next)) fail(i, 'Unsupported or duplicate section.')
      seen.add(next)
      section = next
      if (next === 'provenance') provenance.push(line)
      continue
    }
    if (section === 'provenance') {
      if (line !== '' && !/^- @[A-Za-z0-9-]+$/.test(line))
        fail(
          i,
          'Unsupported provenance. Correct historical source in Git before import.',
        )
      provenance.push(line)
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    if (section === null) fail(i, 'Expected a supported section.')
    if (/^\s|^[>#]|^[-*+]\s/.test(line) && section === 'summary')
      fail(i, 'Highlights accepts plain paragraphs only.')
    let text = line
    if (section === 'features' || section === 'fixes') {
      if (!line.startsWith('- '))
        fail(i, 'Expected a flat unordered list item.')
      text = line.slice(2)
      const credit = / \*\(@[A-Za-z0-9-]+(?:, via @[A-Za-z0-9-]+)?\)\*$/.exec(
        text,
      )
      if (credit) {
        provenance.push(credit[0].trim())
        text = text.slice(0, -credit[0].length)
      }
      // PR references are provenance, not editorial display content.
      const references = / \(#\d+(?:, #\d+)*\)$/.exec(text)
      if (references) {
        provenance.push(references[0].trim())
        text = text.slice(0, -references[0].length)
      }
    }
    if (!validateReleaseProse(text))
      fail(
        i,
        'Unsafe or unsupported prose; explicit safe Git correction required.',
      )
    if (section === 'summary') paragraph.push(text)
    else if (section === 'features' || section === 'fixes')
      body[section].push(text)
  }
  flush()
  if (!cutoffRef) return fail(heading.index, 'Missing cutoff provenance.')
  const parsed = releaseBodySchema.safeParse(body)
  if (!parsed.success)
    return fail(heading.index, 'Release body exceeds bounded content limits.')
  return {
    version,
    headingDate: heading.date,
    cutoffRef,
    body: parsed.data,
    provenance,
  }
}
