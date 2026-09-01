# 0009. Sandcastle runs coordinate through a Durable Object

Status: accepted
Date: 2026-08-30

## Context

Two AFK loops were launched an hour apart and built the same two tickets. The second was started as
`--issue 104`; the flag was misspelled, silently discarded, and its planner read the whole backlog,
walked PRD #104's sub-issue tree on its own and produced a plan byte-identical to the first run's.
Both fleets implemented #106 and #108. One reached five commits between them, the other produced
zero. An hour of sandboxed model time bought nothing, and neither process could have known.

The flag bug is fixed and the planner is now filtered against a scope computed outside it, but those
are two spellings of the same defect: nothing mechanical stopped two runs from claiming one issue.
The `claims.ts` written the same day was a file-based lock keyed on `process.kill(pid, 0)`. It
cannot work across machines and can therefore never cover GitHub Actions, which is the identical
flaw ADR 0004 retired ultrabuild for: _"its run state was machine-local (gitignored), the backlog
could not be shared across machines or agents."_ Replacing one machine-local lock with another would
be the third spelling.

Nothing available offered a way out. Upstream sandcastle is a single-machine orchestrator with no
registry, no locking and no external state store; its own documentation puts branch separation
entirely on the caller. GitHub cannot serve as the lock either: labels and assignment have no
compare-and-swap, so two runs polling a second apart both read "unassigned" and both write
themselves in, and the loser never learns it lost. D1 has no interactive transactions, so a
read-then-write across two statements is not serialisable against a concurrent worker. KV is
eventually consistent and has no conditional put.

What a claim needs is exactly two primitives: a compare-and-swap over shared state, and an expiry
that fires without the holder's cooperation. A crashed loop and a cancelled Actions job both stop
without cleaning up, and a lock that only the holder can release is a lock that outlives its purpose.

## Decision

A single `SandcastleRegistry` Durable Object, one instance per repository via
`idFromName('design4pro/planned.travel')`, is the authority on who holds which issue. Every claim for
a backlog is therefore decided in one thread, which is what makes claim-or-deny atomic without any
locking of our own, and `alarm()` gives the expiry.

**The lock covers a closure, not an issue.** `closure(i) = {i} ∪ ancestors(i) ∪ descendants(i)` over
the sub-issue tree the client reports; an issue is available to a run only if no live lease held by
another run intersects its closure. Claiming PRD #104 locks every slice under it; claiming leaf #106
blocks anyone from taking #104 whole, while leaving sibling #108 free to run in parallel. Anything
narrower is wrong in a way that reproduces the incident: the second run's plan was derived from the
PRD, so a per-issue lock would have let it take the PRD and every leaf under it in one breath.

**A run id is an identity, not a label.** Re-registering an id that is already live is a resume only
when it comes from the same host; from a different one it is a collision and is refused. The local id
is `<date>-<n>`, allocated by scanning local branches, so two operators starting on the same day
genuinely can compute the same one - and treating that as a resume would hand the second machine
every lease the first holds, reproducing "two fleets, one issue" through the coordinator itself.

**The agent tree is one level deep, and stays that way.** `main.ts` is the only orchestrator: it
calls agents, and no agent calls another. That is deliberate, not an accident of the current shape.
A nested agent has no claim on the registry, so the run holding the lease is no longer the thing
doing the work, and the coordination this ADR describes silently stops covering it - on top of the
usual costs of deep agent trees (a context relayed through two summarizations, and a failure that
surfaces as a shrug rather than as a stage). New capability is a new stage in the loop, with its own
lease-bounded slot, never a call from inside an existing one.

**Liveness is a server-computed lease, not a process id.** A pid means nothing to a run on another
machine, and the expiry is stamped by the registry so clock skew between a laptop and an Actions
runner is irrelevant. A run holds its leases by heartbeating every 60 seconds against a five-minute
TTL; a run that stops heartbeating loses them, whether it crashed, was killed or lost the network.
The sweep takes a run and its leases together, so a lapsed run is not told _which_ issues it lost -
it is told it no longer exists, which is the same news about all of them at once. Either answer
aborts the pipelines rather than finishing work the run no longer owns.

**Work in progress outlives the lease.** A dead run's commits are still on disk, so `wip:<issueId>`
survives lease expiry and the next claimant is told which branch to look at. Only the lease holder
may write one: the record is what the next claimant is handed as `adopt`, and it is last-write-wins,
so an unchecked write would let a stale run point the next run at its own abandoned branch. Adoption is gated on
history rather than hope: the branch is taken only if it fast-forwards onto this run's integration
base or `git merge-tree` reports a clean merge against it, otherwise the slice starts fresh and the
reason is logged. Nothing is ever forced, reset or rewritten - `main.ts`'s own header warns that each
run is cut from its own `origin/develop` snapshot, and adopting blindly would drag one run's
differently-based history into another's merge.

**It lives in the app worker, bound on `env.staging` alone.** The repository has one worker and no
second deployable, so a new Durable Object, an internal API route and a console page cost no new
infrastructure. Staging is the single coordinator on purpose: a second registry in production would
let two fleets each believe they hold the backlog, which is the failure this exists to prevent, in a
shape that is harder to notice. The route authenticates a shared bearer token in constant time; the
Durable Object does not re-authenticate, because it is reachable only through the binding.

**The loop fails closed.** Missing configuration or an unreachable coordinator stops a run at
startup, because not knowing what another run holds is indistinguishable from there being no other
run, and only one of those is safe. `--no-coordinator` opts out explicitly and prints a banner
saying so. The two workflow entry points are gated rather than fail-closed, which is a deliberate
asymmetry: `main.ts` refuses to start because duplicated building costs an hour, while triage
promotes a label in seconds, and refusing to triage at all because a secret is unset would be a
self-inflicted outage on a path that builds nothing.

**The dashboard is admin-only**, gated on a seventh resource `sandcastle: ['read']` rather than
folded into an existing admin-exclusive statement. `user: ['list']` would have worked and would have
made the authorisation model say "may list accounts" about a page that lists none. The amendment to
`docs/ACCESS.md` §1.1 and its §2 grid lands in the same commit, as that document requires.

## Consequences

The backlog is shared for the first time. Any number of runs - here, on another machine, or in a
GitHub Actions runner - can work it concurrently without building the same ticket twice, and an
administrator can see what is running without reading `ps` and `git log`. This takes up the decision
ADR 0004 deferred: running sandcastle in CI was blocked on exactly the coordination that did not
exist, and `triage.yml` and `sentry-triage.yml` now register with the same registry as the local
loop.

The local loop now depends on staging being up, which is a real new coupling and the reason
`--no-coordinator` exists rather than being a hole left open by accident. It also means the loop
depends on the Cloudflare Access service token that fronts staging; a run whose token has expired
gets a login page rather than the registry, which fails closed and reads as a broken deployment.

The five-minute TTL is a bet that no stage takes longer than five minutes without a heartbeat. The
heartbeat runs on its own interval rather than on stage boundaries precisely because an implementer
stage runs twenty minutes or more, so the bet is only lost to a hard freeze of the whole process.
The cost of losing it is bounded by `revoked`: the run stops, it does not silently double up.

The workflow entry points hold no lease between their claim and their release, since nothing
heartbeats between two shell steps. A job that outruns the TTL loses its claim. That is accepted
rather than papered over: what those paths need is a claim over the moment an issue changes hands,
not a lock over a thirty-minute job.

A single shared token is the KISS choice for one internal client. The repository already has a
designed-but-unbuilt M2M scheme (`staff_api_tokens`, `MCP_TOKEN_PEPPER`, docs/DEPLOY.md §14.3); that
is the upgrade path if a second client ever needs its own credential and its own revocation.
