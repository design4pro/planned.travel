# 0029. TypeScript 7

Status: proposed
Date: 2026-09-24

## Context

`pnpm typecheck` runs in every gate, on the agents' 4-vCPU VPS as often as anywhere, and after ADR
0028 took ESLint out it was the gate's heaviest rung left. TypeScript 7 is the native (Go) compiler;
it checks the same program with the same `tsconfig.json` and reports no errors on this tree.

Two things held the upgrade back. typescript-eslint declares `typescript <6.1.0`; ADR 0028 removed
it. And TypeScript 7's `typescript` package no longer exports the compiler API (the main entry
returns the version; the rest is under `typescript/unstable/*`), which one test used:
`src/server/__tests__/wrangler-config.test.ts` parsed `worker-configuration.d.ts` with
`ts.createSourceFile` to compare the `Env` interfaces `wrangler types` generates against
`wrangler.jsonc`. Nothing else in the repository or its dependency tree imports `typescript` -
`pnpm why typescript` lists only the direct devDependency.

Measured on the VPS with the load average under 2.5, one run each:

| `tsc --noEmit`                   | wall   | max RSS |
| -------------------------------- | ------ | ------- |
| TypeScript 6.0.3                 | 68.6 s | 2.07 GB |
| TypeScript 7.0.2, default        | 13.1 s | 2.87 GB |
| TypeScript 7.0.2, `--checkers 2` | 13.9 s | 2.12 GB |
| TypeScript 7.0.2, `--checkers 1` | 18.6 s | 1.54 GB |

Under load the gap is far wider: with the host's swap full, the same TypeScript 6 check took
1601 s, and TypeScript 7 with two checkers 13.4 s.

## Decision

`typescript` moves from `^6.0.2` to `^7.0.2`. The name set is unchanged.

`pnpm typecheck` runs `tsc --noEmit --checkers 2`. Memory grows with the number of checkers: the
default count saved 0.8 s over two checkers for 0.75 GB more, well above TypeScript 6. Two checkers
stay at TypeScript 6's memory for a fifth of its time. On a host several gates share, memory is
what runs out first, so the flag is set for every machine, CI included, rather than tuned per host.

`wrangler-config.test.ts` reads the declarations with its own scanner instead of the compiler API:
`wrangler types` writes one member per line in a flat interface body, and the test only needs the
member names and their string, number and boolean literal unions. Anything it cannot read as a
literal comes back empty, so the parity assertions fail on it rather than pass. Checked by editing
the generated file four ways - a staging value changed, a union member dropped, a binding removed,
a literal widened to `string` - each of which turns the test red.

## Consequences

- SPEC §3 records the upgrade next to ADR 0028.
- Anything that needs the compiler API - a codemod, a custom lint rule, a test that parses source -
  has to get it from `typescript/unstable/*` or another package, and that is its own decision.
- If `wrangler types` ever changes its output layout (members across lines, nested object types),
  the scanner stops recognising members and the parity test goes red; it cannot go quietly green.
- `pnpm typecheck` is the single entry point: CI, the pre-commit hook and `validation.commands`
  all call it, so the flag lives in one place.
