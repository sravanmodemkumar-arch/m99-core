import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name:        "integration",
    include:     ["integration/**/*.test.ts"],
    environment: "node",
    setupFiles:  ["integration/setup.ts"],
    testTimeout: 15000,
  },
});
