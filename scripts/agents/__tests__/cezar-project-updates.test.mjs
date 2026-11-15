import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { ProjectSkillUpdater } from '../cezar-project-updates.mjs'

const cleanups = []
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup())
  vi.useRealTimers()
})
function fixture(run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'project-updater-')))
  cleanups.push(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, '.agents'))
  writeFileSync(
    join(root, '.agents/skills-updates.json'),
    JSON.stringify({
      enabled: true,
      source: 'open-mercato/skills',
      branch: 'main',
      intervalHours: 6,
    }),
  )
  const registry = join(root, 'registry.json')
  writeFileSync(
    registry,
    JSON.stringify({ projects: [{ root, commonDir: join(root, '.git') }] }),
  )
  const service = new ProjectSkillUpdater({
    projectUpdateRegistry: registry,
    projectUpdateRun: run,
  })
  cleanups.push(() => service.stop())
  return { root, service, registry }
}

it('installs automatically at startup and every six hours without duplicate concurrent workers', async () => {
  vi.useFakeTimers()
  const run = vi.fn(async () => ({
    stdout: JSON.stringify({
      status: 'current',
      installedSha: 'a'.repeat(40),
      latestSha: 'a'.repeat(40),
    }),
  }))
  const { root, service } = fixture(run)
  await Promise.all([service.check(root), service.check(root)])
  expect(run).toHaveBeenCalledTimes(1)
  expect(service.snapshot(root).autoUpdateEnabled).toBe(true)
  await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
  expect(run).toHaveBeenCalledTimes(2)
})

it('retries deferred installations after five minutes and reports their real reason', async () => {
  vi.useFakeTimers()
  const run = vi.fn(async () => ({
    stdout: JSON.stringify({
      status: 'deferred',
      message: 'Project skills are in use.',
    }),
  }))
  const { root, service } = fixture(run)
  const result = await service.check(root)
  expect(result.managedMessage).toBe('Project skills are in use.')
  expect(result.available).toBe(false)
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
  expect(run).toHaveBeenCalledTimes(2)
})

it('never runs for a project without explicit enrollment', async () => {
  const run = vi.fn()
  const { root, service, registry } = fixture(run)
  writeFileSync(registry, '{"projects":[]}')
  const result = await service.check(root, true)
  expect(result.autoUpdateEnabled).toBe(false)
  expect(run).not.toHaveBeenCalled()
})

it('removing a project stops future scheduled checks', async () => {
  vi.useFakeTimers()
  const run = vi.fn(async () => ({ stdout: '{"status":"current"}' }))
  const { root, service } = fixture(run)
  await service.check(root)
  service.evict(root)
  await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000)
  expect(run).toHaveBeenCalledTimes(1)
})

it('a pending worker cannot re-enroll an evicted project in the timer', async () => {
  vi.useFakeTimers()
  let finish
  const run = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { root, service } = fixture(run)
  const pending = service.check(root)
  await Promise.resolve()
  service.evict(root)
  finish({ stdout: '{"status":"current"}' })
  await pending
  await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000)
  expect(run).toHaveBeenCalledTimes(1)
  expect(service.snapshot(root).nextCheckAt).toBe(null)
})
