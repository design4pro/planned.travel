// A cezar run starts with `--permission-mode dontAsk`, and Claude Code refuses an `Edit` or `Write`
// under `.claude/**` and `.husky/*` whatever the repository's own hooks allow (#670: three
// `om-auto-fix-pr` runs on #668 each diagnosed the defect, wrote the fix and could not commit it).
// The runner declares and preflights `writePaths`; the skill side is one rule, worded the same way
// in every override of a skill that edits files or pushes to a branch. This guard reads those
// overrides: a listed skill that loses a load-bearing statement fails, and so does a new override
// that is in neither list below, so adding one forces the decision.
import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const SKILLS = new URL('../../skills/', import.meta.url)

// Overrides of skills that edit files or push a branch. `om-auto-review-pr` carries the rule in its
// own wording; the other nine carry the paragraph written for #670.
const COVERED = [
  'om-auto-review-pr',
  'om-auto-fix-pr',
  'om-pr-autopilot',
  'om-auto-continue-pr',
  'om-auto-continue-pr-loop',
  'om-auto-create-pr',
  'om-auto-create-pr-loop',
  'om-auto-fix-issue',
  'om-auto-implement-spec',
  'om-check-and-commit',
]

// Overrides without the rule. The `afk-*` skills and the review, merge and housekeeping skills
// write no protected configuration. `om-fix`, `om-open-pr`, `om-auto-write-spec` and
// `om-auto-update-changelog` do edit or push, but only as a step of a covered skill or the `spec`
// workflow, which writes under `.ai/specs`. `om-setup-agent-pipeline` is a skill, not an override, and
// is a one-time configurator a person runs, so it has no entry here.
const NOT_COVERED = [
  'afk-architecture-review',
  'afk-codebase-design',
  'afk-decide',
  'afk-domain-modeling',
  'afk-lessons',
  'afk-plan-to-spec',
  'afk-to-tickets',
  'afk-triage',
  'afk-unblock',
  'om-approve-merge-pr',
  'om-auto-manage-issues',
  'om-auto-qa-pr',
  'om-auto-update-changelog',
  'om-auto-write-spec',
  'om-close-fixed-issues',
  'om-code-review',
  'om-fix',
  'om-followup-issue-from-pr',
  'om-open-pr',
  'om-prepare-test-env',
  'om-review-prs',
]

// The load-bearing statements, each as a pattern over the override with whitespace collapsed
// (the text is wrapped differently from file to file).
const STATEMENTS = {
  'declares protected writes as writePaths / --write-path':
    /`writePaths`.*`cezar task --write-path`/,
  'preflights before expensive work':
    /preflight can stop before expensive work/,
  'stops the unattended run once after a denial':
    /stop the unattended run once/,
  'hands over the exact diff and the worktree': /hand the exact diff.*worktree/,
  'limits approval to the declared paths':
    /supervised run with approval limited to those paths/,
  'never enables a global bypassPermissions':
    /Never enable global `bypassPermissions`/,
  'never switches tools to evade a denial': /switch tools to evade denial/,
  'never repeats diagnosis or tests for the same refusal':
    /repeat diagnosis and tests for the same refusal/,
  'sends a change outside this repository to its own pull request':
    /belong in their own pull request/,
}

// What the paragraph written for #670 adds to the `om-auto-review-pr` wording (the brief leaves that
// override as it is): the paths it covers, the point it is declared, and who gives the verdict.
const BEYOND_REVIEW_PR = {
  'names the protected paths':
    /protected configuration \(`\.claude\/\*\*`, `\.husky\/\*`\)/,
  'declares them before bootstrap or diagnosis':
    /before bootstrap or diagnosis/,
  'hands over the paths with the guardian verdict':
    /the paths, with the configuration guardian verdict from `\.ai\/skills\/afk-decide\/SKILL\.md`/,
}

const read = (name) =>
  readFileSync(new URL(`${name}/SKILL.md`, SKILLS), 'utf8').replace(/\s+/g, ' ')

const overrides = readdirSync(SKILLS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

describe('protected writes rule', () => {
  it('lists every override in exactly one group', () => {
    const listed = [...COVERED, ...NOT_COVERED]
    expect(new Set(listed).size).toBe(listed.length)
    expect([...overrides].sort()).toEqual([...listed].sort())
  })

  describe.each(COVERED)('%s', (name) => {
    it.each(Object.entries(STATEMENTS))('%s', (_label, pattern) => {
      expect(read(name)).toMatch(pattern)
    })
  })

  describe.each(COVERED.filter((name) => name !== 'om-auto-review-pr'))(
    '%s',
    (name) => {
      it.each(Object.entries(BEYOND_REVIEW_PR))('%s', (_label, pattern) => {
        expect(read(name)).toMatch(pattern)
      })
    },
  )

  it.each(['om-auto-fix-pr', 'om-pr-autopilot'])(
    '%s keeps the handover line the rule sits beside',
    (name) => {
      expect(read(name)).toContain(
        'A fix Claude Code refuses to write is handed over, not forced.',
      )
    },
  )
})
