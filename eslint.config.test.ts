import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * The ignore list in `eslint.config.js` is the only thing keeping `pnpm lint` runnable while an
 * agent run is in flight. Every path it names is gitignored scratch that belongs to no tsconfig,
 * so the typed parser reports each file in it as a project-membership error and the whole gate
 * goes red for a reason that has nothing to do with the change under test.
 *
 * Its failure mode is silence: nothing anywhere notices a missing entry until someone exercises
 * the tool that writes the directory, and then the gate fails on files nobody wrote.
 */
const eslint = new ESLint()

/** `isPathIgnored` resolves the flat config for a path; the file need not exist on disk. */
const ignored = (path: string) => eslint.isPathIgnored(path)

describe('eslint.config.js ignore list', () => {
  it('ignores the scratch directories an agent run writes while it is in flight', async () => {
    // `om-auto-qa-pr` writes both of these by instruction (`.ai/browsers/playwright.md`), under a
    // per-run directory whose name it chooses - hence the glob rather than a fixed path.
    await expect(
      ignored('.ai/qa/artifacts_1234/copy-trip.qa.spec.ts'),
    ).resolves.toBe(true)
    await expect(ignored('.ai/qa/artifacts_1234/qa.config.ts')).resolves.toBe(
      true,
    )
    await expect(
      ignored('.ai/tmp/om-auto-fix-pr/1234/prettier.config.js'),
    ).resolves.toBe(true)
    await expect(
      ignored('.ai/cezar/tmp/transform-cache/entry.ts'),
    ).resolves.toBe(true)
  })

  it('keeps linting application source, so the ignores stay scoped rather than blanket', async () => {
    await expect(ignored('src/routes/index.tsx')).resolves.toBe(false)
    await expect(ignored('src/server/repos/trips.ts')).resolves.toBe(false)
    // A sibling of the QA scratch, one level up: only the per-run artifacts directories are out.
    await expect(ignored('.ai/scripts/__tests__/config.test.ts')).resolves.toBe(
      false,
    )
  })
})
