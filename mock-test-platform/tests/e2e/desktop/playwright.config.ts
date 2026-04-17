import { defineConfig } from "@playwright/test";

/**
 * Desktop E2E requires Electron installed.
 * Run: npm run test:desktop
 *
 * Each test uses _electron.launch() targeting the exam-engine desktop app.
 * Requires: npm install in modules/exam-engine/fe/desktop before running.
 */
export default defineConfig({
  testDir:  ".",
  timeout:  40_000,
  retries:  1,
  workers:  1,

  use: {
    screenshot: "only-on-failure",
    video:      "retain-on-failure",
    trace:      "retain-on-failure",
  },
});
