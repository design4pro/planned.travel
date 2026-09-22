// `free-port.mjs` decides whether the e2e gate step gets a port, waits for one, or reports that it
// could not run at all (issue #324). The failure it exists to prevent is silent in the other
// direction: a full port pool read as a failed suite, on a branch that broke nothing.
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { EXIT_POOL_FULL, waitForFreePort } from '../free-port.mjs'

const SCRIPT = fileURLToPath(new URL('../free-port.mjs', import.meta.url))
const read = (path) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

const pool = (busy, pauses) => ({
  min: 3030,
  max: 3032,
  waitMs: 10_000,
  pollMs: 5_000,
  isBusy: async (port) => busy.has(port),
  pause: async (ms) => {
    pauses.push(ms)
  },
})

describe('waitForFreePort', () => {
  it('takes the first free port without waiting', async () => {
    const pauses = []
    expect(await waitForFreePort(pool(new Set([3030]), pauses))).toBe(3031)
    expect(pauses).toEqual([])
  })

  it('waits for a slot to free when the pool is full', async () => {
    const busy = new Set([3030, 3031, 3032])
    const port = await waitForFreePort({
      ...pool(busy, []),
      pause: async () => {
        busy.delete(3032)
      },
    })
    expect(port).toBe(3032)
  })

  it('gives up once the wait is spent, re-scanning every poll until then', async () => {
    const pauses = []
    expect(
      await waitForFreePort(pool(new Set([3030, 3031, 3032]), pauses)),
    ).toBeNull()
    expect(pauses).toEqual([5_000, 5_000])
  })
})

describe('free-port.mjs', { timeout: 15_000 }, () => {
  const servers = []
  afterEach(() => {
    for (const server of servers.splice(0)) server.close()
  })

  const listen = () =>
    new Promise((resolve) => {
      const server = createServer()
      server.listen(0, '127.0.0.1', () => resolve(server))
    })

  // Asynchronous on purpose: a synchronous spawn would stall the listener it probes.
  const run = (port, env = {}) =>
    new Promise((resolve) => {
      execFile(
        process.execPath,
        [SCRIPT, '127.0.0.1', String(port), String(port)],
        { env: { ...process.env, ...env }, timeout: 10_000 },
        (error, stdout, stderr) =>
          resolve({ status: error ? error.code : 0, stdout, stderr }),
      )
    })

  it('exits 75 with no port on stdout when the pool stays full', async () => {
    const server = await listen()
    servers.push(server)
    const result = await run(server.address().port, {
      TEST_ENV_PORT_WAIT_SECONDS: '0',
    })
    expect(result.status).toBe(EXIT_POOL_FULL)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('no free port')
    expect(result.stderr).toContain(`pid ${process.pid}`)
    expect(result.stderr).toContain(process.cwd())
  })

  it('prints a free port and exits 0', async () => {
    const server = await listen()
    const { port } = server.address()
    await new Promise((resolve) => server.close(resolve))
    const result = await run(port, { TEST_ENV_PORT_WAIT_SECONDS: '0' })
    expect(result).toMatchObject({ status: 0, stdout: `${port}\n` })
  })
})

describe('the reserved port pool', () => {
  // playwright.config.ts refuses a base URL outside the pool, so a pool that drifts from its guard
  // turns every gate run red for a reason that has nothing to do with the diff.
  it('is the same range in test-env-up.sh and playwright.config.ts', () => {
    const up = read('../test-env-up.sh')
    const min = up.match(/^PORT_MIN=(\d+)$/m)?.[1]
    const max = up.match(/^PORT_MAX=(\d+)$/m)?.[1]
    expect(min).toBeDefined()
    expect(max).toBeDefined()
    expect(read('../../../playwright.config.ts')).toContain(
      `port < ${min} || port > ${max}`,
    )
  })
})
