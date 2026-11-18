import { readPrState } from './pr-state.mjs'

const sha = /^[a-f0-9]{40}$/
const requiredContexts = [
  'lint · typecheck · build',
  'unit tests',
  'e2e · merged report',
]
const holds = new Set([
  'blocked',
  'do-not-merge',
  'qa-failed',
  'changes-requested',
  'qa',
])
const qaPath =
  /^src\/(?:routes|components|styles|server\/email|lib\/i18n\/messages|i18n|locales)\//
const securityPath =
  /^(?:src\/server\/(?:auth\/|repos\/base\.ts$|billing\/|db\/schema\.ts$|public\/)|drizzle\/|\.agents\/|\.ai\/(?:cezar\/|scripts\/pipeline-control\.mjs$|scripts\/pr-merge\.mjs$)|\.husky\/|\.github\/|scripts\/ci\/)/
const threadsQuery = `query($owner:String!,$name:String!,$number:Int!,$endCursor:String){
  repository(owner:$owner,name:$name){pullRequest(number:$number){
    reviewThreads(first:100,after:$endCursor){
      pageInfo{hasNextPage endCursor} nodes{isResolved isOutdated}
    }
  }}
}`

function requireGate(value, message) {
  if (!value) throw new Error(message)
}

function ownedLock(
  read,
  root,
  repo,
  number,
  runId,
  actor,
  allowAbsent = false,
) {
  const ref = `refs/om-locks/pr-${number}`
  const matching = read([
    'api',
    `${root}/git/matching-refs/om-locks/pr-${number}`,
  ]).filter((entry) => entry.ref === ref)
  if (allowAbsent && matching.length === 0) return null
  const object = matching[0]?.object
  requireGate(
    matching.length === 1 && object?.type === 'commit' && sha.test(object.sha),
    'Atomic PR lock is missing or ambiguous',
  )
  const message = read(['api', `${root}/git/commits/${object.sha}`]).message
  requireGate(message?.startsWith('om-claim-v1\n'), 'Invalid atomic PR lock')
  const lock = JSON.parse(message.slice('om-claim-v1\n'.length))
  requireGate(
    lock.repo === repo &&
      lock.kind === 'pr' &&
      lock.item === String(number) &&
      lock.runId === runId &&
      lock.actor === actor,
    'Atomic PR lock belongs to another owner',
  )
  return object.sha
}

function report(
  read,
  root,
  repo,
  number,
  kind,
  record,
  current,
  trustedAuthors,
) {
  requireGate(
    record?.kind === kind &&
      record.result === 'passed' &&
      record.head === current.head &&
      record.base === current.base &&
      record.policy === current.policy,
    `Missing current independent ${kind} evidence`,
  )
  const prefix = `https://github.com/${repo}/pull/${number}#`
  const match =
    typeof record.source === 'string' && record.source.startsWith(prefix)
      ? /^(issuecomment|pullrequestreview)-([1-9]\d*)$/.exec(
          record.source.slice(prefix.length),
        )
      : null
  requireGate(match, `Invalid ${kind} report reference`)
  const [, type, id] = match
  const comment = read([
    'api',
    type === 'issuecomment'
      ? `${root}/issues/comments/${id}`
      : `${root}/pulls/${number}/reviews/${id}`,
  ])
  requireGate(
    comment.html_url === record.source &&
      trustedAuthors.includes(comment.user?.login) &&
      !['CHANGES_REQUESTED', 'DISMISSED'].includes(comment.state) &&
      (type === 'issuecomment' ||
        (comment.commit_id === current.head &&
          ['APPROVED', 'COMMENTED'].includes(comment.state) &&
          typeof comment.submitted_at === 'string' &&
          comment.submitted_at)) &&
      comment.body
        ?.split(/\r?\n/)
        .includes(`Cezar gate: ${kind} ${current.head} approved`),
    `Published ${kind} verdict is missing, revoked, or stale`,
  )
  return comment
}

function changedPaths(read, root, pr) {
  const files = read([
    'api',
    '--paginate',
    '--slurp',
    `${root}/pulls/${pr.number}/files?per_page=100`,
  ]).flat()
  requireGate(
    Number.isSafeInteger(pr.changed_files) &&
      pr.changed_files > 0 &&
      files.length === pr.changed_files &&
      files.every((file) => typeof file.filename === 'string'),
    'PR file inventory is incomplete',
  )
  return files.flatMap((file) =>
    [file.filename, file.previous_filename].filter(Boolean),
  )
}

function checkSpec(read, root, pr, paths, specPath, review) {
  const specs = paths.filter((path) => path.startsWith(`${specPath}/`))
  if (specs.length !== paths.length) return
  requireGate(
    pr.head.ref.startsWith('spec/') &&
      review.body
        .split(/\r?\n/)
        .includes('Cezar gate: plan-to-spec panel approved'),
    'Spec PR requires its plan-to-spec panel or manual delivery',
  )
  for (const path of specs.filter((path) => path !== `${specPath}/README.md`)) {
    const file = read([
      'api',
      `${root}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${pr.head.sha}`,
    ])
    requireGate(
      file.encoding === 'base64' &&
        /^\|\s*Plan\s*\|\s*[^\s|]/m.test(
          Buffer.from(file.content, 'base64').toString(),
        ),
      'Spec PR needs a Plan row',
    )
  }
}

export function releaseFailedDelivery({
  read,
  releaseRef,
  repo,
  number,
  runId,
}) {
  const root = `repos/${repo}`
  const pr = read(['api', `${root}/pulls/${number}`])
  requireGate(
    pr.number === number && pr.base.ref === 'develop',
    'Cleanup requires the assigned develop PR',
  )
  const actor = read(['api', 'user']).login
  requireGate(
    typeof actor === 'string' && actor,
    'Authenticated tracker actor is unavailable',
  )
  const lock = ownedLock(read, root, repo, number, runId, actor, true)
  if (!lock) return
  if (pr.labels.some(({ name }) => name === 'in-progress'))
    read(
      ['api', '-X', 'DELETE', `${root}/issues/${number}/labels/in-progress`],
      false,
    )
  requireGate(
    ownedLock(read, root, repo, number, runId, actor) === lock,
    'Atomic PR lock changed before cleanup',
  )
  releaseRef(`refs/om-locks/pr-${number}`, lock)
  requireGate(
    !ownedLock(read, root, repo, number, runId, actor, true),
    'PR lock cleanup was not confirmed',
  )
}

export function mergeVerifiedPr({
  read,
  repo,
  number,
  head,
  runId,
  config,
  policy,
  evidence,
  readIntent,
  createIntent,
}) {
  const root = `repos/${repo}`
  const target = `${root}/pulls/${number}`
  const fetchPr = () => read(['api', target])
  function confirmIntent(intent) {
    requireGate(
      intent?.repo === repo &&
        intent.number === number &&
        intent.head === head &&
        intent.runId === runId &&
        sha.test(intent.lock),
      'Merge intent does not match this run and PR',
    )
    const merged = fetchPr()
    requireGate(
      merged.merged === true &&
        merged.head.sha === head &&
        merged.base.ref === 'develop' &&
        sha.test(merged.merge_commit_sha),
      'Merge write is not confirmed; no retry attempted',
    )
    return merged.merge_commit_sha
  }
  const previous = readIntent()
  if (previous) return confirmIntent(previous)
  function checkOpen(pr) {
    requireGate(
      pr.number === number &&
        pr.state === 'open' &&
        pr.draft === false &&
        pr.head?.sha === head &&
        pr.head?.repo?.full_name === repo &&
        pr.base?.ref === 'develop' &&
        sha.test(pr.base.sha) &&
        pr.mergeable === true,
      'PR is outside the exact open, mergeable develop scope',
    )
    const labels = pr.labels.map((label) => label.name)
    requireGate(
      labels.includes('in-progress') &&
        !labels.some((label) => holds.has(label)),
      'PR is held or lacks its in-progress label',
    )
    return labels
  }
  requireGate(
    config.baseBranch === 'develop' &&
      config.pipeline?.requireExecutedCi === true &&
      sha.test(head) &&
      Array.isArray(config.trustedAuthors),
    'Unattended merge policy is unavailable',
  )
  const actor = read(['api', 'user']).login
  requireGate(
    typeof actor === 'string' && actor,
    'Authenticated tracker actor is unavailable',
  )
  const lock = ownedLock(read, root, repo, number, runId, actor)
  const pr = fetchPr()
  const labels = checkOpen(pr)
  const current = { head, base: pr.base.sha, policy }
  const paths = changedPaths(read, root, pr)
  const checkReport = (kind) =>
    report(
      read,
      root,
      repo,
      number,
      kind,
      evidence(kind),
      current,
      config.trustedAuthors,
    )
  const review = checkReport('review')
  checkSpec(read, root, pr, paths, config.paths.specs, review)
  if (paths.some((path) => qaPath.test(path)) || labels.includes('needs-qa')) {
    requireGate(
      labels.includes('needs-qa') &&
        labels.includes('qa-approved') &&
        !labels.includes('skip-qa'),
      'Current QA approval is required',
    )
    checkReport('qa')
  }
  if (
    paths.some((path) => securityPath.test(path)) ||
    labels.some((label) => label === 'risk-high' || label === 'security')
  ) {
    const security = checkReport('security')
    requireGate(
      security.html_url !== review.html_url,
      'Security approval requires a distinct independent report',
    )
  }

  const rules = read([
    'api',
    '--paginate',
    '--slurp',
    `${root}/rules/branches/develop`,
  ]).flat()
  const required = rules
    .filter((rule) => rule.type === 'required_status_checks')
    .flatMap((rule) => rule.parameters.required_status_checks)
  requireGate(
    requiredContexts.every((name) =>
      required.some(
        (check) => check.context === name && check.integration_id === 15368,
      ),
    ),
    'Required repository CI contexts are missing',
  )
  requireGate(
    !rules.some((rule) => rule.type === 'merge_queue'),
    'Develop requires a native merge queue',
  )
  const [owner, name] = repo.split('/')
  const threadPages = read([
    'api',
    'graphql',
    '--paginate',
    '--slurp',
    '-F',
    `owner=${owner}`,
    '-F',
    `name=${name}`,
    '-F',
    `number=${number}`,
    '-f',
    `query=${threadsQuery}`,
  ]).map((page) => page.data.repository.pullRequest.reviewThreads)
  requireGate(
    threadPages.length &&
      threadPages.at(-1).pageInfo.hasNextPage === false &&
      threadPages.every((page) =>
        page.nodes.every(
          (node) => node.isResolved === true || node.isOutdated === true,
        ),
      ),
    'PR has unresolved or unknown review threads',
  )
  const runs = read([
    'api',
    '--paginate',
    '--slurp',
    `${root}/actions/workflows/ci.yml/runs?head_sha=${head}&event=pull_request&per_page=100`,
  ]).flatMap((page) => page.workflow_runs)
  requireGate(
    runs[0]?.head_sha === head &&
      runs[0].event === 'pull_request' &&
      runs[0].path === '.github/workflows/ci.yml' &&
      runs[0].status === 'completed' &&
      runs[0].conclusion === 'success',
    'Repository CI did not execute successfully',
  )
  const state = readPrState(repo, number, read)
  requireGate(
    state.state === 'OPEN' &&
      state.head === head &&
      state.base === 'develop' &&
      state.draft === false &&
      state.ci.state === 'green' &&
      state.ci.workflowRuns > 0 &&
      state.review !== 'changes-requested' &&
      !state.warnings.length,
    'Executed CI or current review status does not permit merge',
  )
  requireGate(
    ownedLock(read, root, repo, number, runId, actor) === lock,
    'Atomic PR lock changed before merge',
  )
  const latest = fetchPr()
  const latestLabels = checkOpen(latest)
  requireGate(
    latest.base.sha === current.base &&
      JSON.stringify(latestLabels.sort()) === JSON.stringify(labels.sort()),
    'PR base or labels changed before merge',
  )

  // Persist intent before the only write. A resumed check only reconciles it.
  const intent = { repo, number, head, base: current.base, runId, lock }
  if (!createIntent(intent)) return confirmIntent(readIntent())
  try {
    read([
      'api',
      '-X',
      'PUT',
      `${target}/merge`,
      '-f',
      `sha=${head}`,
      '-f',
      'merge_method=squash',
    ])
  } catch {
    // A lost response and a refusal both require a read, never another write.
  }
  return confirmIntent(intent)
}
