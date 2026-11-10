import { expect, it } from 'vitest'
import { resolveReleaseContent } from '../resolve'
import { releaseBodySchema } from '../collections'

const source = {
  title: 'Source',
  summary: ['English summary'],
  features: ['English feature'],
  fixes: ['English fix'],
}
const body = {
  title: 'Translation',
  summary: ['Translated summary'],
  features: [],
  fixes: [],
}
it('whitelists the entire reviewed exact-version body without leaking review metadata', () => {
  const result = resolveReleaseContent(source, 'ar', {
    body,
    reviewAuditId: 'restricted-reviewer',
    reviewedAt: new Date(),
  })
  expect(result).toEqual({
    ...body,
    contentLocale: 'ar',
    sourceLocale: 'en',
    usedFallback: false,
  })
})
it('falls back as a whole when translation is missing or unreviewed', () => {
  for (const translation of [
    null,
    { body, reviewAuditId: null, reviewedAt: null },
  ]) {
    expect(resolveReleaseContent(source, 'pl', translation)).toEqual({
      ...source,
      contentLocale: 'en',
      sourceLocale: 'en',
      usedFallback: true,
    })
  }
  expect(resolveReleaseContent(source, 'en', null).usedFallback).toBe(false)
})
it('refuses unbounded bodies and unsupported raw HTML at the content trust boundary', () => {
  expect(
    releaseBodySchema.safeParse({ ...source, title: 'x'.repeat(241) }).success,
  ).toBe(false)
  expect(
    releaseBodySchema.safeParse({
      ...source,
      summary: ['<script>alert(1)</script>'],
    }).success,
  ).toBe(false)
})
