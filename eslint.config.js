//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    // Layering law (docs/SPEC.md §6): all SQL lives in server/repos (catalog is
    // the single stated exception). Client-side layers never see drizzle-orm.
    files: ['src/components/**', 'src/lib/**', 'src/routes/**'],
    ignores: ['src/routes/api/dev/-seed/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'drizzle-orm',
              message:
                'SQL lives in server/repos via the tenant base repository (docs/SPEC.md §6). Call a server function instead.',
            },
          ],
          patterns: [
            {
              group: ['drizzle-orm/*'],
              message:
                'SQL lives in server/repos via the tenant base repository (docs/SPEC.md §6). Call a server function instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Layering law (docs/SPEC.md §6): design-system primitives never reach the
    // server layer. Last so it overrides (and therefore must repeat) the
    // drizzle-orm restriction above — flat config replaces a rule's options
    // wholesale, it does not merge them.
    files: ['src/components/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'drizzle-orm',
              message:
                'SQL lives in server/repos via the tenant base repository (docs/SPEC.md §6). Call a server function instead.',
            },
          ],
          patterns: [
            {
              group: ['#/server/*', '@/server/*', '**/server/*'],
              message:
                'components/ui never imports from server/ (docs/SPEC.md §6). Pass data in as props.',
            },
            {
              group: ['drizzle-orm/*'],
              message:
                'SQL lives in server/repos via the tenant base repository (docs/SPEC.md §6). Call a server function instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // `.claude/workflows/*.js` are Claude Code orchestration scripts: plain JS
    // run against a bespoke global environment (`agent`, `args`, `budget`), not
    // part of the TypeScript project and not shipped.
    //
    // The build and test artefacts are here for a sharper reason: they are not in
    // any tsconfig, so the typed parser rejects every file in them, and one
    // Playwright run is enough to turn `pnpm lint` red on bundled report assets
    // nobody wrote. A gate that breaks itself by being exercised is worse than no
    // gate. These are the same paths .gitignore already refuses to track.
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      '.claude/**',
      // Agent tooling that GitHub's own surfaces read - skills, agent definitions, hooks. Same
      // reason `.claude/**` is here: it is vendored configuration for tools around the project,
      // not application source, and it is not written against this project's tsconfig - so the
      // typed linter cannot parse it and reports every file as a project-membership error.
      '.github/**',
      // Cezar checks out one worktree per run under here; each is a whole second copy of the
      // repository, and linting it from the main checkout is both slow and wrong.
      '.ai/cezar/worktrees/**',
      // Run scratch: transform caches and other artefacts a run writes while it is in flight, so
      // the repo-wide lint goes red for whoever has a cezar run open. Gitignored like the above.
      '.ai/cezar/tmp/**',
      // Same thing one directory up: `om-auto-fix-pr` and friends stage a scratch copy of the
      // repo under `.ai/tmp/<skill>/<run>/`, including a `prettier.config.js` that belongs to
      // no tsconfig. It is gitignored, so it never reaches CI - it just turns `pnpm lint` red
      // on the developer's machine until the directory is deleted, which is the gate failing
      // for a reason that has nothing to do with the change under test.
      '.ai/tmp/**',
      'dist/**',
      'playwright-report/**',
      'blob-report/**',
      'test-results/**',
      '.wrangler/**',
      '.tanstack/**',
      'coverage/**',
    ],
  },
]
