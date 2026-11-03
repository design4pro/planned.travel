# 0049 - Shared storage admission survives interrupted writes

Date: 2026-11-03
Status: accepted
Issue: #1784

Attachments and copied covers spend the same workspace byte and object ceilings. A cover selected
from an attachment is the same object; a copied cover is a separate object without a file row.
Checking usage before a separate insert allowed concurrent writers to overspend both ceilings.

`repos/storage-admission.ts` owns `storage_objects`. A conditional insert reserves both ceilings in
one SQL statement, through the tenant scope. Usage combines this ledger with pre-ledger files and
owned row-less covers, without double counting. Metadata-only seed imports use the same admission
predicate. Publishing an attachment inserts its file row and settles the reservation in one atomic
batch. Copy finalization conditionally publishes a retained cover only while the target is pending.

A reservation has fifteen minutes to start. It remains charged until a conditional cancellation
invalidates it; a timestamp in a usage read never releases capacity. Starting changes `reserved` to
`writing`. Expiring a writing operation must also prevent an already-running object write from
arriving after its capacity was reused. Every new object write therefore uses R2 create-only
`onlyIf: { etagDoesNotMatch: '*' }` against an immutable key. Cancellation wins against settlement in
D1, writes a permanent zero-byte tombstone to that key, and only then releases the charge. The
late content write either preceded the tombstone or is refused. A failed fence stays charged and
retryable. Published objects need no fence: their put has completed before settlement, so cleanup
can delete them normally. Deleted ledger rows prevent key reuse.

Tombstones are internal bookkeeping, not retained user files. They cost one R2 metadata object and
one ledger row per interrupted operation, but no retained content bytes or user file slot. They
must not be removed by trip purge or a TTL policy. Workspace erasure remains the terminal sweep
of a removed workspace's namespaces; this protocol is not a fence for already-running old workers
after a whole workspace has been erased.

Attachment deletion commits guarded metadata removal first. Its charge and file id survive in the
ledger, so an authorized retry can finish object deletion after the file row is gone. Trip deletion
and erasure preserve pre-ledger accounting before cascades. Normal admission retries cleanup in
bounded tenant-scoped passes, and trip purge uses the same ledger-aware cleanup; absent D1 fails
closed. Unreferenced retained objects and failed writes stay charged until storage confirms their
removal or cancellation fence. No new cross-tenant discovery query is introduced.

A legacy copied cover has no recorded size. It conservatively counts the existing 25 MiB product
upload maximum until a bounded admission pass observes its size through the bucket binding. Existing
attachments keep their recorded sizes. This can temporarily overstate legacy usage; it cannot grant
capacity based on an unknown object. No URL fetch or provider import is involved.

Rollout is additive: migrate, deploy all relevant upload/copy/purge workers, then allow subsequent
private-photo work to use this mechanism. Workers still running unconditional puts or old quota
checks are outside the guarantee. This change adds no private-photo endpoint. Do not activate one
while old writers remain in service.

Evidence: the [R2 Workers API reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
documents conditional-put refusal (`null`, no stored object) and strong write consistency. A local
live request against the installed Miniflare/workerd R2 binding tested content-before-fence and
fence-before-content: `firstSize: 7`, both late writes refused, both final sizes zero. This validates
the installed adapter, not remote production R2. Interface tests also delay puts across cancellation,
race mixed writers at both ceilings, retain charges through failed cleanup, and repeat settlement
and purge under two tenant scopes.
