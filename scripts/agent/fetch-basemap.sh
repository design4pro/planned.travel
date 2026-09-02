#!/usr/bin/env bash
# Operator-only: download the e2e basemap once per host into the cache that
# setup-e2e.sh links from. The R2 token stays on the operator's shell; cezar runs never
# see it (the workflow env carries no CLOUDFLARE_* by design).
#
#   E2E_TILES_KEY=basemaps/planet-20260818.pmtiles \
#   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
#   bash scripts/agent/fetch-basemap.sh
#
# Cache: ${PLANNED_TRAVEL_CACHE:-~/.cache/planned-travel}/e2e-tiles/basemap.pmtiles
set -euo pipefail

: "${E2E_TILES_KEY:?dated archive key, e.g. basemaps/planet-20260818.pmtiles}"
: "${CLOUDFLARE_API_TOKEN:?R2:read token on planned-travel-tiles}"
: "${CLOUDFLARE_ACCOUNT_ID:?account that owns the bucket}"

cache="${PLANNED_TRAVEL_CACHE:-$HOME/.cache/planned-travel}/e2e-tiles"
target="$cache/basemap.pmtiles"
mkdir -p "$cache"

if [ -s "$target" ] && [ "${1:-}" != "--force" ]; then
  echo "basemap already cached at $target (use --force to refresh)"
  exit 0
fi

tmp="$target.$$.part"
trap 'rm -f "$tmp"' EXIT
pnpm exec wrangler r2 object get "planned-travel-tiles/${E2E_TILES_KEY}" --remote --file "$tmp"
mv -f "$tmp" "$target"
trap - EXIT
echo "basemap cached at $target"
