#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { runStore } from './backlog-status.mjs'

export function issueFromTask(task) {
  if (!task.trim()) return null
  const match = /^\s*(?:Implement issue\s+)?#?([1-9]\d*)\.?\s*$/i.exec(task)
  if (!match)
    throw new Error('Expected an issue number or "Implement issue #N."')
  const number = Number(match[1])
  if (!Number.isSafeInteger(number))
    throw new Error('Issue number is too large')
  return number
}

export function mayContinue(handoff) {
  if (/^STOP:\s*\S.*$/m.test(handoff)) return false
  const issues = new Set(
    [...handoff.matchAll(/^ISSUE: #([1-9]\d*)\s*$/gm)].map((m) => m[1]),
  )
  if (issues.size !== 1 || /^STOP:/m.test(handoff))
    throw new Error('Missing issue or malformed STOP evidence')
  return true
}

function main(mode) {
  const id = process.env.CEZ_RUN_ID
  if (!/^[a-zA-Z0-9-]+$/.test(id ?? ''))
    throw new Error('CEZ_RUN_ID is required')
  const store = runStore()
  const handoff = join(store, 'runs', `${id}.handoff.md`)
  if (mode === 'continue') {
    process.stdout.write(
      `PIPELINE_CONTINUE=${mayContinue(readFileSync(handoff, 'utf8')) ? 1 : 0}\n`,
    )
    return
  }
  if (mode !== 'preflight')
    throw new Error('Usage: pipeline-control.mjs <preflight|continue>')
  const runs = JSON.parse(readFileSync(join(store, 'runs.json'), 'utf8'))
  const run = runs.find((row) => row.id === id)
  if (!run) throw new Error('Current run not found')
  const readBacklog = (args) =>
    execFileSync(
      process.execPath,
      ['.ai/scripts/backlog-status.mjs', ...args],
      {
        encoding: 'utf8',
        timeout: 120_000,
        env: { ...process.env, CEZ_RUN_ID: id },
      },
    ).trim()
  const issue = issueFromTask(run.task ?? '') ?? Number(readBacklog(['--next']))
  if (!issue) {
    process.stdout.write('PIPELINE_CONTINUE=0\n')
    return
  }
  const evidence = JSON.parse(readBacklog(['--issue', String(issue)]))
  if (evidence.number !== issue || typeof evidence.ready !== 'boolean')
    throw new Error('Invalid readiness evidence')
  appendFileSync(
    handoff,
    `\nISSUE: #${issue}\n${evidence.ready ? '' : `STOP: ${evidence.state} - ${evidence.reason}\n`}`,
  )
  process.stdout.write(
    `PIPELINE_CONTINUE=${evidence.ready ? 1 : 0}\n${JSON.stringify(evidence)}\n`,
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main(process.argv[2])
  } catch (error) {
    console.error(`pipeline-control: ${error.message}`)
    process.exitCode = 1
  }
}
