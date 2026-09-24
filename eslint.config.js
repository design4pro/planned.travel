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
    // Untyped on purpose. The TanStack preset sets `parserOptions.project: true`, which makes
    // eslint build a whole second TypeScript program next to the one `pnpm typecheck` builds in
    // the same gate - measured on the 4-vCPU VPS, 101 s and 2.2 GB RSS per run, with several
    // gates running side by side. Only the three rules below read type information; type-level
    // checks belong to `tsc`. Without it a file's verdict depends on its own bytes alone, which is
    // what makes `--cache` in the `lint` script sound.
    languageOptions: { parserOptions: { project: false } },
    rules: {
      '@typescript-eslint/no-for-in-array': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
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
      // Ignored one level at a time, and not with `'.claude/**'` plus a negation: these are
      // gitignore semantics, so a path inside an excluded *directory* can never be re-included -
      // the directory is pruned before the negation is read. Verified by observation; the
      // shorter form silently ignores the tests below.
      '.claude/*',
      '!.claude/hooks',
      '.claude/hooks/*',
      // The hook tests are the carve-out. The rationale for the rest of this tree is that it is
      // not written against the project's tsconfig - which stopped being true of them when they
      // moved here, because `tsconfig.json` now names the path. Without this they left `pnpm
      // lint` and Prettier on the way in, which their old location had them under.
      '!.claude/hooks/__tests__',
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
      // The dispatch channel a dispatched task tree writes through, the composer's attachments and
      // unsent drafts, and the per-run transcripts and handoffs. Cezar's own ensureDataGitignore
      // refuses to track all four, and a gitignored directory this list does not name is the #203
      // failure waiting for its first `.ts` file: red on the machine that wrote it, pointing at
      // `parserOptions.project`. `attachments/` is the one that needs no waiting - what lands
      // there is whatever a human dropped into the composer. With these the list names every
      // directory `.ai/cezar/.gitignore` refuses; the rest of that file is single files, which
      // the typed parser never reaches.
      '.ai/cezar/dispatch/**',
      '.ai/cezar/attachments/**',
      '.ai/cezar/drafts/**',
      '.ai/cezar/runs/**',
      // Same thing one directory up: `om-auto-fix-pr` and friends stage a scratch copy of the
      // repo under `.ai/tmp/<skill>/<run>/`, including a `prettier.config.js` that belongs to
      // no tsconfig. It is gitignored, so it never reaches CI - it just turns `pnpm lint` red
      // on the developer's machine until the directory is deleted, which is the gate failing
      // for a reason that has nothing to do with the change under test.
      '.ai/tmp/**',
      // The UI QA rounds' own scratch, one per run: `om-auto-qa-pr` writes its throwaway browser
      // specs there by instruction (`.ai/browsers/playwright.md`), along with the config driving
      // them, and neither belongs to any tsconfig. Gitignored like the two above, and red for the
      // same non-reason. Only the `artifacts_*` directories, so the shared
      // `.ai/qa/playwright.config.ts` the same descriptor writes for a repo with no Playwright
      // config of its own stays linted - this repo has one, in the root, so it is never written.
      // `.ai/qa` is the default `paths.qa` and is spelled out here the way `.gitignore` spells it
      // out: move it in `.ai/agentic.config.json` and this goes stale, but the gitignore entry
      // goes stale first and louder, with the artefacts turning up in `git status`.
      '.ai/qa/artifacts_*/**',
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
