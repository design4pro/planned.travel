import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { prepareSentryMcp } from '../mcp-preflight'

const dirs: Array<string> = []
afterEach(() =>
  dirs
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true })),
)

function server(mode: string) {
  const dir = mkdtempSync(join(tmpdir(), 'sentry-preflight-'))
  dirs.push(dir)
  const trace = join(dir, 'trace')
  const script = join(dir, 'server.cjs')
  writeFileSync(
    script,
    `
    const fs = require('node:fs');
    const trace = ${JSON.stringify(trace)};
    const mode = ${JSON.stringify(mode)};
    const note = text => fs.appendFileSync(trace, text + '\\n');
    if (process.argv.includes('--help')) { note('prewarm'); process.exit(mode === 'prewarm-failure' ? 1 : 0); }
    note('connect');
    const attempts = fs.readFileSync(trace, 'utf8').split('connect').length - 1;
    if (mode === 'timeout' || (mode === 'retry' && attempts === 1)) { setInterval(() => {}, 1000); }
    else require('node:readline').createInterface({input:process.stdin}).on('line', line => {
      const request = JSON.parse(line); note(request.method);
      const reply = result => process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\\n');
      if(mode === 'protocol-error') { process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,error:{code:-32603,message:'test-token-never-log'}})+'\\n'); return; }
      if(request.method === 'initialize') reply({protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}});
      if(request.method === 'tools/list') reply({tools: (mode === 'missing' ? [] : ['find_projects','search_issues','search_events','get_sentry_resource','search_sentry_tools','execute_sentry_tool']).map(name=>({name,inputSchema:{type:'object'}}))});
    });
  `,
  )
  return {
    script,
    config: { command: process.execPath, args: [script], env: {} },
    trace,
  }
}

describe('Sentry MCP preflight', () => {
  it.each(['ok', 'missing', 'protocol-error'])(
    'CLI healthcheck %s never starts the agent or GitHub writes',
    (mode) => {
      const { script, trace } = server(mode)
      const bin = join(script, '..', 'npx')
      writeFileSync(
        bin,
        `#!${process.execPath}\n${readFileSync(script, 'utf8')}`,
      )
      chmodSync(bin, 0o755)
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/sentry-triage/sentry-triage.ts',
          '--check-mcp',
        ],
        {
          encoding: 'utf8',
          timeout: 5000,
          env: {
            ...process.env,
            PATH: join(script, '..'),
            SENTRY_ACCESS_TOKEN: 'test-token-never-log',
            SENTRY_ORG: 'test-org',
            SENTRY_ORG_SLUG: 'test-org',
          },
        },
      )
      expect(result.status).toBe(mode === 'ok' ? 0 : 1)
      expect(result.stderr).not.toContain('test-token-never-log')
      expect(result.stdout).not.toContain('Scanned')
      expect(readFileSync(trace, 'utf8')).not.toContain('tools/call')
      if (mode !== 'ok')
        expect(result.stderr).toContain('Sentry MCP unavailable')
      else expect(result.stdout).toContain('No issues were read or filed')
    },
  )

  it('prewarms before initialize, initialized notification and tools discovery without tool calls', async () => {
    const { config, trace } = server('ok')
    await prepareSentryMcp(config, 1000)
    expect(readFileSync(trace, 'utf8').trim().split('\n')).toEqual([
      'prewarm',
      'connect',
      'initialize',
      'notifications/initialized',
      'tools/list',
    ])
  })

  it('retries a timed-out connection once, then succeeds', async () => {
    const { config, trace } = server('retry')
    await prepareSentryMcp(config, 1000)
    expect(readFileSync(trace, 'utf8').match(/connect/g)).toHaveLength(2)
    expect(readFileSync(trace, 'utf8').match(/prewarm/g)).toHaveLength(1)
  })

  it.each(['timeout', 'missing'])(
    'fails closed after two attempts for %s',
    async (mode) => {
      const { config, trace } = server(mode)
      await expect(prepareSentryMcp(config, 1000)).rejects.toThrow(
        'Sentry MCP unavailable',
      )
      expect(readFileSync(trace, 'utf8').match(/connect/g)).toHaveLength(2)
    },
  )

  it('does not start a connection after failed prewarm', async () => {
    const { config, trace } = server('prewarm-failure')
    await expect(prepareSentryMcp(config, 1000)).rejects.toThrow('prewarm')
    expect(readFileSync(trace, 'utf8')).toBe('prewarm\n')
  })
})

describe('scheduled Sentry credential gate', () => {
  it.each([
    ['', 'test-org'],
    ['test-token-never-log', ''],
    ['', ''],
  ])('fails before the sweep when a credential is absent', (token, org) => {
    const workflow = readFileSync('.github/workflows/sentry-triage.yml', 'utf8')
    const gate = /        run: \|\n([\s\S]+?)\n      - /.exec(workflow)?.[1]
    expect(gate).toBeDefined()
    const result = spawnSync('bash', ['-c', gate!], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: process.env.PATH,
        SENTRY_ACCESS_TOKEN: token,
        SENTRY_ORG_SLUG: org,
      },
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('::error::')
    expect(result.stdout).toContain('Sentry is unavailable')
    expect(result.stdout + result.stderr).not.toContain('test-token-never-log')
  })
})
