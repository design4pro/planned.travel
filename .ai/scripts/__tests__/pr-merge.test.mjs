import { describe, expect, it } from 'vitest'
import { mergeVerifiedPr } from '../pr-merge.mjs'

const repo = 'design4pro/planned.travel'
const root = `repos/${repo}`
const head = 'a'.repeat(40)
const base = 'b'.repeat(40)
const mergedSha = 'c'.repeat(40)
const lock = 'd'.repeat(40)
const runId = 'cezar-run'
const actor = 'rafalwolak'
const policy = 'current-policy'
const reportUrl = (number) =>
  `https://github.com/${repo}/pull/17#issuecomment-${number}`

const checks = ['lint · typecheck · build', 'unit tests', 'e2e · merged report']

function fixture(options = {}) {
  const pr = {
    number: 17,
    html_url: `https://github.com/${repo}/pull/17`,
    state: 'open',
    draft: false,
    merged: false,
    mergeable: true,
    changed_files: 1,
    head: { sha: head, ref: 'codex/change', repo: { full_name: repo } },
    base: { ref: 'develop', sha: base },
    labels: [{ name: 'in-progress' }, { name: 'skip-qa' }],
    ...options.pr,
  }
  const writes = []
  let pending
  let lockReads = 0
  const reads = {
    user: () => ({ login: actor }),
    [`${root}/git/matching-refs/om-locks/pr-17`]: () => [
      {
        ref: 'refs/om-locks/pr-17',
        object: {
          type: 'commit',
          sha: options.changedLock && lockReads++ ? head : lock,
        },
      },
    ],
    [`${root}/git/commits/${lock}`]: () => ({
      message:
        'om-claim-v1\n' +
        JSON.stringify({
          repo,
          kind: 'pr',
          item: '17',
          runId: options.owner ?? runId,
          actor,
        }),
    }),
    [`${root}/git/commits/${head}`]: () => ({
      message:
        'om-claim-v1\n' +
        JSON.stringify({ repo, kind: 'pr', item: '17', runId, actor }),
    }),
    [`${root}/pulls/17`]: () => structuredClone(pr),
    [`${root}/pulls/17/files?per_page=100`]: () => [
      [options.file ?? { filename: 'README.md' }],
    ],
    [`${root}/issues/comments/91`]: () => ({
      html_url: reportUrl(91),
      user: { login: options.author ?? actor },
      body: `Independent standards and spec approved\nCezar gate: review ${head} approved\nCezar gate: security ${head} approved`,
    }),
    [`${root}/rules/branches/develop`]: () => [
      [
        {
          type: 'required_status_checks',
          parameters: {
            required_status_checks: options.missingRules
              ? []
              : checks.map((context) => ({ context, integration_id: 15368 })),
          },
        },
      ],
    ],
    [`${root}/branches/develop/protection/required_status_checks`]: () => ({
      contexts: [],
    }),
    [`${root}/commits/${head}/check-runs?per_page=100&filter=latest`]: () => [
      {
        check_runs: checks.map((name) => ({
          name,
          app: { id: 15368 },
          status: 'completed',
          conclusion: options.ci ?? 'success',
        })),
      },
    ],
    [`${root}/commits/${head}/statuses?per_page=100`]: () => [[]],
    [`${root}/actions/runs?head_sha=${head}&event=pull_request&per_page=100`]:
      () => [
        {
          workflow_runs: options.missingRun
            ? []
            : [
                {
                  head_sha: head,
                  event: 'pull_request',
                  status: 'completed',
                  conclusion: 'success',
                  workflow_id: 101,
                },
              ],
        },
      ],
    [`${root}/actions/workflows/ci.yml/runs?head_sha=${head}&event=pull_request&per_page=100`]:
      () => [
        {
          workflow_runs: options.missingRun
            ? []
            : [
                {
                  head_sha: head,
                  event: 'pull_request',
                  path: '.github/workflows/ci.yml',
                  status: 'completed',
                  conclusion: 'success',
                },
              ],
        },
      ],
    [`${root}/pulls/17/reviews?per_page=100`]: () => [options.reviews ?? []],
    graphql: () => [
      {
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { hasNextPage: false },
                nodes: [{ isResolved: !options.thread, isOutdated: false }],
              },
            },
          },
        },
      },
    ],
  }
  const read = (args) => {
    if (args.includes('PUT')) {
      writes.push(args)
      if (!options.deny)
        Object.assign(pr, { merged: true, merge_commit_sha: mergedSha })
      if (options.deny || options.lostResponse)
        throw new Error('Write response unavailable')
      return { merged: true }
    }
    const path = args.find(
      (arg) => arg === 'user' || arg === 'graphql' || arg.startsWith('repos/'),
    )
    if (!reads[path]) throw new Error(`Unexpected read ${path}`)
    return reads[path]()
  }
  const input = {
    read,
    repo,
    number: 17,
    head,
    runId,
    policy,
    config: {
      baseBranch: 'develop',
      pipeline: { requireExecutedCi: true },
      trustedAuthors: [actor],
      paths: { specs: '.ai/specs' },
    },
    evidence: (kind) =>
      (kind === 'review' || (kind === 'security' && options.sameReport)) && {
        kind,
        head: options.reviewHead ?? head,
        base,
        policy,
        result: 'passed',
        source: reportUrl(91),
      },
    readIntent: () => pending,
    createIntent(intent) {
      if (pending) return false
      pending = intent
      return true
    },
  }
  return { input, writes }
}

describe('protected native squash merge', () => {
  it('writes once with the exact SHA and reconciles a lost success response', () => {
    const { input, writes } = fixture({ lostResponse: true })
    expect(mergeVerifiedPr(input)).toBe(mergedSha)
    expect(writes).toEqual([
      [
        'api',
        '-X',
        'PUT',
        `${root}/pulls/17/merge`,
        '-f',
        `sha=${head}`,
        '-f',
        'merge_method=squash',
      ],
    ])
  })

  it('never repeats an unconfirmed mutation', () => {
    const { input, writes } = fixture({ deny: true })
    expect(() => mergeVerifiedPr(input)).toThrow('no retry')
    expect(() => mergeVerifiedPr(input)).toThrow('no retry')
    expect(writes).toHaveLength(1)
  })

  it.each([
    [{ owner: 'another-run' }, 'another owner'],
    [{ changedLock: true }, 'lock changed'],
    [{ pr: { draft: true } }, 'exact open'],
    [{ pr: { base: { sha: base, ref: 'main' } } }, 'exact open'],
    [
      { pr: { labels: [{ name: 'in-progress' }, { name: 'blocked' }] } },
      'held',
    ],
    [{ reviewHead: base }, 'independent review'],
    [{ author: 'untrusted' }, 'Published review'],
    [
      { file: { filename: 'README.md', previous_filename: 'src/routes/x.ts' } },
      'QA approval',
    ],
    [{ file: { filename: '.husky/pre-commit' } }, 'independent security'],
    [{ file: { filename: '.ai/specs/manual.md' } }, 'plan-to-spec'],
    [
      { file: { filename: '.husky/pre-commit' }, sameReport: true },
      'distinct independent report',
    ],
    [{ thread: true }, 'unresolved'],
    [{ ci: 'skipped' }, 'Executed CI'],
    [{ missingRules: true }, 'Required repository CI contexts'],
    [{ missingRun: true }, 'Repository CI did not execute'],
    [
      {
        reviews: [{ state: 'CHANGES_REQUESTED', user: { login: 'reviewer' } }],
      },
      'current review',
    ],
  ])('refuses %j before any write', (options, message) => {
    const { input, writes } = fixture(options)
    expect(() => mergeVerifiedPr(input)).toThrow(message)
    expect(writes).toEqual([])
  })
})
