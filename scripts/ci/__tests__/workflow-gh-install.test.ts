import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * One rule, asserted over every workflow rather than over a list of them: a job that reaches `gh`
 * installs it first.
 *
 * CODE_REVIEW.md states it in prose - a job moved to another runner has every tool it calls
 * installed by a step rather than assumed from the image - and ADR 0026 moved every one of these
 * onto an image nobody here controls. The prose held for two of the three workflows that reach
 * `gh`: `promote-develop.yml` and `claude-code-review.yml` got `scripts/ci/ensure-gh.sh`, and
 * `rearm-review-threads.yml` was missed, because the reach is indirect there - it runs
 * `review-threads-label.mjs`, and the script is what shells out to `gh`.
 *
 * So the reach is derived rather than listed. A workflow reaches `gh` when a `run:` block calls it
 * directly, or when it runs a `scripts/ci` script that does; a fourth instance added later is
 * caught by the same walk, which is the whole point of not hard-coding the three.
 *
 * @see scripts/ci/ensure-gh.sh
 * @see CODE_REVIEW.md, "A job moved to another runner is proven there"
 */
const root = resolve(__dirname, '../../..')
const workflowsDir = resolve(root, '.github/workflows')
const scriptsDir = resolve(root, 'scripts/ci')

/**
 * The file with its comment lines removed. Every detection below is about what a job *runs*, and a
 * comment naming `gh` - of which these workflows have many, this rule being what they explain - is
 * not that.
 */
const withoutComments = (source: string): string =>
  source
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')

/**
 * `gh` in command position. The subcommand list is deliberate rather than a bare `gh\s`: `gh` is
 * two common letters, and matching them loose enough to catch every future subcommand also catches
 * them inside words and paths. A subcommand this misses fails open, which a test that cannot be
 * trusted to fail closed would not be worth having.
 */
const GH_COMMAND =
  /(?:^|[\s;&|(])gh\s+(?:api|auth|issue|label|pr|release|repo|run|search|workflow)\b/m

/**
 * `gh` as a child process. A script does not shell out in the shape `GH_COMMAND` matches: it names
 * the binary as the first argument to `execFileSync` and friends, and the subcommand travels in an
 * array beside it.
 */
const GH_CHILD_PROCESS = /(?:exec|execFile|spawn)(?:Sync)?\(\s*['"]gh['"]/m

/** The `scripts/ci` scripts that reach `gh` themselves, by name as a workflow would invoke them. */
const scriptsReachingGh = readdirSync(scriptsDir)
  .filter((name) => name.endsWith('.mjs'))
  .filter((name) => {
    const source = withoutComments(
      readFileSync(resolve(scriptsDir, name), 'utf8'),
    )
    return GH_COMMAND.test(source) || GH_CHILD_PROCESS.test(source)
  })

const workflows = readdirSync(workflowsDir).filter((name) =>
  name.endsWith('.yml'),
)

describe('every workflow that reaches gh installs it', () => {
  // A guard on the guard: the derivation above walks two directories, and an empty result would
  // make every assertion below vacuously true. `review-threads-label.mjs` is the script the rule
  // was missed on, so its presence is what proves the walk still sees anything at all.
  it('finds the scripts that shell out to gh', () => {
    expect(scriptsReachingGh).toContain('review-threads-label.mjs')
  })

  it.each(workflows)('%s', (name) => {
    const source = withoutComments(
      readFileSync(resolve(workflowsDir, name), 'utf8'),
    )

    const direct = source.match(GH_COMMAND)
    const viaScript = scriptsReachingGh
      .map((script) =>
        source.match(new RegExp(`^.*\\b${script.replace('.', '\\.')}.*$`, 'm')),
      )
      .find((match) => match !== null)
    const reach = direct ?? viaScript
    if (!reach) return

    const install = source.indexOf('ensure-gh.sh')
    expect(
      install,
      `${name} reaches gh at "${reach[0].trim()}" and never runs scripts/ci/ensure-gh.sh`,
    ).toBeGreaterThan(-1)

    // Installing it after the call that needs it would satisfy the line above and nothing else.
    expect(
      install,
      `${name} runs scripts/ci/ensure-gh.sh after "${reach[0].trim()}", not before it`,
    ).toBeLessThan(reach.index!)
  })
})
