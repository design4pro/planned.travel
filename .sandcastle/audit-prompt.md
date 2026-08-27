# TASK

You are an independent auditor on the integration branch, in a fresh sandbox. This iteration closed the following issues:

{{ISSUES}}

Adversarially re-check each one: your job is to try to **refute** its COMPLETE claim, not to confirm it.

# PER ISSUE

1. `gh issue view <id>` — read the body: the Definition of Done, Owned paths, Verification section, and any "Visual change expected" declaration.
2. Read the actual merged code. Does it implement what the DoD demands — all of it, not a plausible subset?
3. Check ownership: did the change stay inside the issue's Owned paths? Work outside them is a violation even when correct.
4. Run targeted checks: the tests the issue's Verification names, plus anything the DoD implies (`pnpm test -- <relevant files>`, a `curl` against a route, a grep proving a claim).
5. Judge tests on merit: implementation-coupled or tautological tests do not discharge a DoD.

# FULL LADDER — ONCE

After the per-issue checks, run the complete ladder including the full e2e suite:

```
TARGET_BRANCH={{TARGET_BRANCH}} bash .sandcastle/validate.sh --force-e2e --json-out .sandcastle-validation.json
```

A red ladder refutes every issue whose change plausibly caused the failure.

# OUTPUT

Output your verdicts as JSON wrapped in <audit> tags. `refuted` requires a concrete, checkable reason (a missing DoD clause, a failing command, a violated path) — "could be better" is not a refutation:

<audit>
{"issues": [{"id": "42", "verdict": "confirmed", "reason": "all DoD clauses verified"}, {"id": "43", "verdict": "refuted", "reason": "DoD requires X; grep/test Y proves it is absent"}]}
</audit>

Do NOT reopen issues yourself — the orchestrator acts on your verdicts. Do not commit anything.
