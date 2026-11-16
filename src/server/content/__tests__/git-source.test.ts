import { expect, it } from 'vitest'
import { parseReleaseSource } from '../git-source'

import { markdown } from './fixtures'

it('preserves the heading and separate provenance without displaying attribution', () => {
  expect(parseReleaseSource(markdown, '1.2.0')).toEqual({
    version: '1.2.0',
    headingDate: '2026-11-01',
    cutoffRef: 'a'.repeat(40),
    body: {
      title: '1.2.0',
      summary: ['Plan a **better** trip with [help](/help).'],
      features: ['Save a place.'],
      fixes: ['Keep your plans.'],
    },
    provenance: [
      '*(@contributor)*',
      '## Contributors',
      '',
      '- @contributor',
      '',
      '<!-- changelog-cutoff: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -->',
      '',
    ],
  })
})

it.each([
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '[bad](javascript:alert)',
  '[bad](//evil.test)',
  '![image](https://evil.test/x)',
  '[bad](https://user:password@example.test)',
  '  - Nested',
  '> A hidden paragraph',
  '## Unknown',
  'Raw customer@example.test',
  'workspace_id=private',
])('refuses unsupported or sensitive source with a location: %s', (line) => {
  expect(() =>
    parseReleaseSource(
      markdown.replace('Plan a **better** trip with [help](/help).', line),
      '1.2.0',
    ),
  ).toThrow(/CHANGELOG.md:7:/)
})

it('refuses unknown paragraphs in lists instead of dropping them', () => {
  expect(() =>
    parseReleaseSource(
      markdown.replace('- Keep your plans.', 'A paragraph outside Highlights.'),
      '1.2.0',
    ),
  ).toThrow(/CHANGELOG.md:15:/)
})

it('refuses duplicate headings, ambiguous cutoff, oversized source and invalid dates', () => {
  expect(() => parseReleaseSource(markdown + markdown, '1.2.0')).toThrow()
  expect(() =>
    parseReleaseSource(markdown.replace('2026-11-01', '2026-02-30'), '1.2.0'),
  ).toThrow()
  expect(() => parseReleaseSource(markdown.repeat(20000), '1.2.0')).toThrow()
  expect(() =>
    parseReleaseSource(
      markdown.replace('<!-- changelog-cutoff:', '<!-- unknown:'),
      '1.2.0',
    ),
  ).toThrow()
})
