# Specifications — agent rules

A spec is a designed change: the problem, the solution, the phases and the assertions that say each
phase landed. `docs/plans/` is the backlog source and GitHub Issues the execution surface; a spec is
what sits between them, and `SDLC.md` places it before Intake.

This file is the contract for the directory. The workflow that writes a spec is the `om-spec-writing`
and `om-auto-write-spec` skills plus `.ai/skills/om-auto-write-spec/SKILL.md`, which adds the two
sections this repository requires of every spec; the workflow that builds one is
`om-auto-implement-spec` plus `.ai/skills/om-auto-implement-spec/SKILL.md`.

## Where a spec lives

The directory **is** the state. Nothing else in this repository records it.

| Directory                | Status field                    | Meaning                                                        |
| ------------------------ | ------------------------------- | -------------------------------------------------------------- |
| `.ai/specs/`             | `draft`, `ready`, `in-progress` | Being written; merged and waiting for a build; a build is open |
| `.ai/specs/implemented/` | `implemented`                   | Every phase shipped                                            |
| `.ai/specs/archived/`    | `archived`                      | Superseded by a later decision, or abandoned                   |

`assets/` holds the static reproductions a spec is measured against and is not a status directory.
`product-brief.md` is `om-discover`'s product context and is not a spec.

## The metadata table

Directly under the `H1`, before the first section, exactly these four rows in this order:

```markdown
| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | implemented |
| **Issue**          | #133        |
| **Spec PR**        | #368        |
| **Implementation** | #382, #385  |
```

`none` is a valid value for `Issue`, `Spec PR` and `Implementation`, and is written out rather than
left blank so that an empty cell always means somebody forgot. `Implementation` lists the pull
requests in the order they merged.

A spec written from a plan stage (`afk-plan-to-spec`) carries a fifth row, after those four, naming
the stage and the plan file that holds it: `| **Plan** | 04-S3 (docs/plans/04-budget-and-currencies.md) |`.
Such a spec is `ready` the moment its pull request merges and has no issue yet, because
`afk-to-tickets` files the parent issue when it slices it, so the stage stands in for the `Issue` the
guard asks of a `ready` spec. Older specs have no `Plan` row and need none.

An **archived** spec carries a `Superseded by` row, last, and only an archived spec may:

```markdown
| **Superseded by** | #382 |
```

`archived` on its own says a design was dropped and leaves the reader with the question they came
with. `archived/2026-09-09-member-population-materialization.md` is the worked example: it measured
FR #136, found the mechanism it proposed would put a fresh D1 bound-parameter cliff into
`recomputeTravelStats`, and recommended closing the ticket — which was then closed as superseded by
#382. Without the row, that chain lives only in a tracker comment.

## Always

- Give a new spec the filename `YYYY-MM-DD-kebab-case-slug.md` and the metadata table above.
- Move a spec between directories with `git mv`, and change `Status` in the same commit. The guard
  fails when the two disagree, which is the point of recording it twice.
- Append the implementation pull request to `Implementation` when a phase merges — every phase, not
  only the last.
- Run `pnpm generate-spec-index` after any of that. The index is generated; the validation gate
  compares it.
- When a merge of `develop` conflicts in the index, take develop's file with
  `git checkout --theirs .ai/specs/README.md`, run `pnpm generate-spec-index` and `git add` the file;
  never resolve the markers by hand. This holds for a merge, not a rebase, and a conflict in a spec
  file itself is still resolved by hand. Every spec that merges to `develop` conflicts the index of
  each open spec pull request, so expect it again on every later merge (#896, #984, #985, #1002).
- Repoint anything that follows a moved spec today — an `assets/` README, a code comment. A dated
  record of what a run or a design saw (`.ai/runs/`, a merged PR body, the body of the spec itself)
  is history and is not rewritten.
- Record what shipped differently from the design as an `## Amendment` section in the spec, with its
  pull request number. A spec that quietly disagrees with the product is worse than no spec.

## Ask First

- Moving a spec to `implemented/` when a phase is unbuilt. Partial delivery keeps `Status:
in-progress` and the built pull requests listed.
- Moving a spec to `archived/` at all. Abandoning a designed decision is a product call.
- Editing the metadata table of a merged spec other than to append an implementation pull request.

## Never

- A spec at `ready` or `in-progress` with neither an issue nor a `Plan` row. A merged design nobody
  can schedule is a decision with no way to reach it.
- A spec at `implemented` with an empty `Implementation`. "It shipped" that names nothing that
  shipped it cannot be checked by the next reader, and will not be.
- A spec at `archived` with an empty `Superseded by`.
- A hand edit to `README.md` in this directory (`pnpm generate-spec-index` owns it).
- A PNG in this directory. Frames go to a scratchpad; `assets/` takes the dependency-free `.html`
  reproductions a spec measured, and nothing else.

## Validation

```bash
bash .ai/scripts/check-generated.sh        # includes the index
pnpm exec vitest run --project=tooling scripts/specs
```

Both are in the gate (`validation.commands` in `.ai/agentic.config.json`). The assertions live in
`scripts/specs/registry.ts` and are documented there;
`scripts/specs/__tests__/spec-registry.test.ts` is what fails on them.
