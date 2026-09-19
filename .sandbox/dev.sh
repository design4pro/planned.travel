#!/usr/bin/env bash
# Dev server for a design4pro sandbox: the SDK reserves port 3000, so bind APP_PORT on all interfaces.
set -euo pipefail

# Vite answers 403 to any Host outside `server.allowedHosts` (it always allows `*.localhost`), and
# `--host` only changes the bind address. So hand it the public preview host from APP_URL.
# `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` is Vite's internal hook (read in 8.2.1); it keeps
# `vite.config.ts` untouched, and a Vite upgrade that drops it shows up as a 403 on the preview.
host="${APP_URL#*://}"
host="${host%%/*}"
host="${host%%:*}"

# --strictPort, as bootstrap.sh serves: a taken port fails loudly instead of drifting to the next.
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="$host" \
  exec pnpm exec vite dev --port "${APP_PORT:?APP_PORT is not set}" --strictPort --host 0.0.0.0
