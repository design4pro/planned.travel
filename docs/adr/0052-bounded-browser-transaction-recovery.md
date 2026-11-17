# Bounded browser transaction recovery

Status: proposed

Issue #1849 reproduced WebKit transaction loss during document replacement with the installed
Sentry SDK. A worker that has not started cannot accept an in-memory handoff reliably. The
amended Agent Brief permits a synchronous, tab-local write-ahead record before asynchronous
worker registration, followed by recovery only under a freshly confirmed matching context.

The installed SDK still owns serialization, its 40-request buffer, response semantics, drop
accounting and flush. Only a scrubbed single JSON transaction enters recovery; Replay, binary
and mixed envelopes retain their native transport. A capability-limited module ServiceWorker
sends only to the configured DSN, without cookies, redirects, interception or keepalive.
Admission is not acknowledgement. Actual HTTP responses, including 413, 429 and 5xx, remove
the record and return their status and rate-limit headers to the SDK. Unknown responses may
be retried with the original event ID; no ingestion deduplication guarantee is assumed.

## Consequences

- Session storage is bounded to 40 records, 512 KiB UTF-8 per body and 2 MiB serialized UTF-16
  including metadata. Eligibility expires after 30 seconds, with at most three persisted
  attempts and 10-second worker / 12-second document deadlines. Suspended documents and
  storage failures can delay physical cleanup; expiry is not a legal retention promise.
- A server-derived digest binds session, user, confirmed effective workspace and impersonator.
  An unconfirmed authenticated scope is never anonymous. The digest is blocked from Replay.
  Identity mutations, workspace changes, cross-tab invalidation, sensitive locations and
  BFCache restoration retire pending work. A generation fence rejects server results that
  started before retirement. Only a fresh result or a new document can reactivate recovery.
- Unavailable storage or admission falls back once to the native transport before dispatch.
  An unknown outcome after dispatch never causes an immediate native resend. No payload
  logging, new sampling, schema, authentication capability or production deployment is added.
- Native keepalive and cold memory-only workers were rejected by browser experiments. Changing
  sampling, dropping large transactions or disabling Replay would avoid neither the handoff
  invariant nor the requirement to preserve existing telemetry behavior.
