import { defineConfig } from "vitest/config";

// Pure domain logic lives in @planned/shared; run these in node (no DOM/Worker).
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
