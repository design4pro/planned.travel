# 0012. Confirmations are read with Workers AI, on our meter, and never trusted unreviewed

Status: accepted
Date: 2026-08-30
Supersedes the `BKG-04` disposition in `docs/plans/11-boundaries-and-blockers.md`, `11-S1`

## Context

`BKG-03` (import from a confirmation file) ships a queue handler that reads calendar files and JSON
exports. A traveller does not receive either. What lands in their inbox is a PDF, an HTML page, a
wallet pass or a plain-text email, and the reference product reads all of them through KDE Itinerary,
a native binary in its own container image — which a Worker cannot execute.

`11-S1` ruled `BKG-04`, the model-assisted fallback, out of scope on three grounds: an instance-level
provider credential is "our credential spent on every tenant's parse with no per-tenant meter";
local model management "presumes a filesystem and a long-lived host, neither of which a Worker has";
and the background parse job with sequential review "is shaped correctly for us and belongs to
`BKG-03`". It then parked the remainder on "the `AI` binding decision recorded in `11-S3`", calling
it an infrastructure and cost decision rather than a build step.

This is that decision. The platform answers all three objections. `env.AI.toMarkdown()` converts
PDFs, images (so scans), HTML, XML, Office and ODF documents to text with no model to manage and no
filesystem to presume. `env.AI.run()` extracts fields from that text. Both arrive through a
**binding**, not a package, so `SPEC` §3's dependency freeze is untouched — the change is one entry
in `wrangler.jsonc`, filed onto a foundations stage like any other shared-file change.

## Decision

We bind Workers AI and read confirmations with it. `toMarkdown()` turns the uploaded file into text;
a text model turns that text into candidate reservations. Three constraints make it ours rather than
the reference's:

The credential is the platform's and the **meter is per tenant**, a ceiling in `resolveLimits()`
beside every other ceiling — which is precisely the objection `11-S1` raised, answered rather than
argued away. Nothing the model produces is written unreviewed: every candidate lands on the import
review list and every row it writes carries `reservations.imported_at`, so a machine-written booking
is visibly a machine-written booking until a person opens it. And a **money field is never trusted**
— an amount the model cannot parse into minor units is dropped and the row is marked for review,
never guessed at, because a wrong price is worse than a missing one.

No user configures a provider, no user supplies a key, and no admin panel pulls a model. Those were
the operator constructs `11-S1` correctly refused, and none of them returns.

`BKG-03` therefore reaches `done` rather than `partial`, and `BKG-04` returns in a hosted shape that
is not a port of the reference's.

Considered and rejected: extending the deterministic engine in JavaScript alone — feasible for
`.txt`, `.html` and, by hand, `.eml` and `.pkpass`, but it leaves PDFs unreadable, and a PDF is the
commonest confirmation there is; and using `toMarkdown()` for conversion while keeping extraction
rule-based — which is KDE Itinerary's job, done with years of per-vendor rules we would be
reimplementing worse.

## Consequences

Model output is non-deterministic, so the review step stops being a courtesy and becomes load-bearing:
any change that lets an imported row reach the database without a person seeing it breaks this
decision, not merely a preference. The tests that matter are the ones asserting a row cannot be
written unreviewed and an unparseable amount is dropped rather than rounded.

This is the product's second metered outbound cost after ADR 0011, and it arrives with the same
shape: our credential, our proxy, our ceiling in `resolveLimits()`. The published number is the
enforced number, for a model call exactly as for a row.
