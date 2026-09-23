import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workflow = (name: string) =>
  readFileSync(resolve(__dirname, `../../cezar/workflows/${name}.yml`), 'utf8')

describe('Cezar workflow bootstrap', () => {
  it('reconciles merged issues before dependency installation and agent review', () => {
    const steps = workflow('housekeeping')
    const reconcile = steps.indexOf('\n  - id: close-fixed\n')
    const bootstrap = steps.indexOf('\n  - id: bootstrap\n')
    const review = steps.indexOf('\n  - id: review-prs\n')

    expect(reconcile).toBeGreaterThan(-1)
    expect(bootstrap).toBeGreaterThan(reconcile)
    expect(review).toBeGreaterThan(bootstrap)
  })

  it('installs dependencies for spec runs without changing shared Git hooks', () => {
    const spec = workflow('spec')

    expect(spec).toContain('command: HUSKY=0 pnpm install --frozen-lockfile --prefer-offline && pnpm generate-routes')
    expect(spec).not.toContain('scripts/worktree/bootstrap.sh --profile worktree --no-seed')
  })
})
