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

/**
 * What earlier rounds and earlier RUNS measured, handed in by the orchestrator.
 *
 * This script has no filesystem, so the orchestrator reads
 * `.claude/ultrabuild/knowledge/` and passes the contents through. The point is that a fact
 * measured once is never measured again: the same port, theme, capture and console mistakes were
 * rediscovered across two consecutive runs at a cost of roughly a hundred findings, because the
 * only channel for carrying knowledge forward was prose appended to the task string.
 *
 *   facts    — settled measurements, each scoped to the agents it applies to.
 *   refuted  — claims already investigated and found wrong, so a critic or auditor does not file
 *              them a fourth time. Only entries marked blindSafe reach the critic, because a
 *              refutation that names our side would end the blind comparison.
 *   backlog  — work deliberately deferred, carried as known risk rather than rediscovered.
 */
const FACTS = Array.isArray(run.facts) ? run.facts : []
const REFUTED = Array.isArray(run.refuted) ? run.refuted : []
const BACKLOG = Array.isArray(run.backlog) ? run.backlog : []

/**
 * Recon the orchestrator found still valid, keyed by reader, plus the hashes it validated them
 * against. A reader present in RECON_CACHE is not run again this round.
 */
const RECON_CACHE = run.recon && typeof run.recon === 'object' ? run.recon : {}
const RECON_HASHES = run.reconHashes && typeof run.reconHashes === 'object' ? run.reconHashes : {}

/** Item ids to carry before anything else, whatever the alphabet says. */
const PRIORITY = Array.isArray(run.priorityItems) ? run.priorityItems : []

/** Current content hash per item id, so an unchanged item is not re-photographed. */
const ITEM_HASHES = run.itemHashes && typeof run.itemHashes === 'object' ? run.itemHashes : {}

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
    package is a finding you report, never a thing you install. Two names are exempt, and only in
    phase A of the Polar migration, because docs/SPEC.md §3 admits them by name: install
    @react-email/components and react-email, and remove stripe. Nothing else, no other round.
  - src/routeTree.gen.ts is generated. Never hand-edit it; run \`pnpm generate-routes\`.
  - SQL lives only in src/server/repos. components/ui never fetches data and never imports server/.
  - TypeScript strict. No \`any\`. No suppressions. No TODOs, placeholder copy or console.log left behind.`

/**
 * Every agent that needs the app in a browser resolves its port the same way.
 *
 * The rule exists because the opposite happened: agents each started their own `pnpm dev`, sixteen
 * ran at once, the machine hit a load average of 563 with 4.4 GB of swap, and a whole round's gate
 * came back as 64 timeouts with not one pixel difference among them. Reuse beats spawning, and a
 * bounded pool keeps two concurrent runs off each other's ports.
 */
/**
 * Which browser an agent reaches for, and why the two are not interchangeable.
 *
 * Ego Lite is a Chromium browser built for agents: it drives a page from a Node heredoc and runs in
 * an isolated task space. It inherits the HUMAN's browser login state, which covers external sites
 * — but measured against this repo it does NOT carry our demo session, because that session lives
 * in Playwright's e2e/.auth/demo.json, not in the human's Chrome profile. An Ego tab asking for
 * /atlas lands on /login?redirect=%2Fatlas, and signing in from inside the task space did not work
 * either. So the split is by SIDE of the blind pair, not by browser preference: Ego takes the
 * external reference, Playwright takes our authenticated screens.
 *
 * Playwright stays the authority for anything that has to be reproducible or cross-engine: it owns
 * the gate, the committed baselines, and WebKit. Ego Lite is one Chromium build on one machine and
 * must never be allowed to decide whether a baseline passed.
 */
const BROWSER_POLICY = `BROWSER POLICY — two browsers, one job each. Do not substitute one for the other.

EGO LITE (\`ego-browser\`) — for the REFERENCE side and any page that needs no session of ours.
Use it for: the reference half of the blind A/B pair, our own unauthenticated pages, and quick
exploratory looks. Verified on this machine: ego-browser 0.4.7.1, Chromium 150.
  - Invoke it from Bash as a heredoc; do not write a .js file first:
      ego-browser nodejs <<'SCRIPT'
      const task = await useOrCreateTaskSpace('ultrabuild <item-id>')
      await openOrReuseTab('http://localhost:<port>/atlas', { wait: true, timeout: 30 })
      await waitForNetworkIdle().catch(() => {})
      const path = await captureScreenshot()
      cliLog(path)
      SCRIPT
  - \`captureScreenshot()\` resolves to a PATH STRING pointing at a PNG in a temp directory. Copy that
    file to where the item wants it; it is not bytes and not a data URL.
  - \`cliLog(...)\` is the only way anything reaches your terminal from inside the heredoc.
  - AUTH AND RELIABILITY, both measured — this decides which browser photographs which side.
    Ego inherits the HUMAN's browser session, so an external site the human is signed into just
    works. Our own dev server does not: this repo's demo session lives in Playwright's
    e2e/.auth/demo.json, and an Ego tab opening http://localhost:<port>/atlas lands on
    /login?redirect=%2Fatlas. Signing in from inside the task space was attempted and did NOT work:
    the login form exposes no input[type="email"], pageInfo() then timed out on Runtime.evaluate,
    and the tab ended on about:blank. Three probes against our localhost gave one success, one
    five-minute hang and one error.
    THEREFORE, until someone demonstrates otherwise with a measurement:
      * OUR AUTHENTICATED SCREENS — anything inside the app shell, which is every screen this
        project's items are about — are photographed with PLAYWRIGHT, which already holds the
        session and has been reliable all run.
      * EGO LITE takes the REFERENCE side of the blind pair and any unauthenticated page of ours,
        plus quick exploratory looks. That is still most of the value: the reference is an external
        site, and Ego reaches it without a Playwright project or a storage state.
    If you do get Ego onto an authenticated screen of ours, say how you did it in your result so the
    next round can stop paying this cost.
  - Reuse one named space for the whole item across heredoc rounds; the Node runtime keeps no state
    between them, but the task space does — including that session.
  - Set the viewport with \`cdp('Emulation.setDeviceMetricsOverride', { width, height,
    deviceScaleFactor: 1, mobile: false })\`. Measured on this machine: overriding to 360x800 and
    then 1440x900 makes \`await pageInfo()\` report exactly \`w: 360, h: 800\` and \`w: 1440, h: 900\`,
    so the override is real and immediate. Still READ pageInfo() back after every resize and never
    file a frame whose measured size is not the one you intended — a wrongly sized frame sends the
    critic after a responsive defect that does not exist.
  - Helpers that exist in this build: openOrReuseTab, gotoAndWait, listTabs, switchTab, closeTab,
    snapshotText, captureScreenshot, pageInfo, click, doubleClick, hover, dragMouse, scroll,
    scrollBy, typeText, fillInput, pressKey, uploadFile, wait, waitForLoad, waitForElement,
    waitForNetworkIdle, js, cdp, serverFetch, browserFetch, cliLog, and the taskSpace family.
    \`help(name)\` has an incomplete registry — a helper missing from help() may still exist.
  - Finish with \`completeTaskSpace(<nameOrId>, { keep: false })\` in its own final heredoc, so you do
    not leave browser windows behind for the next agent.

PLAYWRIGHT — the authority for anything that must be REPRODUCIBLE OR CROSS-ENGINE.
Use it, and only it, for:
  - the mechanical gate: \`PLAYWRIGHT_BASE_URL=http://localhost:<port> pnpm exec playwright test\`;
  - every committed baseline under e2e/__screenshots__. Ego Lite must never record or re-record one.
    Those frames are compared pixel for pixel across machines; a second Chromium build with its own
    fonts and GPU would silently rewrite the truth;
  - anything that has to hold in more than one engine — the suite runs desktop Chromium and mobile
    WebKit today, and Firefox if a project is added. Ego Lite is Chromium only, so a WebKit or
    Firefox claim made from it is not evidence.

WHERE ARTEFACTS GO — the repo root is not a scratch directory.
Every screenshot you take belongs under \`.claude/ultrabuild/shots/<slug>/round-<n>/<item-id>/\`,
including the throwaway ones you shot to check a viewport or a theme. Every scratch script belongs
in the session scratchpad, never in the repo. Both browsers write to a temp path first, so moving
the file is a step you were taking anyway — move it to the right place, not to \`./\`.
This is not tidiness for its own sake. One run left eleven loose PNGs and two probe scripts at the
repo root, and a \`git add -A\` committed 770 KB of them before anyone noticed. A bare image or a
bare .mjs at the root is now gitignored as a backstop, but the backstop only hides them from git —
they still clutter the working directory, so DELETE what you created once it has served its purpose.

WHEN THEY DISAGREE, PLAYWRIGHT WINS, and the disagreement itself is worth reporting: it usually
means the capture and the gate were not looking at the same state.

Say which browser produced each piece of evidence you report. "Ego Lite, 1440x900, light" and
"Playwright chromium project" are different claims and a reader must be able to tell them apart.`

const PORT_POLICY = `DEV SERVER — one command, not a procedure.

    PORT=$(scripts/ultrabuild/resolve-port.sh) || { echo "no server in the pool"; }

That script IS the port policy: it walks the pool 3000-3010, takes the lowest port that identifies
as this app by its own /api/dev/seed endpoint, and prints only the number. Do not probe by hand, do
not assume 3000 (on this machine it has belonged to an unrelated project), and never kill a server
you did not start — a concurrent run may own it.

Add \`--start\` ONLY if you are the mechanical or capture agent and the pool is empty; it starts
exactly one server on the lowest free port. Never start a second one, and never start one because
the port you were handed is busy.

Then pass the port explicitly to everything:
    PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test
Without it, playwright.config.ts waits on 3000 forever and the round hangs.

If the orchestrator named a port, use it and do not probe. If it does not answer, report and stop.`

/**
 * Turn the knowledge files into a prompt block, scoped to one kind of agent.
 *
 * Scoping matters twice over. It keeps each prompt to the facts that agent can act on rather than
 * pasting the whole ledger into every one of the ~30 agents a round spawns, and it keeps the critic
 * blind: only refutations marked blindSafe reach it, because one that names our side of the pair
 * would end the comparison the gate exists for.
 */
function knowledgeFor(role) {
  const facts = FACTS.filter((f) => !f.scope || f.scope.includes(role))
  const refuted = REFUTED.filter(
    (r) => (!r.scope || r.scope.includes(role)) && (role !== 'critic' || r.blindSafe === true),
  )
  if (!facts.length && !refuted.length) return ''

  const factLines = facts.length
    ? `SETTLED — measured already, do not re-derive and do not re-litigate:
${facts.map((f) => `  - ${f.claim}\n      evidence: ${f.evidence}`).join('\n')}`
    : ''

  const refutedLines = refuted.length
    ? `ALREADY REFUTED — these were investigated and found wrong. Reporting one again is a defect of
the report, not of the work. If you believe one is now true, say so WITH a fresh measurement:
${refuted.map((r) => `  - "${r.claim}"\n      why not: ${r.why}${r.cost ? `\n      cost when it was believed: ${r.cost}` : ''}`).join('\n')}`
    : ''

  return `\n${[factLines, refutedLines].filter(Boolean).join('\n\n')}\n`
}

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
          captureStates: {
            type: 'array',
            maxItems: 4,
            description:
              'Interaction states the critic must see, for an item whose whole point is a state the resting screen does not show — a hover tooltip, an open dialog. Omit for an item judged at rest.',
            items: {
              type: 'object',
              required: ['name', 'why', 'flags'],
              additionalProperties: false,
              properties: {
                name: { type: 'string', description: 'kebab-case, becomes the filename prefix' },
                why: { type: 'string', description: 'what the critic is meant to see in it' },
                flags: {
                  type: 'string',
                  description:
                    "scripts/ultrabuild/capture.mjs flags that reach the state, e.g. --hover '[data-country=\"FR\"]'",
                },
              },
            },
          },
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
    learned: {
      type: 'array',
      maxItems: 3,
      description:
        'Environment measurements a LATER agent would otherwise have to repeat: a command that works, a selector that exists, a seam that behaves differently from the obvious guess. Only what you MEASURED, never a plan or an opinion, and never a defect of the code — that is a finding.',
      items: {
        type: 'object',
        required: ['claim', 'evidence', 'scope'],
        additionalProperties: false,
        properties: {
          claim: { type: 'string' },
          evidence: { type: 'string', description: 'the measurement itself, specific enough to re-check' },
          scope: {
            type: 'array',
            items: { type: 'string', enum: ['builder', 'capture', 'critic', 'auditor', 'mechanical'] },
            minItems: 1,
          },
        },
      },
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
    learned: {
      type: 'array',
      maxItems: 3,
      description:
        'Environment measurements a LATER agent would otherwise have to repeat: a command that works, a selector that exists, a seam that behaves differently from the obvious guess. Only what you MEASURED, never a plan or an opinion, and never a defect of the code — that is a finding.',
      items: {
        type: 'object',
        required: ['claim', 'evidence', 'scope'],
        additionalProperties: false,
        properties: {
          claim: { type: 'string' },
          evidence: { type: 'string', description: 'the measurement itself, specific enough to re-check' },
          scope: {
            type: 'array',
            items: { type: 'string', enum: ['builder', 'capture', 'critic', 'auditor', 'mechanical'] },
            minItems: 1,
          },
        },
      },
    },
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
    learned: {
      type: 'array',
      maxItems: 3,
      description:
        'Environment measurements a LATER agent would otherwise have to repeat: a command that works, a selector that exists, a seam that behaves differently from the obvious guess. Only what you MEASURED, never a plan or an opinion, and never a defect of the code — that is a finding.',
      items: {
        type: 'object',
        required: ['claim', 'evidence', 'scope'],
        additionalProperties: false,
        properties: {
          claim: { type: 'string' },
          evidence: { type: 'string', description: 'the measurement itself, specific enough to re-check' },
          scope: {
            type: 'array',
            items: { type: 'string', enum: ['builder', 'capture', 'critic', 'auditor', 'mechanical'] },
            minItems: 1,
          },
        },
      },
    },
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

/** The path part of an item's url, so the capture can be pointed at whatever port resolved. */
function pathOf(url) {
  if (!url) return '/'
  const afterScheme = url.replace(/^https?:\/\//, '')
  const slash = afterScheme.indexOf('/')
  return slash === -1 ? '/' : afterScheme.slice(slash)
}

/**
 * Which frames to take for one item this round.
 *
 * The full grid is eight frames per side, and with ten items that is eighty images a round for a
 * vision model to read — comfortably the largest single input cost in the loop. It is worth paying
 * when an item is being judged for the first time or is up for acceptance. It is not worth paying
 * on a repair pass, where the question is narrower: did the findings get fixed. So a repair
 * captures the anchor pair plus whichever viewport and theme the previous findings actually named.
 */
function captureMatrix(item, priorFindings, { repair }) {
  const map = /atlas|map/i.test(`${item.id} ${item.title}`) || (item.url || '').includes('/atlas')
  const states = Array.isArray(item.captureStates) ? item.captureStates : []
  if (!repair) {
    return { viewports: ['1440x900', '768x1024', '360x800', '2560x1440'], themes: ['light', 'dark'], map, states }
  }
  const said = (priorFindings || []).map((f) => `${f.summary} ${f.evidence || ''}`).join(' ')
  const viewports = new Set(['1440x900', '360x800'])
  for (const [needle, vp] of [['768', '768x1024'], ['2560', '2560x1440']]) {
    if (said.includes(needle)) viewports.add(vp)
  }
  const themes = /\bdark\b/i.test(said) || !/\blight\b/i.test(said) ? ['light', 'dark'] : ['light']
  return { viewports: [...viewports], themes, map, states }
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
Auth, Polar, MapLibre + pmtiles, TanStack Query/Form, Zod v4.
Use Context7 for library docs and the Cloudflare documentation tools for platform behaviour —
prefer retrieved docs over recollection, since these versions are recent. Report as facts the
specific APIs, config keys and idioms to use, and in "risks" the version-specific traps
(SSR/hydration boundaries, Workers runtime limits, nodejs_compat gaps, Tailwind v4 differences
from v3). Cite doc sources.`,
  },
]

/*
 * Only the readers whose inputs actually moved are run.
 *
 * The orchestrator hashes each reader's inputs — the contract documents, the lockfile, HEAD, the
 * run slug — and hands back any cached result whose hash still matches. Across twelve rounds the
 * contract reader read docs/SPEC.md, DESIGN.md, ARCHITECTURE.md and DEPLOY.md (68 KB) twelve times
 * for an answer that never changed once, and the stack reader re-researched a frozen dependency set
 * just as often. Recon is four high-effort agents; this is the cheapest large saving in the loop.
 */
const staleReaders = RECON_READERS.filter((r) => !RECON_CACHE[r.key])
const cachedReaders = RECON_READERS.filter((r) => RECON_CACHE[r.key])

if (cachedReaders.length) {
  log(`recon reused for: ${cachedReaders.map((r) => r.key).join(', ')}`)
}

const freshRecon = staleReaders.length
  ? (
      await parallel(
        staleReaders.map((r) => () =>
          agent(r.prompt, {
            label: `recon:${r.key}`,
            phase: 'Recon',
            schema: RECON_SCHEMA,
          }),
        ),
      )
    ).map((result, i) => (result ? { key: staleReaders[i].key, result } : null))
  : []

const reconByKey = {}
for (const r of cachedReaders) reconByKey[r.key] = RECON_CACHE[r.key]
for (const entry of freshRecon.filter(Boolean)) reconByKey[entry.key] = entry.result

const recon = RECON_READERS.map((r) => reconByKey[r.key]).filter(Boolean)

if (!recon.length) {
  log('recon produced nothing — aborting the round rather than building blind')
  return { items: KNOWN, newFindings: [], dry: false, aborted: 'recon-empty' }
}

// Fresh results only, tagged with the hash they were measured against, so the orchestrator can
// persist them and know when they go stale.
const reconToPersist = {}
for (const entry of freshRecon.filter(Boolean)) {
  reconToPersist[entry.key] = { hash: RECON_HASHES[entry.key] || null, result: entry.result }
}

const reconDigest = recon
  .map((r) => `## ${r.topic}\n${(r.facts || []).map((f) => `- ${f}`).join('\n')}
${(r.gaps || []).length ? `Gaps:\n${r.gaps.map((g) => `- ${g}`).join('\n')}` : ''}
${(r.risks || []).length ? `Risks:\n${r.risks.map((g) => `- ${g}`).join('\n')}` : ''}`)
  .join('\n\n')

// Deferred work is a known risk, not something to rediscover. It reaches the decomposer so a new
// item is not carved over a problem someone already diagnosed and parked.
const backlogDigest = BACKLOG.length
  ? `\nKNOWN DEFERRED WORK — diagnosed in an earlier round and parked on purpose. Do not re-diagnose
it, and do not silently absorb it into an item unless the task actually calls for it:
${BACKLOG.map((b) => `  - ${b.id}: ${b.title}\n      ${b.why || ''}${b.decision ? `\n      decision: ${b.decision}` : ''}`).join('\n')}\n`
  : ''

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
${backlogDigest}
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
- If the item's whole point is a state the resting screen does not show — a hover tooltip, an open
  dialog, an error surface — declare it in captureStates with the flags that reach it. An earlier
  run accepted a hover tooltip at high confidence without the critic ever seeing one, because every
  frame photographed the screen at rest. Give a selector you have actually verified exists.
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
// `accepted-pending-gate` satisfies a dependency: the work is built and both lenses passed it, and
// it is only unaccepted because some OTHER item left the repo gate red. Treating it as unmet would
// hold its dependants for a reason that has nothing to do with either of them.
const doneIds = new Set(
  items.filter((i) => i.status === 'accepted' || i.status === 'accepted-pending-gate').map((i) => i.id),
)
const ready = queue.filter((i) => (i.dependsOn || []).every((d) => doneIds.has(d)))
const heldForDeps = queue.filter((i) => !ready.includes(i))

/*
 * Which items the round can afford, chosen by what unblocks the most rather than by the alphabet.
 *
 * `sort(byId)` used to decide this, and it cost four rounds: `server-clock-pin` was the only item
 * that could turn the repo gate green, every other item was therefore rejected for "repo mechanical
 * gate red" whatever its own quality, and it sorted last, so ITEM_CAP deferred it in rounds 1 and 2.
 * The orchestrator now names the items that unblock the round in `priorityItems`.
 */
const rank = (i) => {
  if (PRIORITY.includes(i.id)) return 0
  if (i.status === 'rejected') return 1
  if (i.status === 'accepted' || i.status === 'accepted-pending-gate') return 3
  return 2
}
const ordered = ready.slice().sort((a, b) => rank(a) - rank(b) || byId(a, b))
const carried = ordered.slice(0, ITEM_CAP)
const deferred = ordered.slice(ITEM_CAP).concat(heldForDeps)

if (PRIORITY.length) {
  log(`priority items this round: ${PRIORITY.join(', ')}`)
}

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

${BROWSER_POLICY}

${PORT_POLICY}
${knowledgeFor('builder')}
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

function capturePrompt(item, matrix) {
  const order = blindOrder(item.id)
  const dir = shotDir(item.id)
  const viewports = matrix.viewports.join(',')
  const themes = matrix.themes.join(',')
  return `Capture a blind A/B screenshot pair for item ${item.id} — ${item.title}.

You are a neutral capture step. You do NOT judge quality and you do NOT edit application code.

Ours:      ${item.url || 'the local dev server root'}
Reference: ${item.referenceUrl || 'https://demo.liketrek.com/dashboard'}

${PORT_POLICY}
${knowledgeFor('capture')}
## Our side — run the script, do not reinvent the procedure

    mkdir -p ${dir}
    PORT=$(scripts/ultrabuild/resolve-port.sh --start)
    node scripts/ultrabuild/capture.mjs \\
      --url http://localhost:$PORT${pathOf(item.url)} \\
      --out ${dir} \\
      --label ${order.ours} \\
      --viewports ${viewports} \\
      --themes ${themes} \\
      --auth${matrix.map ? ' \\\n      --map' : ''}

It prints one JSON object: \`{ files, console: { fatal, notTheApp }, warnings }\`. Report
\`console.fatal\` as consoleErrors and nothing else — \`notTheApp\` is dev-server machinery that
cannot occur in a build. Report every entry of \`warnings\` in skippedReason; a warning means a
frame is suspect and the critic should not be handed it as evidence.

The script owns the viewport, the theme, animation suppression, the map-ready wait, the filename and
the flat-frame check. Do not work around it. If it cannot photograph the state this item is about,
say so in skippedReason and set captured false — a frame of the wrong state is worse than no frame,
because it sends the critic after a defect that does not exist.

${
  matrix.states && matrix.states.length
    ? `### States this item is judged on

The resting screen is not evidence about this item. Capture each of these as its own set of frames,
by adding the flag shown and a \`--state\` name that goes into the filename prefix:
${matrix.states.map((s) => `  ${s.why}\n      --state ${s.name} ${s.flags}`).join('\n')}
`
    : ''
}
## The reference side

${BROWSER_POLICY}

Photograph the reference with Ego Lite: it is an external site, Ego reaches it without a Playwright
project or a storage state, and it inherits the human's browser session. Switch its theme with that
site's own control; if you cannot find one, capture its default theme only and say so in
skippedReason. Never fake a dark frame, and never compare our dark against their light as a pair.

File the reference frames as \`${dir}/<viewport>-<theme>-${order.reference}.png\`, matching the
names our side produced.

## The directory is the critic's whole world

Write NOTHING else into ${dir}: no mapping file, no notes, no README, and never the words "ours",
"reference", "planned" or the reference product's name in a filename or in any file there.

Crop or mask browser chrome, URL bars, and any wordmark or logo on BOTH sides, so neither frame is
identifiable by branding. If a wordmark cannot be cropped without destroying the layout, mask it in
place.

Return the schema: one pairs[] entry per viewport/theme, aPath and bPath pointing at that
combination's two files. If the reference is unreachable, set captured false, explain in
skippedReason, and still capture our side so the round has evidence.`
}

function criticPrompt(item) {
  const dir = shotDir(item.id)
  return `You are the harsh visual critic for item ${item.id} — ${item.title}.

In ${dir}/ there are screenshot pairs named <viewport>-<theme>-A.png and <viewport>-<theme>-B.png,
possibly with a state prefix such as hover-visited-1440-light-A.png. Two different products are
shown. You are NOT told which is which and you must NOT try to find
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
scoring the candidate you judged better.
${knowledgeFor('critic')}`
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

${BROWSER_POLICY}

${PORT_POLICY}
${knowledgeFor('auditor')}
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
   the tenant; no authorisation decided on the client; auth/session and Polar webhook handling
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

/**
 * Whether the item's files are byte-for-byte what they were when it was last judged.
 *
 * The orchestrator hashes each item's ownedPaths before the round; the item carries the hash it had
 * at its last verdict. When the two agree AND the builder reports it wrote nothing, re-photographing
 * and re-critiquing it produces the same eight images and the same verdict at the cost of the
 * single most expensive agent in the loop. The auditor still runs — it reads code, it is cheap
 * beside a vision pass, and it is the lens that catches a defect the pictures cannot show.
 */
function unchangedSinceVerdict(item, built) {
  return (
    built &&
    built.status === 'unchanged' &&
    item.hashAtVerdict &&
    ITEM_HASHES[item.id] &&
    item.hashAtVerdict === ITEM_HASHES[item.id]
  )
}

const gated = await pipeline(
  carried,
  // Stage 1 — build, unless this is a verification pass over accepted work.
  (item) =>
    VERIFY_ONLY && (item.status === 'accepted' || item.status === 'accepted-pending-gate')
      ? Promise.resolve({ itemId: item.id, status: 'unchanged', changedPaths: [] })
      : agent(buildPrompt(item, priorFindingsById[item.id]), {
          label: `build:${item.id}`,
          phase: 'Build',
          schema: BUILD_SCHEMA,
          agentType: 'ultrabuild-builder',
          effort: 'high',
        }),
  // Stage 2 — capture the blind pair (skipped for items with nothing visual, and for items whose
  // files did not move since the verdict that already judged them).
  (built, item) => {
    if (!item.url && !item.referenceUrl) return Promise.resolve({ built, cap: null, reused: false })
    if (unchangedSinceVerdict(item, built) && item.priorVisual) {
      log(`${item.id}: unchanged since its last verdict — reusing that visual verdict`)
      return Promise.resolve({ built, cap: null, reused: true })
    }
    return agent(capturePrompt(item, captureMatrix(item, priorFindingsById[item.id], { repair: false })), {
      label: `capture:${item.id}`,
      phase: 'Capture',
      schema: CAPTURE_SCHEMA,
      effort: 'low',
    }).then((cap) => ({ built, cap, reused: false }))
  },
  // Stage 3 — judge. Critic and auditor are independent lenses on the same work.
  ({ built, cap, reused }, item) =>
    parallel([
      () =>
        reused
          ? Promise.resolve(item.priorVisual)
          : cap && cap.captured
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
    ]).then(([visual, audit]) => ({ item, built, cap, visual, audit, reused })),
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
- Playwright needs a running dev server AND an explicit base URL:
    PORT=$(scripts/ultrabuild/resolve-port.sh --start)
    PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test
  That makes playwright.config.ts skip its own webServer block, which otherwise waits on port 3000
  forever.
- Never pass --update-snapshots. Rewriting the baseline would turn a visual regression into the new
  expected result. A failing screenshot comparison is a finding, not a baseline to refresh.
- If a browser is missing, run \`pnpm exec playwright install\` and retry once, then report.
- Do NOT run \`pnpm check\`: prettier is failing on ~157 pre-existing files repo-wide and is not
  part of this gate.
- green is true only if EVERY command exited 0. One non-zero exit means green is false.
- For each failure, add a finding with the file and line from the compiler/linter/test output and a
  short excerpt of the actual error text. Severity is always "blocking" for a non-zero exit.

${PORT_POLICY}
${knowledgeFor('mechanical')}`,
  { label: 'mechanical', phase: 'Mechanical', schema: MECHANICAL_SCHEMA, effort: 'low' },
)

const mechanicalGreen = !!(mechanical && mechanical.green)
if (!mechanicalGreen) {
  log(`mechanical gate RED — no item can be accepted this round`)
}

/* ------------------------------------------------------------------ *
 * Verdict. An item is accepted only when all three lenses agree.
 * ------------------------------------------------------------------ */

/**
 * Console output that belongs to the toolchain rather than to the item under judgement.
 *
 * Anchored on WHERE the message came from, never on what it says, so an error the app raises stays
 * blocking even when it quotes one of these. `scripts/ultrabuild/capture.mjs` already splits them
 * out; this is the backstop for a capture agent that reported them anyway, and it is the place the
 * reject decision is actually made.
 *
 * The cost of not having it: a `ReferenceError: document is not defined` raised by Vite's own HMR
 * message handler failed atlas-country-actions and atlas-country-card in round 9. Both were
 * finished. The Playwright gate never sees this message, because the gate runs no dev client.
 */
const NOT_THE_APP = /\/@vite\/|\/@react-refresh|\/@id\/|\/@fs\/|react[-_]devtools/i

/**
 * A stable key for "the same problem", so a finding is not re-reported as new in every round.
 *
 * Deliberately keyed on PLACE and not on words. 589 findings in one run produced 588 distinct
 * summaries, because each agent phrases the same defect its own way — so any key derived from the
 * text makes a rewording look like a new problem and a fixed problem look like it is still open.
 * Item plus file plus a ten-line bucket survives rewording. Two genuinely different defects within
 * ten lines of one file collapse into one key, which is a rare and cheap error: they belong to the
 * same builder and land in the same repair either way.
 *
 * A finding with no file has no place to key on, so it falls back to the shape of its summary. That
 * is the weaker key, and it is the reason a critic finding should name a file whenever it can.
 */
function fingerprint(itemId, f) {
  if (f.file) return `${itemId}|${f.file}:${Math.floor((f.line || 0) / 10)}`
  const shape = (f.summary || '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 4)
    .join('-')
  return `${itemId}|no-file|${shape}`
}

function verdictFor(row) {
  const { item, built, cap, visual, audit, reused } = row
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
  } else if (item.visualLens === 'no-reference') {
    /*
     * The reference half cannot be obtained, and that is not this item's failure.
     *
     * docs/SPEC.md section 8 "Who owns the visual judgement" says what happens when no pair
     * exists: our side is still captured and the item is judged on our frames plus code, tests and
     * accessibility, never on a mismatched pair. This branch is what implements that sentence.
     * Without it the rule was unreachable, because the verdict assembler never reads acceptance
     * criteria: ui-primitives-i18n-rtl was rejected in rounds 5 and 6, and settings-module-i18n in
     * round 7, all three times for a demo host we hold no credentials for and never for their work.
     *
     * It is set BY THE ORCHESTRATOR, per item, with the reason recorded in run.json - never by a
     * builder and never by default. `url` is deliberately kept so the capture still runs: the
     * frames are the evidence the auditor and the human read. Only the A/B comparison is waived,
     * and every other lens stays exactly as strict.
     */
    log(`visual lens waived for ${item.id}: reference unobtainable (${(cap && cap.skippedReason) || 'no reason given'})`)
  } else if (item.url || item.referenceUrl) {
    reasons.push(cap && cap.skippedReason ? `no blind pair: ${cap.skippedReason}` : 'no visual verdict')
  }

  const appConsoleErrors = (cap ? cap.consoleErrors || [] : []).filter((e) => !NOT_THE_APP.test(e))
  if (appConsoleErrors.length) {
    reasons.push(`${appConsoleErrors.length} console error(s)`)
    for (const e of appConsoleErrors) {
      findings.push({ summary: `Console: ${e}`, severity: 'blocking', source: 'capture' })
    }
  }

  /*
   * The repo gate is a fact about the ROUND, not a judgement on this item.
   *
   * It used to be appended to `reasons`, so a red repo rejected every item whatever its own two
   * lenses said — and a rejected item goes back to the builder with its findings and is rebuilt.
   * In the atlas run that meant correct, finished code was rebuilt for someone else's failing test
   * across rounds 1 to 8, and five items ended the run marked `rejected` with, in the report's own
   * words, no defect that still existed. An item that passed both its lenses is now held at
   * `accepted-pending-gate`: it is not rebuilt, not re-photographed, and needs only a green repo to
   * become accepted.
   */
  const ownVerdict = reasons.length ? 'rejected' : 'accepted'
  const status = ownVerdict === 'accepted' && !mechanicalGreen ? 'accepted-pending-gate' : ownVerdict

  const blocking = findings
    .filter((f) => f.severity === 'blocking')
    .map((f) => ({ ...f, fingerprint: fingerprint(item.id, f) }))

  return {
    ...item,
    status,
    gateBlocked: !mechanicalGreen,
    round: ROUND,
    abWinner,
    scores: visual ? visual.scores : undefined,
    reasons,
    changedPaths: built ? built.changedPaths : [],
    contractExtensions: built ? built.contractExtensions || [] : [],
    // Carried so a later round can reuse it when the item's files have not moved.
    priorVisual: visual || item.priorVisual,
    reusedVisual: !!reused,
    learned: [...((built && built.learned) || []), ...((cap && cap.learned) || [])],
    findings: blocking,
    allFindings: findings.map((f) => ({ ...f, fingerprint: fingerprint(item.id, f) })),
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
        ? agent(capturePrompt(v, captureMatrix(v, v.findings, { repair: true })), {
            label: `recapture:${v.id}`,
            phase: 'Repair',
            schema: CAPTURE_SCHEMA,
            effort: 'low',
          }).then((cap) => ({ built, cap }))
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

/*
 * Findings this round did NOT re-report, keyed by the fingerprint of a finding it inherited.
 *
 * The loop had no way to say "that one is fixed": a finding stayed in the item's blocking list
 * until a round happened not to mention it, and the builder was handed the same list again. Naming
 * the resolved ones lets the orchestrator close them in the ledger instead of carrying them.
 */
const seen = new Set(newFindings.map((f) => f.fingerprint).filter(Boolean))
const resolved = []
for (const v of verdicts) {
  for (const f of priorFindingsById[v.id] || []) {
    if (f.fingerprint && !seen.has(f.fingerprint)) resolved.push({ itemId: v.id, fingerprint: f.fingerprint })
  }
}

// Environment measurements the agents made, for the orchestrator to fold into
// .claude/ultrabuild/knowledge/facts.json. Deduplicated on the claim so three agents measuring the
// same thing in the same round contribute one entry.
const learnedFacts = []
const claimed = new Set()
for (const source of [...verdicts.map((v) => v.learned), mechanical && mechanical.learned]) {
  for (const l of source || []) {
    const key = (l.claim || '').toLowerCase().slice(0, 80)
    if (!key || claimed.has(key)) continue
    claimed.add(key)
    learnedFacts.push(l)
  }
}

const accepted = merged.filter((m) => m.status === 'accepted').length
const pending = merged.filter((m) => m.status === 'accepted-pending-gate').length
log(
  `round ${ROUND}: ${accepted}/${merged.length} accepted${pending ? ` (+${pending} awaiting a green repo)` : ''} · ` +
    `${newFindings.length} findings · ${resolved.length} resolved · mechanical ${mechanicalGreen ? 'green' : 'RED'}`,
)

return {
  round: ROUND,
  items: merged,
  newFindings,
  resolvedFindings: resolved,
  learnedFacts,
  // Fresh recon only, tagged with the hash it was measured against. The orchestrator persists these
  // and hands back whichever are still valid next round, so a reader runs only when its inputs move.
  recon: reconToPersist,
  extensions,
  mechanical: { green: mechanicalGreen, results: (mechanical && mechanical.results) || [] },
  deferred: deferred.map((i) => i.id),
  // Dry means the loop has nothing left to do: no new findings, a green repo, and
  // every item accepted. Reporting dry while an item is still rejected would let
  // the caller's two-dry-rounds stop condition fire over unfinished work. A green repo means no
  // item can be sitting at `accepted-pending-gate`, so `accepted` is the only status that counts.
  dry: newFindings.length === 0 && mechanicalGreen && merged.every((m) => m.status === 'accepted'),
}
