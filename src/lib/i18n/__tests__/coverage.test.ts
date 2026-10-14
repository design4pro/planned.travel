import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Every catalogued key has a reader.
 *
 * This is the mirror of what `./parity.test.ts` proves. Parity compares
 * catalogue against catalogue: it guarantees a key exists in all 23 languages
 * and that no locale invented one of its own. It cannot see whether anything
 * *renders* the key, because the source is not one of its inputs.
 *
 * The blind spot is not theoretical. When this test was written the whole of
 * `/settings/billing` was catalogued — 101 keys, plural objects and all, in 23
 * languages — and `billing.tsx` asked for none of them: it held its own English,
 * so a Polish traveller read `Active`, `Manage` and `Current plan` on the payment
 * screen while the suite stayed green and the translations sat unreachable. 110
 * keys were in that state, which was 2530 authored translation entries doing
 * nothing. Wiring that screen up took the count to 9.
 *
 * A dead key is worse than a missing one. A missing key is a compile error at
 * the call site, because `../types.ts` derives the key union from the source
 * catalogue. A dead key is silent, and it makes an unmigrated screen look
 * finished from inside the catalogue.
 */

/** Namespace catalogues, source locale. `en` is the only one keys come from. */
const SOURCE = 'src/lib/i18n/messages/en'

/**
 * The count only ever goes down.
 *
 * Deliberately a number and not a list: these are not decisions to be reviewed
 * one by one, they are debt, and the failure below names whichever keys moved.
 * Adding a key and rendering it in the same change leaves this untouched, which
 * is the normal case; adding one without a reader raises it, and wiring one up
 * lowers it and asks for this line to be lowered with it.
 *
 * The eight that remain are `modules.files.error.*` (all but `tooMany`, which the
 * upload pre-flight renders) and `modules.collab.message.reply`: authored in 23
 * languages, then blocked from being wired because the failure shapes they
 * describe are constructed from types `src/server/fns/files` owns.
 *
 * Four more were a pair-shaped leftover — `untick` beside the `untickItem` that
 * replaced it, and three like it — which this test could not see until it
 * stopped matching keys as substrings. They are deleted.
 */
const DEAD_KEYS = 8

/**
 * Keys reached by composition rather than by a literal.
 *
 * `storedKey()` in `#/lib/notification-copy` builds
 * `shell.notification.<event>.<half>` out of a value read from the database, so
 * that a notification written a year ago renders in the reader's language
 * today. No search of the source can see those call sites — the project keeps a
 * separate `TranslateStored` type precisely because the key is not statically
 * known — so the prefix is exempt rather than counted as debt.
 */
const COMPOSED_PREFIXES: ReadonlyArray<string> = ['shell.notification.']

/** Every key in a source catalogue, namespace-qualified. */
function cataloguedKeys(): ReadonlyArray<string> {
  const keys: Array<string> = []

  for (const file of readdirSync(join(process.cwd(), SOURCE))) {
    if (!file.endsWith('.ts') || file === 'namespaces.d.ts') continue
    const namespace = file.slice(0, -3)
    const source = readFileSync(join(process.cwd(), SOURCE, file), 'utf8')
    // One flat object per namespace (SPEC §8), so a key is a two-space-indented
    // quoted property. A plural message is an object, and its branches are
    // indented deeper — they are not keys and must not be counted as any.
    for (const match of source.matchAll(/^ {2}['"]([^'"]+)['"]\s*:/gm)) {
      keys.push(`${namespace}.${match[1]}`)
    }
  }
  return keys
}

/**
 * Every dotted string literal the source asks for, as a set.
 *
 * The obvious shape — join the source and `includes()` each key — is
 * `keys × source` character comparisons: 2100 keys against four megabytes. It
 * ran in a second alone and timed out at thirteen under a loaded suite, and a
 * gate that goes red under CI contention teaches people to ignore red. One pass
 * to collect the literals and a set lookup per key does the same work once.
 *
 * A key is always a whole static literal here — `t('settings.billing.error')`,
 * or a `MessageKey` entry in a table — so whole-literal equality is exact rather
 * than a heuristic. The one exception composes its key at runtime and is
 * exempted by prefix below.
 */
function requestedKeys(): ReadonlySet<string> {
  const found = new Set<string>()
  const LITERAL = /['"`]([\w.-]*\.[\w.-]+)['"`]/g

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'messages') {
          walk(path)
        }
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        for (const match of readFileSync(path, 'utf8').matchAll(LITERAL)) {
          found.add(match[1])
        }
      }
    }
  }

  walk(join(process.cwd(), 'src'))
  return found
}

function deadKeys(): ReadonlyArray<string> {
  const requested = requestedKeys()
  return cataloguedKeys().filter(
    (key) =>
      !COMPOSED_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
      !requested.has(key),
  )
}

describe('catalogue coverage', () => {
  it('renders every key it translates', () => {
    const dead = deadKeys()

    // The list is the useful half of a failure: it says which screen is
    // catalogued but unwired, or which key was added without a reader.
    expect(
      dead.length,
      dead.length > DEAD_KEYS
        ? `keys with no reader in the source:\n  ${dead.join('\n  ')}`
        : 'keys were wired up — lower DEAD_KEYS to match',
    ).toBe(DEAD_KEYS)
  })

  it('reads the catalogue it is meant to be reading', () => {
    // A regex that matches nothing would report zero dead keys and pass.
    expect(cataloguedKeys().length).toBeGreaterThan(1500)
  })
})
