// Flat-config ESLint for the web workspace. Scope for launch: lint the TS/TSX
// (where logic bugs live). .astro files are ignored here until eslint-plugin-astro
// is added (mostly markup + already type-checked by `astro check`). Re-enable by
// installing eslint-plugin-astro + astro-eslint-parser and a `.astro` block.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".astro/**",
      ".wrangler/**",
      "node_modules/**",
      "migrations/**",
      "eslint.config.js",
      "astro.config.mjs",
      // Ambient declaration files use Astro's required triple-slash references
      // (/// <reference path="../.astro/types.d.ts" />) — don't lint them.
      "**/*.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      // Keep the gate functional without a large one-off cleanup. The TS
      // compiler + astro check already cover types; eslint here catches the
      // rest (dead code, foot-guns). Loosen the noisiest rules for launch.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // Test mocks (e.g. FakeDb) legitimately alias `this` to capture the
    // instance inside returned builder objects.
    files: ["test/**"],
    rules: {
      "@typescript-eslint/no-this-alias": "off",
    },
  },
);
