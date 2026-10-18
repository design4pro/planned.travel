import { modulesUnder } from '#/server/catalog/__tests__/module-graph'
import { resolve } from 'node:path'
import { API } from 'typescript/unstable/sync'
import type { Project } from 'typescript/unstable/sync'

/**
 * Loads `src/**` into the TypeScript compiler, plus the `extra` files given as path to source, and
 * runs `run` on the resulting project. A structural test resolves symbols through it, so an alias
 * or a barrel keeps its provenance where a grep would lose it.
 */
export function withProgram<T>(
  extra: Record<string, string>,
  run: (project: Project) => T,
): T {
  const files = {
    ...extra,
    [resolve('tsconfig.json')]: JSON.stringify({
      compilerOptions: {
        target: 'es2022',
        module: 'esnext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        skipLibCheck: true,
        paths: { '#/*': ['./src/*'], '@/*': ['./src/*'] },
      },
      files: [
        ...modulesUnder(resolve('src'), { tests: false }),
        ...Object.keys(extra),
      ],
      include: [],
    }),
  }
  const api = new API({
    fs: {
      readFile: (path) => files[path],
      fileExists: (path) => (path in files ? true : undefined),
    },
  })
  const snapshot = api.updateSnapshot({
    openProjects: [resolve('tsconfig.json')],
    openFiles: Object.keys(extra),
  })
  try {
    const project = snapshot.getProject(resolve('tsconfig.json'))
    if (!project) throw new Error('Compiler did not load project')
    return run(project)
  } finally {
    snapshot.dispose()
    api.close()
  }
}
