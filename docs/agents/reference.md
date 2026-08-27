# The reference product — where to look, and the rules

planned.travel is a from-scratch, Cloudflare-native implementation whose feature set and quality
bar are measured against an open-source reference product. The governing law is docs/SPEC.md:
**§1 clean-room rule (non-negotiable)** — never copy its code, comments, strings or assets; never
use its name or branding in product code or UI — and **§2**, which is the source of truth for the
surfaces below. This file only routes you there and says which surface answers which question.

## Three surfaces, three questions

1. **Public demo — `https://demo.liketrek.com/dashboard`.** Populated with sample data and
   **reset every hour**, so treat it as a pristine, read-only exhibit: what a screen looks like,
   what states it ships, how a flow feels. This is the frame the blind visual critic
   (`pixel-critic`) compares ours against. Don't bother mutating anything there — it will not
   stick, and you cannot rely on anything you created a moment ago still existing.
2. **Local live instance — `https://app.trek.orb.local/` (OrbStack, this machine only).** Full
   admin access, content freely modifiable — use it for authenticated surfaces the public demo
   cannot show (above all `/admin`) and for "what happens if…" experiments with real data. Two
   quiet failure modes, both documented in SPEC §2: the certificate is self-signed (clients need
   `--insecure` / `ignoreHTTPSErrors`), and the hostname resolves only through OrbStack's
   resolver (`dig` says NXDOMAIN while `curl` succeeds). If the Orb hostname is unreachable, the
   same instance answers on `http://localhost:3900/login` — try that before concluding it is
   down. First-boot admin credentials live in the clone's `docker-compose.yml` — read them
   there, never copy them into this repo.
3. **Source code — local clone `/Users/rafalwolak/dev/test/trek`, or the public repository
   `https://github.com/liketrek/TREK` where the clone is absent (cloud/CI agents).** The last
   resort, for one question only: _which_ solution the reference reached for and _where_. Read it
   to learn **what** a feature does — never **how**, and never copy a line. The clean-room rule
   applies identically to both copies. Prefer surfaces 1 and 2; open the source only when
   observing behavior cannot answer the question.

## Rules of engagement

- **Reference study belongs to the planning phase** — grilling and `/to-spec-project`, with a
  human in the loop. The AFK implementer and reviewer (sandcastle) never browse the reference;
  everything they need must already be in the ticket. This keeps the clean-room boundary out of
  the hands of agents optimising for "make the test pass". One carve-out: the loop's neutral
  pixel-capture step photographs the public demo (surface 1) so the blind `pixel-critic` can
  judge an A/B pair — it takes pixels only, writes no notes, and neither it nor the critic ever
  opens the reference source.
- **Citations**: in specs, tickets and plans, cite reference behavior as `` `wiki: <Page-Name>` ``
  with no URL, and describe it in planned.travel's own vocabulary (CONTEXT.md).
- **Captures land outside this repository** — an untracked screenshot in the repo root already
  broke the boundary once (SPEC §2, "capture hygiene"). Use the session scratchpad.
- **The reference cannot settle everything**: several console/account surfaces are ours by
  contract (docs/ACCESS.md), not by parity — a feature the reference lacks is not evidence we
  should lack it. SPEC §2 lists the known cases.
- Surface 2 is the operator's machine-local setup. A cloud or CI agent has surface 1 and, for
  source questions, the public repository from surface 3 — under the same clean-room rules.
