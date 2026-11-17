import { execFile } from 'node:child_process'
import { basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)

// The process reading the files owns the kernel lease. Parsing only uses the
// returned snapshot, so a separate lock-holder cannot die midway through reads.
export async function discoverProjectSkills(repoRoot, parseFrontmatter) {
  const { stdout } = await exec(
    'python3',
    [
      fileURLToPath(new URL('./skills-auto-update.py', import.meta.url)),
      'catalog',
      '--repo',
      repoRoot,
    ],
    {
      timeout: 30_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  )
  const skills = new Map()
  for (const { path, raw } of JSON.parse(stdout)) {
    const { frontmatter, body } = parseFrontmatter(raw)
    const name =
      typeof frontmatter.name === 'string' && frontmatter.name.trim()
        ? frontmatter.name.trim()
        : basename(dirname(path))
    if (!skills.has(name))
      skills.set(name, {
        name,
        body,
        path,
        source: 'agents',
        description:
          typeof frontmatter.description === 'string'
            ? frontmatter.description
            : undefined,
        interactive:
          frontmatter.interactive === true || frontmatter.interactive === 'true'
            ? true
            : undefined,
      })
  }
  return [...skills.values()].sort((a, b) => a.name.localeCompare(b.name))
}
