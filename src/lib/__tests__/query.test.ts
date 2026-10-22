import { describe, expect, it } from 'vitest'

import { encodePublicFailure } from '#/lib/errors'

import { isRetriableError } from '../query'
import { WORKSPACE_CHANGED_KEY } from '../workspace-claim'

describe('isRetriableError', () => {
  it("does not retry a call the session's workspace would refuse again", () => {
    const cause = new Error(
      encodePublicFailure({ kind: 'refusal', message: WORKSPACE_CHANGED_KEY }),
    )
    expect(isRetriableError(cause)).toBe(false)
  })

  it('still retries a failure with no status, as before', () => {
    expect(isRetriableError(new Error('network'))).toBe(true)
  })
})
