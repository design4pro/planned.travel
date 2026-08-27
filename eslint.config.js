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
      '.sandcastle/**',
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
