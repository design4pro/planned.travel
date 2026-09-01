/**
 * What the planner is shown of each issue.
 *
 * The planner is the loop's single most expensive prompt per token of output: 84,448 cache-create
 * tokens against 1,007 output in run 20260831-2, 89% of everything the run wrote to cache. It is
 * also the one prompt that cannot benefit from having written it: a run plans once per iteration
 * and its iterations are three quarters of an hour apart, so the entry has long expired before the
 * next planner reads it. The lever is therefore the payload, not the cache.
 *
 * Roughly a third of that prompt is issue bodies - 130 KB of them for nineteen tickets - and the
 * planner's whole job is the dependency graph: which issue is blocked by which, and which two
 * would collide in the same files. That question is answered by a handful of named sections
 * (`Owned paths`, `Blockers`, and the summary that opens a ticket) and by nothing at all in the
 * acceptance criteria, the verification recipe or the out-of-scope list. Keeping those sections and
 * dropping the rest takes the backlog's bodies from 130 KB to 37 KB - some 23,000 tokens off every
 * planner run, measured against the nineteen tickets open when this was written.
 *
 * The abridgement is stated in the prompt rather than hidden, and `gh issue view` is left open as
 * the valve: a planner that thinks a ticket declares no owned paths has to be able to check,
 * because "this body has no Owned paths section" and "you were not shown it" must not look alike.
 */

/** One issue as `gh issue list --json number,title,body,labels` reports it. */
export interface RawIssue {
  readonly id: string
  readonly title: string
  readonly labels: ReadonlyArray<string>
  readonly body: string | null
}

/** The same issue, with its body cut down to what a dependency graph is built from. */
export interface PlanIssue {
  readonly id: string
  readonly title: string
  readonly labels: ReadonlyArray<string>
  readonly body: string
}

/**
 * Sections worth their tokens, matched against a section's own name.
 *
 * Everything here either names files two issues could collide in or names another ticket. The
 * substrings are deliberately loose - `blocker` catches "Blockers" and "Blocked by" alike - because
 * the cost of keeping one section too many is a few hundred characters and the cost of dropping one
 * is a plan that schedules two colliding slices side by side.
 */
const KEPT_SECTIONS =
  /owned paths|blocker|blocked by|depends on|what ships|problem statement|summary/i

/**
 * How a section starts, in the two shapes this repo's tickets use: a markdown heading
 * (`## Owned paths`) in the PRD-derived slices, and a bold label (`**Owned paths:** …`) in the
 * Agent Briefs that triage writes. Both are matched, because an extractor that knew only headings
 * would silently return the lead paragraph alone for every maintenance ticket in the backlog.
 */
function sectionName(line: string): string | undefined {
  return (
    /^#{1,6}\s+(.*)$/.exec(line)?.[1] ?? /^\*\*(.+?):?\*\*:?/.exec(line)?.[1]
  )
}

/**
 * The body, minus the sections a dependency graph is not built from.
 *
 * The opening is kept whatever it is called: a ticket says what it is before it says anything else,
 * and that is the sentence the "B requires what A introduces" judgement is made from. In the slices
 * that opening sits under a heading of its own (`## 01-S1d — Copy a trip…`, then the paragraph
 * naming the PRD it belongs to), so keeping only what precedes the first heading would throw it
 * away; hence the first section counts as kept regardless of its name.
 *
 * After that a section is kept whole or dropped whole - a truncated `Owned paths` list would be
 * worse than none, since the path it cut is exactly the collision nobody then sees.
 */
export function abridgeBody(body: string): string {
  const kept: string[] = []
  let insideKept = false
  let sections = 0

  for (const line of body.split('\n')) {
    const name = sectionName(line)
    if (name !== undefined) {
      sections++
      insideKept = sections === 1 || KEPT_SECTIONS.test(name)
      if (insideKept) kept.push(line)
    } else if (sections === 0 || insideKept) {
      kept.push(line)
    }
  }

  return kept.join('\n').trim()
}

/** The issue list the planner prompt carries, in the order `gh` reported it. */
export function planPayload(issues: ReadonlyArray<RawIssue>): PlanIssue[] {
  return issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    labels: issue.labels,
    body: abridgeBody(issue.body ?? ''),
  }))
}
