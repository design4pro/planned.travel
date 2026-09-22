import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const descriptors = [
  '.ai/trackers/github.md',
  '.claude/skills/om-setup-agent-pipeline/references/trackers/github.md',
]

function mergeCommand(path) {
  const document = readFileSync(path, 'utf8')
  const section = document.split('#### merge-pr\n')[1].split('\n#### ')[0]
  return section
    .match(/```bash\n([\s\S]*?)\n```/)[1]
    .replaceAll('{prNumber}', '123')
    .replaceAll('{owner}', 'test-owner')
    .replaceAll('{repo}', 'test-repo')
}

function run(command, base, queue = false, failure = '') {
  // Execute the documented operation, with a local gh function: no tracker requests occur.
  const mock = `
    gh() {
      case "$1 $2" in
        'pr view') [ "$TEST_FAILURE" != view ] || return 1; printf '%s' "$TEST_BASE" ;;
        'api repos/test-owner/test-repo/rules/branches/'*)
          [ "$TEST_FAILURE" != rules ] || return 1
          [ "$TEST_QUEUE" != yes ] || printf 'merge_queue\\n'
          return 0 ;;
        'pr merge') printf '%s\\n' "$*" ;;
        *) return 1 ;;
      esac
    }
  `
  return spawnSync('bash', ['-c', `${mock}\n${command}`], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      TEST_BASE: base,
      TEST_QUEUE: queue ? 'yes' : 'no',
      TEST_FAILURE: failure,
    },
  })
}

for (const descriptor of descriptors) {
  describe(descriptor, () => {
    const command = mergeCommand(descriptor)
    it('preserves ancestry on main with a merge commit', () => {
      const result = run(command, 'main')
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('--merge')
      expect(result.stdout).not.toContain('--squash')
    })
    it.each(['develop', 'release/next'])('keeps squash on %s', (base) => {
      const result = run(command, base)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('--squash')
    })
    it.each(['main', 'develop'])(
      'delegates to the queue on %s without a strategy',
      (base) => {
        const result = run(command, base, true)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('pr merge 123')
        expect(result.stdout).not.toMatch(
          /--(?:squash|merge|rebase|delete-branch)/,
        )
      },
    )
    it.each(['view', 'rules'])(
      'never attempts a merge after a failed %s read',
      (failure) => {
        const result = run(command, 'main', false, failure)
        expect(result.status).not.toBe(0)
        expect(result.stdout).not.toContain('pr merge')
      },
    )
    it.each(['', 'null'])(
      'fails closed without a resolved base branch: %s',
      (base) => {
        const result = run(command, base)
        expect(result.status).not.toBe(0)
        expect(result.stdout).not.toContain('pr merge')
      },
    )
  })
}
