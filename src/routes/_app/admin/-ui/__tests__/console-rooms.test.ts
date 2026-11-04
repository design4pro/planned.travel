import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = 'src/routes/_app/admin'

describe('workspace console rooms', () => {
  it('has independently addressable rooms behind the parent gate', () => {
    for (const file of ['route.tsx', 'index.tsx', 'members.tsx', 'audit.tsx']) {
      expect(existsSync(`${root}/${file}`), file).toBe(true)
    }
    const parent = readFileSync(`${root}/route.tsx`, 'utf8')
    expect(parent).toContain('loadAdmin()')
    expect(parent).toContain('Outlet')
  })
})
