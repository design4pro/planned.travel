#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  realpathSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

// New issues have no remote numeric identity yet. Serialize creation on the single
// configured Cezar host; this lease never replaces atomic ownership of existing items.
export function creationReservation(store, runId, release = false) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId ?? ''))
    throw new Error('Invalid run identity')
  const directory = join(store, 'claims')
  mkdirSync(directory, { recursive: true })
  const path = join(directory, 'issue-creation.json')
  if (!release) {
    try {
      writeFileSync(path, JSON.stringify({ runId }), { flag: 'wx' })
      return true
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      return JSON.parse(readFileSync(path, 'utf8')).runId === runId
    }
  }
  if (!existsSync(path)) return true
  if (JSON.parse(readFileSync(path, 'utf8')).runId !== runId) return false
  unlinkSync(path)
  return true
}

export function policyDigest(root = '.') {
  const hash = createHash('sha256')
  const paths = [
    '.ai/agentic.config.json',
    'AGENTS.md',
    '.agents/policy.json',
    'scripts/agents/skills-upstream.json',
    'SDLC.md',
    'CODE_REVIEW.md',
    'BACKWARD_COMPATIBILITY.md',
  ]
  for (const directory of [
    '.agents/policies',
    '.agents/reviewers',
    '.agents/workflows',
  ]) {
    for (const file of readdirSync(join(root, directory)).sort()) {
      if (file.endsWith('.md')) paths.push(`${directory}/${file}`)
    }
  }
  for (const path of paths) {
    hash.update(path)
    hash.update(readFileSync(join(root, path)))
  }
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

function deliveryRun(store, id) {
  const runs = JSON.parse(readFileSync(join(store, 'runs.json'), 'utf8'))
  const matching = runs.filter((run) => run.id === id)
  if (matching.length !== 1)
    throw new Error('Current Cezar run is missing or ambiguous')
  return matching[0]
}

function existingPrNumber(run) {
  if (run.workflow === 'implement-ticket') return null
  if (run.workflow !== 'pr-autopilot')
    throw new Error('Unsupported Cezar delivery workflow')
  const task =
    typeof run.task === 'string' ? run.task.split('\n')[0].trim() : ''
  const match = /^#?([1-9]\d*)$/.exec(task)
  const number = Number(match?.[1])
  if (!Number.isSafeInteger(number))
    throw new Error('pr-autopilot requires an exact PR number')
  return number
}

function confirmMerge({ handoff, store, id, pr, head, source }) {
  appendFileSync(
    handoff,
    `\nOUTCOME: ${JSON.stringify({ outcome: 'merged', runId: id, pr: pr.number, head, policy: policyDigest(), at: new Date().toISOString() })}\n`,
  )
  const issue = /^ISSUE: #([1-9]\d*)\s*$/m.exec(
    readFileSync(handoff, 'utf8'),
  )?.[1]
  for (const key of [`pr-${pr.number}`, ...(issue ? [`issue-${issue}`] : [])]) {
    const path = join(store, 'claims', `${key}.json`)
    if (existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).runId === id)
      unlinkSync(path)
  }
  execFileSync(
    process.execPath,
    [
      join(source, 'scripts/agents/close-fixed-issues.mjs'),
      '--pr',
      String(pr.number),
    ],
    { stdio: 'inherit', timeout: 120_000 },
  )
}

function main(mode) {
  const id = process.env.CEZ_RUN_ID
  if (!/^[a-zA-Z0-9-]+$/.test(id ?? ''))
    throw new Error('CEZ_RUN_ID is required')
  const store = runStore()
  if (mode === 'reserve-creation' || mode === 'release-creation') {
    const runs = JSON.parse(readFileSync(join(store, 'runs.json'), 'utf8'))
    if (!runs.some((run) => run.id === id))
      throw new Error('Current run not found')
    if (!creationReservation(store, id, mode === 'release-creation')) {
      throw new Error(
        'Another run owns issue creation; leave its reservation intact',
      )
    }
    console.log(
      mode === 'reserve-creation'
        ? 'CREATION_RESERVED=1'
        : 'CREATION_RELEASED=1',
    )
    return
  }
  const handoff = join(store, 'runs', `${id}.handoff.md`)
  const deliveryModes = ['pr-preflight', 'ci-preflight', 'ci', 'confirm-merge']
  const source = fileURLToPath(new URL('../../', import.meta.url))
  const delivery = deliveryModes.includes(mode)
  if (
    delivery &&
    realpathSync(source) !== realpathSync(dirname(dirname(store)))
  )
    throw new Error('Delivery helper must come from the primary Cezar checkout')
  const config = JSON.parse(
    readFileSync(
      delivery
        ? join(source, '.ai/agentic.config.json')
        : '.ai/agentic.config.json',
      'utf8',
    ),
  )
  const read = (args) =>
    JSON.parse(
      execFileSync('gh', args, {
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 32 * 1024 * 1024,
        ...(delivery ? { cwd: source } : {}),
      }),
    )
  if (['ci-preflight', 'ci', 'confirm-merge'].includes(mode)) {
    const run = deliveryRun(store, id)
    const repo = read(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? ''))
      throw new Error('Cannot establish the project repository')
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
    let number = existingPrNumber(run)
    if (number === null) {
      const branch = execFileSync('git', ['branch', '--show-current'], {
        encoding: 'utf8',
      }).trim()
      if (!branch) throw new Error('An issue delivery requires a named branch')
      const prs = read([
        'pr',
        'list',
        '--repo',
        repo,
        '--head',
        branch,
        '--state',
        mode === 'confirm-merge' ? 'merged' : 'open',
        '--limit',
        '100',
        '--json',
        'number,headRefName,headRefOid,baseRefName,isCrossRepository',
      ]).filter(
        (pr) =>
          pr.isCrossRepository === false &&
          pr.headRefName === branch &&
          pr.headRefOid === head &&
          pr.baseRefName === config.baseBranch,
      )
      if (
        prs.length !== 1 ||
        !Number.isSafeInteger(prs[0].number) ||
        prs[0].number < 1
      )
        throw new Error(
          'Expected one same-repository PR for this branch, head and base',
        )
      number = prs[0].number
    }
    const expectedState = mode === 'confirm-merge' ? 'MERGED' : 'OPEN'
    const pr = read([
      'pr',
      'view',
      String(number),
      '--repo',
      repo,
      '--json',
      'number,state,isDraft,headRefOid,baseRefName,mergeCommit',
    ])
    if (
      pr.number !== number ||
      pr.state !== expectedState ||
      pr.headRefOid !== head ||
      pr.baseRefName !== config.baseBranch
    )
      throw new Error(
        `PR #${number} must be ${expectedState} at the exact worktree head and configured base`,
      )
    if (mode === 'ci-preflight') {
      if (pr.isDraft !== false)
        throw new Error(
          `PR #${number} must be Ready for review before Cezar waits for CI`,
        )
      console.log(`PR #${number} is ready for CI at ${head}`)
    } else if (mode === 'ci') {
      const state = readPrState(repo, number, read)
      if (
        state.number !== number ||
        state.state !== 'OPEN' ||
        state.head !== head ||
        state.base !== config.baseBranch ||
        state.draft !== false ||
        state.ci.state !== 'green'
      )
        throw new Error(
          'CI verification requires passing checks on the exact open, non-draft PR',
        )
      console.log(JSON.stringify(state))
    } else {
      if (!pr.mergeCommit?.oid)
        throw new Error(`PR #${number} has no confirmed merge commit`)
      confirmMerge({ handoff, store, id, pr, head, source })
    }
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
    const number = existingPrNumber(deliveryRun(store, id))
    if (number === null) throw new Error('PR preflight requires pr-autopilot')
    const repo = read(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? ''))
      throw new Error('Cannot establish the project repository')
    const pr = read([
      'pr',
      'view',
      String(number),
      '--repo',
      repo,
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
      pr.number === number &&
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
