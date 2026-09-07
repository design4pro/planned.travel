#!/usr/bin/env bash
# Host workaround for open-mercato/cezar#914 (fix in upstream PR #916, unreleased as of 0.10.1):
# the automations poller validates every /timeline row against a labeled|unlabeled schema, so one
# comment or cross-reference on any recently updated issue fails the whole `issue.labeled` poll.
# `issue-regroom`, `issue-autofix` and `issue-spec` never fire without this. Patches the copy of
# `@open-mercato/cezar@0.10.1` in the npx cache that the cockpit service runs, keeps a `.orig`
# beside it, and restarts the service. Idempotent. Drop it when the pinned version carries #916.
set -euo pipefail

VERSION="${CEZ_VERSION:-0.10.1}"
FILE=$(grep -lx "  \"version\": \"$VERSION\"," "$HOME"/.npm/_npx/*/node_modules/@open-mercato/cezar/package.json 2>/dev/null \
  | head -1 | xargs -I{} dirname {} | sed 's|$|/dist/automations/github-poller.js|')
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "cezar $VERSION not found in the npx cache; start the cockpit once first" >&2; exit 1; }

if grep -q "cezar#914" "$FILE"; then
  echo "already patched: $FILE"
else
  cp "$FILE" "$FILE.orig"
  node - "$FILE" <<'JS'
const fs = require('node:fs')
const [file] = process.argv.slice(2)
const src = fs.readFileSync(file, 'utf8')
const from = '        return z.array(timelineEventSchema).parse(JSON.parse(raw));'
const to = [
  '        // host patch, open-mercato/cezar#914: validate only the label rows of the timeline.',
  "        const rows = JSON.parse(raw).filter((entry) => entry?.event === 'labeled' || entry?.event === 'unlabeled');",
  '        return z.array(timelineEventSchema).parse(rows);',
].join('\n')
if (src.split(from).length !== 2) throw new Error(`expected exactly one parse site in ${file}`)
fs.writeFileSync(file, src.replace(from, to))
JS
  echo "patched: $FILE"
fi

launchctl kickstart -k "gui/$(id -u)/dev.cezar.cockpit" && echo "cockpit restarted"
