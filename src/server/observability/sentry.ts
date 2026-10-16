/**
 * Sentry wiring for the Worker.
 *
 * Two halves, and they catch different things.
 *
 * `withSentry` (applied in `src/server/worker.ts`) reports what *escapes* a handler. That is the
 * unhandled case: a throw nobody caught, which the user sees as a failed request. It is the half
 * that needs no call sites.
 *
 * {@link sentrySink} reports what the code caught and *decided to log as an error* - a
 * dead-lettered queue task, a tile fetch that gave up, a server function that failed cleanly.
 * Those never reach `withSentry`, because handling an error is precisely what stops it escaping,
 * and they are often the more interesting half. They arrive here through the `LogSink` seam that
 * `createLogger` already takes, so no logging call site changes.
 *
 * The env is read structurally rather than as `Cloudflare.Env`, matching `loggerFromEnv` and
 * `taskEnv` in the Worker entry. `SENTRY_DSN` is a secret, so it reaches the generated binding
 * types only via whichever `.dev.vars` happened to be on the machine that last ran `wrangler
 * types` - a narrow interface here is both more honest and more robust than depending on that.
 */

import * as Sentry from '@sentry/cloudflare'

import { scrubEvent, scrubTelemetry } from '#/lib/sentry-scrub'

import { consoleSink, loggerFromEnv } from './logger'

import type { CloudflareOptions } from '@sentry/cloudflare'
import type { Logger, LoggerFromEnvOptions, LogSink } from './logger'

/** What this module needs from the Worker environment. Everything is optional and unvalidated. */
export interface SentryEnvLike {
  readonly SENTRY_DSN?: unknown
  readonly ENVIRONMENT?: unknown
  readonly CF_VERSION_METADATA?: unknown
}

/** Production samples a fraction of traces; staging keeps all of them, as it does for logs. */
const PRODUCTION_TRACES_SAMPLE_RATE = 0.1

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** The deployed Worker version id, from the `CF_VERSION_METADATA` binding. */
function readVersionId(metadata: unknown): string | undefined {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    !('id' in metadata)
  ) {
    return undefined
  }
  return readString(metadata.id)
}

/** The configured DSN, or `undefined` when this environment has none. */
export function sentryDsn(env: SentryEnvLike): string | undefined {
  return readString(env.SENTRY_DSN)
}

/**
 * The Sentry options for this environment.
 *
 * An absent DSN is not an error path and does not need one: `dsn` is optional to Sentry and a
 * client without one is inert, so a machine with no secret runs the same code and reports nothing.
 * That is what makes `pnpm dev` work unconfigured, and what keeps a deploy that forgot the secret
 * serving traffic instead of failing to boot.
 *
 * Returning options unconditionally rather than `undefined` also lets the Worker and the Durable
 * Object share one callback - `instrumentDurableObjectWithSentry` does not accept the `undefined`
 * that `withSentry` would tolerate, and two subtly different callbacks is exactly the kind of
 * duplication that drifts.
 */
export function sentryOptions(env: SentryEnvLike): CloudflareOptions {
  const environment = readString(env.ENVIRONMENT)
  const versionId = readVersionId(env.CF_VERSION_METADATA)
  return {
    dsn: sentryDsn(env),
    environment,
    // The commit the bundle was built from, and deliberately the same value the browser reports:
    // one release per deploy across both runtimes, or Sentry's release view splits a single deploy
    // into two unrelated halves. Vite substitutes this literal into the Worker bundle as well as
    // the client one, so there is a single source for it. Unset locally, which is correct - a
    // working copy is not a release.
    release: readString(import.meta.env.VITE_SENTRY_RELEASE),
    sendDefaultPii: false,
    // Structured logs as logs, not as issues. Every line the Worker already emits becomes
    // searchable beside the errors, which is what makes a stack trace legible a week later - the
    // three lines before a throw are usually more use than the throw.
    enableLogs: true,
    tracesSampleRate:
      environment === 'production' ? PRODUCTION_TRACES_SAMPLE_RATE : 1,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubTelemetry,
    beforeSendSpan: scrubTelemetry,
    beforeSendLog: scrubTelemetry,
    // Which Cloudflare version actually served the request. A tag rather than the release, because
    // it answers a different question - "which rollout" as opposed to "which code" - and only the
    // Worker has one, so promoting it to the release would reintroduce the split it avoids.
    ...(versionId === undefined
      ? {}
      : { initialScope: { tags: { cf_version: versionId } } }),
  }
}

/** Our four levels onto Sentry's. */
const SENTRY_LOG_LEVEL = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
} as const

/**
 * A sink that mirrors every record into Sentry's log stream.
 *
 * Logs, deliberately, and not issues. An earlier version of this called `captureMessage` for every
 * error record, which had two faults: it made an issue out of a line the code had already handled,
 * and - because `src/server/errors/middleware.ts` also captures the exception it is reporting - a
 * single server-function failure raised *two* Sentry events for the same cause, an exception and a
 * message that looked like an unrelated second problem.
 *
 * So issues come from exactly one place, `captureException` at the point the error is caught, and
 * everything else here is context around it. `serializeError` has already flattened any cause into
 * `errorName` / `errorMessage` / `errorStack` by the time a record reaches a sink, so the fields
 * travel as log attributes rather than as a reconstructed `Error` with a fabricated stack.
 *
 * A record carrying `durationMs` came from `Logger.track()`, which times an operation and names its
 * outcome. Those are recorded as a distribution as well, because the data is already here and the
 * alternative is a second instrumentation call at every timed call site.
 */
export function sentrySink(): LogSink {
  return {
    write(record) {
      const { ts, level, msg, service, durationMs, ...attributes } = record

      Sentry.logger[SENTRY_LOG_LEVEL[level]](msg, {
        service,
        ...attributes,
        ...(durationMs === undefined ? {} : { durationMs }),
      })

      if (typeof durationMs === 'number') {
        Sentry.metrics.distribution('operation.duration', durationMs, {
          unit: 'millisecond',
          attributes: {
            operation: msg,
            ...(typeof attributes.outcome === 'string'
              ? { outcome: attributes.outcome }
              : {}),
            ...(typeof attributes.component === 'string'
              ? { component: attributes.component }
              : {}),
          },
        })
      }
    },
  }
}

/** Writes every record to each sink in turn. */
export function teeSink(...sinks: ReadonlyArray<LogSink>): LogSink {
  return {
    write(record) {
      for (const sink of sinks) {
        sink.write(record)
      }
    },
  }
}

/**
 * The sink a Worker logger should use: the console always, and Sentry's log stream when a DSN is
 * configured.
 *
 * Composed here rather than in `createLogger` so that factory stays runtime-agnostic and testable
 * with `createMemorySink()`.
 */
export function workerSink(env: SentryEnvLike): LogSink {
  return sentryDsn(env) === undefined
    ? consoleSink
    : teeSink(consoleSink, sentrySink())
}

/**
 * The logger Worker code should build: `loggerFromEnv`, plus Sentry when a DSN is configured.
 *
 * It exists so that "an error logged in the Worker reaches Sentry" has one owner instead of being
 * a line every call site has to remember. `loggerFromEnv` stays the lower-level factory and keeps
 * `logger.ts` free of any import from this file - that module is deliberately runtime-agnostic,
 * and pulling the Cloudflare SDK into it would put Sentry in the dependency graph of every test
 * and every consumer that only wanted a `LogRecord` type.
 */
export function workerLogger(
  env: SentryEnvLike,
  options: LoggerFromEnvOptions = {},
): Logger {
  return loggerFromEnv(env, {
    ...options,
    sink: options.sink ?? workerSink(env),
  })
}
