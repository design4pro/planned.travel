import { describe, expect, it, vi } from 'vitest'
import {
  registerCollectionExit,
  requestCollectionExit,
} from '../collection-exit'

describe('collection context exits', () => {
  it('asks the mounted editor before allowing a session mutation and releases it on unmount', async () => {
    const confirm = vi.fn().mockResolvedValue(false)
    const release = registerCollectionExit(confirm)
    expect(await requestCollectionExit()).toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
    release()
    expect(await requestCollectionExit()).toBe(true)
  })
})
