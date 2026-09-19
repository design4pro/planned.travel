#!/usr/bin/env bash
# Dev server for a design4pro sandbox: the SDK reserves port 3000, so bind APP_PORT on all interfaces.
exec pnpm exec vite dev --port "$APP_PORT" --host 0.0.0.0
