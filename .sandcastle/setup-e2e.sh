#!/usr/bin/env bash
# Prepare the e2e environment INSIDE a sandcastle sandbox, mirroring
# .github/actions/e2e-env/action.yml step for step. Run it from the worktree
# root when a ticket needs Playwright; the fast loop (typecheck/lint/vitest)
# never needs it.
#
#   bash .sandcastle/setup-e2e.sh
#   PLAYWRIGHT_BASE_URL=http://localhost:3010 pnpm e2e [--project=chromium] [-g <spec>]
#
# Requires in the environment (injected from .sandcastle/.env by sandcastle):
#   CLOUDFLARE_API_TOKEN   R2:read on planned-travel-tiles (basemap download)
#   CLOUDFLARE_ACCOUNT_ID  account that owns the bucket
#   TILES_KEY              dated archive key, e.g. basemaps/planet-20260818.pmtiles
# The download is skipped when .e2e-tiles/basemap.pmtiles already exists
# (main.ts copies the host's .e2e-tiles cache into every worktree).
#
# The dev server runs on :3010 — the reserved automation range playwright.config.ts
# insists on outside CI — and inside the container's own network namespace, so
# parallel sandboxes never collide on it.
set -euo pipefail

PORT=3010
BASE_URL="http://localhost:${PORT}"

# --if-needed: fix-loop re-validation reuses the live dev server — HMR/SSR
# reload picks up the fix commits, so a restart buys nothing.
if [ "${1:-}" = "--if-needed" ] && curl -sf -o /dev/null "${BASE_URL}/"; then
  echo "==> dev server already answering on :${PORT} — skipping e2e env setup"
  exit 0
fi

echo "==> .dev.vars (throwaway secrets for this sandbox)"
cat > .dev.vars <<EOF
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
APP_URL=${BASE_URL}
TILES_ARCHIVE_KEY=basemaps/e2e.pmtiles
EOF

echo "==> route tree"
pnpm generate-routes

echo "==> local D1 migrations"
pnpm db:migrate:local

if [ ! -s .e2e-tiles/basemap.pmtiles ]; then
  echo "==> basemap not in worktree cache — downloading from R2 (${TILES_KEY:?set TILES_KEY in .sandcastle/.env})"
  : "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN in .sandcastle/.env}"
  : "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID in .sandcastle/.env}"
  mkdir -p .e2e-tiles
  pnpm exec wrangler r2 object get \
    "planned-travel-tiles/${TILES_KEY}" \
    --remote --file .e2e-tiles/basemap.pmtiles
else
  echo "==> basemap present in .e2e-tiles (worktree cache) — skipping download"
fi

echo "==> loading the archive into the local R2 simulator"
pnpm exec wrangler r2 object put \
  planned-travel-tiles/basemaps/e2e.pmtiles \
  --local --file .e2e-tiles/basemap.pmtiles \
  --content-type application/octet-stream

echo "==> dev server on :${PORT}"
# --host binds v4 and v6: Node's fetch (seed.mjs) resolves localhost to
# 127.0.0.1 while a default vite bind in this container is ::1-only, which
# makes the seed unreachable. The container has its own network namespace,
# so the wide bind exposes nothing.
pnpm exec vite dev --port "${PORT}" --strictPort --host > dev-server.log 2>&1 &
for _ in $(seq 1 60); do
  if curl --silent --fail --output /dev/null "${BASE_URL}/"; then
    echo "dev server up"
    break
  fi
  sleep 2
done
if ! curl --silent --fail --output /dev/null "${BASE_URL}/"; then
  echo "ERROR: dev server did not answer on :${PORT} within 120s" >&2
  tail -50 dev-server.log >&2
  exit 1
fi

echo "==> seeding the demo workspace"
node scripts/seed/seed.mjs --url "${BASE_URL}"
node scripts/seed/verify.mjs

echo
echo "Ready. Run the suite with:"
echo "  PLAYWRIGHT_BASE_URL=${BASE_URL} pnpm e2e"
