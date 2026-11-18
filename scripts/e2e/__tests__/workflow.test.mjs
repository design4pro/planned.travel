import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../../../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

function nativeStep(workflow) {
  const start = workflow.indexOf('        id: native-tests')
  expect(start).toBeGreaterThan(0)
  const end = workflow.indexOf('\n      - name:', start)
  return workflow.slice(start, end)
}

describe('both e2e engines remain a required CI verdict', () => {
  it.each([
    ['.github/workflows/ci.yml', 'chromium'],
    ['.github/workflows/e2e-webkit.yml', 'webkit'],
  ])('requires the native runner in %s', (path, target) => {
    const source = read(path)
    const step = nativeStep(source)
    expect(step).toContain(`pnpm exec e2e run --target ${target} --shard=`)
    expect(step).toContain("!cancelled() && steps.tests.outcome != 'skipped'")
    expect(step).not.toContain('continue-on-error')
    expect(step).not.toMatch(/secrets\.|TOKEN|API_KEY|pull_request_target/)
    expect(source).toContain(
      'pnpm exec e2e run --config e2e.browser.config.ts --target',
    )
    expect(source).not.toContain('pnpm exec playwright test')
    const probe = source
      .slice(source.indexOf('      - name: Verify the browser engine contract'))
      .split('\n      - name:')[0]
    expect(probe).toContain('run: pnpm e2e:verify-engine')
    expect(probe).not.toContain('continue-on-error')
    expect(probe).not.toContain('if:')
    expect(source).toContain('timeout-minutes: 50')
    expect(source).not.toMatch(/path: \.e2e\/?\s*$/m)
  })

  it('installs the browser version owned by each engine', () => {
    const source = read('.github/actions/e2e-env/action.yml')
    const guard =
      'if [ "$(id -u)" = 0 ] || command -v sudo >/dev/null 2>&1; then'
    expect(source).toContain(guard)
    const install = source.split(guard)[1].split('        fi')[0]
    const [privileged, unprivileged] = install.split('        else')
    for (const owner of ['e2e-web', 'playwright']) {
      expect(privileged).toContain(
        `pnpm exec ${owner} install --with-deps \${{ inputs.browsers }}`,
      )
      expect(unprivileged).toContain(
        `pnpm exec ${owner} install \${{ inputs.browsers }}`,
      )
    }
    expect(unprivileged).not.toContain('--with-deps')
  })

  it('preserves the protected aggregate check and its dependency on the shards', () => {
    const source = read('.github/workflows/ci.yml')
    expect(source).toContain('name: e2e · merged report')
    expect(source).toContain('needs: [scope, e2e, verify, test]')
  })
})
