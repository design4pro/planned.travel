# TASK

Review the code changes on branch `{{BRANCH}}` and improve code clarity, consistency, and maintainability while preserving exact functionality.

# CONTEXT

## Branch diff

!`git diff {{TARGET_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent.

2. **Check correctness first**: Read the diff and look for anything dodgy. Stress-test edge cases: empty arrays, zero, negative numbers, nulls, race conditions, off-by-one, regressions in adjacent code. If you can break it, fix it. Are new behaviours covered by tests? Any unsafe casts, `any`, injection risks or credential leaks?

3. **Tenancy and layering**: every new query must go through the tenant-scoped repository (`server/catalog` is the only exception); `components/ui` must not import `server/`; server-function inputs must be Zod-validated. These are contract violations, not style issues.

4. **Analyze for improvements**:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Avoid nested ternary operators - prefer switch statements or if/else chains
   - Choose clarity over brevity

5. **Maintain balance**: avoid over-simplification, overly clever solutions, or removing helpful abstractions.

6. **Apply project standards**: follow @.sandcastle/CODING_STANDARDS.md.

7. **Preserve functionality**: Never change what the code does - only how it does it.

If the change touches UI (components, routes, styles), note in your commit message that the pull request needs a pixel-critic pass — the visual gate runs in CI.

# EXECUTION

If you find improvements to make:

1. Make the changes directly on this branch
2. Run `pnpm typecheck`, `pnpm lint` and `pnpm test` to ensure nothing is broken
3. Commit with a `RALPH: Review -` prefix describing the refinements

If the code is already clean, well-tested, and handles edge cases properly, do nothing.

Once complete, output <promise>COMPLETE</promise>.
