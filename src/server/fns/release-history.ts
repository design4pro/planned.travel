import { createServerFn } from '@tanstack/react-start'
import { getSession } from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import { listReleaseHistory } from '#/server/repos/releases'
import {
  decodeReleaseCursor,
  encodeReleaseCursor,
  releaseHistoryInput,
} from './-lib/release-history'

/** ADR 0051 shared published projection. No tenant or publication selector crosses the wire. */
export const loadReleaseHistory = createServerFn({ method: 'GET' })
  .inputValidator(releaseHistoryInput)
  .handler(async ({ data }) => {
    const session = await getSession()
    const page = await listReleaseHistory(getDb(), session, {
      locale: data.locale,
      limit: data.limit,
      ...(data.cursor ? { cursor: decodeReleaseCursor(data.cursor) } : {}),
    })
    return {
      items: page.items,
      nextCursor: page.nextCursor ? encodeReleaseCursor(page.nextCursor) : null,
    }
  })
