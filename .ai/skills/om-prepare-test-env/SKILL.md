---
name: om-prepare-test-env
description: planned.travel extension of the installed om-prepare-test-env skill. Constraints the generated entrypoint must keep when regenerated or repaired.
---

Extends the installed skill: read `.claude/skills/om-prepare-test-env/SKILL.md` and follow it. The generated `.ai/scripts/test-env-up.sh` and `test-env-down.sh` must keep these repo facts on any regeneration or repair:

- Provisioning (deps, `.dev.vars`, local D1 + airports, basemap in local R2) belongs to `scripts/worktree/bootstrap.sh --profile worktree --no-seed`; the up script only checks it (`--check`) and runs it when something is missing. It never writes `.dev.vars` itself.
- Port from **3030-3040 only**: `playwright.config.ts` refuses anything else outside CI, so an automated run can never photograph another checkout's app. Bind `127.0.0.1`, never `localhost` (another checkout may sit on `[::1]`).
- App start: `E2E=1 NODE_OPTIONS="--max-old-space-size=4096" pnpm exec vite dev --port $PORT --strictPort --host 127.0.0.1`, pid recorded in `.ai/qa/dev-server.pid`, log in `dev-server.log`.
- Seed: `node scripts/seed/seed.mjs --url $BASE_URL` then `node scripts/seed/verify.mjs`. Demo identity `rafal@planned.travel` as a `passwordEnv` reference (`TEST_DEMO_PASSWORD` in `.ai/qa/test-env.env`, gitignored).
- Descriptor `.ai/qa/test-env.json` with `baseUrl`, `browser.provider: playwright`, `testRunner: playwright` (`playwright.config.ts`). Committed suite: `PLAYWRIGHT_BASE_URL=$BASE_URL pnpm e2e --project=chromium` (what `.ai/scripts/e2e.sh` runs).
- No Docker services: D1/KV/R2/DO are Miniflare simulators under `.wrangler/`.
- `.ai/scripts/` holds the validation gate, so a run does not repair it in passing: no hook refuses the edit since ADR 0025, but a run that rewrites the gate it is about to be judged by has graded its own paper. Regeneration or repair of the entrypoint happens in an interactive session and lands as a reviewed commit; an agent run that finds the script broken reports it as blocked instead of patching it.
