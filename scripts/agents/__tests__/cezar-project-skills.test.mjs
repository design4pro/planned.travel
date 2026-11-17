import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { discoverProjectSkills } from '../cezar-project-skills.mjs'

const temporary = []
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  )
})
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cezar-catalog-'))
  temporary.push(root)
  return root
}
async function skill(root, path, body) {
  const target = join(root, path)
  await mkdir(join(target, '..'), { recursive: true })
  await writeFile(target, body)
}
function parse(body) {
  return { frontmatter: {}, body }
}

it('discovers only project SKILL.md entries, never legacy dirs or reference documents', async () => {
  const root = await fixture()
  await skill(root, '.agents/skills/local/SKILL.md', 'project')
  await skill(root, '.agents/skills/local/references/ignored.md', 'reference')
  await skill(root, '.agents/skills/plain.md', 'not a skill')
  await skill(root, '.claude/skills/legacy/SKILL.md', 'legacy')
  await skill(root, '.ai/skills/old/SKILL.md', 'old')
  const result = await discoverProjectSkills(root, parse)
  expect(result.map((s) => [s.name, s.body, s.source])).toEqual([
    ['local', 'project', 'agents'],
  ])
})

it('returns an empty catalog without a project skill installation', async () => {
  expect(await discoverProjectSkills(await fixture(), parse)).toEqual([])
})

it('rejects external directory and file links before parsing, including sibling prefixes', async () => {
  const root = await fixture()
  const outside = `${root}-outside`
  temporary.push(outside)
  await skill(outside, 'private/SKILL.md', 'external')
  await mkdir(join(root, '.agents/skills/file'), { recursive: true })
  await symlink(
    join(outside, 'private'),
    join(root, '.agents/skills/directory'),
  )
  await symlink(
    join(outside, 'private/SKILL.md'),
    join(root, '.agents/skills/file/SKILL.md'),
  )
  expect(
    await discoverProjectSkills(root, () => {
      throw new Error('Foreign skill was read')
    }),
  ).toEqual([])
})

it('rejects an external skill root and reads a worktree own copy', async () => {
  const root = await fixture()
  const worktree = await fixture()
  await skill(root, '.agents/skills/local/SKILL.md', 'primary')
  await mkdir(join(worktree, '.agents'), { recursive: true })
  await symlink(join(root, '.agents/skills'), join(worktree, '.agents/skills'))
  expect(await discoverProjectSkills(worktree, parse)).toEqual([])
  await rm(join(worktree, '.agents/skills'))
  await skill(worktree, '.agents/skills/local/SKILL.md', 'worktree')
  expect((await discoverProjectSkills(worktree, parse))[0].body).toBe(
    'worktree',
  )
})
