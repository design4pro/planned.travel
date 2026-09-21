#!/usr/bin/env bash
#
# Put a `gh` of at least a known-good version on PATH, installing it from GitHub's own apt
# repository when the runner image does not carry one.
#
# Two workflows drive GitHub through `gh` and neither installed it: promote-develop.yml opens
# the release pull request, and claude-code-review.yml publishes through `gh pr comment` and
# runs review-threads-label.mjs, which drives the issues API with it. ADR 0026 moved both onto
# Blacksmith images, and CODE_REVIEW.md is explicit about what a moved job owes: every tool it
# calls is installed by a step rather than assumed from the image, and on a required check or a
# shipping job a gap is a blocker.
#
# The images do carry `gh` today, so this is about the day they stop - a rebuild, a variant
# swap, or `vars.RUNNER_CI` pointed elsewhere without a pull request. What it guards against is
# not a red job. It is `gh: command not found` inside a `set -e` block, which on
# promote-develop.yml means the release pull request quietly stops being opened on every push
# to develop, and on claude-code-review.yml means the review-threads automation stops arming
# while the check still reports green.
#
# This lives in scripts/ci/ rather than in a composite action on purpose. claude-code-review.yml
# runs on `pull_request`, so its checkout is the tree of the branch under review; a local
# `uses: ./.github/actions/...` would execute that branch's code with this job's write token,
# which is the exact door the "take the agent hooks and the CI scripts from the base branch"
# step exists to close. scripts/ci is already on that step's restore list, so a script here is
# covered by a guarantee that already holds instead of needing a new one.

set -euo pipefail

# The lowest `gh` this repository's tracker descriptor works against: 2.82.1 is where
# `gh pr edit` stopped aborting on the retired Projects (classic) GraphQL fields. See
# .ai/trackers/github.md, which explains why an older client leaves a pull request silently
# unlabelled rather than failing.
MIN_VERSION="${GH_MIN_VERSION:-2.82.1}"

current=''
if command -v gh >/dev/null 2>&1; then
  current=$(gh --version | sed -n '1s/.*gh version \([0-9][0-9.]*\).*/\1/p')
fi

# `sort -V` puts the lower version first, so the minimum staying first means the installed one
# is at least it. An empty `$current` is handled before this, because an empty line sorts first
# and would read as "new enough".
if [ -n "$current" ] \
  && [ "$(printf '%s\n%s\n' "$MIN_VERSION" "$current" | sort -V | head -n1)" = "$MIN_VERSION" ]; then
  echo "gh $current is already on PATH (minimum $MIN_VERSION)."
  exit 0
fi

if [ -n "$current" ]; then
  echo "::notice title=Upgrading gh::the image carries $current, below the $MIN_VERSION this repository needs."
else
  echo "::notice title=Installing gh::the runner image carries no GitHub CLI."
fi

# GitHub's own repository rather than the distribution's: Debian and Ubuntu ship clients years
# behind, and .ai/trackers/github.md documents what that costs. `dpkg --print-architecture`
# rather than a hard-coded arm64, because `vars.RUNNER_CI` can move these jobs to an x64 runner
# without a pull request.
arch=$(dpkg --print-architecture)
keyring=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo mkdir -p -m 755 /usr/share/keyrings
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo tee "$keyring" >/dev/null
sudo chmod go+r "$keyring"
echo "deb [arch=$arch signed-by=$keyring] https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
sudo apt-get update
sudo apt-get install -y gh

gh --version | head -n1
