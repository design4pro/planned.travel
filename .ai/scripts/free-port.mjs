#!/usr/bin/env node
// The port half of `test-env-up.sh`: a free port from the reserved pool, waiting a bounded time
// for one instead of failing the moment the pool is full (issue #324).
//
// More worktrees are routinely checked out than the pool has ports, and every busy port belongs to
// a dev server: `test-env-up.sh` leaves its server running for the next step to reuse, and a server
// whose worktree was removed stops itself within 30 s (`stopWhenRootIsRemoved` in vite.config.ts,
// issue #327). A slot therefore frees when a sibling run removes its worktree, which is what the wait
// gives a chance to happen. Nothing here signals another checkout's process.
//
// When the pool stays full past the wait this exits 75 (EX_TEMPFAIL, sysexits.h), never 1: the suite
// did not run, and a caller that reads only the exit status must be able to tell that apart from a
// failed one.
//
// Usage: node .ai/scripts/free-port.mjs <host> <min> <max>
// Prints the port on stdout. TEST_ENV_PORT_WAIT_SECONDS (default 300) bounds the wait,
// TEST_ENV_PORT_POLL_SECONDS (default 5) spaces the re-scans.
import { connect } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

export const EXIT_POOL_FULL = 75

// A connect probe, as the shell version always was: something answering is busy, a refusal or a
// timeout is free. Not bash's /dev/tcp, which under dash fails and reads as "free" for every port.
export function portBusy(host, port) {
  return new Promise((resolve) => {
    const socket = connect({ host, port })
    socket.setTimeout(1000)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

// The first port in [min, max] that `isBusy` reports free, re-scanning every `pollMs` until
// `waitMs` has passed; `null` when none freed in time.
export async function waitForFreePort({
  min,
  max,
  waitMs,
  pollMs,
  isBusy,
  pause = sleep,
}) {
  for (let waited = 0; ; waited += pollMs) {
    for (let port = min; port <= max; port++) {
      if (!(await isBusy(port))) return port
    }
    if (waited >= waitMs) return null
    await pause(pollMs)
  }
}

const seconds = (name, fallback) => {
  const value = Number(process.env[name])
  return process.env[name] && Number.isInteger(value) && value >= 0
    ? value
    : fallback
}

async function main([host, min, max]) {
  const waitSeconds = seconds('TEST_ENV_PORT_WAIT_SECONDS', 300)
  // At least a second: a zero poll with a non-zero wait would re-scan forever.
  const pollSeconds = Math.max(seconds('TEST_ENV_PORT_POLL_SECONDS', 5), 1)
  let announced = false
  const port = await waitForFreePort({
    min: Number(min),
    max: Number(max),
    waitMs: waitSeconds * 1000,
    pollMs: pollSeconds * 1000,
    isBusy: (candidate) => portBusy(host, candidate),
    pause: (ms) => {
      if (!announced) {
        announced = true
        process.stderr.write(
          `==> no free port in ${min}-${max}; waiting up to ${waitSeconds}s for one\n`,
        )
      }
      return sleep(ms)
    },
  })
  if (port === null) {
    process.stderr.write(
      `ERROR: no free port in ${min}-${max} after waiting ${waitSeconds}s\n`,
    )
    process.exit(EXIT_POOL_FULL)
  }
  process.stdout.write(`${port}\n`)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main(process.argv.slice(2))
}
