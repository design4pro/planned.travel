#!/bin/bash
#
# Bring a fresh checkout or `git worktree` to a working, signed-in localhost.
#
# Four fixtures the repository cannot carry are what stand between `git worktree
# add` and a usable app, and all four are gitignored and per-checkout:
# `node_modules`, `.dev.vars`, a migrated local D1, and the basemap in the local
# R2 simulator. Without the second of them Better Auth throws on the first
# request that touches a session, so `/login` answers 500 and every screen worth
# looking at - planner, atlas, costs, journal, both consoles - sits behind a
# redirect nobody can satisfy. This script is the one command that fixes that.
#
# It owns local provisioning for every profile. `scripts/cloud/session-start.sh`
# is a dispatcher that picks one and delegates here; `.claude/settings.json`
# runs that dispatcher from the SessionStart hook, on startup and on resume.
#
# Every step is skipped when its result is already on disk, because the hook
# runs again on every resume and a resume must not cost two minutes.
#
#   worktree  a person or an agent working locally. Port 3001-3009, secrets
#             copied from the main checkout when it has them, basemap cloned
#             from it, demo workspace seeded.
#   cloud     a Claude Code session VM. Port 3000, throwaway secrets for a
#             database that lives and dies with the VM, basemap pulled from R2.
#             Does not seed; docs/CLOUD.md §2 describes this profile.
#
# `scripts/agent/setup-e2e.sh` is the third profile and deliberately stays its own
# script: it mirrors `.github/actions/e2e-env/action.yml` step for step and
# gates the e2e suite in CI. See scripts/worktree/README.md.

set -euo pipefail

# ── Arguments ────────────────────────────────────────────────────────────────

PROFILE=worktree
PORT=
CHECK_ONLY=0
IF_NEEDED=0
FORCE=0
SEED=1

usage() {
  cat <<'EOF'
Usage: bash scripts/worktree/bootstrap.sh [options]

  --profile worktree|cloud  Which environment this is. Default: worktree.
  --port N                  Serve on this port instead of the allocated one.
  --check                   Report what is missing and exit 1. Writes nothing.
  --if-needed               Exit 0 immediately when nothing is missing.
  --no-seed                 Stop after the schema; do not start a server or seed.
  --force                   Redo every step even when its result is on disk.
  -h, --help                This text.

Anything else is an error rather than a silently ignored typo.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="${2:?--profile needs a value}"; shift 2 ;;
    --port) PORT="${2:?--port needs a value}"; shift 2 ;;
    --check) CHECK_ONLY=1; shift ;;
    --if-needed) IF_NEEDED=1; shift ;;
    --no-seed) SEED=0; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "bootstrap: unknown argument '$1'" >&2; usage >&2; exit 2 ;;
  esac
done

case "$PROFILE" in
  worktree|cloud) ;;
  *) echo "bootstrap: unknown profile '$PROFILE' (worktree|cloud)" >&2; exit 2 ;;
esac

# The cloud profile provisions a VM for a suite that seeds itself; keeping it
# non-seeding preserves exactly what docs/CLOUD.md §2 promises.
if [ "$PROFILE" = cloud ]; then SEED=0; fi

say() { echo "[bootstrap] $*"; }
warn() { echo "[bootstrap] $*" >&2; }
die() { echo "[bootstrap] ERROR: $*" >&2; exit 1; }

# ── Where we are ─────────────────────────────────────────────────────────────
#
# Resolve to the top of the checkout that contains the current directory rather
# than trusting CLAUDE_PROJECT_DIR alone: in a linked worktree that variable can
# name the main checkout, and provisioning the wrong tree is worse than not
# provisioning at all.

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ROOT=$(pwd)

absolutise() { case "$1" in /*) echo "$1" ;; *) echo "${ROOT}/$1" ;; esac; }

# `--git-dir` is this worktree's own gitdir and `--git-common-dir` the shared
# one. They are equal in the main checkout and differ in every linked worktree,
# which is also how we find the checkout worth copying secrets and a basemap from.
GIT_DIR=$(absolutise "$(git rev-parse --git-dir 2>/dev/null || echo .git)")
GIT_COMMON=$(absolutise "$(git rev-parse --git-common-dir 2>/dev/null || echo .git)")
MAIN_CHECKOUT=
IS_WORKTREE=0
if [ "$GIT_DIR" != "$GIT_COMMON" ]; then
  IS_WORKTREE=1
  MAIN_CHECKOUT=$(dirname "$GIT_COMMON")
  [ -d "$MAIN_CHECKOUT" ] || MAIN_CHECKOUT=
fi

# ── Port ─────────────────────────────────────────────────────────────────────
#
# 3000 is the developer's port and `pnpm dev` hardcodes it, so a second worktree
# on the same machine cannot have it. 3030-3040 is off limits in the other
# direction: playwright.config.ts refuses to run against anything outside that
# range, precisely so an automated round cannot photograph another branch's app,
# and 3010-3020 belongs to money-tracker on the same host. That leaves 3001-3009
# for parallel worktrees.

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

allocate_port() {
  if [ "$PROFILE" = cloud ] || [ "$IS_WORKTREE" = 0 ]; then
    echo 3000
    return 0
  fi
  local p
  for p in $(seq 3001 3009); do
    if ! port_busy "$p"; then echo "$p"; return 0; fi
  done
  return 1
}

# ── State detection ──────────────────────────────────────────────────────────

D1_DIR=.wrangler/state/v3/d1/miniflare-D1DatabaseObject
TILES_BLOBS=.wrangler/state/v3/r2/planned-travel-tiles/blobs

have_deps() { [ -d node_modules/.bin ]; }
have_dev_vars() { [ -f .dev.vars ]; }

# Gated on the schema actually being there, never on the directory existing:
# `vite dev` creates .wrangler/state/v3/d1 holding nothing but metadata.sqlite on
# its first boot, so a directory test skips the migrations forever after one
# failed start. That is the exact state a broken worktree is found in.
ARTEFACT_PATH=public/atlas/airports-iata.v1.txt

# Whether the airport catalogue has been loaded. Counted rather than merely
# present, because the migration creates the table and leaves it empty - the
# state this predicate exists to tell apart from a loaded one.
have_airports() {
  local f
  command -v sqlite3 >/dev/null 2>&1 || return 0
  for f in "$D1_DIR"/*.sqlite; do
    [ -e "$f" ] || continue
    case "$f" in */metadata.sqlite) continue ;; esac
    [ -s "$f" ] || continue
    if [ "$(sqlite3 "file:${f}?mode=ro" \
      "select count(*) from sqlite_master where type='table' and name='airports';" \
      2>/dev/null)" = "1" ] &&
      [ "$(sqlite3 "file:${f}?mode=ro" \
        "select count(*) > 0 from airports;" 2>/dev/null)" = "1" ]; then
      return 0
    fi
  done
  return 1
}

have_schema() {
  local f found=1
  for f in "$D1_DIR"/*.sqlite; do
    [ -e "$f" ] || continue
    case "$f" in */metadata.sqlite) continue ;; esac
    [ -s "$f" ] || continue
    if command -v sqlite3 >/dev/null 2>&1; then
      if sqlite3 "file:${f}?mode=ro" \
        "select 1 from sqlite_master where type='table' and name='user' limit 1;" \
        2>/dev/null | grep -q 1; then
        found=0
      fi
    else
      # No sqlite3 to ask: a non-empty database file that is not the metadata
      # bookkeeping one is the best evidence available.
      found=0
    fi
  done
  return $found
}

have_basemap() { [ -d "$TILES_BLOBS" ] && [ -n "$(ls -A "$TILES_BLOBS" 2>/dev/null)" ]; }

missing_list() {
  have_deps      || echo "node_modules (pnpm install)"
  have_dev_vars  || echo ".dev.vars (BETTER_AUTH_SECRET; without it /login answers 500)"
  have_schema    || echo "local D1 schema (pnpm db:migrate:local)"
  have_airports  || echo "airport catalogue in local D1 (pnpm db:airports:local)"
  have_basemap   || echo "basemap in local R2 (the map renders without tiles)"
}

if [ "$CHECK_ONLY" = 1 ]; then
  MISSING=$(missing_list)
  if [ -z "$MISSING" ]; then
    say "checkout is provisioned"
    exit 0
  fi
  warn "this checkout is missing:"
  echo "$MISSING" | sed 's/^/  - /' >&2
  warn "run: pnpm worktree:bootstrap"
  exit 1
fi

if [ "$IF_NEEDED" = 1 ] && [ "$FORCE" = 0 ] && [ -z "$(missing_list)" ]; then
  say "already provisioned, nothing to do"
  exit 0
fi

# ── 1. Dependencies ──────────────────────────────────────────────────────────
#
# A nested worktree can resolve packages from the parent checkout's
# node_modules, which lets `pnpm typecheck` pass against the wrong tree
# (docs/SPEC.md §3). Its own node_modules is correctness, not tidiness.

if [ "$FORCE" = 1 ] || ! have_deps; then
  say "installing dependencies"
  pnpm install --frozen-lockfile
else
  say "dependencies present"
fi

# ── 2. Route tree ────────────────────────────────────────────────────────────

say "generating the route tree"
pnpm generate-routes

# ── 3. Secrets ───────────────────────────────────────────────────────────────
#
# A .dev.vars we wrote carries the marker below and is ours to keep in step with
# the port. One without it was written by a person: leave every byte of it alone
# and bend the port to its APP_URL instead of the other way round.

MARKER="# planned.travel worktree bootstrap; safe to delete, regenerated on demand"

read_dev_var() {
  [ -f .dev.vars ] || return 0
  sed -n "s/^${1}=//p" .dev.vars | head -1
}

OWNS_DEV_VARS=0
if [ -f .dev.vars ] && head -1 .dev.vars | grep -qF "$MARKER"; then
  OWNS_DEV_VARS=1
fi

if [ "$FORCE" = 1 ] && [ "$OWNS_DEV_VARS" = 1 ]; then
  rm -f .dev.vars
  OWNS_DEV_VARS=0
fi

if [ ! -f .dev.vars ]; then
  OWNS_DEV_VARS=1
  if [ "$PROFILE" = worktree ] && [ -n "$MAIN_CHECKOUT" ] && [ -f "$MAIN_CHECKOUT/.dev.vars" ]; then
    say "copying .dev.vars from $MAIN_CHECKOUT"
    { echo "$MARKER"; cat "$MAIN_CHECKOUT/.dev.vars"; } > .dev.vars
    if [ -f "$MAIN_CHECKOUT/.env.local" ] && [ ! -f .env.local ]; then
      # VITE_POLAR_PRODUCT_* are build-time names Vite inlines. Without them
      # requirePrice() throws for that plan and /pricing ships with nothing on it.
      say "copying .env.local from $MAIN_CHECKOUT"
      cp "$MAIN_CHECKOUT/.env.local" .env.local
    fi
  else
    # Nothing to borrow from: throwaway values for a database that lives and
    # dies with this directory. Real credentials never come near it.
    say "writing throwaway .dev.vars"
    cat > .dev.vars <<EOF
$MARKER
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
APP_URL=http://localhost:3000
TILES_ARCHIVE_KEY=basemaps/e2e.pmtiles
EOF
  fi
fi

[ -n "$(read_dev_var BETTER_AUTH_SECRET)" ] \
  || die ".dev.vars carries no BETTER_AUTH_SECRET, so /login cannot work. Fill it in, or delete the file and rerun."

# Resolve the port against that file rather than over it.
if [ -z "$PORT" ]; then
  if [ "$OWNS_DEV_VARS" = 0 ]; then
    PORT=$(read_dev_var APP_URL | sed -n 's#.*:\([0-9][0-9]*\)/*$#\1#p')
  fi
  if [ -z "$PORT" ]; then
    PORT=$(allocate_port) \
      || die "no free port in 3001-3009; stop another worktree's dev server, or pass --port"
  fi
fi
BASE_URL="http://localhost:${PORT}"

if [ "$OWNS_DEV_VARS" = 1 ]; then
  # Every auth URL is built from APP_URL, so a port nothing listens on does not
  # fail loudly: it sends the OAuth callback and the verification link in an
  # email to a dead origin. Keep the two in step.
  if [ "$(read_dev_var APP_URL)" != "$BASE_URL" ]; then
    say "pointing APP_URL at ${BASE_URL}"
    DEV_VARS_TMP=".dev.vars.$$.part"
    sed "s#^APP_URL=.*#APP_URL=${BASE_URL}#" .dev.vars > "$DEV_VARS_TMP"
    mv -f "$DEV_VARS_TMP" .dev.vars
    grep -q '^APP_URL=' .dev.vars || echo "APP_URL=${BASE_URL}" >> .dev.vars
  fi
elif [ "$(read_dev_var APP_URL)" != "$BASE_URL" ]; then
  warn "APP_URL in your .dev.vars is '$(read_dev_var APP_URL)' but this run serves ${BASE_URL}."
  warn "Leaving your file untouched; pass --port to match it."
fi

TILES_KEY=$(read_dev_var TILES_ARCHIVE_KEY)
TILES_KEY=${TILES_KEY:-basemaps/e2e.pmtiles}

# ── 4. Local D1 ──────────────────────────────────────────────────────────────
#
# Migrations and `vite dev` contend for the same SQLite files, so the schema
# lands before any server starts.

if [ "$FORCE" = 1 ] || ! have_schema; then
  say "applying D1 migrations"
  pnpm db:migrate:local
  have_schema || die "migrations ran but no schema is visible in ${D1_DIR}"
else
  say "local D1 already has the schema"
fi

# The `airports` table ships empty - the migration creates the shape and the
# committed artefact carries the rows. The connection search's stop picker is
# the one surface that treats the catalogue as a gate rather than a shortcut, so
# without this it cannot resolve a stop at all. The load replaces the table's
# contents, so re-running it is free.

if [ "$FORCE" = 1 ] || ! have_airports; then
  say "loading the airport catalogue"
  pnpm db:airports:local >/dev/null
  have_airports || die "the airport load ran but ${ARTEFACT_PATH} is not in the database"
else
  say "local D1 already has the airport catalogue"
fi

# ── 5. Basemap ───────────────────────────────────────────────────────────────
#
# Missing tiles are a missing fixture, not a regression, so say so plainly
# rather than letting a later suite report it as forty coastline-shaped diffs.
#
# Both paths write the archive under whatever key TILES_ARCHIVE_KEY already
# names, which is the only way the Worker finds it: /api/tiles/basemap.pmtiles
# resolves to that var, and a key that disagrees with the stored object does not
# fail loudly, it renders a map with nothing under it.

TILES_TMP=

clone_basemap_from() {
  local src="$1/.wrangler/state/v3/r2"
  [ -d "$src/planned-travel-tiles/blobs" ] || return 1
  say "cloning the local R2 state from $1"
  mkdir -p .wrangler/state/v3
  rm -rf .wrangler/state/v3/r2
  # -c asks APFS for a copy-on-write clone: instant, and no second 480 MB on
  # disk. The whole r2/ tree has to come across, not just the blob: the key to
  # blob index lives apart from it in r2/miniflare-R2BucketObject/*.sqlite and
  # the bytes are unreachable without it. Falls back to a real copy elsewhere.
  cp -Rc "$src" .wrangler/state/v3/r2 2>/dev/null || cp -R "$src" .wrangler/state/v3/r2
}

pull_basemap_from_r2() {
  [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${E2E_TILES_KEY:-}" ] || return 1
  if [ ! -s .e2e-tiles/basemap.pmtiles ]; then
    say "pulling the basemap archive from R2 (${E2E_TILES_KEY})"
    mkdir -p .e2e-tiles
    # The cache outlives this worktree and the -s test above only checks
    # non-empty, so a half-written file would poison every later run. Download
    # to a temp file and move it into place; mv within one filesystem is atomic.
    TILES_TMP=".e2e-tiles/basemap.pmtiles.$$.part"
    trap 'rm -f "$TILES_TMP"' EXIT
    pnpm exec wrangler r2 object get "planned-travel-tiles/${E2E_TILES_KEY}" --remote --file "$TILES_TMP"
    mv -f "$TILES_TMP" .e2e-tiles/basemap.pmtiles
    trap - EXIT
    TILES_TMP=
  fi
  say "loading the archive into the local R2 simulator as ${TILES_KEY}"
  pnpm exec wrangler r2 object put "planned-travel-tiles/${TILES_KEY}" \
    --local --file .e2e-tiles/basemap.pmtiles \
    --content-type application/octet-stream
}

BASEMAP_STATE=present
if [ "$FORCE" = 1 ] || ! have_basemap; then
  if [ "$PROFILE" = worktree ] && [ -n "$MAIN_CHECKOUT" ] && clone_basemap_from "$MAIN_CHECKOUT"; then
    BASEMAP_STATE=cloned
  elif pull_basemap_from_r2; then
    BASEMAP_STATE=downloaded
  else
    BASEMAP_STATE=missing
    warn "no basemap: the map renders its BASEMAP UNAVAILABLE fallback."
    warn "Provision it later with CLOUDFLARE_API_TOKEN and E2E_TILES_KEY set, or by"
    warn "copying .wrangler/state/v3/r2/ from a checkout that has one, server stopped."
  fi
fi

if [ "$SEED" = 0 ]; then
  say "ready. Start a server and seed with:"
  say "  pnpm exec vite dev --port ${PORT} --strictPort"
  say "  node scripts/seed/seed.mjs --url ${BASE_URL}"
  exit 0
fi

# ── 6. Server ────────────────────────────────────────────────────────────────
#
# `pnpm dev` hardcodes --port 3000, so a worktree on its own port has to go
# through vite directly. --strictPort turns a taken port into an error instead
# of a silent drift to the next one, which is how a seed ends up writing into
# another checkout.

if port_busy "$PORT"; then
  say "a server is already answering on :${PORT}, reusing it"
else
  say "starting the dev server on :${PORT}"
  pnpm exec vite dev --port "$PORT" --strictPort > dev-server.log 2>&1 &
  for _ in $(seq 1 60); do
    curl --silent --fail --output /dev/null "${BASE_URL}/" && break
    sleep 2
  done
  curl --silent --fail --output /dev/null "${BASE_URL}/" || {
    tail -40 dev-server.log >&2
    die "dev server did not answer on :${PORT} within 120s"
  }
fi

# ── 7. Demo workspace ────────────────────────────────────────────────────────
#
# --url is not optional. Without it seed.mjs probes 3000-3005 then 3030-3035 and
# writes to the first origin that answers, which on a machine running several
# worktrees is a write to somebody else's database.

say "seeding the demo workspace"
node scripts/seed/seed.mjs --url "$BASE_URL"
node scripts/seed/verify.mjs

# ── 8. Report ────────────────────────────────────────────────────────────────

if [ "$BASEMAP_STATE" = missing ]; then
  TILES_STATUS='MISSING, the map renders without tiles'
else
  TILES_CODE=$(curl -s -o /dev/null -w '%{http_code}' -r 0-16 \
    "${BASE_URL}/api/tiles/basemap.pmtiles" || echo 000)
  case "$TILES_CODE" in
    200|206) TILES_STATUS="serving (${BASEMAP_STATE})" ;;
    *) TILES_STATUS="NOT SERVING (HTTP ${TILES_CODE}); TILES_ARCHIVE_KEY='${TILES_KEY}' may not name the stored object" ;;
  esac
fi

cat <<EOF

[bootstrap] ready.

  App        ${BASE_URL}
  Sign in    rafal@planned.travel / planned-demo-2026
  Basemap    ${TILES_STATUS}
  Server log ${ROOT}/dev-server.log

The password is a fixture for a local database, not a secret; see
scripts/seed/README.md. Social sign-in is registered against :3000 only, so on
any other port use the password form.
EOF
