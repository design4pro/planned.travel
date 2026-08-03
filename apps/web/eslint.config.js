// Flat-config ESLint for the TanStack Start web workspace.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".wrangler/**",
      "node_modules/**",
      "migrations/**",
      "eslint.config.js",
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
      // Keep the gate focused on runtime and UI code.
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
