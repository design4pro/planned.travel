# Worktree bootstrap

One command between `git worktree add` and a signed-in `localhost`.

```sh
pnpm worktree:bootstrap
```

## Why it exists

Four fixtures are gitignored and per-checkout, so a new worktree carries none of them:

| Fixture             | Without it                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `node_modules`      | Nothing runs. A nested worktree may also resolve the parent's packages and typecheck falsely (SPEC §3).                                         |
| `.dev.vars`         | `requireSecret()` throws on the first request that touches a session, so `/login` answers 500 and the whole app behind the gate is unreachable. |
| Migrated local D1   | `/api/dev/seed` returns 500 and every screen is an empty state.                                                                                 |
| Basemap in local R2 | Every map renders the BASEMAP UNAVAILABLE fallback; four atlas baselines fail with coastline-shaped diffs.                                      |

Only the second one is dramatic, and it is the one that makes the other three hard to diagnose:
a 500 on `/login` looks like a code defect and is a missing file.

## Flags

| Flag                        | Effect                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `--profile worktree\|cloud` | Which environment this is. Default `worktree`. See the table below.                 |
| `--port N`                  | Serve on this port instead of the allocated one.                                    |
| `--check`                   | Report what is missing and exit 1. Writes nothing. Cheap enough for any pre-flight. |
| `--if-needed`               | Exit 0 immediately when nothing is missing. What the SessionStart hook passes.      |
| `--no-seed`                 | Stop after the schema; start no server and seed nothing.                            |
| `--force`                   | Redo every step even when its result is already on disk.                            |

Anything else is a hard error rather than a silently ignored typo.

## Profiles

|             | `worktree`                                                      | `cloud`                     |
| ----------- | --------------------------------------------------------------- | --------------------------- |
| Who runs it | a person or an agent, locally                                   | a Claude Code session VM    |
| Port        | first free in 3001-3009                                         | 3000                        |
| `.dev.vars` | copied from the main checkout when it has one, else throwaway   | throwaway, always           |
| Basemap     | APFS clone of the main checkout's local R2, else pulled from R2 | pulled from R2              |
| Seeds       | yes                                                             | no; prints the two commands |

`scripts/cloud/session-start.sh` picks the profile off `CLAUDE_CODE_REMOTE` and does nothing else.
`.claude/settings.json` runs it from the `SessionStart` hook on startup and on resume, with a
generous timeout because the first run in a fresh worktree installs dependencies.

## Its relationship to `scripts/agent/setup-e2e.sh`

That script is the third profile and deliberately stays separate. It mirrors
`.github/actions/e2e-env/action.yml` step for step, gates the e2e suite in CI, pins port 3010
because `playwright.config.ts` insists on the reserved range, and writes a `.dev.vars` marked as
a sandcastle throwaway so an accidental run on a real checkout aborts before touching anything.
Folding it in here would couple the e2e gate to a convenience script. Use it for automated rounds,
this one for working on the app.

## The port, and why not 3000

`pnpm dev` hardcodes `--port 3000`: that is the main checkout's port and a second worktree cannot
have it. The other end is fenced too, and harder: `playwright.config.ts` refuses to run non-CI
against anything outside 3010-3020, a guard added after a round photographed a different
worktree's application. That leaves 3001-3009, which is what this script allocates from, and it
starts the server through `pnpm exec vite dev --port N --strictPort` so a taken port is an error
rather than a silent drift to the next one.

The port is written into `APP_URL` in the `.dev.vars` this script owns, because every auth URL is
built from that value. A `.dev.vars` written by a person carries no marker of ours: it is left
untouched and the script takes its port from that file instead.

## Signing in

|          |                        |
| -------- | ---------------------- |
| Email    | `rafal@planned.travel` |
| Password | `planned-demo-2026`    |

A fixture for a local database, not a secret; `scripts/seed/README.md` explains the reasoning and
the three other seeded people. **Social sign-in is registered against `:3000` only**, so on any
other port use the password form. `/sign-in/email` allows ten attempts a minute.

## Traps it handles, that a hand-rolled setup does not

- **The D1 guard is on the schema, not the directory.** `vite dev` creates
  `.wrangler/state/v3/d1` holding nothing but `metadata.sqlite` on its first boot, so a
  directory-existence test skips the migrations forever after one failed start.
- **`--url` on the seeder is not optional.** Without it `seed.mjs` probes 3000-3005 then 3010-3015
  and writes to the first origin that answers, which on a machine running several worktrees is a
  write to somebody else's database. The script always passes its own port.
- **The whole `r2/` tree has to be cloned, not just the blob.** The key-to-blob index lives apart
  from the archive, in `r2/miniflare-R2BucketObject/*.sqlite`, and the bytes are unreachable
  without it.
- **`TILES_ARCHIVE_KEY` has to name the object that is actually stored.** A mismatch does not fail
  loudly, it renders a map with nothing under it, so the download path writes the archive under
  whatever key the file already names and the summary verifies
  `GET /api/tiles/basemap.pmtiles` end to end.
- **Migrations before any server.** `wrangler d1 migrations apply --local` and `vite dev` contend
  for the same SQLite files.

## Expected noise

After the seed's sign-ups the queue consumer logs `TaskConfigurationError`, because a local
`.dev.vars` has no `EMAIL_API_KEY`. Environmental, documented in the `verifying-changes` skill,
and not something `--check` reports.
