import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const dirs: Array<string> = []
afterEach(() =>
  dirs
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true })),
)
const script = resolve('scripts/sentry-triage/sentry-triage.ts')
const loader = import.meta.resolve('tsx')
const secrets = [
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GH_ENTERPRISE_TOKEN',
  'GITHUB_ENTERPRISE_TOKEN',
  'CUSTOM_GITHUB_TOKEN',
  'GIT_CONFIG_VALUE_0',
]

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'sentry-session-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'src'))
  writeFileSync(join(dir, 'src/app.ts'), 'throw new Error("fixture")\n')
  writeFileSync(join(dir, 'outside.ts'), 'outside\n')
  symlinkSync(join(dir, 'outside.ts'), join(dir, 'src/escape.ts'))
  const trace = join(dir, 'trace.jsonl')
  const report = {
    status: 'ok',
    window: '24h',
    scanned: { production: 1, staging: 0, feedback: 0 },
    candidates: [
      {
        shortId: 'PLANNED-TRAVEL-TEST',
        issueUrl: 'https://design4pro.sentry.io/issues/123/',
        title: 'Fixture error',
        errorType: 'Error',
        errorValue: 'fixture',
        culprit: 'src/app.ts',
        level: 'error',
        sentryStatus: 'unresolved',
        unhandled: true,
        environments: ['production'],
        primaryEnvironment: 'production',
        firstSeen: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        lastSeen: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        eventCount: 100,
        userCount: 20,
        release: null,
        inAppFrame: { file: 'src/app.ts', line: 1, fn: 'fixture' },
        breadcrumbs: [],
        suspectedCause: 'Fixture hypothesis',
        judgement: 'file',
        judgementReason: 'Fixture error',
      },
    ],
    feedback: [],
    skipped: [],
    notes: '',
  }
  const common = `
const fs = require('node:fs');
const secretNames = ${JSON.stringify(secrets)};
const note = data => fs.appendFileSync(${JSON.stringify(trace)}, JSON.stringify(data)+'\\n');
const credentials = () => secretNames.filter(key => process.env[key]);
const descendant = kind => {
 const child = require('node:child_process').spawnSync(process.execPath, ['-e',
  'process.stdout.write(JSON.stringify('+JSON.stringify(secretNames)+'.filter(key => process.env[key])))'], {encoding:'utf8'});
 note({kind,credentials:JSON.parse(child.stdout)});
};
`
  function bin(name: string, source: string) {
    const path = join(dir, name)
    writeFileSync(`${path}.cjs`, `${common}\n${source}`)
    writeFileSync(
      path,
      `#!/bin/sh\nexec "${process.execPath}" "${path}.cjs" "$@"\n`,
    )
    chmodSync(path, 0o755)
  }
  bin(
    'npx',
    `
note({kind:'mcp', credentials:credentials(), claudeAuth:!!process.env.CLAUDE_CODE_OAUTH_TOKEN}); descendant('mcp-descendant');
if(process.argv.includes('--help')) process.exit(0);
require('node:readline').createInterface({input:process.stdin}).on('line', line => {
 const request=JSON.parse(line);
 const result = request.method === 'initialize' ? {protocolVersion:'2025-03-26',capabilities:{tools:{}}} :
 {tools:['find_projects','search_issues','search_events','get_sentry_resource','search_sentry_tools','execute_sentry_tool'].map(name=>({name,inputSchema:{type:'object'}}))};
 if(request.id) process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\\n');
});`,
  )
  bin(
    'claude',
    `
const args=process.argv.slice(2);
note({kind:'survey',args,credentials:credentials(),claudeAuth:!!process.env.CLAUDE_CODE_OAUTH_TOKEN,toolSearch:process.env.ENABLE_TOOL_SEARCH}); descendant('survey-descendant');
const prompt=fs.readFileSync(0,'utf8');
note({kind:'prompt',sourceRead:/Read AGENTS|with Read|Open the file/.test(prompt)});
if(fs.existsSync('failure')) process.exit(1);
const body=fs.readFileSync('report.json','utf8');
if(fs.existsSync('tool-failure')) process.stdout.write(JSON.stringify({type:'user',message:{role:'user',content:[{type:'tool_result',tool_use_id:'fixture',is_error:true,content:'MCP unavailable'}]},tool_use_result:{isError:true}})+'\\n');
process.stdout.write(JSON.stringify({type:'result',subtype:'success',is_error:false,
 permission_denials:fs.existsSync('denied')?[{tool_name:'Read'}]:[],result:'<sentry-triage>'+body+'</sentry-triage>'}));`,
  )
  bin(
    'gh',
    `
const args=process.argv.slice(2); note({kind:'github',args,credentials:credentials()});
if(args.includes('list')) process.stdout.write(fs.existsSync('tracked.json') ? fs.readFileSync('tracked.json','utf8') : '[]');
else { fs.readFileSync(0,'utf8'); process.stdout.write('https://github.com/example/repo/issues/1'); }`,
  )
  return {
    dir,
    report,
    run(args: Array<string> = []) {
      writeFileSync(join(dir, 'report.json'), JSON.stringify(report))
      return spawnSync(
        process.execPath,
        ['--import', loader, script, ...args],
        {
          cwd: dir,
          encoding: 'utf8',
          timeout: 10000,
          env: {
            ...process.env,
            ...Object.fromEntries(
              secrets.map((key) => [key, 'sentinel-not-a-real-token']),
            ),
            PATH: dir,
            SENTRY_ACCESS_TOKEN: 'fake-sentry',
            SENTRY_ORG_SLUG: 'fixture',
            CLAUDE_CODE_OAUTH_TOKEN: 'fake-claude',
          },
        },
      )
    },
    events(): Array<{
      kind: string
      args: Array<string>
      credentials: Array<string>
      claudeAuth: boolean
      sourceRead: boolean
      toolSearch: string
    }> {
      return readFileSync(trace, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    },
  }
}

describe('restricted Sentry sweep subprocess boundary', () => {
  it('removes built-ins, bypass, inherited settings/hooks and GitHub credentials while retaining host auth', () => {
    const f = fixture()
    const result = f.run()
    expect(result.status, result.stderr).toBe(0)
    const events = f.events()
    const survey = events.find((e) => e.kind === 'survey')!
    const args = survey.args
    expect(args).not.toContain('--dangerously-skip-permissions')
    expect(args[args.indexOf('--tools') + 1]).toBe('')
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('dontAsk')
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('')
    expect(JSON.parse(args[args.indexOf('--settings') + 1])).toMatchObject({
      disableAllHooks: true,
    })
    expect(args).toContain('--strict-mcp-config')
    expect(args[args.indexOf('--allowedTools') + 1].split(',')).toEqual([
      'mcp__sentry__find_projects',
      'mcp__sentry__search_issues',
      'mcp__sentry__search_events',
      'mcp__sentry__get_sentry_resource',
      'mcp__sentry__search_sentry_tools',
      'mcp__sentry__execute_sentry_tool',
    ])
    expect(survey.credentials).toEqual([])
    for (const event of events.filter((e) => e.kind.endsWith('-descendant')))
      expect(event.credentials).toEqual([])
    expect(survey.claudeAuth).toBe(true)
    expect(survey.toolSearch).toBe('false')
    expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json')
    for (const event of events.filter((e) => e.kind === 'mcp')) {
      expect(event.credentials).toEqual([])
      expect(event.claudeAuth).toBe(false)
    }
    for (const event of events.filter((e) => e.kind === 'github'))
      expect(event.credentials).toEqual(secrets)
    expect(events.find((e) => e.kind === 'prompt')?.sourceRead).toBe(false)
    expect(
      events.filter((e) => e.kind === 'github' && e.args.includes('create')),
    ).toHaveLength(0)
    expect(result.stdout).toContain('Report-only')
  })

  it('files a valid candidate with the real policy and host source check', () => {
    const f = fixture()
    const result = f.run(['--file-issues'])
    expect(result.status, result.stderr).toBe(0)
    expect(
      f
        .events()
        .filter((e) => e.kind === 'github' && e.args.includes('create')),
    ).toHaveLength(1)
  })

  it.each([
    '../outside.ts',
    'outside.ts',
    '/etc/passwd',
    'src/../outside.ts',
    'src/escape.ts',
    'src/missing.ts',
    'src',
  ])('refuses frame %s', (file) => {
    const f = fixture()
    f.report.candidates[0].inAppFrame.file = file
    const result = f.run(['--file-issues'])
    expect(result.status, result.stderr).toBe(0)
    expect(
      f
        .events()
        .filter((e) => e.kind === 'github' && e.args.includes('create')),
    ).toHaveLength(0)
  })

  it.each([0, 99])('refuses invalid frame line %s', (line) => {
    const f = fixture()
    f.report.candidates[0].inAppFrame.line = line
    const result = f.run(['--file-issues'])
    expect(
      f
        .events()
        .filter((e) => e.kind === 'github' && e.args.includes('create')),
    ).toHaveLength(0)
    if (line === 99) expect(result.status, result.stderr).toBe(0)
    else expect(result.status).not.toBe(0)
  })

  it('refuses a symlinked source root', () => {
    const f = fixture()
    rmSync(join(f.dir, 'src'), { recursive: true })
    const outside = mkdtempSync(join(tmpdir(), 'sentry-outside-'))
    dirs.push(outside)
    writeFileSync(join(outside, 'app.ts'), 'fixture\n')
    symlinkSync(outside, join(f.dir, 'src'))
    expect(f.run(['--file-issues']).status).toBe(0)
    expect(
      f
        .events()
        .filter((e) => e.kind === 'github' && e.args.includes('create')),
    ).toHaveLength(0)
  })

  it('refuses oversized source files', () => {
    const f = fixture()
    writeFileSync(join(f.dir, 'src/app.ts'), 'x'.repeat(2 * 1024 * 1024 + 1))
    expect(f.run(['--file-issues']).status).toBe(0)
    expect(
      f
        .events()
        .filter((e) => e.kind === 'github' && e.args.includes('create')),
    ).toHaveLength(0)
  })

  it.each(['failure', 'denied', 'invalid report'])(
    'does not file on %s',
    (failure) => {
      const f = fixture()
      if (failure === 'invalid report') f.report.status = 'invalid'
      else writeFileSync(join(f.dir, failure), '')
      expect(f.run(['--file-issues']).status).not.toBe(0)
      expect(
        f
          .events()
          .filter((e) => e.kind === 'github' && e.args.includes('create')),
      ).toHaveLength(0)
    },
  )

  it('refuses a failed survey tool despite successful preflight and an eligible report', () => {
    const f = fixture()
    writeFileSync(join(f.dir, 'tool-failure'), '')
    const result = f.run(['--file-issues'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Sentry survey tool failed')
    expect(f.events().some((event) => event.kind === 'mcp')).toBe(true)
    expect(f.events().some((event) => event.kind === 'survey')).toBe(true)
    expect(
      f
        .events()
        .filter(
          (event) => event.kind === 'github' && event.args.includes('create'),
        ),
    ).toHaveLength(0)
  })

  it('keeps deduplication and the filing cap effective', () => {
    const f = fixture()
    writeFileSync(
      join(f.dir, 'tracked.json'),
      JSON.stringify([
        {
          number: 1,
          state: 'OPEN',
          closedAt: null,
          body: '<!-- sentry-issue: PLANNED-TRAVEL-TEST -->',
        },
      ]),
    )
    expect(f.run(['--file-issues']).status).toBe(0)
    expect(
      f
        .events()
        .filter((e) => e.kind === 'github' && e.args.includes('create')),
    ).toHaveLength(0)
    rmSync(join(f.dir, 'tracked.json'))
    expect(f.run(['--file-issues', '--max', '0']).status).toBe(0)
    expect(
      f
        .events()
        .filter((e) => e.kind === 'github' && e.args.includes('create')),
    ).toHaveLength(0)
  })

  it('does not persist checkout credentials and pins the read-only MCP catalogue', () => {
    expect(
      readFileSync('.github/workflows/sentry-triage.yml', 'utf8'),
    ).toContain('persist-credentials: false')
    const config = JSON.parse(
      readFileSync('scripts/sentry-triage/mcp.json', 'utf8'),
    )
    expect(Object.keys(config.mcpServers)).toEqual(['sentry'])
    expect(config.mcpServers.sentry.args).toEqual([
      '-y',
      '@sentry/mcp-server@0.39.0',
      '--skills=inspect',
      '--organization-slug=${SENTRY_ORG_SLUG}',
    ])
  })
})
