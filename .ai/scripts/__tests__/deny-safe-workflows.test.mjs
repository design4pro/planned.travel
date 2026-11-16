// Static repository policy checks. Codex runtime permissions are configured separately.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = new URL('../../../', import.meta.url)
const WORKFLOWS = new URL('.ai/cezar/workflows/', ROOT)

/**
 * A Claude Code `Bash(...)` rule body as a regular expression that finds a command it matches
 * anywhere in a text: `*` is any run of characters, a trailing `:*` makes the rest a prefix.
 * Unanchored on purpose - a prompt embeds commands in prose and a step chains them with `&&`.
 * `.` never crosses a newline, so a match stays within one line.
 */
function denyPatternToRegExp(pattern) {
  const body = pattern.endsWith(':*') ? `${pattern.slice(0, -2)}*` : pattern
  const source = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(source)
}

/**
 * The `command:` and `prompt:` values of a workflow file: plain or quoted scalars on the key's
 * line, and `|` / `>` block scalars on the lines indented deeper than the key.
 */
function stepTexts(yaml) {
  const lines = yaml.split('\n')
  const texts = []
  for (let i = 0; i < lines.length; i++) {
    const key = /^(\s*(?:-\s+)?)(command|prompt):\s*(.*)$/.exec(lines[i])
    if (!key) continue
    const [, lead, , value] = key
    if (/^[|>][+-]?$/.test(value)) {
      const block = []
      while (
        i + 1 < lines.length &&
        (lines[i + 1].trim() === '' || indent(lines[i + 1]) > lead.length)
      ) {
        block.push(lines[++i].trim())
      }
      texts.push(block.join('\n'))
    } else {
      texts.push(unquote(value))
    }
  }
  return texts
}

const indent = (line) => line.length - line.trimStart().length

function unquote(value) {
  if (value.startsWith("'") && value.endsWith("'"))
    return value.slice(1, -1).replaceAll("''", "'")
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value)
  return value
}

const denyPatterns = JSON.parse(
  readFileSync(new URL('.agents/policy.json', ROOT), 'utf8'),
).forbiddenCommands

const workflows = readdirSync(WORKFLOWS).filter((name) => name.endsWith('.yml'))

describe('denyPatternToRegExp', () => {
  it('reads * as any run of characters', () => {
    const re = denyPatternToRegExp('git push *--force*')
    expect(re.test('git push origin HEAD --force-with-lease')).toBe(true)
    expect(re.test('git push origin HEAD:refs/heads/fix/x')).toBe(false)
  })

  it('finds the command inside prose or a chain', () => {
    const re = denyPatternToRegExp('git reset --hard*')
    expect(re.test('then run `git reset --hard origin/fix/x` to align')).toBe(
      true,
    )
    expect(re.test('git fetch origin x && git reset --hard origin/x')).toBe(
      true,
    )
    expect(re.test('git reset --soft HEAD~1')).toBe(false)
  })

  it('reads a trailing :* as a prefix', () => {
    const re = denyPatternToRegExp('wrangler delete:*')
    expect(re.test('wrangler delete --name x')).toBe(true)
    expect(re.test('wrangler deploy')).toBe(false)
  })

  it('escapes regular-expression characters', () => {
    const re = denyPatternToRegExp('a.b (c)*')
    expect(re.test('a.b (c) d')).toBe(true)
    expect(re.test('axb (c) d')).toBe(false)
  })

  it('stays within one line', () => {
    expect(
      denyPatternToRegExp('git *--no-verify*').test('git commit\n--no-verify'),
    ).toBe(false)
  })
})

describe('stepTexts', () => {
  it('reads plain, quoted and block scalars', () => {
    const yaml = [
      'steps:',
      '  - id: a',
      '    command: bash x.sh && git status',
      "    prompt: '/om-x {{task}} it''s'",
      '  - id: b',
      '    prompt: |',
      '      line one',
      '',
      '      line two',
      '    allowedTools: [Read]',
    ].join('\n')
    expect(stepTexts(yaml)).toEqual([
      'bash x.sh && git status',
      "/om-x {{task}} it's",
      'line one\n\nline two',
    ])
  })
})

describe('cezar workflows', () => {
  it('has Bash deny patterns and workflows to check', () => {
    expect(denyPatterns).toContain('git reset --hard*')
    expect(workflows.length).toBeGreaterThan(0)
  })

  it.each(workflows)(
    '%s prescribes no command repository policy forbids',
    (name) => {
      const texts = stepTexts(readFileSync(new URL(name, WORKFLOWS), 'utf8'))
      expect(texts.length).toBeGreaterThan(0)
      const hits = texts.flatMap((text) =>
        denyPatterns
          .filter((pattern) => denyPatternToRegExp(pattern).test(text))
          .map((pattern) => `Bash(${pattern})`),
      )
      expect(hits).toEqual([])
    },
  )
})

describe('secret read policy', () => {
  const policy = JSON.parse(
    readFileSync(new URL('.agents/policy.json', ROOT), 'utf8'),
  )
  const instructions = readFileSync(
    new URL('.agents/policies/security.md', ROOT),
    'utf8',
  )
  it.each(policy.secretPaths)('documents the protected path %s', (path) => {
    expect(instructions).toContain(path.replace(/\/\*\*$/, '/'))
  })
})
