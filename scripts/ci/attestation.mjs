#!/usr/bin/env node

/**
 * An agent's record that it ran the validation gate on a tree, and the check that decides whether
 * `ci.yml` may take its word for it (ADR 0045).
 *
 *   node scripts/ci/attestation.mjs attest --pr <n>   # agent: run the gate, post the record
 *   node scripts/ci/attestation.mjs verify            # CI: judge it, print `valid=` to $GITHUB_OUTPUT
 *
 * The record is bound to the TREE it ran on, not the commit: a rebase that keeps the content keeps
 * the attestation, and one more commit voids it. It lives in a pull request comment, so it adds no
 * file to the branch (a committed one would sit in the tree it attests) and no merge conflict
 * between pull requests.
 *
 * `valid=false` is never a failure: it sends the pull request through the full `verify` and `test`
 * jobs, exactly as before. Everything below errs toward that - an unreadable comment, an empty diff,
 * a gate the base branch changed, a path that defines the gate itself.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ATTESTATION_MARKER = '<!-- agent-attestation -->'
const VERSION = 1

/** Comment authors whose word counts: anyone can comment on a public pull request. */
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

/**
 * Paths a green attestation cannot vouch for. The first group defines what the gate runs, so an
 * attestation of a gate the diff itself edited proves nothing; the second is `risk-high` in SDLC.md,
 * which keeps the full pipeline whatever an agent reports. A path nobody thought about rides on the
 * attestation, so extend this list when the gate grows a new input.
 */
const FULL_CI_PATHS = [
  /^\.github\//,
  /^scripts\//,
  /^\.ai\/agentic\.config\.json$/,
  /^\.ai\/scripts\//,
  /^\.oxlintrc/,
  /^package\.json$/,
  /^pnpm-(lock|workspace)\.yaml$/,
  /^tsconfig/,
  /^vite\.config/,
  /^vitest[.\w-]*\.ts$/,
  /^src\/server\/(auth|billing|public)\//,
  /^src\/server\/repos\/base\.ts$/,
  /^src\/server\/db\/schema\.ts$/,
  /^drizzle\//,
]

/** The files API stops listing at this many, so a diff this long may be longer still. */
export const FILE_LIST_LIMIT = 3000

const isHash = (value) =>
  typeof value === 'string' && /^[0-9a-f]{40,64}$/.test(value)

function isAttestation(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.version === VERSION &&
    isHash(value.treeHash) &&
    Array.isArray(value.commands) &&
    value.commands.every(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof entry.command === 'string' &&
        Number.isInteger(entry.exitCode),
    )
  )
}

export function renderAttestationComment(attestation) {
  return [
    ATTESTATION_MARKER,
    `Gate run green on tree \`${attestation.treeHash.slice(0, 12)}\` (commit \`${attestation.headSha.slice(0, 12)}\`).`,
    '',
    '```json',
    JSON.stringify(attestation, null, 2),
    '```',
    '',
  ].join('\n')
}

/** @returns {object | null} the attestation in a comment body, or null when there is none to trust */
export function parseAttestationComment(body) {
  if (typeof body !== 'string' || !body.startsWith(ATTESTATION_MARKER))
    return null
  const json = body.match(/```json\n([\s\S]*?)\n```/)?.[1]
  if (json === undefined) return null
  try {
    const parsed = JSON.parse(json)
    return isAttestation(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** The newest attestation a trusted author left among a pull request's comments. */
export function findAttestation(comments) {
  return (
    comments
      .filter((comment) => TRUSTED.has(comment.author_association))
      .toSorted((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((comment) => parseAttestationComment(comment.body))
      .find((attestation) => attestation !== null) ?? null
  )
}

/**
 * @param {object} input
 * @param {object | null} input.attestation
 * @param {string} input.treeHash the tree of the commit CI checked out
 * @param {string[]} input.gateCommands `validation.commands` as the BASE branch has them, so a
 *   pull request cannot shorten the gate it is judged by
 * @param {string[]} input.changedFiles every path the pull request changes
 * @returns {{ valid: boolean, reason: string }}
 */
export function judge({ attestation, treeHash, gateCommands, changedFiles }) {
  const no = (reason) => ({ valid: false, reason })

  if (attestation === null) return no('no attestation from a trusted author')
  if (attestation.version !== VERSION)
    return no(`attestation version ${attestation.version} is unknown`)
  if (attestation.treeHash !== treeHash)
    return no(
      `attested tree ${attestation.treeHash.slice(0, 12)} is not this tree ${treeHash.slice(0, 12)}`,
    )
  if (gateCommands.length === 0)
    return no('the base branch lists no gate commands')

  const ran = attestation.commands
  const sameGate =
    ran.length === gateCommands.length &&
    gateCommands.every((command, index) => ran[index].command === command)
  if (!sameGate)
    return no('the attested commands are not the base branch gate, in order')

  const failed = ran.find((entry) => entry.exitCode !== 0)
  if (failed) return no(`${failed.command} exited ${failed.exitCode}`)

  // An empty or truncated list is as likely a diff that failed to compute as one that changes nothing.
  if (changedFiles.length === 0) return no('the diff lists no files')
  if (changedFiles.length >= FILE_LIST_LIMIT)
    return no('the diff may be longer than the file list')
  const reaching = changedFiles.find((path) =>
    FULL_CI_PATHS.some((pattern) => pattern.test(path)),
  )
  if (reaching !== undefined)
    return no(`${reaching} always runs the full pipeline`)

  return {
    valid: true,
    reason: `${ran.length} gate commands green on tree ${treeHash.slice(0, 12)}`,
  }
}

// -- the two entry points; everything below touches git, gh or the shell ---------------------------

const run = (file, args, options = {}) =>
  execFileSync(file, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
    ...options,
  }).trim()

const gh = (args, input) =>
  run('gh', args, input === undefined ? {} : { input })

function option(name) {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? undefined : process.argv[at + 1]
}

function verify() {
  const { REPO, PR, BASE_REF } = process.env
  let verdict
  try {
    const comments = JSON.parse(
      gh([
        'api',
        `repos/${REPO}/issues/${PR}/comments`,
        '--paginate',
        '--slurp',
      ]),
    ).flat()
    // Read from the base branch, not the checkout: the checkout is the pull request.
    const config = JSON.parse(
      gh([
        'api',
        `repos/${REPO}/contents/.ai/agentic.config.json?ref=${BASE_REF}`,
        '-H',
        'Accept: application/vnd.github.raw',
      ]),
    )
    const files = JSON.parse(
      gh(['api', `repos/${REPO}/pulls/${PR}/files`, '--paginate', '--slurp']),
    )
      .flat()
      .flatMap((file) =>
        [file.filename, file.previous_filename].filter(Boolean),
      )
    verdict = judge({
      attestation: findAttestation(comments),
      treeHash: run('git', ['rev-parse', 'HEAD^{tree}']),
      gateCommands: config.validation?.commands ?? [],
      changedFiles: files,
    })
  } catch (error) {
    verdict = {
      valid: false,
      reason: `could not judge: ${error.message.split('\n')[0]}`,
    }
  }
  console.error(
    `attestation: ${verdict.valid ? 'accepted' : 'not accepted'} - ${verdict.reason}.`,
  )
  const output = `valid=${verdict.valid}\n`
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, output)
  else process.stdout.write(output)
}

function attest() {
  const pr = option('pr')
  if (!pr) throw new Error('usage: attestation.mjs attest --pr <number>')
  // The tree is the HEAD commit's, so a dirty checkout would attest something it did not run.
  if (run('git', ['status', '--porcelain']) !== '')
    throw new Error(
      'the working tree is not clean: commit first, the attestation is of a commit',
    )

  const config = JSON.parse(
    run('git', ['show', 'HEAD:.ai/agentic.config.json']),
  )
  const commands = []
  for (const command of config.validation.commands) {
    const started = Date.now()
    const { status } = spawnSync('bash', ['-c', command], { stdio: 'inherit' })
    commands.push({
      command,
      exitCode: status ?? 1,
      durationMs: Date.now() - started,
    })
    if (status !== 0) throw new Error(`${command} failed: nothing to attest`)
  }

  const attestation = {
    version: VERSION,
    treeHash: run('git', ['rev-parse', 'HEAD^{tree}']),
    headSha: run('git', ['rev-parse', 'HEAD']),
    commands,
  }
  const repo = run('gh', [
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '--jq',
    '.nameWithOwner',
  ])
  const me = run('gh', ['api', 'user', '--jq', '.login'])
  const existing = JSON.parse(
    gh(['api', `repos/${repo}/issues/${pr}/comments`, '--paginate', '--slurp']),
  )
    .flat()
    .find(
      (comment) =>
        comment.body?.startsWith(ATTESTATION_MARKER) &&
        comment.user?.login === me,
    )
  const body = JSON.stringify({ body: renderAttestationComment(attestation) })
  if (existing)
    gh(
      [
        'api',
        '-X',
        'PATCH',
        `repos/${repo}/issues/comments/${existing.id}`,
        '--input',
        '-',
      ],
      body,
    )
  else
    gh(
      [
        'api',
        '-X',
        'POST',
        `repos/${repo}/issues/${pr}/comments`,
        '--input',
        '-',
      ],
      body,
    )
  console.error(
    `attestation: posted on #${pr} for tree ${attestation.treeHash.slice(0, 12)}.`,
  )
}

// Importing this file for `judge` must not run a command inside the test runner.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const commands = { verify, attest }
  const command = commands[process.argv[2]]
  if (!command) {
    console.error('usage: attestation.mjs <attest --pr N | verify>')
    process.exit(2)
  }
  try {
    command()
  } catch (error) {
    console.error(`attestation: ${error.message}`)
    process.exit(1)
  }
}
