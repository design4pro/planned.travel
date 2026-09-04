#!/usr/bin/env node

/**
 * Fails a green `anthropics/claude-code-action` step that reviewed nothing.
 *
 *   EXECUTION_FILE=<path> node scripts/ci/claude-review-ran.mjs
 *
 * The action reports success whenever the SDK returned a result, whatever that result says. A run
 * whose tools were all denied still ends `subtype: "success"`, `is_error: false`, so the check goes
 * green having reviewed nothing - which is worse than red, because a red check gets looked at.
 *
 * Run 33864762160 is the shape this guards against. The workflow passed
 * `--allowedTools "mcp__github_inline_comment__create_inline_comment"`, and the action injects no
 * default allowlist of its own, so that one entry was the whole allowlist and the plugin's first
 * `gh pr view` was denied. Eighteen seconds, six turns, `permission_denials_count: 1`, no comment
 * posted, check green.
 *
 * Two signals, both read off the last result message and the transcript around it:
 *
 *   - any permission denial. Every tool the review needs is declared in the workflow, so a denial
 *     means one it reached for was missing, and what it concluded without that tool is not a review.
 *   - no `Task` call. `/code-review:code-review` does its reading in subagents - the preflight
 *     alone is one - so a transcript with no subagent in it never started reviewing.
 *
 * Neither signal reads the review's own text, and both are cheap to satisfy honestly.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function fail(reason) {
  console.log(`::error::${reason}`)
  process.exit(1)
}

const file =
  process.env.EXECUTION_FILE ||
  (process.env.RUNNER_TEMP
    ? join(process.env.RUNNER_TEMP, 'claude-execution-output.json')
    : '')

if (!file) {
  fail(
    'Claude reported success and left no execution output to confirm it reviewed anything.',
  )
}

let messages
try {
  messages = JSON.parse(readFileSync(file, 'utf-8'))
} catch (error) {
  fail(
    `Claude reported success and its execution output could not be read: ${error}`,
  )
}

if (!Array.isArray(messages)) {
  fail(
    'Claude reported success and its execution output was not a list of messages.',
  )
}

const result = messages.findLast((message) => message?.type === 'result')

if (!result) {
  fail('Claude reported success without reporting a result.')
}

const denials = Number(result.permission_denials_count ?? 0)

if (denials > 0) {
  fail(
    `The review was denied ${denials} tool call(s), so it did not read the pull request. Add what ` +
      'it asked for to `claude_args: --allowedTools` in .github/workflows/claude-code-review.yml.',
  )
}

const spawnedSubagent = messages.some(
  (message) =>
    message?.type === 'assistant' &&
    Array.isArray(message.message?.content) &&
    message.message.content.some(
      (block) => block?.type === 'tool_use' && block.name === 'Task',
    ),
)

if (!spawnedSubagent) {
  fail(
    'The review ran no subagent, so it reviewed nothing. /code-review:code-review reads the pull ' +
      'request in `Task` subagents; a transcript without one is a run that stopped before it began.',
  )
}

console.log(`::notice::The review ran with no denied tool calls.`)
