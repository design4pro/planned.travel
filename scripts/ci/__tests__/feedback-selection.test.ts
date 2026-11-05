import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import * as prettier from 'prettier'
import { describe, expect, it } from 'vitest'

type Node = { type: string; value?: string; children?: Array<Node> }

type Value = string | Array<Value> | { [key: string]: Value }

function decode(node: Node): Value {
  const children = node.children ?? []
  if (node.type === 'mapping' || node.type === 'flowMapping') {
    return Object.fromEntries(
      children.map((item) => {
        const [key, value] = item.children ?? []
        if (!key || !value) throw new Error('Invalid YAML mapping')
        return [String(decode(key)), decode(value)]
      }),
    )
  }
  if (node.type === 'sequence' || node.type === 'flowSequence')
    return children.map(decode)
  if (node.value !== undefined) return node.value
  if (node.type === 'mappingValue' && children.length === 0) return ''
  if (children.length === 1 && children[0]) return decode(children[0])
  throw new Error(`Unsupported YAML node ${node.type}`)
}

function object(value: Value | undefined): Record<string, Value> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected YAML mapping')
  return value
}

async function workflow(source: string) {
  const debug = (
    prettier as unknown as {
      __debug: {
        parse: (
          text: string,
          options: { parser: string },
        ) => Promise<{ ast: unknown }>
      }
    }
  ).__debug
  const result = await debug.parse(source, { parser: 'yaml' })
  const root = result.ast as Node
  const body = root.children?.[0]?.children?.find(
    (node) => node.type === 'documentBody',
  )
  if (!body) throw new Error('Missing workflow document')
  return object(decode(body))
}

function assertRequiredJob(config: Record<string, Value>) {
  const jobs = object(config.jobs)
  const base = object(jobs.e2e)
  const feedback = object(jobs['e2e-feedback'])
  const report = object(jobs['e2e-report'])
  expect(feedback.if).toBe(base.if)
  expect(feedback.needs).toBe('scope')
  expect(feedback['continue-on-error']).toBeUndefined()
  const steps = feedback.steps
  if (!Array.isArray(steps)) throw new Error('Missing feedback steps')
  const prepare = steps
    .map(object)
    .find((step) => step.uses === './.github/actions/e2e-env')
  const test = steps
    .map(object)
    .find((step) => step.name === 'Run the feedback journey')
  expect(object(prepare?.with).feedback).toBe('true')
  expect(prepare?.if).toBeUndefined()
  expect(test?.if).toBeUndefined()
  expect(test?.['continue-on-error']).toBeUndefined()
  expect(test?.run).toBe(
    'pnpm exec playwright test --project=chromium --grep @feedback-sdk --reporter=list,github',
  )
  expect(report.needs).toContain('e2e-feedback')
  const reportSteps = report.steps
  if (!Array.isArray(reportSteps)) throw new Error('Missing report steps')
  const gate = reportSteps
    .map(object)
    .find((step) => step.name === 'Require every expected shard to pass')
  expect(gate?.if).toBeUndefined()
  expect(gate?.['continue-on-error']).toBeUndefined()
  expect(object(gate?.env).FEEDBACK_RESULT).toBe(
    '${{ needs.e2e-feedback.result }}',
  )
  const script = String(gate?.run)
  for (const [shards, result, skipAllowed, expected] of [
    ['success', 'success', 'false', 0],
    ['success', 'failure', 'false', 1],
    ['success', 'skipped', 'false', 1],
    ['failure', 'success', 'false', 1],
    ['skipped', 'skipped', 'true', 0],
    ['skipped', 'success', 'true', 1],
    ['skipped', 'skipped', 'false', 1],
  ] as const) {
    const execution = spawnSync('bash', ['-c', script], {
      env: {
        ...process.env,
        SHARDS_RESULT: shards,
        FEEDBACK_RESULT: result,
        SKIP_ALLOWED: skipAllowed,
      },
      timeout: 5000,
    })
    expect(execution.status).toBe(expected)
  }
}

type ListedTest = { projectName: string; expectedStatus: string }
type Spec = { title: string; file: string; tests: Array<ListedTest> }
type Suite = { specs?: Array<Spec>; suites?: Array<Suite> }

function list(args: Array<string>) {
  const output = execFileSync(
    'pnpm',
    ['exec', 'playwright', 'test', ...args, '--list', '--reporter=json'],
    {
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, CI: '1', E2E_WEBKIT: '1' },
    },
  )
  const result = JSON.parse(output) as { suites: Array<Suite> }
  const cases: Array<{ id: string; project: string; expected: string }> = []
  function visit(suite: Suite) {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests)
        cases.push({
          id: `${spec.file} › ${spec.title}`,
          project: test.projectName,
          expected: test.expectedStatus,
        })
    for (const child of suite.suites ?? []) visit(child)
  }
  result.suites.forEach(visit)
  return cases
}

describe('feedback CI coverage', () => {
  it('rejects a disabled job, skipped step, or missing required gate', async () => {
    const source = readFileSync('.github/workflows/ci.yml', 'utf8')
    const parsed = await workflow(source)
    assertRequiredJob(parsed)
    const jobs = object(parsed.jobs)
    const feedback = object(jobs['e2e-feedback'])
    delete jobs['e2e-feedback']
    expect(() => assertRequiredJob(parsed)).toThrow()
    jobs['e2e-feedback'] = feedback
    const savedIf = feedback.if
    feedback.if = 'false'
    expect(() => assertRequiredJob(parsed)).toThrow()
    feedback.if = savedIf
    const steps = feedback.steps as Array<Value>
    const setup = steps
      .map(object)
      .find((entry) => entry.uses === './.github/actions/e2e-env')
    if (!setup) throw new Error('Missing setup step')
    const inputs = object(setup.with)
    inputs.feedback = 'false'
    expect(() => assertRequiredJob(parsed)).toThrow()
    inputs.feedback = 'true'
    const step = steps
      .map(object)
      .find((entry) => entry.name === 'Run the feedback journey')
    if (!step) throw new Error('Missing feedback step')
    step.if = 'false'
    expect(() => assertRequiredJob(parsed)).toThrow()
    delete step.if
    const report = object(jobs['e2e-report'])
    const savedNeeds = report.needs
    report.needs = []
    expect(() => assertRequiredJob(parsed)).toThrow()
    report.needs = savedNeeds as Value
  })

  it('keeps both viewport iterations inside the selected feedback test', async () => {
    const source = readFileSync('e2e/day-detail.spec.ts', 'utf8')
    const debug = (
      prettier as unknown as {
        __debug: {
          parse: (
            text: string,
            options: { parser: string },
          ) => Promise<{ ast: unknown }>
        }
      }
    ).__debug
    const result = await debug.parse(source, { parser: 'typescript' })
    const ast = result.ast as {
      body: Array<{
        expression?: {
          type?: string
          callee?: { name?: string }
          arguments?: Array<{ value?: string; range?: [number, number] }>
        }
      }>
    }
    const selected = ast.body.filter((statement) => {
      const call = statement.expression
      return (
        call?.type === 'CallExpression' &&
        call.callee?.name === 'test' &&
        call.arguments?.[0]?.value?.includes('@feedback-sdk')
      )
    })
    expect(selected).toHaveLength(1)
    const range = selected[0]?.expression?.arguments?.[1]?.range
    if (!range) throw new Error('Missing feedback callback')
    const callback = source.slice(...range).replace(/\s/g, '')
    expect(callback).toContain(
      'for(constviewportof[{width:720,height:450},{width:360,height:450},])',
    )
  })

  it('assigns each browser case once and runs the feedback case with setup', () => {
    for (const project of ['chromium', 'mobile-safari']) {
      const all = list(['--project', project]).filter(
        (entry) => entry.project === project,
      )
      const shard1 = list([
        '--project',
        project,
        '--grep-invert',
        '@feedback-sdk',
        '--shard=1/2',
      ])
      const shard2 = list([
        '--project',
        project,
        '--grep-invert',
        '@feedback-sdk',
        '--shard=2/2',
      ])
      const focused =
        project === 'chromium'
          ? list(['--project', project, '--grep', '@feedback-sdk'])
          : []
      if (project === 'chromium') {
        expect(
          focused.filter((entry) => entry.project === 'setup'),
        ).toHaveLength(1)
        const selected = focused.filter((entry) => entry.project === project)
        expect(selected).toHaveLength(1)
        expect(selected[0]?.expected).toBe('passed')
      }
      const combined = [...shard1, ...shard2, ...focused].filter(
        (entry) => entry.project === project,
      )
      expect(new Set(combined.map((entry) => entry.id)).size).toBe(
        combined.length,
      )
      expect(
        combined.map((entry) => `${entry.id}|${entry.expected}`).sort(),
      ).toEqual(all.map((entry) => `${entry.id}|${entry.expected}`).sort())
    }
  }, 180_000)
})
