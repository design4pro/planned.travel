import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Copy inside a declared zone reaches the reader through the catalogue.
 *
 * The parity test compares *catalogues*: it proves every key exists in all 23
 * languages. A string that was never entered into a catalogue is not a key, so
 * there is nothing for it to compare — parity guards translation, not coverage.
 * That gap is why `/settings/billing` renders `Active`, `Manage` and `Upgrade`
 * in English under `Accept-Language: pl` with a green suite.
 *
 * Closing it needs a gate that can be trusted, which rules out the obvious
 * approach. "No English literal in a component" is not decidable by reading
 * source: an SVG path, a `KeyboardEvent.key` value, a Tailwind arbitrary
 * variant and a `displayName` are all strings, and a gate that fails a build
 * over `M8.6 20.2c0-6` gets deleted within a week. So this reads only the two
 * shapes whose meaning is not a guess:
 *
 *   1. JSX text nodes  — `<span>Active</span>`
 *   2. Four attributes — aria-label, placeholder, title, alt
 *
 * Both are unambiguously delivered to a person, and none of the shapes above
 * can appear as either. The cost is recall, and it is a real cost: a sentence
 * passed as a `description` prop is invisible here, which is exactly how
 * `collab-board.tsx` kept a hardcoded English paragraph directly beneath a
 * translated title. This gate stops the bleeding; it does not find everything.
 */

/**
 * Paths whose rendered copy is entirely catalogued. An addition here is a
 * claim, checked on every run — the list grows as areas are migrated, and the
 * areas outside it are measured in the audit rather than guarded here.
 */
const CLEAN: ReadonlyArray<string> = [
  'src/components/costs',
  'src/components/marketing',
  'src/components/modules',
  'src/components/ui',
]

/** Two or more letters in a row: a word, not a glyph, digit or unit symbol. */
const WORD = /\p{L}{2,}/u

/**
 * Only code puts these in a JSX text node.
 *
 * The punctuation half carries almost all of it: an expression that flattened
 * into the `>` … `<` window brings a bracket, an operator or a dotted access
 * with it. The keyword half is deliberately short, and shorter than it was.
 *
 * It used to list every reserved word, which quietly cost the rule its reach:
 * `new`, `class`, `type`, `from`, `return`, `string` and `number` are ordinary
 * English, and `<DialogTitle>Start a new trip</DialogTitle>` was rejected as
 * code because "new" is in it. That sentence shipped untranslated and was found
 * by reading the file, not by this test. What is left are words no interface
 * copy uses — a reader is never shown the word `typeof`.
 */
const CODE_SHAPE =
  /[=(){}[\];`$]|=>|\.\w|\b(?:const|let|var|interface|extends|implements|readonly|typeof|keyof|satisfies|undefined|React)\b/

/**
 * Type syntax caught between the `>` of one generic and the `<` of the next.
 *
 * Four shapes, because an interface body flattens into that window in four
 * different ways: an intersection (`& VariantProps`), one property signature
 * (`people: ReadonlyArray`), the tail of a previous property's type (`void
 * legend: string`, `boolean weekStartsOn?: …`), and a run of several
 * (`viewerUserId: string mine: boolean runs: boolean`).
 *
 * The run is what distinguishes a type body from prose without banning ordinary
 * English: a sentence almost never carries two colons, and the single-signature
 * form stays anchored and capitalised so "Note: Add a stop" is still read as
 * copy.
 */
const TYPE_SYNTAX =
  /^[&|,]|^\w+\??\s*:\s*[A-Z]\w*$|^(?:void|string|number|boolean|unknown|never)\b|(?:\w+\??\s*:\s*\S+\s+){2}/

/** `&nbsp;` and friends are markup, not copy. */
const ENTITY = /^(?:&[a-z]+;|&#\d+;)+$/i

/**
 * Rendered, but the same in every language.
 *
 * Each is a rule rather than a list of values, so a new airport or a new key
 * hint does not need a line here:
 *
 * - `KEY_NAME` — `<Kbd>Enter</Kbd>`. The sentence around it is translated; the
 *   key is engraved on the keyboard in Latin script whatever the locale.
 * - `UNIT` — the symbol trailing a number input. SI symbols are not localised.
 * - `EXAMPLE_CODE` — a placeholder in capitals and digits is a sample booking
 *   reference or IATA code (`LHR`, `SK983`, `TK-4821-99`), not prose.
 * - `URL_SCHEME` — `placeholder="https://"` shows the shape of a link.
 * - `SAMPLE_CONTENT` — the only exception that is a list, because it cannot be
 *   a rule. The landing page's illustrations depict a real-looking trip, and
 *   these are the two strings inside them that are the trip rather than the
 *   product: a name somebody gave their holiday, and a temple. Everything the
 *   product itself says in those panels — the headers, the counters, the
 *   badges — is catalogued, and adding a string here rather than a key is a
 *   claim that a reader would find it odd to see translated.
 */
const KEY_NAME =
  /^(?:Enter|Shift|Ctrl|Alt|Cmd|Mod|Esc|Tab|Space|Del|Backspace|Home|End|PgUp|PgDn)$/
const UNIT = /^(?:km|mi|kg|lb|ml|cl|l|m|ft|h|min|s|°C|°F)$/
const EXAMPLE_CODE = /^[A-Z0-9][A-Z0-9-]*$/
const URL_SCHEME = /^https?:\/\/$/
const SAMPLE_CONTENT: ReadonlySet<string> = new Set([
  'Cherry blossom run',
  'Kiyomizu-dera',
])

function untranslatable(value: string): boolean {
  return (
    KEY_NAME.test(value) ||
    UNIT.test(value) ||
    EXAMPLE_CODE.test(value) ||
    URL_SCHEME.test(value) ||
    SAMPLE_CONTENT.has(value)
  )
}

/** Every `.tsx` under a path, tests excluded. */
function sourceFiles(root: string): ReadonlyArray<string> {
  const found: Array<string> = []

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') {
          walk(path)
        }
      } else if (entry.name.endsWith('.tsx')) {
        found.push(path)
      }
    }
  }

  walk(join(process.cwd(), root))
  return found
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * Text sitting between a closing `>` and the next `<`. Whitespace collapses
 * first so a sentence that wrapped across three lines is read as one.
 *
 * The upper bound used to be 200 characters, which silently dropped exactly the
 * copy most worth catching: `/pricing` carried a 246-character paragraph about
 * who the merchant of record is, and no scan in this project ever reported it.
 * The character class already refuses to cross a tag or an expression boundary,
 * so the cap was buying no safety — it is generous now, and still bounded.
 */
function textNodes(source: string): ReadonlyArray<string> {
  const flat = withoutComments(source).replace(/\s+/g, ' ')
  const found: Array<string> = []

  for (const match of flat.matchAll(
    />\s*([^<>{}]{2,600}?)\s*<(\/|[A-Za-z])/g,
  )) {
    const value = match[1].trim()
    if (!value || !WORD.test(value)) continue
    if (ENTITY.test(value) || CODE_SHAPE.test(value)) continue
    if (TYPE_SYNTAX.test(value)) continue
    // `Promise<void>` and `<span>Save</span>` flatten to the same shape, so the
    // terminator decides: real JSX text is closed by `</`, a generic argument
    // list is not. Only a lone capitalised word is ambiguous enough to need it.
    if (match[2] !== '/' && !/\s/.test(value) && /^[A-Z]/.test(value)) continue
    if (untranslatable(value)) continue
    found.push(value)
  }
  return found
}

/** The four attributes a reader or a screen reader receives verbatim. */
function attributes(source: string): ReadonlyArray<string> {
  const found: Array<string> = []
  const pattern = /\b(aria-label|placeholder|title|alt)\s*=\s*"([^"]*)"/g

  for (const match of withoutComments(source).matchAll(pattern)) {
    const value = match[2].trim()
    if (!value || !WORD.test(value)) continue
    if (untranslatable(value)) continue
    found.push(`${match[1]}="${value}"`)
  }
  return found
}

function rendered(root: string): ReadonlyArray<string> {
  const found: Array<string> = []
  for (const path of sourceFiles(root)) {
    const source = readFileSync(path, 'utf8')
    const relative = path.slice(path.indexOf('/src/') + 1)
    for (const value of [...textNodes(source), ...attributes(source)]) {
      found.push(`${relative}: ${value}`)
    }
  }
  return found
}

describe('rendered copy', () => {
  for (const zone of CLEAN) {
    it(`renders no untranslated copy in ${zone}`, () => {
      expect(rendered(zone)).toEqual([])
    })
  }

  it('reads the copy it is meant to be reading', () => {
    // The route layer is not in a clean zone yet and is known to hold
    // hundreds of English strings. A detector that reports nothing there has
    // broken, and would pass every zone above for the wrong reason.
    expect(rendered('src/routes').length).toBeGreaterThan(50)
  })
})
