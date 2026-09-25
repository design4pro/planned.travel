# 0031. The pre-commit hook runs the tests a commit reaches

Status: proposed
Date: 2026-09-24

## Context

`.husky/pre-commit` ran `lint-staged`, `pnpm typecheck` and the whole `pnpm test` on every
developer commit. On the 4-vCPU VPS the whole suite took 384 s at a load average around 3 (309 test
files). On a host shared with agent runs, that suite is what times out first, and the failing test
is often one the commit never touched.

Cezar runs skip the hook (`CEZ_TASK_ID`, docs/agents/cezar.md) and are gated by the full
`validation.commands`. Their logs from 2026-09-23 and 2026-09-24 show that runs already narrow
their own test runs outside that gate, so there is nothing to change for them. The hook is where the
time goes.

`vitest --changed` picks tests by the module graph, and that graph is blind to a test that checks
a file it never imports. 76 test-side files read the disk or start a process, 74 of them test
files. They include:

- the copy, i18n source and logical-property rules, which scan sources;
- the migration chain and the repository harness, which read `drizzle/`;
- `wrangler-config.test.ts`, which reads `worker-configuration.d.ts`;
- `lint-ignores.test.ts`, which reads `.gitignore`;
- the hook tests.

`.gitignore` is not hypothetical. In money-tracker.online, a change to it broke `pnpm test` through
that repository's ignore-list test on 2026-09-24.

## Decision

The hook runs:

```sh
pnpm exec vitest related --run --passWithNoTests \
  $(git diff --cached --name-only --diff-filter=d) \
  $(git grep -lE '<disk or process access>' -- '*.test.*' '*__tests__/*')
```

That covers three groups:

- every test that imports a staged file;
- every test-side file that reads the disk or starts a process;
- every test that imports such a helper.

The second list is found by `git grep` on every commit, not kept by hand, so a new test of that kind
joins it without anyone remembering to add it. A staged `package.json`, vitest config or setup file
still runs the whole suite: vitest checks the related files against `forceRerunTriggers`.

Rejected alternatives:

- **Plain `--changed`.** It drops the 74 disk-reading test files, and those are the rule tests a
  commit is most likely to break without importing them.
- **Keep the whole suite.** Most of it is code the commit cannot reach, and that is exactly the time
  this ADR saves.

## Consequences

- **Cost:** the disk-reading set alone is 112 test files and 3464 of the suite's 7203 tests. It ran
  in 161 s against the full run's 384 s, measured one after the other on `develop` at deba6a1b with
  this change on top. That is the least a commit pays. A commit that reaches a shared module pays more, and one that touches the
  vitest config pays for the whole suite.
- **Blind spot:** a test that reads the disk through something the grep does not name escapes the
  hook, for example a new fs API or a helper outside `__tests__`. `validation.commands` and CI still
  catch it, because they run the whole suite. The hook is the early warning, not the gate.
- **Pinned by a test:** `pre-commit.test.ts` stubs `npx` and `pnpm` in a scratch repository and
  asserts the exact commands the hook runs.
