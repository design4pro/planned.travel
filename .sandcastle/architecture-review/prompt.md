# TASK

Survey this repository for codebase-architecture improvement candidates — places where modules should be **deepened** (small interface, more functionality behind it, one test boundary around it) or where a shallow-module sprawl makes the code hard to test and hard for agents to navigate.

This is an ANALYSIS run. Do NOT modify any file. Do NOT commit. Your only output is the report.

# CONTEXT

Read CLAUDE.md first. The layering contract is docs/SPEC.md §6; the archetype of a deep module in this repo is the tenant-scoped repository boundary (see docs/adr/0002). Domain vocabulary: CONTEXT.md.

Recent hot spots (change frequency is a signal of leverage):

<recent-commits>

!`git log -n 40 --oneline --no-merges`

</recent-commits>

# METHOD

1. Scope by YAGNI: prefer candidates in code that changes often or is known-heavy. Known large route-level files worth inspecting: the planner screen, the atlas country overlay and panel, billing settings, the lists board.
2. For each candidate, judge depth as **leverage**: how much complexity would callers stop paying if the interface were narrowed? A pass-through wrapper is not a candidate; a cluster of files that must be tested together is.
3. Consider testability first: where would ONE test boundary replace many small ones? The interface is the test surface.
4. 3 to 6 candidates. Fewer, well-argued, beats a laundry list.

# OUTPUT

Output the report between <report> tags, as markdown:

<report>
## Candidate N: <name>

- **Files**: <the cluster>
- **Problem**: <why this is shallow / hard to test today>
- **Proposed interface**: <the narrow seam, in one or two sentences — no code>
- **Benefits**: <what gets cheaper: tests, agent navigation, future changes>
- **Recommendation**: Strong | Worth exploring | Speculative

(…repeat per candidate…)

## Top recommendation

<one paragraph: which candidate first, and why>
</report>

Nothing outside the tags matters. Do not edit files. Do not commit.
