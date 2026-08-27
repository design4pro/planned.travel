# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving conflicts, run `pnpm typecheck`, `pnpm lint` and `pnpm test` to verify everything works
4. If tests fail, fix the issues before proceeding to the next branch

After all branches are merged, make a single commit summarizing the merge (Conventional Commits, English — the `RALPH:` prefix is only for in-loop commits).

# CLOSE ISSUES

For each branch that was merged, close its issue using:

`gh issue close <id> --comment "Merged via sandcastle."`

Also close any parent issue (such as a PRD) that this completes — a PRD is complete when all of its sub-issues are closed.

Here are all the issues:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
