import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { bindingNamesIn, nodeAt, parseJsonc } from './wrangler-config'

const config = parseJsonc(readFileSync('wrangler.jsonc', 'utf8'))
const declarations = ts.createSourceFile(
  'worker-configuration.d.ts',
  readFileSync('worker-configuration.d.ts', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
)

function members(name: string) {
  const result = new Map<string, ts.TypeNode>()
  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.type)
          result.set(member.name.getText(declarations), member.type)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(declarations)
  return result
}
function literals(type: ts.TypeNode | undefined): Array<unknown> {
  if (!type) return []
  if (ts.isUnionTypeNode(type)) return type.types.flatMap(literals)
  if (!ts.isLiteralTypeNode(type)) return []
  if (ts.isStringLiteral(type.literal)) return [type.literal.text]
  if (ts.isNumericLiteral(type.literal)) return [Number(type.literal.text)]
  if (type.literal.kind === ts.SyntaxKind.TrueKeyword) return [true]
  if (type.literal.kind === ts.SyntaxKind.FalseKeyword) return [false]
  return []
}

describe('JSONC reader', () => {
  it('preserves comment markers, escapes, and braces inside strings', () => {
    expect(
      parseJsonc(String.raw`{ // comment
      "url": "https://example.com/*path*/", "quote": "a\"b", "brace": "},", /* block */ "list": [1,],
    }`),
    ).toEqual({
      url: 'https://example.com/*path*/',
      quote: 'a"b',
      brace: '},',
      list: [1],
    })
  })
  it('does not concatenate tokens across comments or accept unfinished comments', () => {
    expect(() => parseJsonc('{"x":1/* gap */2}')).toThrow()
    expect(() => parseJsonc('{} /* unfinished')).toThrow()
  })
  it('reads singleton and collection bindings without a live inventory fixture', () => {
    const fixture = {
      ai: { binding: 'MODEL' },
      version_metadata: { binding: 'VERSION' },
      kv_namespaces: [{ binding: 'CACHE' }],
      durable_objects: { bindings: [{ name: 'ROOM' }] },
    }
    expect(bindingNamesIn(fixture, [])).toEqual([
      'CACHE',
      'MODEL',
      'ROOM',
      'VERSION',
    ])
    expect(nodeAt(fixture, ['missing'])).toBeUndefined()
  })
})

describe('Wrangler environment parity', () => {
  const production = bindingNamesIn(config, [])
  const staging = bindingNamesIn(config, ['env', 'staging'])
  it('redeclares every production binding in staging, allowing staging-only bindings', () => {
    expect(staging).toEqual(expect.arrayContaining(production))
  })
  it('redeclares every production variable in staging', () => {
    expect(
      Object.keys(nodeAt(config, ['env', 'staging', 'vars']) as object),
    ).toEqual(
      expect.arrayContaining(Object.keys(nodeAt(config, ['vars']) as object)),
    )
  })
  it.each([
    { name: '__BaseEnv_Env', paths: [[], ['env', 'staging']] },
    { name: 'StagingEnv', paths: [['env', 'staging']] },
  ])(
    'keeps $name bindings and literal variables current without circular typegen imports',
    ({ name, paths }) => {
      const declared = members(name)
      const expected = new Set<string>()
      const variables = new Map<string, Set<unknown>>()
      for (const path of paths) {
        for (const binding of bindingNamesIn(config, path))
          expected.add(binding)
        for (const [key, value] of Object.entries(
          nodeAt(config, [...path, 'vars']) as object,
        )) {
          expected.add(key)
          if (!variables.has(key)) variables.set(key, new Set())
          variables.get(key)?.add(value)
        }
      }
      expect([...declared.keys()].sort()).toEqual([...expected].sort())
      for (const [key, values] of variables) {
        expect(
          literals(declared.get(key))
            .map((value) => JSON.stringify(value))
            .sort(),
          `${name}.${key}`,
        ).toEqual([...values].map((value) => JSON.stringify(value)).sort())
      }
    },
  )
})
