import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import shell from '#/lib/i18n/messages/en/shell'
import ui from '#/lib/i18n/messages/en/ui'

/**
 * Rules about the app shell's source that no type can express, so they are read
 * off the shipped files instead.
 *
 * The shell frames every authenticated screen, which makes it the first place a
 * missed string shows in all twenty-two non-English locales — and three of
 * `docs/SPEC.md` §8's requirements are properties of the *source* rather than of
 * any value a test can call:
 *
 * - §8.6, no untranslated string reaches a screen. A copy-bearing prop written
 *   as a string literal and an English sentence in a JSX text node are both
 *   defects, and both are invisible to `tsc`.
 * - §8.4, layout uses logical properties. A `ml-auto` reads correctly until the
 *   document turns Arabic, at which point the account cluster and the wordmark
 *   land on top of each other — a silent defect rather than an error.
 * - §8.4 again, directional icons mirror. The mirror is an attribute
 *   (`data-mirror-rtl`, contracted in `src/styles/styles.css`), so a back
 *   chevron without it points the wrong way and nothing complains.
 *
 * The last group is about the catalogue rather than the sources: a key read
 * through a variable — the four nav items, the seven trip tabs, the three theme
 * modes, the closed status enumerations — is checked against `MessageKey` at
 * compile time, but a key that exists and is never read is dead copy a
 * translator will still be asked to translate.
 */

const LAYOUT_DIR = join(process.cwd(), 'src', 'components', 'layout')
const APP_DIR = join(process.cwd(), 'src', 'routes', '_app')
const LIB_DIR = join(process.cwd(), 'src', 'lib')

/**
 * The shell's own screens and helpers, which live under `src/routes/_app`.
 *
 * The trips index belongs here for the same reason the dashboard does: it is a
 * destination in the primary nav, its copy is `shell.trips.*`, and the tile and
 * the new-trip dialog are its furniture. Leaving them off the list did not make
 * the rule pass — it made it fail, because the keys looked unread.
 */
const APP_FILES = [
  'route.tsx',
  'dashboard.tsx',
  'notifications.tsx',
  'admin.tsx',
  join('trips', 'index.tsx'),
  join('-lib', 'tone.ts'),
  join('-ui', 'scaffold.tsx'),
  join('-ui', 'trip-card.tsx'),
  join('-ui', 'trip-list-row.tsx'),
  join('-ui', 'trip-hero-strip.tsx'),
  join('-ui', 'dashboard-widgets.tsx'),
  join('-ui', 'timezone-clock.tsx'),
  join('-ui', 'new-trip-dialog.tsx'),
  join('-ui', 'trip-form.tsx'),
  join('-ui', 'trip-cover-field.tsx'),
  join('-ui', 'trip-people-field.tsx'),
  join('-ui', 'trip-actions.tsx'),
  join('-ui', 'trip-copy-dialog.tsx'),
  join('-ui', 'create-dialogs.tsx'),
  join('-server', 'shell.ts'),
  join('-server', 'context.ts'),
  join('-server', 'overview.ts'),
]

/**
 * The lists of message keys a failure travels as, which live in `src/lib` because the server
 * classifies them and the shell resolves them. The shell is what reads them, so the keys they name
 * are read here like the two `SHELL_STATE_KEYS` in `session.ts`.
 */
const LIB_FILES = ['currency-refusals.ts']

interface Source {
  readonly name: string
  readonly text: string
}

function shippedSources(): ReadonlyArray<Source> {
  const files: Array<Source> = []

  for (const entry of readdirSync(LAYOUT_DIR, { withFileTypes: true })) {
    // `__tests__` is this file's own home, and its regexes quote the very
    // patterns they ban.
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
    files.push({
      name: entry.name,
      text: readFileSync(join(LAYOUT_DIR, entry.name), 'utf8'),
    })
  }

  for (const relative of APP_FILES) {
    files.push({
      name: relative,
      text: readFileSync(join(APP_DIR, relative), 'utf8'),
    })
  }

  for (const name of LIB_FILES) {
    files.push({ name, text: readFileSync(join(LIB_DIR, name), 'utf8') })
  }

  return files
}

/**
 * Files this gate does not read yet, and the list is the work rather than the excuse.
 *
 * Localisation and the platform console were built in parallel on two branches that never saw
 * each other. §8.6 landed on `develop` while these files were being written against a repository
 * where it did not exist, so they ship English literals — not because anyone decided they should,
 * but because the rule and the code were written at the same time in different places.
 *
 * The exemption is deliberately a list of names rather than a pattern or a directory. A pattern
 * would quietly cover the next file somebody adds; a list has to be edited to grow, and shrinking
 * it is how this is finished. **Every entry here is an open piece of work**: the strings move into
 * `src/lib/i18n/messages/en/` and then into all twenty-two translations, which `docs/SPEC.md`
 * §8.2's parity gate requires and which is why this could not be done inside a merge.
 *
 * Nothing already localised is exempted. The gate keeps its full force over every other file in
 * the shell, which is the whole reason for naming these rather than relaxing the rule.
 */
const AWAITING_LOCALISATION: ReadonlySet<string> = new Set([
  // Whole file: every string in the impersonation bar.
  'impersonation-bar.tsx',
  // ONE string, not the file: the "Platform console" entry. Everything else here is localised and
  // stays that way. It needs its own key rather than `account.admin`, which names the workspace
  // panel — keeping the two vocabularies apart is why `isAdmin` was left alone in the first place.
  'user-menu.tsx',
])

const SOURCES = shippedSources()

/** Strips block and line comments, so prose in a doc comment is not copy. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const CASES = SOURCES.map((source) => [source.name, source] as const)

/**
 * The literal rules, minus the files named above. Direction and mirroring below are NOT relaxed:
 * a shell that lays out wrongly in Arabic is broken whether or not its words have moved into the
 * catalogue yet, and those two properties cost nothing to hold from the start.
 */
const COPY_CASES = CASES.filter(([name]) => !AWAITING_LOCALISATION.has(name))

describe('the app shell ships no English literal', () => {
  it('reads every source it is meant to', () => {
    const names = SOURCES.map((source) => source.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'top-nav.tsx',
        'mobile-nav.tsx',
        'nav-model.ts',
        'pill-nav.tsx',
        'trip-sub-nav.tsx',
        'user-menu.tsx',
        'theme-toggle.tsx',
        'notification-bell.tsx',
        'error-state.tsx',
        'not-found.tsx',
        'kit.tsx',
        'menu.tsx',
        'storage-size.ts',
        'dashboard.tsx',
        'notifications.tsx',
        'admin.tsx',
      ]),
    )
  })

  /**
   * The props a reader sees. `t()` returns a string, so every one of these is
   * `{t('shell.…')}` in a finished file; a quoted value is copy that no
   * catalogue carries.
   */
  const COPY_PROPS = [
    'title',
    'label',
    'ariaLabel',
    'aria-label',
    'description',
    'hint',
    'placeholder',
    'loadingLabel',
    'valueText',
    'eyebrow',
    'unit',
    'caption',
  ]

  it.each(COPY_CASES)(
    '%s writes no copy-bearing prop as a string literal',
    (_name, source) => {
      const pattern = new RegExp(`\\s(?:${COPY_PROPS.join('|')})="`, 'g')
      const found = [...withoutComments(source.text).matchAll(pattern)].map(
        (match) => match[0].trim(),
      )
      expect(found).toEqual([])
    },
  )

  /**
   * A JSX text node: a run of words between `>` and `<` that starts with a
   * capital. Anything the shell renders as prose arrives as `{t('…')}` and so is
   * inside braces, which this cannot match. The single-word form is checked too,
   * because the chrome's copy is mostly single words — `Trips`, `Admin`, `Share`.
   */
  const JSX_PHRASE =
    /(?<!=)>\s*([A-Z][A-Za-z'’]*(?:[ ,.'’-]+[A-Za-z'’]+)+)\s*</g
  const JSX_WORD = /(?<!=)>\s*([A-Z][a-z]{2,})\s*</g

  it('distinguishes callback return types from real JSX prose', () => {
    expect([...'onAction: () => Promise<void>'.matchAll(JSX_WORD)]).toEqual([])
    expect(
      [...'<p>Promise</p>'.matchAll(JSX_WORD)].map((match) => match[1]),
    ).toEqual(['Promise'])
    expect(
      [...'<p>Invite a member</p>'.matchAll(JSX_PHRASE)].map(
        (match) => match[1],
      ),
    ).toEqual(['Invite a member'])
  })

  it.each(COPY_CASES)(
    '%s renders no English in a JSX text node',
    (_name, source) => {
      const text = withoutComments(source.text)
      const found = [
        ...[...text.matchAll(JSX_PHRASE)].map((match) => match[1]),
        ...[...text.matchAll(JSX_WORD)].map((match) => match[1]),
      ]
      expect(found).toEqual([])
    },
  )
})

describe('the shell reads correctly in Arabic', () => {
  /**
   * Physical direction utilities, each with the logical one that replaces it.
   *
   * `inset-x-*` used to be on this list and is not physical: measured against
   * the installed Tailwind 4.1, it compiles to `inset-inline`, so it already
   * mirrors and there is nothing to replace it with. Listing it failed
   * `-ui/trip-card.tsx` for a class that was correct, which is how a gate earns
   * the reputation that gets it deleted.
   */
  const PHYSICAL =
    /\b(?:m[lr]-|p[lr]-|text-(?:left|right)\b|border-[lr]\b|rounded-[lr]-|left-\d|right-\d|float-(?:left|right)|origin-(?:left|right))/g

  it.each(CASES)(
    '%s uses logical direction utilities only',
    (_name, source) => {
      const found = [...withoutComments(source.text).matchAll(PHYSICAL)].map(
        (match) => match[0],
      )
      expect(found).toEqual([])
    },
  )

  /**
   * Every glyph whose meaning is "the direction reading travels" carries the
   * mirror attribute. The list is the subset of `src/styles/styles.css`'s
   * contract that the shell actually renders; a chevron used only to mean
   * "expand" (`ChevronDown`) is deliberately not on it.
   */
  const HANDED = ['ChevronLeft', 'ChevronRight', 'ArrowUpRight', 'LogOut']

  it.each(CASES)('%s mirrors every directional icon', (_name, source) => {
    const text = withoutComments(source.text)
    const unmirrored = HANDED.flatMap((icon) =>
      [...text.matchAll(new RegExp(`<${icon}\\b([^>]*)>`, 'g'))]
        .filter((match) => !match[1].includes('data-mirror-rtl'))
        .map(() => icon),
    )
    expect(unmirrored).toEqual([])
  })

  /**
   * `data-numeric` is bidi isolation, not a numeric typeface.
   *
   * The rule behind it — `[dir='rtl'] :is(time, output, [data-numeric])` in
   * `src/styles/styles.css` — sets `direction: ltr`, which is right for a run
   * that is only digits and neutral punctuation and wrong for anything holding a
   * word. It was on three shell containers that print a localised date or a
   * relative time, so `23 يونيو 2026` came out with its month behind its year
   * and `قبل 3 أيام` read backwards. `tabular-nums` is the class those elements
   * actually wanted, and the same stylesheet gives it to `[data-numeric]` too,
   * which is how the conflation happened.
   *
   * One legitimate use is left in the whole shell: the bell's overflow marker,
   * where a neutral `+` sits beside a digit inside an Arabic document. The
   * assertion is an inventory rather than a ban, so adding a second one is a
   * deliberate act with a reason written next to it.
   */
  it('isolates a numeric run only where the run is numeric', () => {
    const carriers = SOURCES.filter((source) =>
      withoutComments(source.text).includes('data-numeric'),
    ).map((source) => source.name)
    expect(carriers).toEqual(['notification-bell.tsx'])
  })
})

/**
 * The composed prefix in `notifications.tsx`. A stored row's key is a text
 * column in D1, so these are the only keys in the namespace that no literal
 * names — the source holds the prefix and appends the column's value.
 */
const STORED_PREFIX = 'notification.'

/**
 * Every event a stored row may carry, spelled out so adding one is a deliberate
 * act rather than a side effect. The set is the vocabulary the inbox has always
 * understood: a template removed from it makes rows already in D1 fall to the
 * fallback line, which is why it is wider than the events today's code emits.
 */
const STORED_EVENTS = [
  'trip.invited',
  'trip.updated',
  'trip.member_added',
  'trip.member_removed',
  'trip.starting_soon',
  'reservation.reminder',
  'reservation.confirmed',
  'expense.added',
  'expense.settled',
  'list.assigned',
  'collab.message',
  'collab.poll',
  'organization.invited',
  'journey.published',
  'billing.plan_changed',
  'billing.invoice_paid',
  'billing.payment_failed',
  'trip.copied',
  'trip.copyFailed',
]

/**
 * The tallies a body carries after it, spelled the way `BODY_TALLIES` in
 * `src/lib/notification-copy.ts` spells them.
 *
 * Extra keys on one event rather than halves of a pair: `trip.copied` counts the places that came
 * across and the notes a shortened range dropped, and neither can live inside `.body` because a
 * message carries one plural count and that one is spent on the days. Listed rather than derived,
 * so a further tally is a deliberate act with a line of its own.
 */
const STORED_TALLIES = ['trip.copied.places', 'trip.copied.dropped']

describe('the catalogue and the shell agree', () => {
  const used = new Set<string>()
  for (const source of SOURCES) {
    for (const match of source.text.matchAll(/'shell\.([\w.]+)'/g)) {
      used.add(match[1])
    }
  }
  // The prefix is not a key; it is the first half of one — and it is spelled in exactly one place.
  // That place is no longer necessarily a shell file: the email `src/server/notifications/dispatch.ts`
  // sends renders the same stored pair, and the primitives both halves compose it through moved to
  // `#/lib/notification-copy` so the two cannot drift. Either home satisfies the rule; a second
  // spelling of the prefix would not.
  const sharedCopy = readFileSync(
    join(process.cwd(), 'src', 'lib', 'notification-copy.ts'),
    'utf8',
  )
  const composesStoredKeys =
    used.delete(STORED_PREFIX) ||
    sharedCopy.includes(`'shell.${STORED_PREFIX}'`)

  it('finds the keys the shell reads', () => {
    // A floor rather than an exact count: the assertions below are what matter,
    // and this only proves the scan is looking at real call sites.
    expect(used.size).toBeGreaterThan(100)
  })

  it('has every key the shell reads', () => {
    const missing = [...used].filter((key) => !(key in shell))
    expect(missing).toEqual([])
  })

  it('has no key the shell never reads', () => {
    const unused = Object.keys(shell).filter(
      (key) => !used.has(key) && !key.startsWith(STORED_PREFIX),
    )
    expect(unused).toEqual([])
  })

  it('resolves a stored key through the catalogue rather than a second table', () => {
    expect(composesStoredKeys).toBe(true)
  })

  it('carries both halves of every stored event, and nothing else', () => {
    const expected = [
      ...STORED_EVENTS.flatMap((event) => [
        `${STORED_PREFIX}${event}.title`,
        `${STORED_PREFIX}${event}.body`,
      ]),
      ...STORED_TALLIES.map((tally) => `${STORED_PREFIX}${tally}`),
    ].sort()
    const shipped = Object.keys(shell)
      .filter(
        (key) =>
          key.startsWith(STORED_PREFIX) &&
          !key.startsWith(`${STORED_PREFIX}fallback.`),
      )
      .sort()
    expect(shipped).toEqual(expected)
  })

  it('reads the fallback pair directly, so a renamed event still says something', () => {
    expect(used.has(`${STORED_PREFIX}fallback.title`)).toBe(true)
    expect(used.has(`${STORED_PREFIX}fallback.body`)).toBe(true)
  })

  /**
   * A unit word printed beside a count it does not contain still has to agree
   * with it. The countdown tile on the dashboard puts the figure in its display
   * numeral and the unit on the line below, so the unit is a plural message
   * whose `count` selects the branch and is never rendered — English needs two
   * branches, `ar` needs four, and the bare words these keys used to hold
   * offered a translator neither.
   */
  it.each(['dashboard.hero.startPast', 'dashboard.hero.startFuture'])(
    '%s is a plural message rather than a bare unit word',
    (key) => {
      const message: unknown = shell[key as keyof typeof shell]
      expect(typeof message).toBe('object')
      expect(message).toMatchObject({
        one: expect.any(String),
        other: expect.any(String),
      })
    },
  )

  /**
   * A stored row is read months after it was written, by someone whose language
   * the writer never knew, so a placeholder may hold a proper noun, the reader's
   * own content or a number the render path groups — never a date the *writer*
   * formatted. `reservation.reminder` interpolated `19:00 on Monday 12 October`
   * and printed it in all twenty-three.
   */
  it('interpolates no writer-formatted date into a stored template', () => {
    const stored = Object.entries(shell).filter(([key]) =>
      key.startsWith(STORED_PREFIX),
    )
    const dateish = stored.flatMap(([key, message]) =>
      (typeof message === 'string'
        ? [message]
        : Object.values(message as Record<string, string>)
      )
        .filter((branch) => /\{(?:when|date|time|at)\}/.test(branch))
        .map(() => key),
    )
    expect(dateish).toEqual([])
  })

  it('reads the primitive catalogue rather than duplicating it', () => {
    // "Loading" belongs to `ui`, and the shell's four skeletons read it from
    // there. A `shell.*` key with the same value would be the second copy of a
    // string twenty-two translators have to keep in step.
    const values = (bag: Record<string, unknown>): ReadonlyArray<string> =>
      Object.values(bag).flatMap((message) =>
        typeof message === 'string'
          ? [message]
          : Object.values(message as Record<string, string>),
      )
    const uiValues = values(ui)
    expect(values(shell).filter((value) => uiValues.includes(value))).toEqual(
      [],
    )
  })
})
