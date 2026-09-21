import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = resolve(import.meta.dirname, '../ensure-gh.sh')

/**
 * Run the script against a synthetic PATH: a `gh` that reports whatever version the case wants
 * (or none at all), plus `sudo`, `curl` and `apt-get` stubs that record being called instead of
 * touching the machine. What the script decided is then readable from the recorder.
 */
function run({ ghVersion, min }) {
  const dir = mkdtempSync(join(tmpdir(), 'ensure-gh-'))
  const log = join(dir, 'calls.log')

  const stub = (name, body) => {
    const path = join(dir, name)
    writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`)
    chmodSync(path, 0o755)
  }

  if (ghVersion) stub('gh', `echo "gh version ${ghVersion} (2026-01-01)"`)

  // Every path that would change the machine is recorded and neutered. `sudo` is the only one
  // the script reaches the system through, so the recorder lives there: it logs the argv, and
  // for `tee` it also logs stdin, which is where the apt source line - the one carrying the
  // architecture - actually travels. On `apt-get install` it materialises a `gh`, because that
  // is what a real install leaves behind and the script verifies its own work afterwards.
  stub(
    'sudo',
    [
      `echo "sudo $*" >> "${log}"`,
      `[ "$1" = tee ] && cat >> "${log}"`,
      `if [ "$1" = apt-get ] && [ "$2" = install ]; then`,
      `  printf '#!/usr/bin/env bash\\necho "gh version 2.101.0 (2026-01-01)"\\n' > "${dir}/gh"`,
      `  chmod +x "${dir}/gh"`,
      `fi`,
      `exit 0`,
    ].join('\n'),
  )
  stub('curl', `echo "curl $*" >> "${log}"; echo fake-key`)
  stub('dpkg', 'echo arm64')

  const r = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      // `dir` first so the stubs win; the real coreutils still have to be reachable.
      PATH: `${dir}:/usr/bin:/bin`,
      ...(min ? { GH_MIN_VERSION: min } : {}),
    },
  })

  let calls = ''
  try {
    calls = readFileSync(log, 'utf8')
  } catch {
    calls = ''
  }
  return { status: r.status, stdout: r.stdout, calls }
}

describe('ensure-gh.sh', () => {
  it('leaves a new-enough gh alone', () => {
    const r = run({ ghVersion: '2.101.0' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('already on PATH')
    expect(r.calls).toBe('')
  })

  // The boundary itself passes: the rule is "at least", not "above".
  it('accepts exactly the minimum', () => {
    const r = run({ ghVersion: '2.82.1', min: '2.82.1' })
    expect(r.status).toBe(0)
    expect(r.calls).toBe('')
  })

  // 2.9.0 sorts above 2.82.1 as a string and below it as a version. Getting this backwards is
  // the whole reason the comparison is `sort -V` and not a test on the text.
  it('upgrades a client that only looks newer', () => {
    const r = run({ ghVersion: '2.9.0', min: '2.82.1' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Upgrading gh')
    expect(r.calls).toContain('apt-get install')
  })

  // The case the whole script exists for: an image that stops carrying the CLI. An empty
  // version string must not read as "new enough" on the way through `sort -V`.
  it('installs when the image carries no gh at all', () => {
    const r = run({ ghVersion: null })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('carries no GitHub CLI')
    expect(r.calls).toContain('apt-get install')
  })

  it('asks apt for the architecture it is actually on', () => {
    const r = run({ ghVersion: null })
    expect(r.calls).toContain('arch=arm64')
  })
})
