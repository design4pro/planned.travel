#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  unlinkSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { runStore, isAlive } from './backlog-status.mjs'
import { parseCloseLinks } from '../../scripts/agents/close-fixed-issues.mjs'
import { readPrState } from './pr-state.mjs'

export function claimWork(store, key, runId) {
  if (!/^(issue|pr)-[1-9]\d*$/.test(key) || !/^[a-zA-Z0-9-]+$/.test(runId))
    throw new Error('Invalid claim identity')
  const dir = join(store, 'claims')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${key}.json`)
  try {
    writeFileSync(path, JSON.stringify({ runId }), { flag: 'wx' })
    return true
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    return JSON.parse(readFileSync(path, 'utf8')).runId === runId
  }
}

export function policyDigest(root = '.') {
  const hash = createHash('sha256')
  for (const path of [
    '.ai/agentic.config.json',
    'SDLC.md',
    'CODE_REVIEW.md',
    'BACKWARD_COMPATIBILITY.md',
  ])
    hash.update(readFileSync(join(root, path)))
  return hash.digest('hex')
}

export function reusableEvidence(record, current) {
  return (
    ['review', 'qa', 'ci'].includes(record?.kind) &&
    record.result === 'passed' &&
    Boolean(record.source) &&
    ['head', 'base', 'policy'].every(
      (key) =>
        typeof current[key] === 'string' &&
        current[key] &&
        record[key] === current[key],
    )
  )
}

export function issueFromTask(task) {
  if (!task.trim()) return null
  const match =
    /^\s*(?:Implement issue\s+)?#?([1-9]\d*)\.?\s*(?:\[product-radar\])?\s*$/i.exec(
      task,
    )
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
  const config = JSON.parse(readFileSync('.ai/agentic.config.json', 'utf8'))
  const read = (args) =>
    JSON.parse(
      execFileSync('gh', args, {
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 32 * 1024 * 1024,
      }),
    )
  if (mode === 'ci') {
    const branch = execFileSync('git', ['branch', '--show-current'], {
      encoding: 'utf8',
    }).trim()
    const prs = read([
      'pr',
      'list',
      '--head',
      branch,
      '--state',
      'open',
      '--json',
      'number',
    ])
    if (prs.length !== 1)
      throw new Error('Expected one open PR for this branch')
    const repo = read(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner
    const state = readPrState(repo, prs[0].number, read)
    if (state.ci.state !== 'green' || state.base !== config.baseBranch)
      throw new Error('Incomplete CI or wrong merge base')
    console.log(JSON.stringify(state))
    return
  }
  if (mode === 'record-evidence' || mode === 'evidence') {
    const [kind, number, source, expectedHead, expectedBase] =
      process.argv.slice(3)
    if (
      !['review', 'qa', 'ci'].includes(kind) ||
      !/^[1-9]\d*$/.test(number ?? '')
    )
      throw new Error('Expected evidence kind and PR number')
    const pr = read(['pr', 'view', number, '--json', 'headRefOid,baseRefOid'])
    const current = {
      head: pr.headRefOid,
      base: pr.baseRefOid,
      policy: policyDigest(),
    }
    const path = join(store, 'runs', `pr-${number}-${kind}.evidence.json`)
    if (mode === 'record-evidence') {
      if (expectedHead !== current.head || expectedBase !== current.base)
        throw new Error('Reviewed revision changed; evidence not recorded')
      if (
        !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(pull|issues)\/[1-9]\d*#/.test(
          source ?? '',
        )
      )
        throw new Error('A published report URL is required')
      writeFileSync(
        path,
        JSON.stringify({
          ...current,
          kind,
          source,
          result: 'passed',
          runId: id,
          at: new Date().toISOString(),
        }) + '\n',
      )
    } else {
      const record = existsSync(path)
        ? JSON.parse(readFileSync(path, 'utf8'))
        : null
      console.log(
        JSON.stringify({
          reusable: reusableEvidence(record, current),
          record,
          current,
        }),
      )
    }
    return
  }
  if (mode === 'confirm-merge') {
    const branch = execFileSync('git', ['branch', '--show-current'], {
      encoding: 'utf8',
    }).trim()
    const prs = read([
      'pr',
      'list',
      '--head',
      branch,
      '--state',
      'all',
      '--json',
      'number,state,baseRefName,headRefOid,mergeCommit',
    ])
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
    const pr = prs.find(
      (pr) =>
        pr.state === 'MERGED' &&
        pr.baseRefName === config.baseBranch &&
        pr.headRefOid === head,
    )
    if (!pr)
      throw new Error(
        'No confirmed merge of this head into the configured base',
      )
    appendFileSync(
      handoff,
      `\nOUTCOME: ${JSON.stringify({ outcome: 'merged', runId: id, pr: pr.number, head, policy: policyDigest(), at: new Date().toISOString() })}\n`,
    )
    const issue = /^ISSUE: #([1-9]\d*)\s*$/m.exec(
      readFileSync(handoff, 'utf8'),
    )?.[1]
    for (const key of [
      `pr-${pr.number}`,
      ...(issue ? [`issue-${issue}`] : []),
    ]) {
      const path = join(store, 'claims', `${key}.json`)
      if (
        existsSync(path) &&
        JSON.parse(readFileSync(path, 'utf8')).runId === id
      )
        unlinkSync(path)
    }
    execFileSync(
      process.execPath,
      [
        'scripts/agents/close-fixed-issues.mjs',
        '--pr',
        String(pr.number),
        '--apply',
      ],
      { stdio: 'inherit', timeout: 120_000 },
    )
    return
  }
  if (mode === 'continue' || mode === 'implemented') {
    if (mode === 'implemented' && mayContinue(readFileSync(handoff, 'utf8'))) {
      appendFileSync(
        handoff,
        `\nOUTCOME: ${JSON.stringify({ outcome: 'implemented', runId: id, policy: policyDigest(), at: new Date().toISOString() })}\n`,
      )
    }
    process.stdout.write(
      `PIPELINE_CONTINUE=${mayContinue(readFileSync(handoff, 'utf8')) ? 1 : 0}\n`,
    )
    return
  }
  if (!['preflight', 'pr-preflight'].includes(mode))
    throw new Error('Usage: pipeline-control.mjs <preflight|continue>')
  const runs = JSON.parse(readFileSync(join(store, 'runs.json'), 'utf8'))
  const run = runs.find((row) => row.id === id)
  if (!run) throw new Error('Current run not found')
  if (mode === 'pr-preflight') {
    const number = issueFromTask(run.task.split('\n')[0])
    if (!number) throw new Error('PR number is required')
    const pr = read([
      'pr',
      'view',
      String(number),
      '--json',
      'number,title,body,baseRefName,headRefName,state',
    ])
    const issues = parseCloseLinks(pr)
    const owned =
      runs.some(
        (other) =>
          other.id !== id && isAlive(other) && other.branch === pr.headRefName,
      ) ||
      issues.some((number) => {
        const path = join(store, 'claims', `issue-${number}.json`)
        if (
          existsSync(path) &&
          JSON.parse(readFileSync(path, 'utf8')).runId !== id
        )
          return true
        return runs.some(
          (other) =>
            other.id !== id &&
            isAlive(other) &&
            (Number(other.issueNumber) === number ||
              other.branch === pr.headRefName),
        )
      })
    const ready =
      pr.baseRefName === config.baseBranch &&
      pr.state === 'OPEN' &&
      !owned &&
      claimWork(store, `pr-${number}`, id)
    appendFileSync(
      handoff,
      `\nPR: #${number}\n${ready ? '' : 'OUTCOME: {"outcome":"no-op","reason":"PR is owned, closed, or targets another base"}\n'}`,
    )
    console.log(`PIPELINE_CONTINUE=${ready ? 1 : 0}`)
    return
  }
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
    appendFileSync(
      handoff,
      '\nOUTCOME: {"outcome":"no-op","reason":"No ready issue"}\n',
    )
    process.stdout.write('PIPELINE_CONTINUE=0\n')
    return
  }
  const evidence = JSON.parse(readBacklog(['--issue', String(issue)]))
  if (evidence.number !== issue || typeof evidence.ready !== 'boolean')
    throw new Error('Invalid readiness evidence')
  if (evidence.ready && !claimWork(store, `issue-${issue}`, id)) {
    evidence.ready = false
    evidence.state = 'OWNED'
    evidence.reason =
      'Another run owns this issue; inspect its handoff before releasing the claim'
  }
  appendFileSync(
    handoff,
    `\nISSUE: #${issue}\n${evidence.ready ? '' : `STOP: ${evidence.state} - ${evidence.reason}\nOUTCOME: ${JSON.stringify({ outcome: 'blocked', runId: id, reason: evidence.reason })}\n`}`,
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
