import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name:        "unit",
    include:     ["unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include:  ["../modules/rrb-group-d/fe/shared/*.ts"],
    },
  },
});
