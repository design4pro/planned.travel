import {
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} from 'drizzle-kit/api'
import type { TestProject } from 'vitest/node'

/**
 * The repository harness's DDL (`src/server/repos/__tests__/harness.ts`), generated once per run.
 *
 * It used to be generated inside the harness, cached per module. But every test file gets a fresh
 * module graph, so that cache lasted one file, and each of the ~45 files that build a harness paid
 * for importing drizzle-kit (1.7 s cold) and generating the snapshot again. Here it happens once
 * and reaches the workers through `inject('schemaDdl')`.
 */
async function schemaDdl(): Promise<Array<string>> {
  const { authSchema } = await import('#/server/db/auth-schema')
  const domainSchema = await import('#/server/db/schema')
  return generateSQLiteMigration(
    await generateSQLiteDrizzleJson({}),
    await generateSQLiteDrizzleJson({ ...authSchema, ...domainSchema }),
  )
}

export default async function setup(project: TestProject) {
  project.provide('schemaDdl', await schemaDdl())
  // Watch mode reruns without running this file again, so a schema edit has to be picked up here.
  project.onTestsRerun(async () => {
    project.provide('schemaDdl', await schemaDdl())
  })
}

declare module 'vitest' {
  export interface ProvidedContext {
    schemaDdl: Array<string>
  }
}
