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
