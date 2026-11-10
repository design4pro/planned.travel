import { releaseBodySchema } from './collections'
import type { ReleaseBody } from './collections'
import type { Locale } from '#/lib/i18n/locales'

/** Resolve the entire exact-version body; never mix paragraphs from different revisions. */
export function resolveReleaseContent(
  source: ReleaseBody,
  locale: Locale,
  translation: {
    body: ReleaseBody
    reviewedAt: Date | null
    reviewAuditId: string | null
  } | null,
) {
  const translated =
    locale !== 'en' &&
    translation?.reviewedAt != null &&
    translation.reviewAuditId != null
  return {
    ...releaseBodySchema.parse(translated ? translation.body : source),
    contentLocale: translated ? locale : 'en',
    sourceLocale: 'en' as const,
    usedFallback: locale !== 'en' && !translated,
  }
}
