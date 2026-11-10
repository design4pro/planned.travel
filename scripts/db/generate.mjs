import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { releaseVersionTriggers } from './release-version-triggers.mjs'

function runDrizzle(args) {
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, 'exec', 'drizzle-kit', 'generate', ...args],
    { stdio: 'inherit' },
  )
  if (result.error) throw result.error
  return result.status ?? 1
}

/** Add constraints only to a newly generated migration; existing history is verified, never repaired. */
export function generateMigrations(directory, args, run = runDrizzle) {
  const before = new Set(readdirSync(directory))
  const status = run(args)
  if (status !== 0) return status
  const migrations = readdirSync(directory).filter((name) =>
    name.endsWith('.sql'),
  )
  const owners = migrations.filter((name) =>
    /CREATE TABLE [`"]content_versions[`"]/.test(
      readFileSync(join(directory, name), 'utf8'),
    ),
  )
  if (owners.length !== 1)
    throw new Error('Expected one content_versions creation migration.')
  const path = join(directory, owners[0])
  const sql = readFileSync(path, 'utf8')
  const supplement = releaseVersionTriggers.join('\n--> statement-breakpoint\n')
  if (!before.has(owners[0])) {
    writeFileSync(path, `${sql}\n--> statement-breakpoint\n${supplement}\n`)
  } else if (
    !sql.endsWith(`${supplement}\n`) ||
    (sql.match(/CREATE TRIGGER content_versions_no_/g) ?? []).length !== 2
  ) {
    throw new Error(
      'Immutable content version triggers missing or changed; refusing to rewrite migration history.',
    )
  }
  return 0
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  process.exitCode = generateMigrations(
    join(process.cwd(), 'drizzle'),
    process.argv.slice(2),
  )
}
