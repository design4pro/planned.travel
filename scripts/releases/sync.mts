/** Local preview and authenticated operator transport. No SQL, publication or promotion adapter. */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  parseReleaseSource,
  MAX_CHANGELOG_BYTES,
  ReleaseSourceError,
} from '../../src/server/content/git-source.ts'
import { releaseOperationSchema } from '../../src/server/content/publication.ts'
import { hashSecret } from '../../src/server/security/secret.ts'

function git(args: string[]) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: MAX_CHANGELOG_BYTES + 1,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd()
}

export function readLocalRelease(commit: string, version: string) {
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw new Error('An exact 40-character source commit is required.')
  const source = parseReleaseSource(
    git(['show', `${commit}:CHANGELOG.md`]),
    version,
  )
  const cutoffSha = git([
    'rev-parse',
    '--verify',
    `${source.cutoffRef}^{commit}`,
  ])
  if (!/^[a-f0-9]{40}$/.test(cutoffSha)) throw new Error('Ambiguous cutoff.')
  git(['merge-base', '--is-ancestor', cutoffSha, commit])
  return { ...source, sourceCommit: commit, cutoffSha }
}

export async function syncRelease(
  args: string[],
  transport: typeof fetch = fetch,
) {
  const allowed = new Set([
    'operation',
    'commit',
    'version',
    'operation-id',
    'generation',
    'hash',
    'server',
    'screened',
    'reviewed',
  ])
  const options = new Map<string, string>()
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '')
    const value = args[i + 1]
    if (
      !args[i]?.startsWith('--') ||
      !allowed.has(key) ||
      !value ||
      options.has(key)
    )
      throw new Error('Unknown, duplicate or missing option.')
    options.set(key, value)
  }
  const operation = options.get('operation') ?? 'preview'
  const sourceCommit = options.get('commit') ?? ''
  const version = options.get('version') ?? ''
  const operationId = options.get('operation-id') ?? 'local-preview'
  if (operation !== 'preview' && !options.has('operation-id'))
    throw new Error(
      'Reuse an explicit stable --operation-id for mutations and inspect.',
    )
  const expectedGeneration = Number(options.get('generation') ?? 0)
  if (operation === 'import' || operation === 'approve') {
    if (!options.has('generation') || !options.has('hash'))
      throw new Error('Explicit --generation and --hash are required.')
  }
  if (operation === 'preview') {
    const source = readLocalRelease(sourceCommit, version)
    return {
      operationId,
      status: 'unchanged',
      sourceHash: await hashSecret(JSON.stringify(source.body)),
      sourceCommit,
      cutoffSha: source.cutoffSha,
      diff: { before: null, after: source.body },
      baseline:
        'Local source preview only; inspect server generation before import.',
      sync: 'disabled',
    }
  }
  const input = releaseOperationSchema.parse({
    operation,
    operationId,
    version,
    sourceCommit,
    expectedGeneration,
    ...(operation === 'import' || operation === 'approve'
      ? { sourceHash: options.get('hash') }
      : {}),
    ...(operation === 'import'
      ? { screened: options.get('screened') === options.get('hash') }
      : {}),
    ...(operation === 'approve'
      ? {
          review: Object.fromEntries(
            [
              'plainLanguage',
              'accuracy',
              'safeLinks',
              'privacy',
              'security',
            ].map((key) => [
              key,
              options.get('reviewed') === options.get('hash'),
            ]),
          ),
        }
      : {}),
  })
  const server = new URL(options.get('server') ?? '')
  if (
    (server.protocol !== 'https:' &&
      !(
        server.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(server.hostname)
      )) ||
    server.username ||
    server.password ||
    server.search ||
    server.hash ||
    server.pathname !== '/'
  )
    throw new Error('Use an HTTPS server origin or loopback HTTP origin.')
  // Supplied by the operator's process, never read from a file or printed by this command.
  const cookie = process.env.RELEASE_OPERATOR_COOKIE
  if (!cookie) throw new Error('Authenticated operator session is required.')
  const response = await transport(new URL('/api/releases/sync', server), {
    method: 'POST',
    redirect: 'error',
    headers: {
      Origin: server.origin,
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok)
    throw new Error(
      `Operator transport refused (${response.status}); inspect before retrying.`,
    )
  return response.json()
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  syncRelease(process.argv.slice(2))
    .then((result) =>
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
    )
    .catch((error: unknown) => {
      if (error instanceof ReleaseSourceError)
        process.stderr.write(`${error.message}\n`)
      process.stderr.write(
        'Release sync failed. Check source grammar and explicit options; inspect persisted state before retrying.\n',
      )
      process.exitCode = 1
    })
}
