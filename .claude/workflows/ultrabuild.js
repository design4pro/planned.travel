export const meta = {
  name: 'ultrabuild',
  description: 'Fan out builders and adversarial critics over one round of work until each item passes the docs/SPEC.md gate',
  whenToUse:
    'Invoked by /ultrabuild once per loop round. Recon the contract and codebase, decompose the task into independently ownable items, build each one, then gate it with a repo-wide mechanical check, a blind side-by-side visual critic, and a refuting auditor.',
  phases: [
    { title: 'Recon', detail: 'parallel readers: contract, codebase, reference target, stack docs' },
    { title: 'Decompose', detail: 'ordered work items with disjoint file ownership' },
    { title: 'Build', detail: 'one builder per item, scoped to its owned paths' },
    { title: 'Capture', detail: 'screenshot ours + reference into a blind A/B pair' },
    { title: 'Gate', detail: 'blind visual critic + refuting auditor per item' },
    { title: 'Mechanical', detail: 'repo-wide typecheck, lint, test, build, playwright' },
    { title: 'Repair', detail: 'rejected items rebuilt against their findings and re-gated' },
    { title: 'Report', detail: 'merge verdicts into item statuses' },
  ],
}

/* ------------------------------------------------------------------ *
 * Inputs. `args` comes from /ultrabuild and is the whole run state.
 * ------------------------------------------------------------------ */

const run = args || {}
const TASK = run.task || 'No task supplied — stop and report this.'
const SLUG = run.slug || 'unslugged'
const ROUND = run.round || 1
const MAX_ITEM_ROUNDS = run.maxItemRounds || 3
const KNOWN = Array.isArray(run.knownItems) ? run.knownItems : []
const ONLY = Array.isArray(run.onlyItems) ? run.onlyItems : []

// How many items one round dares to carry. Each item costs ~4 agents
// (build + capture + critic + auditor), so this is the main cost lever.
const ITEM_CAP = budget.total
  ? Math.max(2, Math.min(8, Math.floor(budget.total / 150_000)))
  : 3

const CONTRACT = `Contract files, which are the definition of done and must be read, not assumed:
  docs/SPEC.md      §1 clean-room rule · §2 quality bar · §3 pinned stack + dependency freeze
                    §6 repo conventions · §7 definition of done
  docs/DESIGN.md    token contract, palette, motion and type scale
  docs/ARCHITECTURE.md  request lifecycle, tenancy, quotas, scaling levers
Hard constraints that override any instinct to be helpful:
  - Never copy TREK source, strings or assets. Never use the TREK name or mark. TREK is a
    feature and data-model reference only.
  - Dependency freeze: no pnpm add/remove, no edits to package.json or pnpm-lock.yaml. A missing
    package is a finding you report, never a thing you install.
  - src/routeTree.gen.ts is generated. Never hand-edit it; run \`pnpm generate-routes\`.
  - SQL lives only in src/server/repos. components/ui never fetches data and never imports server/.
  - TypeScript strict. No \`any\`. No suppressions. No TODOs, placeholder copy or console.log left behind.`

/* ------------------------------------------------------------------ *
 * Schemas — validated at the tool boundary, so agents retry on mismatch.
 * ------------------------------------------------------------------ */

const RECON_SCHEMA = {
  type: 'object',
  required: ['topic', 'facts'],
  additionalProperties: false,
  properties: {
    topic: { type: 'string' },
    facts: { type: 'array', items: { type: 'string' }, maxItems: 40 },
    gaps: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    risks: { type: 'array', items: { type: 'string' }, maxItems: 20 },
  },
}

const DECOMPOSE_SCHEMA = {
  type: 'object',
  required: ['items'],
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      maxItems: 24,
      items: {
        type: 'object',
        required: ['id', 'title', 'ownedPaths', 'acceptance'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'stable kebab-case id, reused across rounds' },
          title: { type: 'string' },
          rationale: { type: 'string' },
          ownedPaths: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'files/dirs this item exclusively owns; must not overlap another item',
          },
          acceptance: { type: 'array', items: { type: 'string' }, minItems: 1 },
          url: { type: 'string', description: 'local URL that renders this item, if any' },
          referenceUrl: { type: 'string', description: 'reference screen to be judged against, if any' },
          dependsOn: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  required: ['itemId', 'status'],
  additionalProperties: false,
  properties: {
    itemId: { type: 'string' },
    status: { type: 'string', enum: ['implemented', 'unchanged', 'blocked'] },
    changedPaths: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
    blockedReason: { type: 'string' },
    contractExtensions: {
      type: 'array',
      items: { type: 'string' },
      description: 'work discovered but out of this item’s ownership; becomes next round’s items',
    },
  },
}

const CAPTURE_SCHEMA = {
  type: 'object',
  required: ['itemId', 'captured'],
  additionalProperties: false,
  properties: {
    itemId: { type: 'string' },
    captured: { type: 'boolean' },
    pairs: {
      type: 'array',
      description: 'one entry per viewport/theme combination',
      items: {
        type: 'object',
        required: ['viewport', 'theme', 'aPath', 'bPath'],
        additionalProperties: false,
        properties: {
          viewport: { type: 'string' },
          theme: { type: 'string', enum: ['light', 'dark'] },
          aPath: { type: 'string' },
          bPath: { type: 'string' },
        },
      },
    },
    consoleErrors: { type: 'array', items: { type: 'string' } },
    skippedReason: { type: 'string' },
  },
}

const FINDING = {
  type: 'object',
  required: ['summary', 'severity'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    severity: { type: 'string', enum: ['blocking', 'minor'] },
    file: { type: 'string' },
    line: { type: 'integer' },
    evidence: { type: 'string' },
  },
}

const VISUAL_SCHEMA = {
  type: 'object',
  required: ['itemId', 'winner', 'verdict', 'findings'],
  additionalProperties: false,
  properties: {
    itemId: { type: 'string' },
    winner: {
      type: 'string',
      enum: ['A', 'B', 'tie'],
      description: 'which unlabelled candidate is the better-looking product',
    },
    verdict: { type: 'string', enum: ['ACCEPT', 'REJECT'] },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    scores: {
      type: 'object',
      additionalProperties: false,
      properties: {
        typography: { type: 'integer' },
        spacing: { type: 'integer' },
        colour: { type: 'integer' },
        states: { type: 'integer' },
        motion: { type: 'integer' },
        responsive: { type: 'integer' },
        darkParity: { type: 'integer' },
      },
    },
    findings: { type: 'array', items: FINDING, maxItems: 30 },
  },
}

const AUDIT_SCHEMA = {
  type: 'object',
  required: ['itemId', 'blocking', 'nonBlocking'],
  additionalProperties: false,
  properties: {
    itemId: { type: 'string' },
    blocking: { type: 'array', items: FINDING, maxItems: 30 },
    nonBlocking: { type: 'array', items: FINDING, maxItems: 30 },
  },
}

const MECHANICAL_SCHEMA = {
  type: 'object',
  required: ['green', 'results'],
  additionalProperties: false,
  properties: {
    green: { type: 'boolean' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        required: ['command', 'exitCode'],
        additionalProperties: false,
        properties: {
          command: { type: 'string' },
          exitCode: { type: 'integer' },
          summary: { type: 'string' },
        },
      },
    },
    failures: { type: 'array', items: FINDING, maxItems: 40 },
  },
}

/* ------------------------------------------------------------------ *
 * Helpers. No Date.now(), no Math.random() — they are unavailable here
 * and would break resume. Blind A/B order is hashed from the item id,
 * which keeps it stable and reproducible across rounds.
 * ------------------------------------------------------------------ */

function blindOrder(id) {
  let h = 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 99991
  return h % 2 === 0 ? { ours: 'A', reference: 'B' } : { ours: 'B', reference: 'A' }
}

function shotDir(id) {
  return `.claude/ultrabuild/shots/${SLUG}/round-${ROUND}/${id}`
}

function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function budgetOk(reserve) {
  return !budget.total || budget.remaining() > reserve
}

/* ------------------------------------------------------------------ *
 * Phase 1 — Recon. A barrier is correct here: Decompose needs all four
 * perspectives at once to carve non-overlapping ownership.
 * ------------------------------------------------------------------ */

phase('Recon')
log(`round ${ROUND} · task: ${TASK}`)

const RECON_READERS = [
  {
    key: 'contract',
    prompt: `Read docs/SPEC.md, docs/DESIGN.md and docs/ARCHITECTURE.md in full. Return the binding
requirements that apply to this task: "${TASK}".
Report as facts: the exact definition of done (SPEC §7), the quality-bar clauses (SPEC §2), the
required design tokens and their names (DESIGN.md), the repo conventions that constrain file
placement (SPEC §6), and every hard prohibition. In "gaps", list anything the task needs that the
contract does not currently specify. Quote token names and script names exactly — downstream
agents will use your facts verbatim instead of re-reading these files.`,
  },
  {
    key: 'codebase',
    prompt: `Inventory the part of this codebase the task touches: "${TASK}".
Walk src/routes, src/components, src/server/repos, src/server/fns, src/lib and src/styles as
relevant. Report as facts: which files already implement this area and what state they are in,
which design-system primitives in src/components/ui already exist and should be reused rather
than rewritten, which server functions and repos already expose the needed data, and the exact
existing patterns (naming, exports, cn() usage, token usage) a new file must match.
In "gaps", list what is missing or stubbed. Cite file paths. Do not propose code.`,
  },
  {
    key: 'reference',
    prompt: `Establish the quality bar for this task: "${TASK}".
The TREK project (github.com/liketrek/TREK) and its demo at https://demo.liketrek.com/dashboard
are a FEATURE and DATA-MODEL reference and a VISUAL quality bar only. Per docs/SPEC.md §1 this is
a clean-room build: you may describe what a feature does and how a screen is composed, but you
must not reproduce its code, strings, class names or assets, and must never use the TREK name in
any output that lands in the repo.
Report as facts: what the corresponding reference screen contains, its information hierarchy, the
interactions it offers, and the specific places where its design is weak and ours should clearly
beat it (typography, colour warmth, state completeness, motion). Give the reference URL for the
screen this task maps to.`,
  },
  {
    key: 'stack',
    prompt: `Research the current, correct way to implement this task on this pinned stack: "${TASK}".
The stack is TanStack Start (React 19) on Cloudflare Workers, Vite 8 + @cloudflare/vite-plugin,
Tailwind v4 CSS-first @theme, radix-ui, Drizzle + D1, KV, R2, Durable Objects, Queues, Better
Auth, Stripe, MapLibre + pmtiles, TanStack Query/Form, Zod v4.
Use Context7 for library docs and the Cloudflare documentation tools for platform behaviour —
prefer retrieved docs over recollection, since these versions are recent. Report as facts the
specific APIs, config keys and idioms to use, and in "risks" the version-specific traps
(SSR/hydration boundaries, Workers runtime limits, nodejs_compat gaps, Tailwind v4 differences
from v3). Cite doc sources.`,
  },
]

const recon = (
  await parallel(
    RECON_READERS.map((r) => () =>
      agent(r.prompt, {
        label: `recon:${r.key}`,
        phase: 'Recon',
        schema: RECON_SCHEMA,
      }),
    ),
  )
).filter(Boolean)

if (!recon.length) {
  log('recon produced nothing — aborting the round rather than building blind')
  return { items: KNOWN, newFindings: [], dry: false, aborted: 'recon-empty' }
}

const reconDigest = recon
  .map((r) => `## ${r.topic}\n${(r.facts || []).map((f) => `- ${f}`).join('\n')}
${(r.gaps || []).length ? `Gaps:\n${r.gaps.map((g) => `- ${g}`).join('\n')}` : ''}
${(r.risks || []).length ? `Risks:\n${r.risks.map((g) => `- ${g}`).join('\n')}` : ''}`)
  .join('\n\n')

/* ------------------------------------------------------------------ *
 * Phase 2 — Decompose. Skipped when resuming: the item list is part of
 * the contract, so round N must not re-carve round 1's work.
 * ------------------------------------------------------------------ */

phase('Decompose')

let items = KNOWN.slice()

if (!items.length) {
  const decomposed = await agent(
    `Decompose this task into independently ownable work items: "${TASK}".

${CONTRACT}

Recon findings from four parallel readers — treat these as established, do not re-derive them:

${reconDigest}

Rules for the decomposition:
- One item = one slice a single agent can finish and defend on its own.
- ownedPaths must be DISJOINT across items. Two items may never list the same file, because
  builders run in parallel and would clobber each other. If two concerns genuinely share a file,
  merge them into one item.
- acceptance must be concrete and checkable, drawn from docs/SPEC.md §2 and §7 and
  docs/DESIGN.md — not restatements of the title. "Empty, skeleton and error states exist and use
  --color-surface-2" is acceptance; "looks good" is not.
- Give each item a stable kebab-case id derived from its subject, so the same slice keeps the same
  id across loop rounds.
- Set url to the local route that renders the item (http://localhost:3000/...) and referenceUrl to
  the reference screen it will be judged against, whenever a visual judgement is possible.
- Order items so dependencies come first; express them in dependsOn.`,
    { label: 'decompose', phase: 'Decompose', schema: DECOMPOSE_SCHEMA, effort: 'high' },
  )
  items = ((decomposed && decomposed.items) || []).slice().sort(byId)
  log(`decomposed into ${items.length} items`)
} else {
  log(`resuming with ${items.length} known items`)
}

if (!items.length) {
  return { items: [], newFindings: [], dry: false, aborted: 'decompose-empty' }
}

/* ------------------------------------------------------------------ *
 * Build → Capture → Gate, as one pipeline. No barrier between stages:
 * an item is critiqued the moment its build lands, while other items
 * are still building.
 * ------------------------------------------------------------------ */

// A round with known items but no unaccepted ones is a VERIFICATION round: the
// loop re-gates work it already accepted, to make sure a critic did not get
// lucky once. Re-judging is the point; rebuilding is not, so the builder is
// skipped for items that are already accepted.
const VERIFY_ONLY = KNOWN.length > 0 && ONLY.length === 0
const targetIds = ONLY.length ? ONLY : items.map((i) => i.id)
const queue = items.filter((i) => targetIds.includes(i.id)).sort(byId)

// Dependency gate: an item whose dependency is still unaccepted would be built
// against work that does not exist yet, and would be rejected for reasons that
// are not its own. Hold it for a later round instead.
const acceptedIds = new Set(items.filter((i) => i.status === 'accepted').map((i) => i.id))
const ready = queue.filter((i) => (i.dependsOn || []).every((d) => acceptedIds.has(d)))
const heldForDeps = queue.filter((i) => !ready.includes(i))
const carried = ready.slice(0, ITEM_CAP)
const deferred = ready.slice(ITEM_CAP).concat(heldForDeps)

if (heldForDeps.length) {
  log(`held for unmet dependencies: ${heldForDeps.map((i) => `${i.id}(needs ${(i.dependsOn || []).join('+')})`).join(', ')}`)
}
if (deferred.length) {
  log(
    `carrying ${carried.length} of ${queue.length} items this round (ITEM_CAP=${ITEM_CAP}); deferred: ${deferred
      .map((i) => i.id)
      .join(', ')}`,
  )
}
if (!carried.length) {
  log('nothing is buildable this round — every remaining item is blocked on an unaccepted dependency')
  return {
    round: ROUND,
    items,
    newFindings: [],
    extensions: [],
    deferred: deferred.map((i) => i.id),
    dry: false,
    aborted: 'dependency-deadlock',
  }
}

function buildPrompt(item, priorFindings) {
  const order = blindOrder(item.id)
  return `Implement this work item to the standard in docs/SPEC.md. You are the owner of it.

ITEM ${item.id} — ${item.title}
${item.rationale ? `Why: ${item.rationale}\n` : ''}Owned paths (you may edit ONLY these, plus files you create inside them):
${item.ownedPaths.map((p) => `  ${p}`).join('\n')}
Acceptance criteria — every one must be true when you finish:
${item.acceptance.map((a) => `  - ${a}`).join('\n')}
${item.url ? `Renders at: ${item.url}\n` : ''}
${CONTRACT}

Established recon — do not re-derive:

${reconDigest}
${
  priorFindings && priorFindings.length
    ? `\nThis item was REJECTED in an earlier round. Fix every finding below. Do not argue with
them, do not partially address them, and do not paper over one by changing an unrelated file:
${priorFindings.map((f) => `  [${f.severity}] ${f.file ? f.file + (f.line ? ':' + f.line : '') + ' — ' : ''}${f.summary}`).join('\n')}`
    : ''
}

Method:
1. Read every file you are about to change before changing it, and the neighbouring files that
   establish the pattern. Reuse existing primitives from src/components/ui and existing server
   functions and repos — do not write a second implementation of something that exists.
2. Implement completely. Every interactive element gets hover, focus-visible, active, disabled and
   loading states. Every list gets designed empty, skeleton and error states. Both themes. 360px
   through 2560px. Keyboard reachable. WCAG 2.2 AA contrast.
3. Use only tokens from src/styles/tokens.css. No hard-coded colours, no eyeballed one-off spacing
   values — the 4px grid is not optional.
4. Verify your own work before returning: run \`pnpm typecheck\` and \`pnpm lint\` and fix what you
   broke. If you cannot make it clean, return status "blocked" with the reason.
5. If you discover necessary work outside your ownedPaths, do NOT touch it. List it in
   contractExtensions so the next round can own it properly.

Return the schema. changedPaths must be the exact set of files you wrote — a critic will check
that you stayed inside your ownership.

For the record, this item's screenshots will be filed as candidate ${order.ours} (ours) versus
${order.reference} (reference); the critic that judges them will not be told which is which.`
}

function capturePrompt(item) {
  const order = blindOrder(item.id)
  const dir = shotDir(item.id)
  return `Capture a blind A/B screenshot pair for item ${item.id} — ${item.title}.

You are a neutral capture step. You do NOT judge quality and you do NOT edit application code.

Ours:      ${item.url || 'the local dev server root'}
Reference: ${item.referenceUrl || 'https://demo.liketrek.com/dashboard'}

Our page is served by a dev server that is ALREADY RUNNING. Use the port the orchestrator names in
the task context and do not start one of your own; if none is named, find the port already bound
(this environment injects an extra --port, so it is frequently not 3000).

For each of these combinations, screenshot BOTH pages full-page:
  viewports 360x800, 768x1024, 1440x900, 2560x1440
  themes    light and dark
At minimum produce: 1440 light, 1440 dark, 360 light, 360 dark, 768 light, 2560 light.

Mechanics, because the obvious approach does not work:
- Set the viewport with the Playwright MCP resize tool before each capture.
- Switch OUR theme by setting the attribute directly:
  browser_evaluate with: document.documentElement.setAttribute('data-theme', 'dark')  (or 'light').
  docs/DESIGN.md guarantees an explicit data-theme attribute wins over the media query in both
  directions, so this is the supported path. There is no colour-scheme emulation tool here.
- Switch the REFERENCE theme using that site's own theme control. If you cannot find one, capture
  the reference in its default theme only and say so in skippedReason — do not fake a dark frame,
  and do not compare our dark against their light as if it were a fair pair.
- Before each shot: wait for the page to settle and fonts to load, dismiss cookie banners and
  incidental modals, and scroll to top.
- **Kill animation before you shoot.** An entrance transition caught mid-flight renders text at
  20-25% opacity, and a critic reading that frame reports a contrast failure the product does not
  have. Inject a stylesheet that stops them, then wait one frame:
  browser_evaluate with:
    const s = document.createElement('style');
    s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    document.head.appendChild(s);
- **If the page has a map, wait for it to finish drawing.** A WebGL canvas photographed before its
  first idle is a flat empty rectangle, and a critic reading that frame reports "renders no map at
  all" about a map that works. Our MapCanvas publishes \`data-map-ready="false"\` from its first
  render and latches it to \`"true"\` on MapLibre's own idle event. Wait for
  \`[data-map-ready="true"]\` (allow 20s) before every shot of a map-bearing page, and wait for it
  AGAIN after each theme switch and each resize - a theme change replaces the whole style document
  through setStyle, and the marker goes back to false while the new style loads.
- **Sanity-check your own frame before filing it.** If a full-bleed region larger than a third of
  the viewport comes out as one flat colour, or a number renders as a pale ghost of its neighbours,
  you captured too early. Retry that combination. Filing such a frame wastes the critic's round on
  a defect that does not exist, which has happened.
- The screenshot tool writes into its own output directory, so it cannot target a repo path
  directly. Take the shot with a distinctive filename, then MOVE the produced file into place with
  Bash. Create ${dir}/ first.

Final filenames, and this part matters more than anything else you do — the critic must not be
able to tell which product is which:
  ${dir}/<viewport>-<theme>-${order.ours}.png   <- OUR page
  ${dir}/<viewport>-<theme>-${order.reference}.png   <- the REFERENCE page
e.g. 1440-light-${order.ours}.png and 1440-light-${order.reference}.png.

Write NOTHING else into that directory: no mapping file, no notes, no README, and never put the
words "ours", "reference", "planned" or the reference product's name into a filename or into any
file in that directory. The critic reads that directory and only that directory.

Crop or mask browser chrome, URL bars, and any wordmark or logo on BOTH sides, so neither frame is
identifiable by branding. If a wordmark cannot be cropped without destroying the layout, mask it in
place.

Also collect our page's browser console messages and report every error and warning **from the
final load of the page you photographed**. Do not report session-wide history: earlier hot-reloads,
other dev-server ports and transient module-graph errors from a build that has since settled are
not defects of the frame you filed, and reporting them as console errors fails the item for
something no reader would ever see.

Return the schema: one pairs[] entry per viewport/theme, aPath and bPath pointing at that
combination's two files. If the reference is unreachable, set captured false, explain in
skippedReason, and still capture our side so the round has evidence.`
}

function criticPrompt(item) {
  const dir = shotDir(item.id)
  return `You are the harsh visual critic for item ${item.id} — ${item.title}.

In ${dir}/ there are screenshot pairs named <viewport>-<theme>-A.png and <viewport>-<theme>-B.png.
Two different products are shown. You are NOT told which is which and you must NOT try to find
out: do not read any mapping file, do not open source code, do not visit any URL, do not reason
about which one "looks like the repo you are in". Judge only the pixels in front of you.

Read every pair. For each, compare A against B on:
  - Typography: type scale discipline, optical sizing, tracking on small caps labels, tabular
    numerals on changing numbers, line length and leading, hierarchy legibility.
  - Spacing: honest 4px grid, consistent rhythm, optical alignment, no eyeballed one-offs, no
    crowding and no accidental voids.
  - Colour: warmth and confidence of the palette, restraint in accent use, contrast that reads as
    designed rather than defaulted, WCAG 2.2 AA on every text/background pair.
  - State completeness: does each interactive element visibly afford hover/focus/active/disabled,
    and do lists show designed empty, skeleton and error states rather than blank space.
  - Responsive: is the small viewport a designed layout or a squeezed desktop; is the large
    viewport composed or just stretched.
  - Dark parity: is dark a designed theme with its own shadows and surface separation, or an
    inverted afterthought.

Then answer the only question that matters: **which of A or B is the better-looking product?**

Verdict rules, applied strictly:
  - ACCEPT requires that one candidate is CLEARLY better, at a level that would make a design-led
    team proud to ship it.
  - A tie is a REJECT. "Roughly equivalent" is a REJECT. "Good enough" is a REJECT.
  - Low confidence is a REJECT. If you cannot tell them apart, that is itself a failure of the
    candidate that was supposed to be exceptional.
  - Being merely as good as the other candidate is a REJECT.

Every REJECT must come with specific, actionable findings anchored to what you can see: which
element, which viewport, which theme, what is wrong, and what it should be instead. Mark a finding
"blocking" when it is the reason for the reject; "minor" when it is polish you noticed on the way.
Vague findings ("improve the spacing") are useless — name the element and the value.

Set winner to A, B or tie. Set verdict per the rules above. Fill scores 0-10 for each dimension,
scoring the candidate you judged better.`
}

function auditPrompt(item, changedPaths) {
  return `You are an adversarial auditor for item ${item.id} — ${item.title}. Your job is to REFUTE
the claim that this work is done, not to confirm it. Default to finding problems; a clean report
is only credible after you have genuinely tried to break it.

Files the builder claims to have changed:
${(changedPaths || []).map((p) => `  ${p}`).join('\n') || '  (none reported)'}
Declared ownership:
${item.ownedPaths.map((p) => `  ${p}`).join('\n')}
Acceptance criteria it claims to satisfy:
${item.acceptance.map((a) => `  - ${a}`).join('\n')}

${CONTRACT}

Read the actual code. Check, in this order:
1. Ownership: did it edit anything outside ownedPaths? Did it touch package.json, pnpm-lock.yaml
   or src/routeTree.gen.ts? Any of those is blocking.
2. Contract compliance: hard-coded colours or spacing instead of tokens; SQL outside
   src/server/repos; data fetching or server/ imports inside components/ui; \`any\`; eslint or ts
   suppressions; leftover TODOs, placeholder copy, console.log or commented-out code. Each is
   blocking.
3. Correctness: does the code do what the acceptance criteria say, on the paths that actually run?
   Trace the real call chain rather than trusting names. Look for unhandled rejections, missing
   loading and error branches, incorrect Suspense or hydration boundaries.
4. Security and tenancy: every server function input validated with Zod; every repo call scoped to
   the tenant; no authorisation decided on the client; auth/session and Stripe webhook handling
   verifying signatures and idempotency; no secret reachable from client bundles.
5. Scale, per docs/ARCHITECTURE.md: N+1 queries against D1, unbounded result sets, missing cache
   or invalidation, Durable Object hot-spotting, quota checks bypassed at the repository boundary.
6. Accessibility and performance: keyboard reachability and focus order, accessible names, ARIA
   only where semantics are insufficient, reduced-motion honoured, layout shift after paint,
   oversized client bundle or a dependency pulled into the wrong environment.

Report each problem once, with file and line, the concrete failure it causes, and enough evidence
that someone can verify it without redoing your analysis. "blocking" means the item is not done.
"nonBlocking" means it is real but does not fail the gate.`
}

const priorFindingsById = {}
for (const it of KNOWN) {
  if (it && it.id && Array.isArray(it.findings)) priorFindingsById[it.id] = it.findings
}

if (VERIFY_ONLY) log('verification round: re-gating accepted work without rebuilding')

phase('Build')

const gated = await pipeline(
  carried,
  // Stage 1 — build, unless this is a verification pass over accepted work.
  (item) =>
    VERIFY_ONLY && item.status === 'accepted'
      ? Promise.resolve({ itemId: item.id, status: 'unchanged', changedPaths: [] })
      : agent(buildPrompt(item, priorFindingsById[item.id]), {
          label: `build:${item.id}`,
          phase: 'Build',
          schema: BUILD_SCHEMA,
          agentType: 'ultrabuild-builder',
          effort: 'high',
        }),
  // Stage 2 — capture the blind pair (skipped for items with nothing visual).
  (built, item) =>
    item.url || item.referenceUrl
      ? agent(capturePrompt(item), {
          label: `capture:${item.id}`,
          phase: 'Capture',
          schema: CAPTURE_SCHEMA,
          effort: 'low',
        }).then((cap) => ({ built, cap }))
      : Promise.resolve({ built, cap: null }),
  // Stage 3 — judge. Critic and auditor are independent lenses on the same work.
  ({ built, cap }, item) =>
    parallel([
      () =>
        cap && cap.captured
          ? agent(criticPrompt(item), {
              label: `critic:${item.id}`,
              phase: 'Gate',
              schema: VISUAL_SCHEMA,
              agentType: 'pixel-critic',
              effort: 'high',
            })
          : Promise.resolve(null),
      () =>
        agent(auditPrompt(item, built && built.changedPaths), {
          label: `audit:${item.id}`,
          phase: 'Gate',
          schema: AUDIT_SCHEMA,
          agentType: 'ultrabuild-auditor',
          effort: 'high',
        }),
    ]).then(([visual, audit]) => ({ item, built, cap, visual, audit })),
)

/* ------------------------------------------------------------------ *
 * Mechanical gate. Repo-wide, so it runs once per round rather than
 * once per item — and it runs after the builds, which is the natural
 * barrier the pipeline already gave us.
 * ------------------------------------------------------------------ */

phase('Mechanical')

const mechanical = await agent(
  `Run this repository's mechanical gate and report raw results. You are a measuring instrument,
not a judge: do not fix anything, do not edit any file, do not soften a failure.

Run each command from the repo root, capture its exit code, and summarise its output:
  pnpm typecheck
  pnpm lint
  pnpm test
  pnpm build
  pnpm exec playwright test

Notes:
- Playwright needs a running dev server AND an explicit base URL. Find the port the dev server
  actually bound (this environment injects an extra --port, so it is often not 3000), verify it
  answers with curl, and run the suite as
  \`PLAYWRIGHT_BASE_URL=http://localhost:<port> pnpm exec playwright test\`. That makes
  playwright.config.ts skip its own webServer block, which otherwise waits on port 3000 forever.
- Never pass --update-snapshots. Rewriting the baseline would turn a visual regression into the new
  expected result. A failing screenshot comparison is a finding, not a baseline to refresh.
- If a browser is missing, run \`pnpm exec playwright install\` and retry once, then report.
- Do NOT run \`pnpm check\`: prettier is failing on ~157 pre-existing files repo-wide and is not
  part of this gate.
- green is true only if EVERY command exited 0. One non-zero exit means green is false.
- For each failure, add a finding with the file and line from the compiler/linter/test output and a
  short excerpt of the actual error text. Severity is always "blocking" for a non-zero exit.`,
  { label: 'mechanical', phase: 'Mechanical', schema: MECHANICAL_SCHEMA, effort: 'low' },
)

const mechanicalGreen = !!(mechanical && mechanical.green)
if (!mechanicalGreen) {
  log(`mechanical gate RED — no item can be accepted this round`)
}

/* ------------------------------------------------------------------ *
 * Verdict. An item is accepted only when all three lenses agree.
 * ------------------------------------------------------------------ */

function verdictFor(row) {
  const { item, built, cap, visual, audit } = row
  const findings = []
  const reasons = []

  if (!built || built.status === 'blocked') {
    reasons.push(built && built.blockedReason ? `builder blocked: ${built.blockedReason}` : 'builder produced nothing')
  }

  if (audit) {
    for (const f of audit.blocking || []) findings.push({ ...f, source: 'auditor', severity: 'blocking' })
    for (const f of audit.nonBlocking || []) findings.push({ ...f, source: 'auditor', severity: 'minor' })
    if ((audit.blocking || []).length) reasons.push(`${audit.blocking.length} blocking audit finding(s)`)
  } else {
    reasons.push('auditor did not report')
  }

  let abWinner = null
  if (visual) {
    for (const f of visual.findings || []) findings.push({ ...f, source: 'critic' })
    const order = blindOrder(item.id)
    abWinner = visual.winner === 'tie' ? 'tie' : visual.winner === order.ours ? 'ours' : 'reference'
    if (visual.verdict !== 'ACCEPT') reasons.push('visual critic REJECTED')
    if (abWinner !== 'ours') reasons.push(`blind A/B winner: ${abWinner}`)
    if (visual.confidence === 'low') reasons.push('critic confidence low')
  } else if (item.url || item.referenceUrl) {
    reasons.push(cap && cap.skippedReason ? `no blind pair: ${cap.skippedReason}` : 'no visual verdict')
  }

  if (cap && (cap.consoleErrors || []).length) {
    reasons.push(`${cap.consoleErrors.length} console error(s)`)
    for (const e of cap.consoleErrors) findings.push({ summary: `Console: ${e}`, severity: 'blocking', source: 'capture' })
  }

  if (!mechanicalGreen) reasons.push('repo mechanical gate red')

  return {
    ...item,
    status: reasons.length ? 'rejected' : 'accepted',
    round: ROUND,
    abWinner,
    scores: visual ? visual.scores : undefined,
    reasons,
    changedPaths: built ? built.changedPaths : [],
    contractExtensions: built ? built.contractExtensions || [] : [],
    findings: findings.filter((f) => f.severity === 'blocking'),
    allFindings: findings,
  }
}

let verdicts = gated.filter(Boolean).map(verdictFor)

/* ------------------------------------------------------------------ *
 * Repair. Rejected items go back to the builder with their findings and
 * are re-gated, up to maxItemRounds, while budget allows.
 * ------------------------------------------------------------------ */

phase('Repair')

let itemRound = 1
while (
  itemRound < MAX_ITEM_ROUNDS &&
  verdicts.some((v) => v.status === 'rejected') &&
  mechanicalGreen &&
  budgetOk(120_000)
) {
  itemRound++
  const rejected = verdicts.filter((v) => v.status === 'rejected')
  log(`repair pass ${itemRound}: ${rejected.map((r) => r.id).join(', ')}`)

  const repaired = await pipeline(
    rejected,
    (v) =>
      agent(buildPrompt(v, v.findings), {
        label: `repair:${v.id}`,
        phase: 'Repair',
        schema: BUILD_SCHEMA,
        agentType: 'ultrabuild-builder',
        effort: 'high',
      }),
    (built, v) =>
      v.url || v.referenceUrl
        ? agent(capturePrompt(v), { label: `recapture:${v.id}`, phase: 'Repair', schema: CAPTURE_SCHEMA, effort: 'low' }).then(
            (cap) => ({ built, cap }),
          )
        : Promise.resolve({ built, cap: null }),
    ({ built, cap }, v) =>
      parallel([
        () =>
          cap && cap.captured
            ? agent(criticPrompt(v), {
                label: `recritic:${v.id}`,
                phase: 'Repair',
                schema: VISUAL_SCHEMA,
                agentType: 'pixel-critic',
                effort: 'high',
              })
            : Promise.resolve(null),
        () =>
          agent(auditPrompt(v, built && built.changedPaths), {
            label: `reaudit:${v.id}`,
            phase: 'Repair',
            schema: AUDIT_SCHEMA,
            agentType: 'ultrabuild-auditor',
            effort: 'high',
          }),
      ]).then(([visual, audit]) => ({ item: v, built, cap, visual, audit })),
  )

  const redone = repaired.filter(Boolean).map(verdictFor)
  const redoneById = {}
  for (const r of redone) redoneById[r.id] = r
  verdicts = verdicts.map((v) => redoneById[v.id] || v)
}

if (verdicts.some((v) => v.status === 'rejected') && !budgetOk(120_000)) {
  log('stopped repairing early: token budget nearly spent — remaining rejects are reported, not hidden')
}

/* ------------------------------------------------------------------ *
 * Report. Deferred items keep their previous status; discovered work
 * becomes next round's items.
 * ------------------------------------------------------------------ */

phase('Report')

const verdictById = {}
for (const v of verdicts) verdictById[v.id] = v

const merged = items
  .map((it) => (verdictById[it.id] ? verdictById[it.id] : { ...it, status: it.status || 'pending' }))
  .sort(byId)

const extensions = []
for (const v of verdicts) {
  for (const e of v.contractExtensions || []) extensions.push({ from: v.id, work: e })
}

const newFindings = []
for (const v of verdicts) {
  for (const f of v.allFindings || []) newFindings.push({ itemId: v.id, round: ROUND, ...f })
}
if (!mechanicalGreen) {
  for (const f of (mechanical && mechanical.failures) || []) {
    newFindings.push({ itemId: '(repo)', round: ROUND, source: 'mechanical', ...f })
  }
}

const accepted = merged.filter((m) => m.status === 'accepted').length
log(`round ${ROUND}: ${accepted}/${merged.length} accepted · ${newFindings.length} findings · mechanical ${mechanicalGreen ? 'green' : 'RED'}`)

return {
  round: ROUND,
  items: merged,
  newFindings,
  extensions,
  mechanical: { green: mechanicalGreen, results: (mechanical && mechanical.results) || [] },
  deferred: deferred.map((i) => i.id),
  // Dry means the loop has nothing left to do: no new findings, a green repo, and
  // every item accepted. Reporting dry while an item is still rejected would let
  // the caller's two-dry-rounds stop condition fire over unfinished work.
  dry: newFindings.length === 0 && mechanicalGreen && merged.every((m) => m.status === 'accepted'),
}
