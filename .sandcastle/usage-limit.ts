/**
 * Waiting out a Claude usage limit instead of dying on it.
 *
 * When the subscription's session limit is reached, the agent CLI exits non-zero and the library
 * turns that into an `AgentError` whose message carries the CLI's own words:
 *
 *     claude-code exited with code 1:
 *     You've hit your session limit · resets 12:20am (UTC)
 *
 * Inside `workIssue` that rejection is caught by `Promise.allSettled` and costs one issue. At the
 * top level — planner, merger, auditor — it is an uncaught exception that kills the whole loop
 * mid-flight, which is how a run once ended with three issue branches cut and empty and its
 * merged work stranded, unpushed, on the operator's disk. Neither outcome is right: a usage limit
 * is not a failure, it is a wait.
 *
 * The matching is on the message text, not `instanceof`. `AgentError` is not exported from the
 * library's public surface, and what actually reaches a `catch` is Effect's `FiberFailure` wrapper
 * around it — binding to either would be a dependency on a private shape that a patch release is
 * free to change. A string that says "the agent exited and the reason it gave was a limit" is the
 * stable part.
 */

import { setTimeout as delay } from 'node:timers/promises'

/** What the agent said about the limit it hit. */
export interface UsageLimit {
  /** When the limit lifts. */
  readonly resetsAt: Date
  /** False when no reset time could be read and `resetsAt` is the fallback guess. */
  readonly precise: boolean
}

/** No reset time in the message: wait this long and ask the API again rather than give up. */
export const BLIND_WAIT_MS = 60 * 60 * 1000

/** Come back after the reset, not on it — a clock a minute fast would spend the retry for nothing. */
export const WAKE_MARGIN_MS = 60 * 1000

/**
 * Longest single wait. Past this the run stops and the operator resumes it later with
 * `pnpm sandcastle --run <full id>`, which costs nothing: the work is on the branches.
 */
const MAX_WAIT_MS = Number(
  process.env.SANDCASTLE_LIMIT_WAIT_MAX_MS ?? 6 * 60 * 60 * 1000,
)

/** Consecutive waits one stage may sit through before the error is allowed to stand. */
const MAX_WAITS_PER_STAGE = 3

/** It came from an agent process, not from git, the coordinator or our own code. */
const AGENT_EXIT = /exited with code \d+/

/** …and the reason it gave was a limit rather than a bug. */
const LIMIT_REASONS = [
  /hit your (?:session|usage) limit/i,
  /usage limit reached/i,
  /rate.?limit/i,
  /\b429\b/,
]

/** `resets 12:20am (UTC)` — a wall clock, which is what the CLI prints today. */
const RESETS_AT_CLOCK = /resets\s+(\d{1,2}):(\d{2})\s*(am|pm)\s*\(UTC\)/i

/** `Claude AI usage limit reached|1756612800` — the older, unambiguous form. */
const RESETS_AT_EPOCH = /usage limit reached\|(\d{10,})/

function messageOf(error: unknown): string {
  if (error instanceof Error) return `${error.message}\n${error.stack ?? ''}`
  return String(error)
}

/**
 * The next moment the UTC wall clock reads `hour:minute`, strictly after `now`.
 *
 * `12:xxam` is midnight and `12:xxpm` is noon — the one mapping a naive `hour % 12` gets backwards,
 * and the exact one the observed message used.
 */
function nextUtcTime(
  now: Date,
  hour12: number,
  minute: number,
  meridiem: string,
): Date {
  const hour = (hour12 % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0)
  const at = new Date(now)
  at.setUTCHours(hour, minute, 0, 0)
  if (at.getTime() <= now.getTime()) at.setUTCDate(at.getUTCDate() + 1)
  return at
}

/**
 * Is this error a usage limit, and when does it lift?
 *
 * Both halves must match. An agent that exited non-zero because the build broke is a real failure
 * and must stay one; a message that merely mentions rate limits — a stack trace through an HTTP
 * client, an issue body quoted into a prompt — did not come from an agent exiting.
 */
export function parseUsageLimit(
  error: unknown,
  now: Date,
): UsageLimit | undefined {
  const message = messageOf(error)
  if (!AGENT_EXIT.test(message)) return undefined
  if (!LIMIT_REASONS.some((reason) => reason.test(message))) return undefined

  const clock = RESETS_AT_CLOCK.exec(message)
  if (clock !== null) {
    return {
      resetsAt: nextUtcTime(now, Number(clock[1]), Number(clock[2]), clock[3]!),
      precise: true,
    }
  }

  const epoch = RESETS_AT_EPOCH.exec(message)
  if (epoch !== null) {
    return { resetsAt: new Date(Number(epoch[1]) * 1000), precise: true }
  }

  // A limit we recognise but cannot time. Guessing an hour is strictly better than ending the run:
  // if the limit is still up when we come back, this simply happens again.
  return { resetsAt: new Date(now.getTime() + BLIND_WAIT_MS), precise: false }
}

/**
 * The wait itself, shared by every stage in flight.
 *
 * Two issue pipelines run at once and both hit the same limit within seconds of each other. One
 * timer, one log line, one wake-up: the second caller joins the first one's wait rather than
 * starting its own and hammering the same closed door on its own schedule.
 */
let pending: Promise<void> | undefined

interface Clock {
  readonly now: () => Date
  readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>
}

const REAL: Clock = {
  now: () => new Date(),
  sleep: async (ms, signal) => {
    await delay(ms, undefined, { signal })
  },
}

/**
 * Runs `thunk`, waiting out any usage limit it hits and then running it again.
 *
 * Retrying re-runs the stage from the top rather than resuming its agent session: the commits it
 * already made are on the branch and the prompts all start by reading the branch, so this is the
 * same semantics as resuming the whole run, only cheaper. Anything that is not a usage limit is
 * rethrown untouched — masking a real failure is the one thing this must never do.
 */
export async function withUsageLimit<T>(
  /** The stage's name, for the log line the operator will read hours later. */
  label: string,
  thunk: () => Promise<T>,
  options: { signal?: AbortSignal; clock?: Clock } = {},
): Promise<T> {
  const clock = options.clock ?? REAL
  for (let waits = 0; ; waits++) {
    try {
      return await thunk()
    } catch (error) {
      const limit = parseUsageLimit(error, clock.now())
      if (limit === undefined) throw error
      if (waits >= MAX_WAITS_PER_STAGE) {
        console.error(
          `  ! ${label}: usage limit hit ${waits + 1} times in a row — giving up rather than looping.`,
        )
        throw error
      }
      await waitForReset(label, limit, clock, options.signal)
    }
  }
}

async function waitForReset(
  label: string,
  limit: UsageLimit,
  clock: Clock,
  signal?: AbortSignal,
): Promise<void> {
  if (pending !== undefined) {
    console.log(
      `  … ${label}: usage limit — joining the wait already in flight`,
    )
    await pending
    return
  }

  const ms = limit.resetsAt.getTime() - clock.now().getTime() + WAKE_MARGIN_MS
  if (ms > MAX_WAIT_MS) {
    throw new Error(
      `Usage limit resets at ${limit.resetsAt.toISOString()}, ${Math.round(ms / 60_000)} minutes away — ` +
        `longer than SANDCASTLE_LIMIT_WAIT_MAX_MS (${Math.round(MAX_WAIT_MS / 60_000)} minutes). ` +
        `Resume this run after the reset with \`pnpm sandcastle --run <run id>\`; its work is on its branches.`,
    )
  }

  // Loud on purpose. A silent process is indistinguishable from a hung one, and this one also holds
  // its coordinator leases for the whole wait — the heartbeat keeps ticking, so other machines stay
  // locked out of these issues until it wakes. That is what a resume needs and it must be visible.
  console.log(
    `\n  ⏸ ${label}: usage limit. Waiting ${Math.max(1, Math.round(ms / 60_000))} min, until ` +
      `${limit.resetsAt.toISOString()}${limit.precise ? '' : ' (guessed — no reset time in the message)'}. ` +
      `This run keeps its issues claimed while it waits.`,
  )

  pending = clock.sleep(Math.max(0, ms), signal)
  try {
    await pending
  } finally {
    pending = undefined
  }
  console.log(`  ▶ ${label}: limit window over — retrying.`)
}

/** Test seam: the gate is module state, and each test needs it empty. */
export function resetUsageLimitGate(): void {
  pending = undefined
}
