import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * The ignore list in `eslint.config.js` is the only thing keeping `pnpm lint` runnable while an
 * agent run is in flight. Every path it names is gitignored scratch that belongs to no tsconfig,
 * so the typed parser reports each file in it as a project-membership error and the whole gate
 * goes red for a reason that has nothing to do with the change under test.
 *
 * Its failure mode is silence, in both directions: nothing notices a missing entry until someone
 * exercises the tool that writes the directory, and nothing notices an entry that grew too wide
 * until a real error goes unreported. So each case below pins a boundary rather than a path.
 *
 * The answers are collected in `beforeAll` rather than asked for per case, because the first one
 * costs about four seconds: resolving the flat config means evaluating `eslint.config.js`, which
 * pulls in `@tanstack/eslint-config` and all of `typescript-eslint` behind it. Paid once, off the
 * clock of any single case, it is the difference between this file being cheap and this file
 * timing out at the default five seconds and taking a worker's neighbours down with it.
 *
 * `cwd` is pinned to this file's own directory - the one holding `eslint.config.js` - because
 * every path asserted here is relative. A `root` on the vitest project, or a run started from a
 * subdirectory, would otherwise either fail to find the config or resolve those paths against
 * somewhere else and answer confidently about nothing.
 */
const PATHS = [
  // The QA round's throwaway spec and the per-run config driving it, both written by instruction
  // (`.ai/browsers/playwright.md`) into a directory named for the run - hence the glob. The run
  // id is `$(date -u +%Y%m%d-%H%M%S)-$$`, which is the shape used here.
  '.ai/qa/artifacts_20260909-231500-9999/copy-trip.qa.spec.ts',
  '.ai/qa/artifacts_20260909-231500-9999/qa.config.ts',
  '.ai/tmp/om-auto-fix-pr/1234/prettier.config.js',
  '.ai/cezar/tmp/transform-cache/entry.ts',
  '.claude/hooks/__tests__/hooks.test.ts',
  '.claude/hooks/guard-read.ts',
  'src/routes/index.tsx',
  'src/server/repos/trips.ts',
  '.ai/qa/playwright.config.ts',
  '.ai/scripts/__tests__/cezar-config.test.ts',
] as const

const ignored = new Map<string, boolean>()

beforeAll(async () => {
  const eslint = new ESLint({
    cwd: fileURLToPath(new URL('.', import.meta.url)),
  })
  for (const path of PATHS) ignored.set(path, await eslint.isPathIgnored(path))
}, 60_000)

/**
 * Reads a collected answer. A path missing from `PATHS` reads as `undefined`, which `toBe` -
 * `Object.is` - refuses against both `true` and `false`, so it fails the case either way rather
 * than passing one direction by accident. The parameter type refuses it a step earlier, at
 * `pnpm typecheck`.
 */
const wasIgnored = (path: (typeof PATHS)[number]) => ignored.get(path)

describe('eslint.config.js ignore list', () => {
  it('ignores the scratch directories an agent run writes while it is in flight', () => {
    expect(
      wasIgnored('.ai/qa/artifacts_20260909-231500-9999/copy-trip.qa.spec.ts'),
    ).toBe(true)
    expect(
      wasIgnored('.ai/qa/artifacts_20260909-231500-9999/qa.config.ts'),
    ).toBe(true)
    expect(wasIgnored('.ai/tmp/om-auto-fix-pr/1234/prettier.config.js')).toBe(
      true,
    )
    expect(wasIgnored('.ai/cezar/tmp/transform-cache/entry.ts')).toBe(true)
  })

  it('re-includes the hook tests, which the list can only do one directory at a time', () => {
    // The list's one fragile entry, and the only one whose own comment records having broken
    // silently: these are gitignore semantics, so a path inside an excluded *directory* can never
    // be re-included, and the shorter `.claude/**` plus a negation left the tests below unlinted
    // while saying nothing. The four-step ladder is what re-includes them, and this is what says
    // so if anyone shortens it back.
    expect(wasIgnored('.claude/hooks/__tests__/hooks.test.ts')).toBe(false)
    // The other side of the same ladder. A hypothetical path: the hooks themselves are shell
    // today, and a `.sh` would answer `true` merely for matching no config at all.
    expect(wasIgnored('.claude/hooks/guard-read.ts')).toBe(true)
  })

  it('keeps linting application source, so the ignores stay scoped rather than blanket', () => {
    expect(wasIgnored('src/routes/index.tsx')).toBe(false)
    expect(wasIgnored('src/server/repos/trips.ts')).toBe(false)
    // The QA directory itself, one level up from the per-run scratch: only the `artifacts_*`
    // directories are out, so widening that entry to `.ai/qa/**` fails here. This is also where
    // the browser descriptor puts the shared config it writes for a repo owning no Playwright
    // config - not the case here, but the entry should not cover it either way.
    expect(wasIgnored('.ai/qa/playwright.config.ts')).toBe(false)
    expect(wasIgnored('.ai/scripts/__tests__/cezar-config.test.ts')).toBe(false)
  })
})
