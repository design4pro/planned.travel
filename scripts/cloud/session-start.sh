#!/bin/bash
#
# Project setup for a Claude Code *cloud* session.
#
# Runs from the SessionStart hook in .claude/settings.json, after Claude Code
# launches, on startup and on resume. It exits immediately anywhere else, so
# your own terminal is untouched: `CLAUDE_CODE_REMOTE` is `true` only on the
# session VM.
#
# The division of labour, which the docs are firm about and which is easy to get
# backwards: the *setup script* configured at claude.ai/code provisions the VM
# (toolchains, browsers - things that belong in the cached filesystem snapshot),
# and this hook does the project setup that has to reflect the commit that was
# just cloned. See docs/CLOUD.md §2.
#
# Every step below is skipped when its result is already on disk, because the
# hook runs again on every resume and a resume should not cost two minutes.

set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo '[cloud] installing dependencies'
pnpm install --frozen-lockfile

echo '[cloud] generating the route tree'
pnpm generate-routes

# The session VM has no secrets store, so these are throwaways for a database
# that lives and dies with the VM. Real credentials never come near it.
if [ ! -f .dev.vars ]; then
  echo '[cloud] writing .dev.vars'
  cat > .dev.vars <<EOF
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
APP_URL=http://localhost:3000
TILES_ARCHIVE_KEY=basemaps/e2e.pmtiles
EOF
fi

if [ ! -d .wrangler/state/v3/d1 ]; then
  echo '[cloud] applying D1 migrations'
  pnpm db:migrate:local
fi

# The basemap. Without it every /atlas frame renders a map with no tiles under
# it, which is a missing fixture rather than a regression - so say so plainly
# rather than letting the suite report it as forty red screenshots.
#
# CLOUDFLARE_API_TOKEN is set in the cloud environment's variables, where it is
# readable by anyone who uses that environment. Scope it to R2:read on
# planned-travel-tiles and nothing else.
if [ ! -f .e2e-tiles/basemap.pmtiles ]; then
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${E2E_TILES_KEY:-}" ]; then
    echo '[cloud] pulling the basemap archive from R2'
    mkdir -p .e2e-tiles
    pnpm exec wrangler r2 object get "planned-travel-tiles/${E2E_TILES_KEY}" \
      --remote --file .e2e-tiles/basemap.pmtiles
    pnpm exec wrangler r2 object put planned-travel-tiles/basemaps/e2e.pmtiles \
      --local --file .e2e-tiles/basemap.pmtiles \
      --content-type application/octet-stream
  else
    echo '[cloud] no R2 credentials: the atlas frames will not match their baselines'
  fi
fi

echo '[cloud] ready. Seed with: pnpm dev & node scripts/seed/seed.mjs'
exit 0
