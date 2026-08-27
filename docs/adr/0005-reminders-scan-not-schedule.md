# Reminders are swept by scan, not scheduled at write

The original reminder design (`src/server/queue/reminders.ts` as first written) scheduled a KV key
per trip at write time and cancelled it on every date change, freezing recipient e-mail addresses
into the key's record. We replaced it with a scan model before it ever fired: the `*/15` cron reads
due, unarchived trips straight from D1 (a cheap indexed range over `start_date`), resolves
recipients and channel preferences fresh at fire time through the notification dispatch module, and
deduplicates with a self-expiring KV marker keyed by trip and due instant.

Considered and rejected: the schedule-at-write index. It froze recipients (a member added after
scheduling was never reminded, one who left still was), delivered e-mail only (bypassing in-app
notifications and the per-user preference matrix), and its cancel/re-schedule machinery — including
a cross-plan obligation on every future trip-edit path to thread the pre-edit anchor — existed only
to avoid a periodic scan whose cost is proportional to trips starting in the next month. The
reference product runs the scan model for the same reasons.

Consequence worth naming: trip create, edit, archive, restore and delete must call **no** reminder
code — the next scan sees the row as it is. A scheduler call reintroduced in a write path is a
defect, not a missing feature.
