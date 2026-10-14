// State the agent tooling writes into the worktree while a run is going. A cezar autosave commit
// takes whatever is not ignored, so a file missing from `.gitignore` lands on the PR branch: the
// impeccable hook's cache was committed on the branches of #1004, #1076 and #1185 and deleted by hand
// each time. The check reads `.gitignore` itself rather than asking `git check-ignore`, because
// `.git/info/exclude` and the global excludes are per machine and would answer "ignored" here and
// "tracked" on the next clone.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const ignored = new Set(
  readFileSync(new URL('../../../.gitignore', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.trim()),
)

describe('agent run state is never committed', () => {
  it.each(['.impeccable/hook.cache.json', '.impeccable/hook.pending.json'])(
    'ignores %s',
    (path) => {
      expect(ignored.has(path)).toBe(true)
    },
  )

  it.each(['.impeccable/design.json', '.impeccable/config.json'])(
    'keeps %s tracked, it is project truth',
    (path) => {
      expect(ignored.has(path)).toBe(false)
    },
  )
})
