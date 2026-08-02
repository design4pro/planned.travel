import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "uniwind-types.d.ts"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
