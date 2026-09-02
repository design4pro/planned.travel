# TASK

Smoke-test the e2e environment of this sandbox. This is a VERIFICATION run: do not modify any source file, do not commit. Execute commands and report outcomes verbatim.

# STEPS

1. `bash scripts/agent/setup-e2e.sh` — prepares .dev.vars, local D1, the basemap in the local R2 simulator, a dev server on :3010 and the seeded demo workspace. If it fails, capture the failing step's output and stop.
2. `PLAYWRIGHT_BASE_URL=http://localhost:3010 pnpm exec playwright test --list --project=chromium 2>&1 | tail -5` — prove Playwright resolves the suite.
3. Run ONE cheap public-route spec end to end:
   `PLAYWRIGHT_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=chromium -g "landing" 2>&1 | tail -15`
   If nothing matches "landing", pick the first public route test from the --list output instead.
4. `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3010/api/tiles/basemaps/e2e.pmtiles" -H "Range: bytes=0-99"` — prove the tiles endpoint serves the archive from the local R2 sim (expect 206 or 200).

# OUTPUT

Output the result between <smoke> tags:

<smoke>
setup: OK | FAILED at <step> — <one-line reason>
playwright-list: OK (<n> tests) | FAILED — <reason>
spec-run: <passed/failed/skipped counts, and for failures whether the diff is pixels or infrastructure>
tiles-endpoint: <http code>
verdict: <one sentence — is the sandbox e2e path usable?>
</smoke>
