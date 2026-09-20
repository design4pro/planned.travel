import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * The spec index has to regenerate wherever it is asked to, including inside an agent worktree.
 *
 * `tsx`'s command-line entrypoint binds a unix domain socket for the IPC channel between its CLI
 * process and the loader it injects, and it puts that socket under `$TMPDIR`
 * (`$TMPDIR/tsx-<uid>/<pid>.pipe`). A unix socket path is bounded by `sun_path` - 104 bytes on
 * macOS, 108 on Linux - so a deep `$TMPDIR` makes `listen()` fail with `EINVAL` before the
 * generator runs at all. Cezar gives each task a `$TMPDIR` nested under the repository
 * (`.ai/cezar/tmp/<task-uuid>`), which is already ~98 bytes on its own, so `pnpm
 * generate-spec-index` failed in every one of those runs - and with it `.ai/scripts/check-generated.sh`,
 * the fifth command of the validation gate, for a reason unrelated to the change under review.
 *
 * `node --import tsx` loads the same transform as a module hook in the single node process, so no
 * IPC channel and no socket exists to outgrow the limit. The fix therefore belongs in how the
 * generator is invoked, not in the `$TMPDIR` any one caller happens to set: overriding `TMPDIR`
 * around the call inside the gate script would leave every direct `pnpm generate-spec-index` still
 * broken.
 *
 * @see https://github.com/design4pro/planned.travel/issues/487
 */
describe('the generate-spec-index script', () => {
  const { scripts } = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
  ) as { scripts: Record<string, string> }

  it('runs the generator through node, not through the tsx CLI', () => {
    expect(scripts['generate-spec-index']).toBe(
      'node --import tsx scripts/specs/index.ts',
    )
  })
})
