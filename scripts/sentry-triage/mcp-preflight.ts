import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { z } from 'zod'

export interface McpCommand {
  command: string
  args: Array<string>
  env: Record<string, string>
}

const requiredTools = [
  'find_projects',
  'search_issues',
  'search_events',
  'get_sentry_resource',
  'search_sentry_tools',
  'execute_sentry_tool',
]
const initializeResult = z.object({
  protocolVersion: z.literal('2025-03-26'),
  capabilities: z.object({ tools: z.object({}) }),
})
const toolPage = z.object({
  tools: z.array(
    z.object({
      name: z.string(),
      inputSchema: z.object({ type: z.literal('object') }),
    }),
  ),
  nextCursor: z.string().optional(),
})
const response = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.number().optional(),
  result: z.unknown().optional(),
  error: z.unknown().optional(),
})

/** No server stderr or raw response enters a diagnostic: either can contain credentials. */
function attempt(
  config: McpCommand,
  timeoutMs: number,
  prewarm: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      config.command,
      prewarm ? [...config.args, '--help'] : config.args,
      {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'ignore'],
        detached: process.platform !== 'win32',
      },
    )
    let settled = false
    let outcome: Error | undefined
    let expectedId = 1
    const names = new Set<string>()
    const lines = createInterface({ input: child.stdout })
    // Killing the group includes npx's server child, so retries cannot accumulate orphan servers.
    const kill = () => {
      if (!child.pid) return
      try {
        if (process.platform === 'win32') child.kill('SIGKILL')
        else process.kill(-child.pid, 'SIGKILL')
      } catch {
        /* The process has already exited. */
      }
    }
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      outcome = error
      clearTimeout(timer)
      lines.close()
      child.stdin.end()
      kill()
    }
    const timer = setTimeout(
      () => finish(new Error('connection timed out')),
      timeoutMs,
    )
    const send = (message: object) =>
      child.stdin.write(`${JSON.stringify(message)}\n`)
    child.stdin.on('error', () => finish(new Error('server input closed')))
    child.once('error', () => finish(new Error('server could not start')))
    child.once('close', (code) => {
      if (!settled)
        finish(
          prewarm && code === 0
            ? undefined
            : new Error('server exited before discovery'),
        )
      if (outcome) reject(outcome)
      else resolve()
    })
    if (prewarm) return
    lines.on('line', (line) => {
      if (settled) return
      try {
        const message = response.parse(JSON.parse(line))
        if (message.id === undefined) return // Notifications do not complete a request.
        if (message.id !== expectedId || message.error !== undefined)
          throw new Error('protocol response failed')
        if (expectedId === 1) {
          initializeResult.parse(message.result)
          send({ jsonrpc: '2.0', method: 'notifications/initialized' })
          expectedId += 1
          send({
            jsonrpc: '2.0',
            id: expectedId,
            method: 'tools/list',
            params: {},
          })
          return
        }
        const page = toolPage.parse(message.result)
        for (const tool of page.tools) names.add(tool.name)
        if (page.nextCursor) {
          expectedId += 1
          send({
            jsonrpc: '2.0',
            id: expectedId,
            method: 'tools/list',
            params: { cursor: page.nextCursor },
          })
          return
        }
        if (requiredTools.some((name) => !names.has(name)))
          throw new Error('required tools missing')
        finish()
      } catch {
        finish(new Error('handshake or required tool discovery failed'))
      }
    })
    send({
      jsonrpc: '2.0',
      id: expectedId,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'planned-sentry-preflight', version: '1.0.0' },
      },
    })
  })
}

/** Prewarm the exact configured package once, then allow at most one connection retry. */
export async function prepareSentryMcp(
  config: McpCommand,
  timeoutMs = 30_000,
): Promise<void> {
  try {
    await attempt(config, 120_000, true)
  } catch {
    throw new Error('Sentry MCP prewarm failed; nothing was looked at')
  }
  for (let index = 0; index < 2; index += 1) {
    try {
      await attempt(config, timeoutMs, false)
      return
    } catch {
      if (index === 1)
        throw new Error(
          'Sentry MCP unavailable after two connection attempts; nothing was looked at',
        )
    }
  }
}

/** Resolve the same environment placeholders Claude expands, without persisting their values. */
export function resolveMcpCommand(
  config: McpCommand,
  env: NodeJS.ProcessEnv,
): McpCommand {
  const expand = (value: string) =>
    value.replace(/\$\{([A-Z_]+)\}/g, (_, name: string) => {
      const resolved = env[name]
      if (!resolved) throw new Error(`Sentry MCP requires ${name}`)
      return resolved
    })
  return {
    command: config.command,
    args: config.args.map(expand),
    env: Object.fromEntries(
      Object.entries(config.env).map(([key, value]) => [key, expand(value)]),
    ),
  }
}
