# Dependency compatibility

PR #1868 keeps one compatible dependency update while deferring upgrades that need
application migrations. `package.json` pins the selected versions exactly and
`pnpm-lock.yaml` records their coordinated transitive graph. Install with
`pnpm install --frozen-lockfile`; regenerating the lockfile from scratch is not a
compatibility proof.

| Set                        | Retained versions                                                                                                | Regression evidence required before upgrading                                                                                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack routing and Start | React Start 1.168.49, React Router 1.170.32, Router Devtools 1.167.1, Router CLI 1.167.31                        | Typecheck, framework request-context tests, generated routes and production build. Start 1.169.5 removed the consumed `requestHandler` export and the grouped update changed route/error typing.                                                                                    |
| Authentication             | Better Auth 1.7.1                                                                                                | Real sign-up, sessions, passkeys, account authority and tenant isolation tests. 1.7.18 failed account creation and changed the upstream access dictionary from the documented 27 statements to 28. Preserve fail-closed authority; an auth migration needs its own security review. |
| React and primitives       | React/React DOM 19.2.8, React types 19.2.18/19.2.4, Radix UI 1.6.7                                               | Dialog accessible names and descriptions, keyboard interaction and the full UI suite. The proposed set produced invalid expense-dialog description references.                                                                                                                      |
| Worker build               | Vite 8.2.1, Cloudflare Vite plugin 1.53.0, Wrangler 4.124.0, Workers types 5.20260818.1, React Vite plugin 6.0.5 | Production and E2E builds. The grouped update failed to resolve `cloudflare:workers`; do not hide this by externalizing Worker bindings into client code.                                                                                                                           |
| Development tools          | React Devtools 0.10.12, Devtools Vite 0.8.5                                                                      | Retain with the framework/build set until separately validated.                                                                                                                                                                                                                     |

The remaining updates retain the versions proposed by #1868, including Query,
Virtual, Tailwind, Drizzle, MapLibre, Lucide, Zod, Playwright and test tooling.
These pins do not change the dependency freeze, authorization boundaries, access
policy or acceptance gates. A future upgrade must pass the complete configured
gate and native required CI, followed by independent review and applicable QA.

## Validation runtime

Use Node 24.x, matching `.github/workflows/ci.yml`, for the complete validation
gate. Node 26.13.0 includes ICU 79.1 / CLDR 49.0 and reports Vietnamese cardinal
categories as `one` and `other`; Node 24.14.0 with ICU 78.2 / CLDR 48.0 reports
only `other`. The unchanged plural and catalogue-parity tests fail on both the
candidate and its develop base under Node 26, and pass on the candidate under
Node 24. This runtime difference is not evidence of a dependency regression.
Keep the assertions and catalogue requirements intact; a runtime upgrade needs
its own cross-runtime plural agreement verification (SPEC §8.5).
