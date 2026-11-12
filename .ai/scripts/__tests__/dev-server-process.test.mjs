import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  describePortHolders,
  procArgs,
  procFields,
} from '../dev-server-process.mjs'

it('retains empty arguments and removes only the final command-line separator', () => {
  expect(procArgs('node\0\0vite.js\0dev\0')).toEqual([
    'node',
    '',
    'vite.js',
    'dev',
  ])
  expect(procArgs('')).toEqual([])
})

it('diagnoses an orphaned holder without terminating it', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'orphan-port-test-'))
  const child = spawn(
    process.execPath,
    [
      '-e',
      `require('node:net').createServer().listen(0, '127.0.0.1', function () { console.log(this.address().port) })`,
    ],
    { cwd, stdio: ['ignore', 'pipe', 'ignore'] },
  )
  try {
    const [ready] = await once(child.stdout, 'data')
    const port = Number(ready.toString().trim())
    rmSync(cwd, { recursive: true, force: true })
    const report = describePortHolders(port)
    expect(report).toContain(`pid ${child.pid}`)
    expect(report).toContain('ORPHANED')
    expect(() => process.kill(child.pid, 0)).not.toThrow()
  } finally {
    child.kill('SIGTERM')
    await once(child, 'exit')
    rmSync(cwd, { recursive: true, force: true })
  }
})

it('reads Linux start time after a command name containing spaces and parentheses', () => {
  const fields = ['S', '42', ...Array(17).fill('0'), '987654']
  expect(procFields(`123 (node (test) worker) ${fields.join(' ')}`)[19]).toBe(
    '987654',
  )
  expect(procFields(`123 (node (test) worker) ${fields.join(' ')}`)[1]).toBe(
    '42',
  )
})
