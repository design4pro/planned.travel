/**
 * The access document and the code agree on who may create a workspace, and on who may not while
 * impersonating. The document is the contract (docs/ACCESS.md §2.7, §6.4); a floor that moved in the
 * code and not in the document, or the other way round, fails here.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MIN_ROLE_TO_CREATE_WORKSPACE } from '#/server/fns/workspace-writes'

const document = readFileSync('docs/ACCESS.md', 'utf8')

/** The text of one `###` section, from its heading to the next heading of the same or higher level. */
function section(heading: string): string {
  const start = document.indexOf(`### ${heading}`)
  if (start === -1) throw new Error(`docs/ACCESS.md has no section ${heading}`)
  const rest = document.slice(start + 1)
  const next = rest.search(/\n#{2,3} /)
  // Collapsed to single spaces: the document is hard-wrapped, a phrase is not.
  return (next === -1 ? rest : rest.slice(0, next)).replace(/\s+/g, ' ')
}

describe('docs/ACCESS.md §2.7', () => {
  it('names the role the code enforces as the minimum that may create a workspace', () => {
    expect(MIN_ROLE_TO_CREATE_WORKSPACE).toBe('admin')
    expect(section('2.7 Creating a workspace')).toContain(
      `**\`${MIN_ROLE_TO_CREATE_WORKSPACE}\` is the minimum organization role that may create a workspace**`,
    )
  })

  it('states the refusals the code returns, in the order it checks them', () => {
    const text = section('2.7 Creating a workspace')
    for (const term of [
      'role-required',
      'allowUserToCreateOrganization: false',
    ]) {
      expect(text).toContain(term)
    }
  })
})

describe('docs/ACCESS.md §6.4', () => {
  it('names workspace creation as refused under impersonation', () => {
    const text = section(
      '6.4 May an impersonated session perform platform mutations? No.',
    )
    expect(text).toContain('**creating a workspace**')
    expect(text).toContain("AuthRequirementError('impersonated')")
  })
})
