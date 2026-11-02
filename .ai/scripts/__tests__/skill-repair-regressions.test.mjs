import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it } from 'vitest'

const skill = (path) => resolve('.agents/skills', path)
const scratch = []
const windows = []
afterEach(() => {
  windows.splice(0).forEach((dom) => dom.window.close())
  scratch
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true }))
})
function temporary() {
  const path = mkdtempSync(join(tmpdir(), 'skill-regression-'))
  scratch.push(path)
  return path
}

it('redacts quoted credentials in generated JSON and embedded tool output', () => {
  const root = temporary()
  const secrets = {
    password: 'fixture password with spaces',
    api_key: 'fixture-"quoted"-key',
    token: 'fixture-token-only',
    client_secret: "fixture-'single'-secret",
    db_password: 'fixture-prefixed-secret',
    numeric_password: 123456,
    object_secret: { value: 'fixture-object-secret' },
    boolean_secret: false,
  }
  const content = JSON.stringify({
    safe: 'keep this',
    nested: secrets,
    config: JSON.stringify({ db_password: 'fixture-serialized-secret' }),
  })
  writeFileSync(join(root, 'example.json'), content)
  writeFileSync(join(root, 'files.txt'), 'example.json\n')
  writeFileSync(
    join(root, 'session.json'),
    JSON.stringify({
      turns: [
        { role: 'user', content: 'Synthetic test' },
        {
          role: 'assistant',
          content: [{ type: 'tool_output', output: content }],
        },
      ],
    }),
  )
  const result = spawnSync(
    process.execPath,
    [
      skill('om-share-this-session/scripts/prepare-share-bundle.mjs'),
      '--name',
      'fixture-share',
      '--session',
      join(root, 'session.json'),
      '--project-root',
      root,
      '--files',
      join(root, 'files.txt'),
      '--out',
      join(root, 'bundle'),
    ],
    { encoding: 'utf8', timeout: 10000 },
  )
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  const generated = JSON.parse(
    readFileSync(
      join(root, 'bundle/review/generated-files/example.json'),
      'utf8',
    ),
  )
  expect(generated.safe).toBe('keep this')
  expect(Object.values(generated.nested)).toEqual(
    Object.keys(secrets).map(() => '«redacted:secret-value»'),
  )
  expect(JSON.parse(generated.config)).toEqual({
    db_password: '«redacted:secret-value»',
  })
  const session = JSON.parse(
    readFileSync(join(root, 'bundle/session.json'), 'utf8'),
  )
  const embedded = JSON.parse(session.turns[1].content[0].output)
  expect(embedded).toEqual(generated)
  expect(
    JSON.parse(readFileSync(join(root, 'bundle/privacy-report.json'), 'utf8'))
      .automatedScan,
  ).toBe('pass')
})

describe('criterion identities', () => {
  it.each([
    ['C1', 'C2', 0],
    ['C1', 'C1', 1],
    ['C1', 'C3', 1],
    ['C0', 'C1', 1],
    ['C2', 'C1', 1],
    ['C01', 'C2', 1],
    ['C1', null, 1],
  ])('validates %s / %s with exit %s', (first, second, expected) => {
    const root = temporary()
    execFileSync('git', ['init', '-q', root])
    writeFileSync(join(root, 'currency.ts'), 'export const currencies = []\n')
    execFileSync('git', ['-C', root, 'add', 'currency.ts'])
    writeFileSync(
      join(root, 'story.txt'),
      'Currency support\n- currencies listed\n- currencies converted\n',
    )
    const rows = [first, second]
      .filter(Boolean)
      .map((id) => '  - ' + id + ': covered `currency.ts`')
      .join('\n')
    const block =
      '- **Verdict**: ✅ Implemented\n- **Criteria coverage**:\n' +
      rows +
      '\n- **Grounding query**: `currencies`\n- **Grounding source**: core\n- **Effort**: 0\n- **Upstream pipeline**: none\n'
    const result = spawnSync(
      'bash',
      [
        skill('om-gap-analysis/bin/gap-validate-finding'),
        '1.1',
        '--repo-root',
        root,
        '--story',
        join(root, 'story.txt'),
      ],
      { input: block, encoding: 'utf8', timeout: 10000 },
    )
    expect(result.status, result.stderr).toBe(expected)
  })
})

const engine = readFileSync(
  skill('om-ux-design/references/assets/prototype.js'),
  'utf8',
)
function openPrototype(storage) {
  const dom = new JSDOM(
    '<html data-prototype-id="fixture"><body><div class="doc-toolbar"></div>' +
      '<section class="screen" id="s1"><h2>Source</h2><div class="frame"><div id="next" data-goto="s2">Next</div></div></section>' +
      '<section class="screen" id="s2"><h2>Destination</h2><div class="frame"></div></section></body></html>',
    { url: 'https://fixture.invalid', runScripts: 'outside-only' },
  )
  windows.push(dom)
  Object.defineProperty(dom.window, 'localStorage', {
    value: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  })
  dom.window.HTMLElement.prototype.scrollIntoView = function () {}
  dom.window.scrollTo = () => {}
  dom.window.confirm = () => true
  dom.window.eval(engine)
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'))
  return dom.window
}
function button(win, text) {
  return [...win.document.querySelectorAll('button')].find(
    (node) => node.textContent === text,
  )
}
function comment(win, text) {
  button(win, 'Comment').click()
  win.document.getElementById('next').click()
  win.document.querySelector('.anno-composer textarea').value = text
  button(win, 'Add comment').click()
}
it('merges stale-tab feedback and keeps deletion tombstones on later writes and reload', () => {
  const storage = new Map()
  const a = openPrototype(storage)
  const b = openPrototype(storage)
  comment(a, 'From A')
  comment(b, 'From B')
  const key = 'om-prototype-comments:v2:fixture'
  expect(JSON.parse(storage.get(key)).operations).toHaveLength(2)
  a.dispatchEvent(new a.StorageEvent('storage', { key }))
  expect(a.document.querySelector('.anno-panel').textContent).toContain(
    'From B',
  )
  button(a, 'Delete').click()
  comment(b, 'Later from B')
  const operations = JSON.parse(storage.get(key)).operations
  expect(operations).toHaveLength(4)
  expect(operations.filter((op) => op.type === 'delete')).toHaveLength(1)
  const reloaded = openPrototype(storage)
  button(reloaded, 'Threads').click()
  const text = reloaded.document.querySelector('.anno-panel').textContent
  expect(text).not.toContain('From A')
  expect(text).toContain('From B')
  expect(text).toContain('Later from B')
})
it.each(['Enter', ' '])(
  'moves focus to destination and back after keyboard activation with %s',
  (key) => {
    const win = openPrototype(new Map())
    button(win, 'Presentation').click()
    const source = win.document.getElementById('next')
    source.focus()
    source.dispatchEvent(
      new win.KeyboardEvent('keydown', { key, bubbles: true }),
    )
    expect(win.document.querySelector('.is-current').id).toBe('s2')
    expect(win.document.activeElement).toBe(
      win.document.querySelector('#s2 h2'),
    )
    button(win, '← Back').click()
    expect(win.document.querySelector('.is-current').id).toBe('s1')
    expect(win.document.activeElement).toBe(
      win.document.querySelector('#s1 h2'),
    )
  },
)
