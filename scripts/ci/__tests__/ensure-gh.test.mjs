import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  writeFileSync,
  chmodSync,
  readFileSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = resolve(import.meta.dirname, '../ensure-gh.sh')

/** Where a tool really lives, resolved once against this process's own PATH. */
const systemPath = (tool) =>
  execFileSync('sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).trim()

// The stub directory is the whole PATH the script runs under, so the handful of real tools it
// and the stubs need are linked into it by hand. Leaving /usr/bin on the PATH instead would
// hand the script whatever `gh` the runner image happens to carry - which is what the
// "carries no gh" cases are supposed to be free of, and what an image that ships one
// (Blacksmith's arm64 Ubuntu does) turns into a failure that says nothing about the script.
const SYSTEM_TOOLS = ['bash', 'cat', 'chmod', 'head', 'sed', 'sort']

/**
 * Run the script against a synthetic PATH: a `gh` that reports whatever version the case wants
 * (or none at all), plus `sudo`, `curl` and `apt-get` stubs that record being called instead of
 * touching the machine. What the script decided is then readable from the recorder.
 */
function run({ ghVersion, min }) {
  const dir = mkdtempSync(join(tmpdir(), 'ensure-gh-'))
  const log = join(dir, 'calls.log')

  for (const tool of SYSTEM_TOOLS)
    symlinkSync(systemPath(tool), join(dir, tool))

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

  const r = spawnSync(systemPath('bash'), [SCRIPT], {
    encoding: 'utf8',
    env: {
      // The stub directory and nothing else: what the script cannot find there, it cannot find.
      PATH: dir,
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
