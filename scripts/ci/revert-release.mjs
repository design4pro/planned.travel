import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Revert on develop so the next promotion cannot reintroduce a rolled-back release.
export function prepareRevert({ repo, healthy, failed, incident }) {
  assert.match(repo, /^[\w.-]+\/[\w.-]+$/)
  for (const sha of [healthy, failed]) assert.match(sha, /^[a-f0-9]{40}$/)
  assert(Number.isSafeInteger(incident) && incident > 0)
  const run = (command, args, cwd) =>
    execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 32 * 1024 * 1024,
    }).trim()
  const branch = `recovery/release-${failed}`
  const existing = JSON.parse(
    run('gh', [
      'pr',
      'list',
      '--repo',
      repo,
      '--head',
      branch,
      '--state',
      'all',
      '--json',
      'url',
    ]),
  )
  if (existing.length) return existing[0].url
  run('git', ['fetch', 'origin', 'main', 'develop'])
  assert.equal(
    run('git', ['rev-parse', 'origin/main']),
    failed,
    'Main advanced; repair needs human review',
  )
  run('git', ['merge-base', '--is-ancestor', healthy, failed])
  const commits = run('git', [
    'rev-list',
    '--first-parent',
    `${healthy}..${failed}`,
  ])
    .split('\n')
    .filter(Boolean)
  assert(commits.length > 0, 'Empty recovery range')
  const scratch = mkdtempSync(join(tmpdir(), 'release-revert-'))
  const tree = join(scratch, 'worktree')
  let added = false
  try {
    run('git', ['worktree', 'add', '-b', branch, tree, 'origin/develop'])
    added = true
    for (const commit of commits) {
      const parents =
        run('git', ['rev-list', '--parents', '-n', '1', commit], tree).split(
          ' ',
        ).length - 1
      assert(parents === 1 || parents === 2, 'Unexpected release ancestry')
      run(
        'git',
        [
          'revert',
          '--no-commit',
          ...(parents === 2 ? ['-m', '1'] : []),
          commit,
        ],
        tree,
      )
    }
    assert.equal(
      run(
        'git',
        [
          'diff',
          '--cached',
          '--name-only',
          '--',
          'drizzle',
          'src/server/db',
          'wrangler.jsonc',
        ],
        tree,
      ),
      '',
      'Recovery must not revert schema or bindings',
    )
    run('git', ['diff', '--cached', '--check'], tree)
    run(
      'git',
      [
        '-c',
        'user.name=planned.travel release recovery',
        '-c',
        'user.email=release-recovery@users.noreply.github.com',
        'commit',
        '-m',
        `fix: revert failed production release ${failed.slice(0, 12)}`,
      ],
      tree,
    )
    run('git', ['push', 'origin', branch], tree)
    const body = join(scratch, 'body.md')
    writeFileSync(
      body,
      `Reverts the first-parent production range ${healthy}..${failed} on develop after a verified Worker rollback.\n\nRefs #${incident}. Keep the incident open until this repair passes the full review, QA and CI gates, merges, and production is verified. This draft does not reverse database migrations.\n`,
    )
    return run(
      'gh',
      [
        'pr',
        'create',
        '--repo',
        repo,
        '--base',
        'develop',
        '--head',
        branch,
        '--draft',
        '--title',
        `fix: recover production ${failed.slice(0, 12)}`,
        '--body-file',
        body,
      ],
      tree,
    )
  } finally {
    if (added) run('git', ['worktree', 'remove', '--force', tree])
    rmSync(scratch, { recursive: true, force: true })
  }
}
