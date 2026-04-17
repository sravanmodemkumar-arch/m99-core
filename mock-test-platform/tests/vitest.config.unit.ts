import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name:        "unit",
    include:     ["unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include:  ["../modules/exam-engine/fe/shared/*.ts"],
    },
  },
});
