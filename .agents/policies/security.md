# Agent safety policy

These are repository instructions and static checks, not an OS sandbox. Codex does not
consume Claude permission settings or workflow `allowedTools`. Cezar uses the selected
runner's permission model; do not claim that a prompt enforces process isolation.

- Never open `.env*`, `.dev.vars*`, `.ai/qa/test-env.env` or `.e2e-tiles/`, even redacted.
  Committed `*.example` templates are permitted. Use credential variable references from
  `.ai/qa/test-env.json`. Sourcing the credentials file for a command is permitted;
  printing its contents or values is not.
- Never hand-edit `src/routeTree.gen.ts`, `drizzle/` or `worker-configuration.d.ts`.
  Use the owning generator and stage generated output before the configured gate.
- Never rewrite branch history: no force push, `git reset --hard` or `--no-verify`.
  To switch to a PR head, require a clean tree and no unpushed commits first, then fetch
  and use `git checkout -B <head> origin/<head>`. Merge the base or create a new branch.
- The only `--force-with-lease` exception is the tracker descriptor's compare-and-delete
  of exactly `refs/om-locks/{issue|pr}-<positive-number>`, with an explicit expected SHA
  and verified run ownership (or separately authorized recovery after workers stopped).
  It grants no branch rewrite. Never use REST DELETE for those refs, never infer ownership
  from a shared login, and never fall back to comment-only acquisition on a GitHub error.
- Never write Cloudflare secrets or delete a D1 database, R2 bucket, KV namespace or Worker.
  Production deployment, remote migrations and main promotion need the existing explicit
  release authorization. Preparing this repository grants none of those actions.
- Before changing agent configuration, hooks or CI, obtain the independent configuration
  guardian/security review required by SDLC. If the runtime denies a write, stop once:
  hand over the exact diff, worktree and paths. Never switch tools, disable a guard,
  enable `bypassPermissions`, or repeat diagnosis and tests to evade the refusal.
- Keep lessons and artifacts within the repository's approved output locations. Never edit
  host-wide agent settings or start, stop or reconfigure a service as a side effect.

The machine-readable command and secret patterns in `.agents/policy.json` support the
workflow regression tests. They are not a Codex permissions configuration.
