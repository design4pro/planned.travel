#!/usr/bin/env bash
# PreToolUse hook (Bash). Three tiers, by who is at the other end of the command.
#
# Tier one - everyone, in every session: destructive git, `--no-verify`, the two Cloudflare
# operations nothing recovers from - writing a secret and deleting a D1/R2/KV store or the Worker
# itself - and the commands that delete the checkout or its history rather than a file inside it.
# Everything here destroys work that is not recoverable from the reflog by someone who does not
# already know to look, or takes the reflog itself away. `develop` and `main` are the shared
# branches - staging and production respectively - so a force-push to either, or a delete of
# either, rewrites what somebody else has already pulled.
#
# Tier two - agent runs (CEZ_TASK_ID or GITHUB_ACTIONS): the things an om-* run never needs.
# Dumping the environment (the worktree holds live secrets in .dev.vars), changing the pinned
# stack (docs/SPEC.md §3), shipping - deploys and remote migrations - leaving the user the run was
# started as, and deleting anything but build output and scratch space. GitHub mutations,
# `git add -A`, closing keywords and `pnpm exec` are the om-* skills' ordinary tools (tracker
# descriptor .ai/trackers/github.md, SDLC.md) and stay open under Cezar.
#
# Tier three - GitHub Actions only: the whole `gh` mutation surface. See the section itself.
#
# The Cloudflare rules are split by what a mistake costs. A deploy is undone by deploying again,
# so a developer at the keyboard keeps the ordinary approval prompt for it; a written secret is
# already in the transcript and a deleted database is gone, so those are refused in every session.
# Nothing that refuses a command belongs in `.claude/settings.json` - its allow list is only for
# the tracker operations the om-* pipeline cannot run without.
#
# Contract: exit 2 blocks the tool call and feeds stderr back to the model; exit 0 allows.
set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

[ -z "$command" ] && exit 0

# A backslash-newline is a line continuation: the shell joins the two lines into one statement
# before running it, so this file has to join them before reading it. Every rule below greps a
# possibly-multi-line `$scan`, and grep works a line at a time, so a continuation left in place
# splits one statement into two lines that each carry only part of what a rule matches on. That
# silently unblocks any rule whose pattern spans a space - `git reset --hard`, `git clean -fd`
# and the remote-D1 gate below were all reachable that way.
#
# It has to happen here, before `unquote()`: that strips the backslash and would leave the
# newline it was escaping behind, which is the split itself. Fold first, strip second.
#
# The pair is removed, not replaced with a space, because that is what the shell does with it -
# a continuation may split a token in half, and the shell rejoins the halves. Substituting a
# space put the halves back as two tokens instead of one, so `git re\`+newline+`set --hard` read
# as `git re set --hard` and matched no rule at all. The same shape hid `wrangler d\`+newline+`1`
# from the remote-D1 gate. Every test written for this until now happened to break on a space,
# where the two spellings agree.
command=${command//\\$'\n'/}

# A rule matches the command, not prose about it - and deciding which is which is the whole
# problem. The first shape of this got it backwards: it listed the ways a string gets *executed*
# and read everything else as text. A denylist of ways to run a string is a list that is always
# missing one, and it was missing four - `bash -lc`, `sh -ec`, `node -e` and a heredoc redirected
# into a shell all had their payload deleted before a rule saw it. It was over-broad in the same
# stroke, on raw substrings: `grep -c` was refused, and so was a commit message that merely
# contained the token - including the one writing this fix.
#
# So the list is inverted. Quoted spans and heredoc bodies are discarded only for a closed set of
# commands whose quoted arguments are text *by definition*, and only when nothing else hides
# behind them. Everything else - every executor, listed or not - keeps every word. An unknown
# command now fails closed, which is the direction this file's mistakes should point.
#
# Backslash is a quoting character too, and both audiences need it gone: the shell drops it and
# keeps the character, so `gh pr \review 12 --approve` invokes `gh pr review` while a `tr` that
# deletes only the two quote marks left it matching nothing.
#
# A backslash at the end of a line is the one place it means something else, and it has to be read
# before the rest are deleted: the shell joins the two lines into one command before it reads a
# single word, so a hook that does not is reading a command the shell will never run. Every rule
# below is line-oriented - `grep` matches within a line, and the `rm` tokenizer ends an invocation
# at a newline - so a continued command used to have each of its halves judged as a command of its
# own, and a target list split across the join lost everything after it.
unquote() {
  printf '%s' "$1" \
    | awk '{ line = line $0
             if (sub(/\\$/, "", line)) { line = line " "; next }
             print line; line = "" }
           END { if (line != "") print line }' \
    | tr -d '"\047\\'
}

# Nothing on this list can execute a string it is handed: a message, a pattern, a heredoc written
# to a file. `sed` (GNU `s///e`) and `awk` (`system()`) can, so they are deliberately absent even
# though their arguments read as prose - the criterion is what the command *can* do, not what it
# usually does.
prose_command='^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*(git[[:space:]]+(commit|tag|stash|notes)|gh[[:space:]]+(pr|issue|release)[[:space:]]+[a-z-]+|grep|egrep|fgrep|rg|echo|printf|cat|tee)([[:space:]]|$)'

# Under GitHub Actions nothing is discarded at all, not even for those commands: there the string
# comes from an attacker-authored diff, so a commit message is untrusted input like the rest of
# it. Only the quoting characters go, which is what makes `gh pr "review" 12 --approve` still
# match the rule for `gh pr review` - the raw string does not, because the quotes sit exactly
# where the verb is expected.
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  scan=$(unquote "$command")
else
  scan=$(unquote "$command")
  # Here-strings, not pipes: `grep -q` closes early, and under `pipefail` that turns a match into
  # a non-zero pipeline - the one failure shape that would silently re-open the stripping.
  if grep -Eq "$prose_command" <<< "${command%%$'\n'*}"; then
    # Buffer before stripping: an unclosed or ambiguous delimiter must preserve the whole
    # command. Build the quote character portably rather than using octal regexp escapes.
    text=$(printf '%s' "$command" | awk '
      BEGIN {
        quotes = sprintf("%c%c", 34, 39)
        pattern = "<<-?[" quotes "][A-Za-z_][A-Za-z0-9_]*[" quotes "]"
      }
      {
        original = original $0 "\n"
        if (skip) {
          closing = $0
          if (tabs) sub(/^\t+/, "", closing)
          if (closing == tag) skip = 0
          next
        }
        if (match($0, pattern)) {
          prefix = substr($0, 1, RSTART - 1)
          # A third angle bracket makes this a here-string, with no body to discard.
          if (prefix ~ /<$/) uncertain = 1
          if (prefix ~ ("[" quotes "#]") || index(prefix, sprintf("%c", 92))) uncertain = 1
          marker = substr($0, RSTART, RLENGTH)
          rest = substr($0, RSTART + RLENGTH)
          # Shell words can concatenate quoted and unquoted parts: <<"EOF"x closes at
          # EOFx, not EOF. Only a complete delimiter token is safe to strip.
          if (rest != "" && rest !~ /^[[:space:];|&()<>]/) uncertain = 1
          if (rest ~ /<</) uncertain = 1
          tabs = substr(marker, 3, 1) == "-"
          offset = tabs ? 5 : 4
          if (substr(marker, offset - 1, 1) != substr(marker, length(marker), 1)) uncertain = 1
          tag = substr(marker, offset, length(marker) - offset)
          skip = 1
        } else if ($0 ~ /<</) uncertain = 1
        stripped = stripped $0 "\n"
      }
      END { printf "%s", (skip || uncertain) ? original "uncertain heredoc\n" : stripped }
    ')
    # An uncertain heredoc retains a newline, preventing this candidate from replacing scan.
    text=$(printf '%s' "$text" | sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g")
    # A control operator means a second command hides behind the first, and the head word says
    # nothing about it: a `grep` chained by `&&` into a shell invocation would have had the
    # payload stripped as if it were the grep's own pattern. Only a lone simple command is text.
    #
    # A newline is one of those operators. It separates commands exactly as `;` does, and leaving
    # it out of the set was the whole bug: the head-word test above reads only the first line, so
    # a prose head word followed by a newline and an executor carrying a quoted payload passed as
    # prose, and the payload was deleted before a rule saw it. The awk above has already removed
    # heredoc bodies, so a newline still in $text is a second command, never a quoted document -
    # which is why the heredoc commit-message shape keeps its exemption.
    #
    # The trade-off, taken deliberately: a multi-line command that both starts with a prose head
    # word and carries a matching token inside quotes on a later line is now refused. Re-issue it
    # as one line. That is the fail-closed direction this file's mistakes should point in.
    if ! grep -Eq '[|;&`]|\$\(' <<< "$text" && [ "$text" = "${text%%$'\n'*}" ]; then
       scan="$text"
    fi
  fi
fi

block() {
  echo "BLOCKED: '$command' matches dangerous pattern '$1'. The user has prevented you from doing this." >&2
  exit 2
}

case "$scan" in
  *"git push"*--force*develop*|*"git push"*--force*main*|*"git push"*-f\ *develop*|*"git push"*-f\ *main*)
    block "force-push to develop/main" ;;
esac

echo "$scan" | grep -Eq 'git\s+reset\s+--hard' && block 'git reset --hard'
echo "$scan" | grep -Eq 'git\s+clean\s+-[a-zA-Z]*f' && block 'git clean -f'
echo "$scan" | grep -Eq 'git\s+branch\s+-D\b' && block 'git branch -D'
echo "$scan" | grep -Eq 'git\s+(checkout|restore)\s+\.' && block 'git checkout/restore .'
# The pre-commit hook is the fast gate (lint-staged, typecheck, tests); skipping it is how a red
# tree reaches a pull request.
echo "$scan" | grep -Eq 'git\s+.*--no-verify' && block 'git --no-verify'
echo "$scan" | grep -Eq 'git\s+commit\b.*\s-n(\s|$)' && block 'git --no-verify'

# A secret named on a command line is already in the transcript, and a deleted D1 database, R2
# bucket, KV namespace or Worker does not come back - deleting the Worker takes its routes, its
# Durable Object bindings and the live deployment with it. Neither has a legitimate caller here,
# in any session.
echo "$scan" | grep -Eq 'wrangler\s+secret\b' && block 'wrangler secret'
echo "$scan" | grep -Eq 'wrangler\s+((d1|r2\s+bucket|kv\s+namespace)\s+)?delete\b' && block 'wrangler delete'


# Destroying the checkout itself, refused in every session. The two rules above it are refused
# because the reflog makes them recoverable by somebody who knows to look; these are the commands
# that take the reflog away, or take the whole history at once, and nothing recovers from them.
# None has a caller here - a developer retiring their own checkout does it from a shell, not from
# an agent session.
echo "$scan" | grep -Eq 'git\s+reflog\s+expire' && block 'git reflog expire'
echo "$scan" | grep -Eq 'git\s+gc\b[^|;&]*--prune' && block 'git gc --prune'
echo "$scan" | grep -Eq 'git\s+(filter-branch|filter-repo)\b' && block 'git history rewrite'
echo "$scan" | grep -Eq 'gh\s+repo\s+delete\b' && block 'gh repo delete'
# Deleting a shared branch on the remote, in each of its three spellings: `--delete develop`, the
# short form `-d`, and the colon refspec `:develop` are one act, and all of them undo what
# everybody else has already pulled. `-d` is not a variant this rule may leave to the long
# spelling it already covers - git-push(1) documents the two as one option ("-d, --delete"), an
# exact synonym since 1.7.0, so matching only `--delete` protected the shared branches from
# nobody who types the short form. A merged feature branch stays deletable in either spelling,
# which is what `--delete-branch` on a merge needs.
echo "$scan" | grep -Eq 'git\s+push\b[^|;&]*\s(--delete|-d)\s+\S*\s*(develop|main)([^[:alnum:]_/-]|$)' \
  && block 'git push --delete develop/main'
echo "$scan" | grep -Eq 'git\s+push\b[^|;&]*[[:space:]]:(refs/heads/)?(develop|main)([^[:alnum:]_/-]|$)' \
  && block 'git push :develop/main'

# A recursive delete, judged by what it names. This is the hole the rest of this file left open.
# guard-generated.sh confines Edit and Write to the worktree and says in its own header that a
# Bash redirect still reaches outside - but nothing here read `rm` at all, so a run could delete
# the tree it was given, and every tree beside it, without matching a single rule in either hook.
#
# `rm_invocations` prints one `<recursive> <target>` line per target of every `rm` in the command,
# so `rm -rf dist && rm -rf src` is judged as the two acts it is rather than as one string that
# happens to contain an accepted word. The two tiers then differ only in which targets they take:
# this one refuses what has no caller anywhere, and the agent tier below accepts only what a
# command in package.json can put back.
rm_invocations() { # command
  # scan has lost its quotes. A quoted or escaped angle bracket may belong to a real
  # filename. Substitutions can be split by the tokenizer and hide subsequent targets.
  # Keep ambiguous redirects visible so their operands fail the disposable-path allowlist.
  local strip_redirects=1
  if grep -Eq "\"[^\"]*[<>][^\"]*\"|'[^']*[<>][^']*'|\\\\[<>]" <<< "$command"; then
    strip_redirects=0
  fi
  if grep -Eq '\$\(|`' <<< "$command"; then
    strip_redirects=0
  fi
  printf '%s\n' "$1" | awk -v strip_redirects="$strip_redirects" '
    function emit(   j) {
      if (!inrm) return
      # No literal target: the paths come from somewhere this hook cannot read, so there is
      # nothing to match an allowlist against. Emit a placeholder no allowlist accepts, so the
      # run is refused and told to name the path, rather than dropped.
      if (n == 0) tgt[++n] = "<unnamed>"
      for (j = 1; j <= n; j++) printf "%d %s\n", rec, tgt[j]
      inrm = 0; rec = 0; n = 0
    }
    {
      # Space out the shell metacharacters before the fields are read, so a word one of them is
      # glued to is still that word: `;rm` is an operator followed by `rm`, not one unknown token.
      # Strip exactly one redirection and its operand before spacing control operators.
      # In particular, the ampersand in 2>&1 is not a command boundary. Attached targets
      # such as dist>/dev/null keep their dist prefix; following targets remain visible.
      redirect = "([&]>|[<>][<>|]?[&]?)[[:space:]]*[^[:space:];|&()`<>]+"
      if (strip_redirects) {
        gsub("(^|[[:space:]])[0-9]+" redirect, " ")
        gsub(redirect, " ")
      }
      gsub(/[;|&()`]/, " & ")
      # A newline ends a command as surely as a semicolon does, so no state survives one.
      inrm = 0; rec = 0; n = 0
      for (i = 1; i <= NF; i++) {
        t = $i
        # A control operator ends the invocation; the next word starts a new command.
        if (t ~ /^[;|&()`]+$/) { emit(); continue }
        if (t ~ /(^|\/)rm$/) { emit(); inrm = 1; continue }
        if (!inrm) continue
        if (t == "--") continue
        # A flag may follow the targets (`rm node_modules -rf` is valid), so recursion is decided
        # over the whole invocation and the targets are held until it ends.
        if (t == "--recursive") { rec = 1; continue }
        if (t ~ /^--/) continue
        if (t ~ /^-/) { if (t ~ /[rR]/) rec = 1; continue }
        tgt[++n] = t
      }
      emit()
    }'
}

# The machine, the account, the checkout. `$HOME` and `~` are matched literally: this hook never
# expands a variable, and the shell that would have is the one being stopped.
fatal_rm_target() { # path
  case "$1" in
    / | // | /\* | '~' | '~/' | '~/*') return 0 ;;
    '$HOME' | '${HOME}' | '$HOME'/* | '${HOME}'/*) return 0 ;;
    . | ./ | ./\* | .. | ../ | \*) return 0 ;;
    /Users | /Users/ | /home | /home/ | /etc | /usr | /var) return 0 ;;
    '$CLAUDE_PROJECT_DIR' | '${CLAUDE_PROJECT_DIR}' | '$CLAUDE_PROJECT_DIR'/) return 0 ;;
    "$guard_root" | "$guard_root"/) return 0 ;;
  esac
  return 1
}

guard_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
rm_seen=$(rm_invocations "$scan")
while read -r rm_rec rm_target; do
  [ "$rm_rec" = 1 ] || continue
  fatal_rm_target "$rm_target" && block "recursive delete of '$rm_target'"
done <<RM_TIER_ONE
$rm_seen
RM_TIER_ONE
# Everything below applies to agent runs only; a developer at the keyboard keeps pnpm and env.
[ -n "${CEZ_TASK_ID:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ] || exit 0

agent_block() {
  echo "BLOCKED (agent run): '$command' matches '$1'. $2" >&2
  exit 2
}

echo "$scan" | grep -Eq '(^|[^[:alnum:]_/-])pnpm\s+(add|remove|rm|uninstall|update|up|upgrade)\b' \
  && agent_block 'pnpm add|remove|update' 'The stack is pinned (docs/SPEC.md §3); end the run as blocked and name the dependency.'
echo "$scan" | grep -Eq '(^|[^[:alnum:]_/-])printenv\b' && agent_block 'printenv' 'The environment holds secrets.'
echo "$scan" | grep -Eq '(^|[^[:alnum:]_/-])env(\s*$|\s*\||\s+-0|\s*;|\s*&&)' && agent_block 'env dump' 'The environment holds secrets.'


# A recursive delete in an agent run, judged against what a command in package.json can put back.
# The list is an allowlist because a denylist of paths worth keeping is the same list that is
# always missing one, and the one it is missing here is the source tree. A run that needs to
# delete anything else ends as blocked and names the path - which is a failure a reviewer can
# read, and the direction this file's mistakes should point in.
disposable_rm_target() { # path
  # A `*` in a `case` glob matches `/` and `..` alike, so a path that walks back up out of an
  # accepted prefix used to be accepted along with it: `node_modules/../src` matched
  # `node_modules/*` and named the source tree, which is the one path this allowlist exists to
  # keep. So any `..` segment is refused before the allowlist is consulted at all. Refusing
  # rather than normalising is deliberate - resolving a path here would have to guess at symlinks
  # and at a working directory this hook does not know, and a run can always name the directory
  # it means.
  case "/${1#/}/" in
    */../*) return 1 ;;
  esac
  case "${1%/}" in
    node_modules | */node_modules | node_modules/* | */node_modules/*) return 0 ;;
    dist | */dist | build | */build | coverage | */coverage) return 0 ;;
    .wrangler | */.wrangler | .turbo | */.turbo | .vite | */.vite) return 0 ;;
    .output | */.output | .cache | */.cache) return 0 ;;
    playwright-report* | */playwright-report* | test-results* | */test-results*) return 0 ;;
    .ai/tmp | .ai/tmp/* | */.ai/tmp | */.ai/tmp/*) return 0 ;;
    .ai/analysis/* | */.ai/analysis/*) return 0 ;;
    .ai/cezar/tmp | .ai/cezar/tmp/* | */.ai/cezar/tmp/*) return 0 ;;
    /tmp/* | /private/tmp/* | /var/folders/*) return 0 ;;
    '$TMPDIR'/* | '${TMPDIR}'/*) return 0 ;;
    *.log) return 0 ;;
  esac
  return 1
}

while read -r rm_rec rm_target; do
  [ "$rm_rec" = 1 ] || continue
  disposable_rm_target "$rm_target" || agent_block "recursive delete of '$rm_target'" \
    'A run deletes only build output and scratch space. Delete the files you need one by one, or end the run as blocked and name the path.'
done <<RM_AGENT_TIER
$rm_seen
RM_AGENT_TIER

# The two ways to spell the same delete without naming `rm` as the command.
echo "$scan" | grep -Eq '(^|[^[:alnum:]_/-])find\s[^|;&]*(-delete|-exec\s+rm)\b' \
  && agent_block 'find -delete' 'A run deletes only build output and scratch space, by naming the path.'
# The worktree a run was given is the cockpit's to create and retire, and `--force` discards
# uncommitted work in it - including a human's, when the path is wrong.
echo "$scan" | grep -Eq 'git\s+worktree\s+remove\b[^|;&]*(--force|-f)\b' \
  && agent_block 'git worktree remove --force' 'The cockpit owns the worktrees; end the run instead.'
# Nothing a run does needs to leave the user it was started as.
echo "$scan" | grep -Eq '(^|[^[:alnum:]_/-])sudo\s' \
  && agent_block 'sudo' 'A run holds exactly the permissions it was started with.'
# Shipping is a human decision, and an unattended run has nobody to answer a prompt about it.
# `deploy` is not the only way to ship: `versions upload` + `versions deploy` is the gradual
# rollout, `rollback` and `triggers deploy` change what production serves. `db:migrate:local` is
# the local D1 copy and stays open; `--remote` is what names staging or production.
echo "$scan" | grep -Eq 'wrangler\s+(deploy|rollback|versions\s+(deploy|upload)|triggers\s+deploy)\b' \
  && agent_block 'wrangler deploy' 'Deploying is a human decision; end the run as blocked and say what is ready to ship.'

# Remote D1 is split by which database is at the other end, because that is what decides the cost
# of a mistake. Staging is the half an agent run is *supposed* to reach - #582 is the shape of it: a
# query plan is only worth reading against real data and real statistics, so a rule that refused
# staging made a ticket unfinishable rather than safe, and the run ended as blocked on work nobody
# else was going to do. A staging mistake is repaired by reloading staging. Production is not, and
# stays a human decision exactly as before.
#
# The rule is an allowlist on the database each statement names, not a denylist of the production
# one. `wrangler d1 execute` accepts a `database_id` or a binding name as readily as a
# `database_name`, and the production id sits in plaintext in wrangler.jsonc, so denylisting the
# production `database_name` left `wrangler d1 execute <production-id> --remote --env staging`
# allowed: a bare id resolves through the D1 API without the config being consulted, so `--env`
# never narrows it.
#
# The allowlist is counted, not inspected, and that distinction is the fix for a real regression
# this rule shipped with in its first form. Reading the positionals a pattern recognises and
# allowing the line when all of them are staging means anything the pattern could *not* read is
# invisible - and invisible was allowed. `... planned-travel-db-staging --remote --env staging &&
# wrangler d1 export planned-travel-db --remote` passed, because `export` is not a sub-command the
# extraction names; so did the same line with the production statement's positional pushed onto a
# continued line. Both were refused outright before this rule existed, by the blanket block it
# replaced. Counting asks a question the rule cannot be wrong about - is every `d1` sub-command
# on this line the one allowed staging statement? - and treats any difference as production.
#
# It counts `d1`, not `wrangler d1`, and the difference is the whole guarantee. Requiring the two
# words to be adjacent made a perfectly ordinary spelling invisible to the counter - `wrangler -c
# wrangler.jsonc d1 execute ...`, `npx wrangler@latest d1 execute ...` - so a compound line whose
# second statement carried a flag counted once, matched the one staging statement, and passed.
# Anything between `wrangler` and its sub-command is the caller's business; what this rule needs
# to know is how many D1 sub-commands are on the line, and that word is `d1`.
#
# Splitting the line into sub-commands was the other candidate and is worse: `$scan` has already
# had its quotes stripped, so an `&&` inside a `--command` string would split a legitimate
# statement into fragments carrying neither `d1` nor `--remote`, and the gate would stop firing
# at all. Counting gets the per-statement guarantee without needing to know where the statements
# begin.
#
# `--env staging` is still required on top of that, because it is what wrangler resolves bindings
# from, and its absence is what production looks like on a command line. `-e` carries a left-hand
# boundary like every other rule in this file, or `--file ./restore-e staging.sql` reads as a
# selector that is not there.
# Explicit remote operations are gated, including future sub-commands. Time travel
# and database creation reach the remote API without taking --remote.
if echo "$scan" | grep -Eq '\bd1\b.*--remote|\bd1[[:space:]]+(time-travel|create)\b'; then
  # Count, do not inspect. Reading the positionals the extraction happens to recognise and
  # allowing the line when all of them are staging is the shape that failed review: anything on
  # the line the extraction could *not* read stayed invisible and rode along - a `d1 export`
  # against production, a sub-command the pattern does not name, a statement the fold above did
  # not reach, a flag sitting between `wrangler` and `d1`. So the rule asks a question it cannot
  # be wrong about: is every `d1` sub-command on this line the one staging statement that is
  # allowed? If the two counts differ, something is here that this rule cannot account for, and
  # unaccounted-for is the production path. A `d1` that is not a sub-command at all - one inside
  # a SQL string, say - counts too and blocks the line, which is the direction this fails in.
  #
  # Only the staging `database_name` counts as allowed - the spelling package.json reaches
  # staging by. The staging `database_id` and the `DB` binding are refused too: an agent run has
  # no reason to spell the database any other way, and a second constant is a second thing to
  # drift out of step with wrangler.jsonc. The trailing boundary keeps `planned-travel-db-staging`
  # from vouching for `planned-travel-db-staging-old`.
  # `grep -c` counts matching *lines*, not matches, and two statements share a line here by
  # definition - `-o` piped into `wc -l` is what counts occurrences.
  d1_total=$(echo "$scan" | grep -oE '\bd1\b' | wc -l | tr -d '[:space:]') || true
  d1_staging=$(echo "$scan" | grep -oE \
    '\bd1[[:space:]]+(migrations[[:space:]]+[a-z-]+|time-travel[[:space:]]+[a-z-]+|[a-z-]+)[[:space:]]+planned-travel-db-staging([^[:alnum:]_-]|$)' \
    | wc -l | tr -d '[:space:]') || true
  [ "${d1_total:-0}" = "${d1_staging:-0}" ] \
    || agent_block 'remote d1 access (production)' 'Only the staging database is open to an agent run, spelled the way package.json spells it - wrangler d1 ... planned-travel-db-staging --remote --env staging - and every d1 sub-command on the line has to be that one. Anything else is a human decision; end the run as blocked.'
  echo "$scan" | grep -Eq '(^|[^[:alnum:]_-])(--env[[:space:]=]+staging|-e[[:space:]]+staging)([^[:alnum:]_-]|$)' \
    || agent_block 'remote d1 access (production)' 'A remote D1 command without --env staging reaches production, which is a human decision; end the run as blocked.'
fi
# The package scripts that reach staging or production, named as this repository spells them -
# `db:migrate:remote` and `db:migrate:remote:staging`, not the `db:migrate:prod` of a sibling
# repo. A list copied from elsewhere would match nothing here and look protective while being
# inert. Longest alternative first, and flags and a filter argument are skipped over, so
# `pnpm -s run deploy` and `pnpm --filter web deploy` are the same deploy.
echo "$scan" | grep -Eq '(^|[^[:alnum:]_/-])pnpm\s+((-{1,2}[^[:space:]]+|[a-z]+)\s+)*(deploy:staging|db:migrate:remote|deploy)(\s|$)' \
  && agent_block 'pnpm deploy|remote migration' 'Deploys and remote migrations are a human decision; end the run as blocked.'

# GitHub Actions only. .github/workflows/claude-code-review.yml runs on every pull_request
# with `--permission-mode bypassPermissions` and a pull-requests:write token, so the diff it
# reads is untrusted input and this hook is the only thing between a crafted PR and
# `gh pr review --approve`. A Cezar run (CEZ_TASK_ID) is different: it runs on the
# operator's host, on work the operator queued, and mutates GitHub through the tracker
# descriptor by design, so these blocks do not apply there.
[ -n "${GITHUB_ACTIONS:-}" ] || exit 0

actions_block() {
  echo "BLOCKED (GitHub Actions): '$command' matches '$1'. The review job posts one comment and nothing else." >&2
  exit 2
}

echo "$scan" | grep -Eq 'gh\s+(issue|pr)\s+(create|edit|close|reopen|delete|transfer|pin|unpin|lock|unlock|merge|review|ready|checkout)\b' && actions_block 'gh issue|pr mutation'
# `comment` is the one verb with an exception. The code review posts its summary with
# `gh pr comment`, and that job is the one agent run whose whole purpose is to write to a pull
# request. Only .github/workflows/claude-code-review.yml sets the variable, and a pull request
# cannot set it for itself: editing that workflow makes the action's OIDC exchange refuse to run
# the review at all. `gh issue comment` stays blocked either way.
comment_targets='issue|pr'
[ "${CLAUDE_REVIEW_PR_COMMENT:-}" = 1 ] && comment_targets='issue'
echo "$scan" | grep -Eq "gh\s+($comment_targets)\s+comment\b" && actions_block 'gh issue|pr mutation'
echo "$scan" | grep -Eq 'gh\s+(label|release|repo|secret|variable|workflow|run)\s' && actions_block 'gh mutation surface'
if echo "$scan" | grep -Eq '(^|[^[:alnum:]_/-])gh\s+api\b'; then
  echo "$scan" | grep -Eq '(--method|-X)[[:space:]=]*(POST|PATCH|PUT|DELETE)|(^|\s)(-f|-F|--field|--raw-field|--input)(\s|=)' && actions_block 'gh api non-GET'
fi

exit 0
