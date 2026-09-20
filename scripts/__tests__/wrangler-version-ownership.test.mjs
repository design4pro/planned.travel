/**
 * Who owns the wrangler version the shipping workflows run.
 *
 * Until #567 all three of them passed `wranglerVersion: '4.70.0'` to
 * `cloudflare/wrangler-action@v4`, under a comment asking that it be kept in step with the
 * `wrangler` devDependency in package.json. It was not: `4.70.0` is the floor of the `^4.70.0`
 * range declared there, and pnpm-lock.yaml resolves `4.124.0`.
 *
 * That gap was not cosmetic. The action compares an exact-semver input to the installed version
 * with string equality rather than range satisfaction, so the check was `'4.124.0' === '4.70.0'`,
 * it failed on every run, and the action installed `wrangler@4.70.0` into the checkout root. Every
 * production deploy, staging deploy and rollback shipped through a wrangler substantially older
 * than the one this repository typechecks and tests against, and paid a full dependency re-resolve
 * for the privilege - all of it silent, all of it behind a green run.
 *
 * The fix was to stop naming a version: unset, the action runs whatever `pnpm exec wrangler`
 * resolves, which makes pnpm-lock.yaml the single owner. These cases hold that open. Re-adding a
 * pin is the regression, whether it is stale like the last one or correct on the day it is written.
 *
 * Read as text, like the sibling workflow tests: the repository pins no YAML parser, and both
 * things asserted here are single lines.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WORKFLOWS = join(ROOT, '.github/workflows')

const read = (name) => readFileSync(join(WORKFLOWS, name), 'utf8')

/**
 * Every workflow that calls wrangler-action, discovered rather than listed. A hand-written list
 * exempts a fourth shipping workflow from this guard by omission, and does it silently - the one
 * way a test like this comes back green while covering less than it says.
 */
const SHIPPING_WORKFLOWS = readdirSync(WORKFLOWS).filter((name) =>
  read(name).includes('cloudflare/wrangler-action'),
)

/**
 * The `wranglerVersion:` inputs `workflow` sets. Anchored on the key at the start of a line so the
 * comments that explain the absence - which name the input - are not read as uses of it.
 */
function versionInputs(workflow) {
  return workflow.match(/^\s*wranglerVersion:.*$/gm) ?? []
}

describe('shipping workflows leave the wrangler version to the lockfile', () => {
  it('has workflows to guard', () => {
    // Discovery that matches nothing - a renamed directory, a moved action - would leave every
    // case below with no input and the suite green on zero coverage.
    expect(SHIPPING_WORKFLOWS).not.toEqual([])
  })

  it.each(SHIPPING_WORKFLOWS)('%s pins no wrangler version', (name) => {
    expect(versionInputs(read(name))).toEqual([])
  })

  it('recognises the pin shape the workflows used to carry', () => {
    const before = [
      '        with:',
      '          packageManager: pnpm',
      '          # Keep in step with the `wrangler` devDependency in package.json.',
      "          wranglerVersion: '4.70.0'",
      '          command: deploy',
    ].join('\n')

    expect(versionInputs(before)).toEqual([
      "          wranglerVersion: '4.70.0'",
    ])
  })

  it('installs the dependency tree in rollback.yml, so wrangler is there to resolve', () => {
    // The rollback runs no build, and skipping the install was defensible while a pin made
    // wrangler-action fetch its own wrangler. Without one it probes `pnpm exec wrangler --version`
    // instead, and that needs a node_modules.
    //
    // Turning the install back off would not fail loudly, which is why this is worth a test rather
    // than a comment: the action catches the failed probe and installs `wrangler@4` - its default
    // when the input is unset - straight from the registry. The rollback stays green while the
    // lockfile quietly stops owning the version, which is exactly the failure #567 closed.
    //
    // .github/actions/setup no longer offers a switch to turn it off: this workflow was the only
    // caller that ever set one, so #567 removed the input with the last use of it. Asserted on the
    // bare key rather than on one spelling of a value, so that re-adding the switch and reaching
    // for it here is a failing test rather than a silent return to the paragraph above.
    expect(read('rollback.yml')).not.toMatch(/^\s*install:/m)
  })
})
