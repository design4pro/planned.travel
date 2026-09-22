#!/usr/bin/env node
// PID files are hints, not ownership: validate cwd, command and process start time before signaling.
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  realpathSync,
  readlinkSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

const output = (command, args) => {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}
const canonical = (path) => {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}
const read = (path) => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}
const linuxPids = () =>
  readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .map(Number)
// comm may itself contain spaces and parentheses; the final closing parenthesis ends it.
export const procFields = (stat) =>
  stat
    .slice(stat.lastIndexOf(')') + 2)
    .trim()
    .split(/\s+/)
const procStat = (pid) => procFields(read(`/proc/${pid}/stat`))
const live = (pid) => {
  if (!Number.isInteger(pid) || pid <= 1) return false
  try {
    process.kill(pid, 0)
    return process.platform === 'linux'
      ? procStat(pid)[0] !== 'Z'
      : !output('ps', ['-p', String(pid), '-o', 'stat=']).startsWith('Z')
  } catch {
    return false
  }
}
export function processInfo(pid) {
  // Minimal Linux runners need neither lsof nor procps for ownership verification.
  if (process.platform === 'linux') {
    let cwd = ''
    try {
      cwd = readlinkSync(`/proc/${pid}/cwd`)
    } catch {}
    const started = procStat(pid)[19]
    return {
      pid,
      cwd: canonical(cwd),
      command: read(`/proc/${pid}/cmdline`).replace(/\0/g, ' ').trim(),
      started: started
        ? `${read('/proc/sys/kernel/random/boot_id').trim()}:${started}`
        : '',
    }
  }
  const cwd = output('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
    .split('\n')
    .find((line) => line.startsWith('n'))
    ?.slice(1)
  return {
    pid,
    cwd: cwd ? canonical(cwd) : '',
    command: output('ps', ['-p', String(pid), '-o', 'args=']),
    started: output('ps', ['-p', String(pid), '-o', 'lstart=']),
  }
}
const isVite = (info, root) =>
  info.cwd === root &&
  info.started &&
  /(?:^|\/)vite(?:\.js)?\s+(?:dev|--port)\b/.test(info.command)
const isWrapper = (info, root) =>
  info.cwd === root &&
  info.started &&
  /pnpm\b.*\bexec vite dev\b/.test(info.command)
const matches = (saved, current) =>
  ['pid', 'cwd', 'command', 'started'].every(
    (key) => saved[key] === current[key],
  )
const paths = (root) => ({
  identity: join(root, '.ai/qa/dev-server-process.json'),
  pid: join(root, '.ai/qa/dev-server.pid'),
})

function recorded(root) {
  const files = paths(root)
  if (existsSync(files.identity))
    return [JSON.parse(readFileSync(files.identity, 'utf8'))]
  // Migrate the old PID-only format conservatively, including pnpm's actual Vite child.
  let pid = existsSync(files.pid)
    ? Number(readFileSync(files.pid, 'utf8').trim())
    : null
  const descriptor = join(root, '.ai/qa/test-env.json')
  if (!pid && existsSync(descriptor))
    pid = JSON.parse(readFileSync(descriptor, 'utf8')).app?.pid
  if (!pid || !live(pid)) return []
  const info = processInfo(pid)
  if (isVite(info, root)) return [info]
  if (isWrapper(info, root)) {
    const processPairs =
      process.platform === 'linux'
        ? linuxPids().map((child) => [child, Number(procStat(child)[1])])
        : output('ps', ['-axo', 'pid=,ppid='])
            .split('\n')
            .map((line) => line.trim().split(/\s+/).map(Number))
    const children = processPairs
      .filter(([, parent]) => parent === pid)
      .map(([child]) => processInfo(child))
      .filter((child) => isVite(child, root))
    if (children.length === 1) return [...children, info]
  }
  throw new Error(
    `Refusing to signal unverified pid ${pid} (cwd: ${info.cwd || 'unavailable'})`,
  )
}

export function ownsServer(root, port) {
  root = canonical(root)
  const records = recorded(root)
  return (
    records.length > 0 &&
    records.every(
      (saved) =>
        (isVite(saved, root) || isWrapper(saved, root)) &&
        live(saved.pid) &&
        matches(saved, processInfo(saved.pid)),
    ) &&
    records[0].port === Number(port)
  )
}

export function rememberServer(root, pid, port) {
  root = canonical(root)
  const info = processInfo(Number(pid))
  if (!isVite(info, root))
    throw new Error(`Cannot identify started Vite pid ${pid}`)
  writeFileSync(
    paths(root).identity,
    JSON.stringify({ ...info, port: Number(port) }) + '\n',
  )
}

export async function stopServer(root) {
  root = canonical(root)
  for (const saved of recorded(root)) {
    if (!live(saved.pid)) continue
    if (
      !(isVite(saved, root) || isWrapper(saved, root)) ||
      !matches(saved, processInfo(saved.pid))
    ) {
      throw new Error(
        `Refusing to signal reused or unverified pid ${saved.pid}`,
      )
    }
    process.kill(saved.pid, 'SIGTERM')
    for (let attempt = 0; attempt < 50 && live(saved.pid); attempt++)
      await sleep(100)
    if (live(saved.pid))
      throw new Error(
        `Vite pid ${saved.pid} did not stop; refusing to start another server`,
      )
  }
  for (const file of Object.values(paths(root)))
    if (existsSync(file)) unlinkSync(file)
}

export function portHolders(port) {
  if (process.platform === 'linux') {
    const inodes = new Set(
      ['tcp', 'tcp6'].flatMap((table) =>
        read(`/proc/net/${table}`)
          .trim()
          .split('\n')
          .slice(1)
          .map((line) => line.trim().split(/\s+/))
          .filter(
            (fields) =>
              fields[3] === '0A' &&
              parseInt(fields[1].split(':')[1], 16) === Number(port),
          )
          .map((fields) => `socket:[${fields[9]}]`),
      ),
    )
    return linuxPids()
      .filter((pid) => {
        try {
          return readdirSync(`/proc/${pid}/fd`).some((fd) => {
            try {
              return inodes.has(readlinkSync(`/proc/${pid}/fd/${fd}`))
            } catch {
              return false
            }
          })
        } catch {
          return false
        }
      })
      .map(processInfo)
  }
  return output('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    .split(/\s+/)
    .filter(Boolean)
    .map(Number)
    .map(processInfo)
}

export function describePortHolders(port) {
  const holders = portHolders(port)
  if (!holders.length) return `  :${port} holder not visible to this user\n`
  return holders
    .map((holder) => {
      const orphaned =
        holder.cwd && !existsSync(holder.cwd.replace(/ \(deleted\)$/, ''))
      return `  :${port} pid ${holder.pid} cwd ${holder.cwd || 'unavailable'}${orphaned ? ' ORPHANED' : ''}\n`
    })
    .join('')
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [action, first, second] = process.argv.slice(2)
    if (action === 'record') rememberServer(process.cwd(), first, second)
    else if (action === 'stop') await stopServer(process.cwd())
    else if (action === 'holders')
      process.stderr.write(describePortHolders(first))
    else if (action === 'owned')
      process.exitCode = ownsServer(process.cwd(), first) ? 0 : 1
    else throw new Error(`Unknown lifecycle action: ${action}`)
  } catch (error) {
    console.error(`ERROR: ${error.message}`)
    process.exitCode = 1
  }
}
