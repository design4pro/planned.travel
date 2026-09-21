// The housekeeping install procedure is one concept written in two places: the `__PATH__`
// instruction in the launchd template, and the `command -v` check in docs/agents/cezar.md that
// tells an operator whether the PATH they substituted is the right one. They drifted once (#349):
// the template went on naming `npx` after the fallback that used it was removed, and never
// learned to name `cezar`, which the script now needs to run at all. Nothing said so, because
// launchd gives the job only the substituted PATH and a missing binary there is an exit 1 into
// a log nobody reads. This ties the two sides together so the next drift is a red test.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const template = readFileSync(
  resolve(__dirname, '../launchd/dev.planned-travel.housekeeping.plist'),
  'utf8',
)

// The instruction alone, and stopping short of the `docs/agents/cezar.md` pointer that follows
// it: the header says "the cezar host" and names a path under .ai/cezar/, so a substring search
// over anything wider passes on a template that never asks for the binary.
const instruction = template.match(
  /__PATH__ with a PATH that[\s\S]*?(?=, then install)/,
)?.[0]

// Both halves are read by their wording, so a rephrasing on either side stops the pattern
// matching. That must be an error and not a fallback: `''` contains no binary name, so the
// npx assertion below would pass on it and report a guard that is no longer guarding anything.
if (!instruction) {
  throw new Error(
    'The __PATH__ instruction was not found in the plist header. If the comment was rephrased ' +
      'on purpose, update the pattern in this test to match the new wording.',
  )
}

const doc = readFileSync(
  resolve(__dirname, '../../../docs/agents/cezar.md'),
  'utf8',
)

// `… /bin/bash -c 'command -v cezar node gh curl'` — the binaries the doc makes an operator
// verify under the installed plist's own PATH.
const required = doc
  .match(/command -v ((?:[a-z0-9-]+ )+[a-z0-9-]+)'/)?.[1]
  .split(' ')

if (!required) {
  throw new Error(
    'The `command -v` check was not found in docs/agents/cezar.md § Housekeeping. If the check ' +
      'was rewritten, update the pattern in this test to match it.',
  )
}

describe('dev.planned-travel.housekeeping.plist', () => {
  it('names in its __PATH__ instruction every binary docs/agents/cezar.md makes the operator check', () => {
    for (const binary of required) {
      expect(instruction).toContain(binary)
    }
  })

  // `housekeeping.sh` has no npx form: on an unreachable cockpit it runs the global `cezar` or
  // exits. A template still asking for npx invites a PATH built around the wrong binary.
  it('does not ask for npx, which the script no longer falls back to', () => {
    expect(instruction).not.toContain('npx')
  })
})
