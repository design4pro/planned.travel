# VALIDATION FAILED — fix attempt {{ATTEMPT}}/{{BUDGET}}

You are the same implementer session, resumed. The deterministic validation ladder rejected your work:

```
{{FAILURE_DIGEST}}
```

# RULES

- NEVER run `--update-snapshots` or edit files under `e2e/__screenshots__`. An unexpected snapshot diff is a regression in your change — fix the code, not the baseline. (Intended visual changes are handled by the orchestrator when the issue declares them.)
- NEVER weaken, skip, or delete a test to make it pass. The test is the spec.
- A failure that is a pure **TIMEOUT with no pixel count and no assertion diff** is machine load, not code — rerun the failing step once before changing anything.
- A **whole suite failing on one repeated error shape** (e.g. 504 "Outdated Optimize Dep", every authenticated spec skipping) is dev-server state: `rm -rf node_modules/.vite`, rerun.
- Stay inside the issue's Owned paths.

# PROCESS

1. Reproduce the smallest failing signal (single test file / single spec) before editing.
2. Fix, then run the relevant fast checks (`pnpm typecheck`, the failing tests).
3. Commit with a `RALPH: fix —` prefix describing what was wrong and what changed.
4. Output <promise>COMPLETE</promise>.

Do not re-run the full ladder yourself — the orchestrator re-validates after you finish.
