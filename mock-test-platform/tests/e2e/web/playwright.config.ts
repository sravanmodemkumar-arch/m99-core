import { defineConfig, devices } from "@playwright/test";

/**
 * Requires two local servers before running:
 *   1. wrangler dev (CF workers on :8787)
 *   2. npx serve modules/ (static HTML on :3000)
 *
 * Run: npm run test:web
 */
export default defineConfig({
  testDir:     ".",
  timeout:     30_000,
  retries:     1,
  workers:     1,          // single worker — tests share auth state

  use: {
    baseURL:         "http://localhost:3000",
    extraHTTPHeaders: { "x-test-mode": "1" },
    screenshot:      "only-on-failure",
    video:           "retain-on-failure",
    trace:           "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox",  use: { ...devices["Desktop Firefox"] } },
    { name: "webkit",   use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile-chrome",
      use:  { ...devices["Pixel 5"] },
    },
  ],

  webServer: [
    {
      command:              "npx wrangler dev --port 8787",
      port:                 8787,
      reuseExistingServer:  !process.env.CI,
      timeout:              30_000,
    },
    {
      command:              "npx serve ../../modules --port 3000",
      port:                 3000,
      reuseExistingServer:  !process.env.CI,
      timeout:              10_000,
    },
  ],
});
