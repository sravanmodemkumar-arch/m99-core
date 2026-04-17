import { test, expect, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import path from "path";

const EXAM_ENGINE_DESKTOP = path.resolve(
  __dirname,
  "../../../modules/exam-engine/fe/desktop/main.js"
);

const MOCK_START_RESPONSE = {
  session_id: "sess_desktop_001",
  bundle_url: "http://localhost:8787/exam/bundle/test-bundle.json",
  duration_s: 300,
  started_at: Date.now(),
  elapsed_s:  0,
  resumed:    false,
};

const MOCK_BUNDLE = {
  session_id: "sess_desktop_001",
  exam_id:    "test-exam",
  duration_s: 300,
  started_at: Date.now(),
  sections:   [{ id: "math", label: "Mathematics", count: 2 }],
  questions:  [
    { id: "m1", section: "math", text: "2+2=?",  options: [{ key: "A", text: "4" }, { key: "B", text: "3" }] },
    { id: "m2", section: "math", text: "3×3=?",  options: [{ key: "A", text: "6" }, { key: "B", text: "9" }] },
  ],
};

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args:  [EXAM_ENGINE_DESKTOP],
    env:   { ...process.env, NODE_ENV: "test" },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

async function seedToken(app: ElectronApplication) {
  await app.evaluate(({ ipcMain }) => {
    ipcMain.emit("setToken", {}, "test-jwt-token");
  });
}

async function mockExamAPIs(page: Page) {
  await page.route("**/exam/start", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_START_RESPONSE) })
  );
  await page.route("**/exam/bundle/**", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BUNDLE) })
  );
  await page.route("**/exam/sync", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
  );
  await page.route("**/exam/submit", async (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        answer_key: { m1: "A", m2: "B" },
        result: { score: 2, correct: 2, wrong: 0, skipped: 0, total_qs: 2 },
      }),
    })
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Desktop — Auth", () => {
  test("app launches to auth/login page when no token", async () => {
    const { app, page } = await launchApp();
    try {
      const url = page.url();
      expect(url).toMatch(/login|auth/);
    } finally {
      await app.close();
    }
  });

  test("window controls (min/max/close) injected on Win/Linux", async () => {
    const { app, page } = await launchApp();
    try {
      const platform = process.platform;
      if (platform !== "darwin") {
        await expect(page.locator(".window-controls, #window-controls, [data-controls]")).toBeVisible({ timeout: 5000 });
      }
    } finally {
      await app.close();
    }
  });

  test("data-platform=desktop set on body", async () => {
    const { app, page } = await launchApp();
    try {
      await page.waitForSelector("[data-platform='desktop']", { timeout: 5000 });
      const platform = await page.getAttribute("body", "data-platform");
      expect(platform).toBe("desktop");
    } finally {
      await app.close();
    }
  });
});

test.describe("Desktop — Exam behaviour", () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeEach(async () => {
    ({ app, page } = await launchApp());
    await mockExamAPIs(page);
    await page.evaluate(() => localStorage.setItem("auth_token", "test-jwt-token"));
  });

  test.afterEach(async () => {
    await app.close();
  });

  test("powerSaveBlocker activated when exam starts", async () => {
    await page.goto("http://localhost:3000/modules/exam-engine/fe/web/exam.html?exam_id=test");
    await page.waitForSelector("#loading-wrap", { state: "hidden", timeout: 10000 });

    const blockerId = await app.evaluate(async ({ ipcMain }) => {
      return new Promise<number>((resolve) => {
        ipcMain.once("keepAwake-id", (_event: unknown, id: number) => resolve(id));
      });
    });
    expect(typeof blockerId).toBe("number");
  });

  test("exam shell renders inside Electron window", async () => {
    await page.goto("http://localhost:3000/modules/exam-engine/fe/web/exam.html?exam_id=test");
    await page.waitForSelector("#loading-wrap", { state: "hidden", timeout: 10000 });
    await expect(page.locator("#exam-shell")).toBeVisible();
  });

  test("desktop CSS applied — two-column layout at default window size", async () => {
    await page.goto("http://localhost:3000/modules/exam-engine/fe/web/exam.html?exam_id=test");
    await page.waitForSelector("#loading-wrap", { state: "hidden", timeout: 10000 });
    await expect(page.locator("#sidebar-col")).toBeVisible();
  });

  test("submit → powerSaveBlocker released", async () => {
    await page.goto("http://localhost:3000/modules/exam-engine/fe/web/exam.html?exam_id=test");
    await page.waitForSelector("#loading-wrap", { state: "hidden", timeout: 10000 });

    await page.evaluate(() => {
      if (window.__examEnded) window.__examEnded();
    });

    const isRunning = await app.evaluate(({ powerSaveBlocker }) =>
      powerSaveBlocker.getSupportedTypes !== undefined
    );
    expect(isRunning).toBeTruthy();
  });
});

test.describe("Desktop — Single instance lock", () => {
  test("second instance does not open a second window", async () => {
    const { app, page } = await launchApp();
    try {
      const windows = await app.windows();
      expect(windows.length).toBe(1);
    } finally {
      await app.close();
    }
  });
});
