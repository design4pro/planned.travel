export const highRiskPath = (path) =>
  /^(?:drizzle\/|\.github\/|\.claude\/|\.agents\/|\.ai\/|scripts\/|src\/server\/(?:auth\/|billing\/|public\/|db\/|repos\/(?:base|billing)|queue\/handlers\/billing)|wrangler\.|package\.json|pnpm-lock|SDLC\.md|CODE_REVIEW\.md|AGENTS\.md|BACKWARD_COMPATIBILITY\.md)/.test(
    path,
  )

export function promotionDecision({
  sha,
  staging,
  ci,
  files,
  prs,
  approved,
  incident,
  now = Date.now(),
}) {
  if (incident) return 'Production incident blocks releases'
  if (
    !/^[a-f0-9]{40}$/.test(sha ?? '') ||
    !staging?.version ||
    staging.sha !== sha ||
    staging.smoke !== true
  )
    return 'Missing deployment evidence for candidate'
  const start = Date.parse(staging.observedFrom)
  const end = Date.parse(staging.verifiedAt)
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end - start < 30 * 60_000 ||
    now < end ||
    now - end > 15 * 60_000
  )
    return 'Staging observation is incomplete or stale'
  if (ci !== 'green') return 'Required CI is not green'
  if (
    !Array.isArray(files) ||
    !files.length ||
    !Array.isArray(prs) ||
    !prs.length
  )
    return 'Release scope is unknown'
  if (
    (files.some(highRiskPath) ||
      prs.some(
        (pr) =>
          !pr.known ||
          pr.labels.some((label) => ['risk-high', 'security'].includes(label)),
      )) &&
    !approved
  )
    return 'High-risk range requires a current-head release approval'
  return null
}

// Promotion PR jobs are intentionally skipped; the same SHA's full develop push is canonical.
export function promotionCi(workflow, sha, prCi) {
  return workflow?.status === 'completed' &&
    workflow.conclusion === 'success' &&
    workflow.head_sha === sha &&
    workflow.head_branch === 'develop' &&
    workflow.event === 'push' &&
    workflow.path === '.github/workflows/ci.yml' &&
    ['green', 'pending'].includes(prCi?.state) &&
    prCi.pending === 0
    ? 'green'
    : 'unknown'
}

export function rollbackDecision({
  healthy,
  failed,
  schemaCompatible,
  attempted,
  incident,
}) {
  return Boolean(
    !incident &&
    !attempted &&
    schemaCompatible === true &&
    healthy?.smoke === true &&
    healthy.version &&
    healthy.sha &&
    failed?.version &&
    healthy.version !== failed.version,
  )
}

export function releaseApproved(reviews, comments, trusted, sha) {
  const decisions = [
    ...reviews
      .filter(
        (r) =>
          r.commit_id === sha &&
          ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state),
      )
      .map((r) => ({
        login: r.user.login,
        at: r.submitted_at,
        approve: r.state === 'APPROVED',
      })),
    ...comments.flatMap((c) => {
      const match = /^\/(approve|revoke)-release ([a-f0-9]{40})$/.exec(
        c.body.trim(),
      )
      return match?.[2] === sha
        ? [
            {
              login: c.user.login,
              at: c.updated_at,
              approve: match[1] === 'approve',
            },
          ]
        : []
    }),
  ]
    .filter(
      (d) => trusted.includes(d.login) && Number.isFinite(Date.parse(d.at)),
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return decisions.at(-1)?.approve === true
}
