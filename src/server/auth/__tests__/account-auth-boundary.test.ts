import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..', '..', '..', '..')
const sources = readdirSync(join(root, 'src'), { recursive: true })
  .filter(
    (name): name is string =>
      typeof name === 'string' &&
      /\.[cm]?[jt]sx?$/.test(name) &&
      !name.includes('__tests__'),
  )
  .map((name) => [name, readFileSync(join(root, 'src', name), 'utf8')] as const)

function importers(specifier: string) {
  return sources
    .filter(([, text]) => text.includes(specifier))
    .map(([name]) => name)
    .sort()
}

describe('the closed account-auth capability boundary', () => {
  it('has exactly the approved repository callers and no tenant schema access', () => {
    expect(importers("from '#/server/repos/account-security'")).toEqual([
      'server/auth/account-authority.ts',
      'server/auth/account-security-cleanup.ts',
      'server/auth/factor-management.ts',
    ])
    const repository = readFileSync(
      join(root, 'src/server/repos/account-security.ts'),
      'utf8',
    )
    expect(repository.includes("from '#/server/db/schema'")).toBe(false)
    expect(
      /\b(?:from|join|into|update)\s+(?:member|organization|trips)\b/i.test(
        repository,
      ),
    ).toBe(false)
  })

  it('mints account capabilities in the auth boundary only', () => {
    expect(importers('accountScopeBrand')).toEqual([
      'server/auth/account-authority-lib/scope.ts',
      'server/auth/account-authority.ts',
    ])
  })

  it('pins system acknowledgements and deletion recovery to their approved callers', () => {
    expect(
      importers('acknowledgeAccountRoomEviction').filter(
        (name) => name !== 'server/auth/account-authority.ts',
      ),
    ).toEqual(['server/queue/handlers/trip-room-evict.ts'])
    expect(
      importers('recoverAccountDeletions').filter(
        (name) => name !== 'server/auth/account-authority.ts',
      ),
    ).toEqual(['server/auth/account-security-scheduled.ts'])
  })
})
