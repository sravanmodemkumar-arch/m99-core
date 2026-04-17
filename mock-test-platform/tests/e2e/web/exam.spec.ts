import { test, expect, Page } from "@playwright/test";

const EXAM_URL   = "/rrb-group-d/fe/web/exam.html?exam_id=rrb-test-exam";
const RESULT_URL = "/rrb-group-d/fe/web/result.html";
const HOME_URL   = "/rrb-group-d/fe/web/home.html";

// ── Exam API mock responses ───────────────────────────────────────────────────

const MOCK_BUNDLE = {
  session_id:  "sess_test_001",
  exam_id:     "rrb-test-exam",
  duration_s:  300,
  started_at:  Date.now(),
  sections:    [
    { id: "math",    label: "Mathematics", count: 2 },
    { id: "science", label: "Science",     count: 2 },
  ],
  questions: [
    { id: "m1", section: "math",    text: "What is 2+2?",         options: [{ key: "A", text: "4" }, { key: "B", text: "3" }, { key: "C", text: "5" }, { key: "D", text: "6" }] },
    { id: "m2", section: "math",    text: "What is 3×3?",         options: [{ key: "A", text: "6" }, { key: "B", text: "9" }, { key: "C", text: "12" }, { key: "D", text: "8" }] },
    { id: "s1", section: "science", text: "Symbol of Gold?",      options: [{ key: "A", text: "Go" }, { key: "B", text: "Au" }, { key: "C", text: "Ag" }, { key: "D", text: "Fe" }] },
    { id: "s2", section: "science", text: "Speed of light unit?", options: [{ key: "A", text: "m/s" }, { key: "B", text: "km" }, { key: "C", text: "Hz" }, { key: "D", text: "W" }] },
  ],
};

const MOCK_SUBMIT_RESPONSE = {
  answer_key: { m1: "A", m2: "B", s1: "B", s2: "A" },
  result: { score: 3, correct: 3, wrong: 1, skipped: 0, total_qs: 4 },
};

async function mockExamAPIs(page: Page, opts: { timerDuration?: number } = {}) {
  const bundle = { ...MOCK_BUNDLE, duration_s: opts.timerDuration ?? 300 };

  await page.route("**/rrb/exam/start", async (route) => {
    await route.fulfill({
      status:      200,
      contentType: "application/json",
      body:        JSON.stringify({
        session_id: "sess_test_001",
        bundle_url: "/rrb/bundle/test-bundle.json",
        duration_s: bundle.duration_s,
        started_at: Date.now(),
        elapsed_s:  0,
        resumed:    false,
      }),
    });
  });

  await page.route("**/rrb/bundle/**", async (route) => {
    await route.fulfill({
      status:      200,
      contentType: "application/json",
      body:        JSON.stringify(bundle),
    });
  });

  await page.route("**/rrb/exam/sync", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });

  await page.route("**/rrb/exam/submit", async (route) => {
    await route.fulfill({
      status:      200,
      contentType: "application/json",
      body:        JSON.stringify(MOCK_SUBMIT_RESPONSE),
    });
  });
}

async function seedAuthToken(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem("auth_token", "test-token-alice");
    localStorage.setItem("name", "Alice");
  });
}

async function loadExam(page: Page, timerDuration?: number) {
  await page.goto(EXAM_URL);
  await seedAuthToken(page);
  await mockExamAPIs(page, { timerDuration });
  await page.reload();
  // Wait for loading spinner to disappear
  await page.waitForSelector("#loading-wrap", { state: "hidden", timeout: 10000 });
  await expect(page.locator("#exam-shell")).toBeVisible();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Exam — Load", () => {
  test("loading spinner shows then hides when exam loads", async ({ page }) => {
    await page.goto(EXAM_URL);
    await seedAuthToken(page);
    await mockExamAPIs(page);
    await page.reload();
    await expect(page.locator("#loading-wrap")).toBeVisible();
    await page.waitForSelector("#loading-wrap", { state: "hidden", timeout: 10000 });
    await expect(page.locator("#exam-shell")).toBeVisible();
  });

  test("exam title visible in header", async ({ page }) => {
    await loadExam(page);
    await expect(page.locator("#exam-title")).toBeVisible();
  });

  test("timer starts counting down from duration", async ({ page }) => {
    await loadExam(page);
    const timerEl = page.locator("#exam-timer");
    await expect(timerEl).toBeVisible();
    const text = await timerEl.textContent();
    expect(text).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  test("section tabs render for each section", async ({ page }) => {
    await loadExam(page);
    const tabs = page.locator("#section-tabs [data-section], #section-tabs button, #section-tabs .section-tab");
    await expect(tabs.first()).toBeVisible();
  });

  test("first question rendered in question-area", async ({ page }) => {
    await loadExam(page);
    await expect(page.locator("#question-area")).not.toBeEmpty();
    await expect(page.locator("#question-area")).toContainText("2+2");
  });
});

test.describe("Exam — Question interaction", () => {
  test("selecting an option reflects in the palette (answered state)", async ({ page }) => {
    await loadExam(page);
    // Click first option in the question
    await page.click("#question-area button:first-child, #question-area [onclick*='__selectOption']:first-child");
    // Palette should show at least one answered (green) button
    await expect(page.locator(".q-answered, [data-status='answered']").first()).toBeVisible({ timeout: 3000 });
  });

  test("Save & Next navigates to next question", async ({ page }) => {
    await loadExam(page);
    const before = await page.locator("#question-area").textContent();
    await page.click("#action-bar [onclick*='__saveAndNext'], #action-bar button:last-child");
    const after = await page.locator("#question-area").textContent();
    expect(after).not.toBe(before);
  });

  test("Clear button removes selected answer", async ({ page }) => {
    await loadExam(page);
    // Select an option
    await page.click("#question-area button:first-child, #question-area [onclick*='__selectOption']:first-child");
    // Click Clear
    await page.click("#action-bar [onclick*='__clearOption'], #action-bar button:first-child");
    // Palette should not show answered
    const answered = await page.locator(".q-answered").count();
    expect(answered).toBe(0);
  });

  test("Mark button changes palette to marked state", async ({ page }) => {
    await loadExam(page);
    // Click Mark
    await page.click("#action-bar [onclick*='__toggleMark'], #action-bar button:nth-child(2)");
    await expect(page.locator(".q-marked, .q-marked-review, [data-status='marked_review']").first()).toBeVisible({ timeout: 3000 });
  });

  test("section tab switch navigates to first question of that section", async ({ page }) => {
    await loadExam(page);
    // Click the second section tab
    await page.click("#section-tabs button:nth-child(2), #section-tabs [onclick*='science']:first-child");
    await expect(page.locator("#question-area")).toContainText(/Gold|light/);
  });
});

test.describe("Exam — Submit flow", () => {
  test("Submit button opens confirmation modal", async ({ page }) => {
    await loadExam(page);
    // Navigate to last question (question 4) and trigger submit
    await page.evaluate(() => { window.__submitExam(); });
    await expect(page.locator("#submit-overlay")).toHaveClass(/open/);
    await expect(page.locator(".submit-modal-title")).toBeVisible();
  });

  test("cancel submit closes modal", async ({ page }) => {
    await loadExam(page);
    await page.evaluate(() => { window.__submitExam(); });
    await expect(page.locator("#submit-overlay")).toHaveClass(/open/);
    await page.click(".submit-modal button:first-child, button:has-text('Go Back')");
    await expect(page.locator("#submit-overlay")).not.toHaveClass(/open/);
  });

  test("confirm submit navigates to result page", async ({ page }) => {
    await loadExam(page);
    await page.evaluate(() => { window.__submitExam(); });
    await page.click("#confirm-submit-btn");
    await page.waitForURL(/result\.html/, { timeout: 10000 });
  });

  test("modal summary shows correct answered/skipped counts", async ({ page }) => {
    await loadExam(page);
    // Answer 2 questions
    await page.click("#question-area [onclick*='__selectOption']:first-child");
    await page.click("#action-bar [onclick*='__saveAndNext']:first-child, #action-bar button:last-child");
    await page.click("#question-area [onclick*='__selectOption']:first-child");
    // Open submit modal
    await page.evaluate(() => { window.__submitExam(); });
    const summary = await page.locator("#modal-summary").textContent();
    expect(summary).toMatch(/[12]/); // at least 1 answered shown
  });
});

test.describe("Exam — Timer", () => {
  test("timer shows warning color when < 5 minutes remaining", async ({ page }) => {
    // Load exam with only 290s (< 300s warn threshold)
    await loadExam(page, 290);
    // Advance timer by 1s — should immediately be in warning zone
    await page.waitForTimeout(1500);
    await expect(page.locator("#exam-timer.timer-warn, #exam-timer[class*='warn']")).toBeVisible({ timeout: 5000 });
  });

  test("timer format is HH:MM:SS", async ({ page }) => {
    await loadExam(page);
    const text = await page.locator("#exam-timer").textContent();
    expect(text?.trim()).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

test.describe("Exam — Mobile palette drawer", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("Questions button is visible on mobile", async ({ page }) => {
    await loadExam(page);
    await expect(page.locator("#mobile-palette-btn")).toBeVisible();
  });

  test("tapping Questions button opens palette drawer", async ({ page }) => {
    await loadExam(page);
    await page.click("#mobile-palette-btn");
    await expect(page.locator("#palette-drawer")).toHaveClass(/open/);
  });

  test("backdrop click closes palette drawer", async ({ page }) => {
    await loadExam(page);
    await page.click("#mobile-palette-btn");
    await page.click("#palette-backdrop");
    await expect(page.locator("#palette-drawer")).not.toHaveClass(/open/);
  });
});

test.describe("Exam — Tablet layout", () => {
  test.use({ viewport: { width: 900, height: 768 } });

  test("sidebar palette visible on tablet (≥768px)", async ({ page }) => {
    await loadExam(page);
    await expect(page.locator("#sidebar-col")).toBeVisible();
    await expect(page.locator("#mobile-palette-btn")).toBeHidden();
  });
});

test.describe("Exam — Resume", () => {
  test("checkpoint restored on page reload (local storage)", async ({ page }) => {
    await loadExam(page);
    // Answer first question
    await page.click("#question-area [onclick*='__selectOption']:first-child");
    // Wait for the auto-sync to write to localStorage
    await page.waitForTimeout(500);

    // Mock resume scenario
    await page.route("**/rrb/exam/start", async (route) => {
      await route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({
          session_id:  "sess_test_001",
          bundle_url:  "/rrb/bundle/test-bundle.json",
          duration_s:  300,
          started_at:  Date.now() - 60000,
          elapsed_s:   60,
          resumed:     true,
          checkpoint:  { m1: { chosen: "A", attempted: true } },
        }),
      });
    });

    await page.reload();
    await page.waitForSelector("#loading-wrap", { state: "hidden", timeout: 10000 });
    // First question should show as answered in palette
    await expect(page.locator(".q-answered, [data-status='answered']").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Home page", () => {
  test("exam grid renders exam cards", async ({ page }) => {
    await page.goto(HOME_URL);
    await page.evaluate(() => {
      localStorage.setItem("auth_token", "test-token");
      localStorage.setItem("name", "Alice");
    });
    await page.route("**/rrb/exams", async (route) => {
      await route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ exams: [
          { id: "rrb-gd-1", title: "RRB Full Mock Test 1", type: "full", total_qs: 100, duration_s: 5400 },
        ]}),
      });
    });
    await page.reload();
    await expect(page.locator(".exam-card").first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator(".exam-card").first()).toContainText("RRB Full Mock Test 1");
  });

  test("Start Test button navigates to exam page", async ({ page }) => {
    await page.goto(HOME_URL);
    await page.evaluate(() => { localStorage.setItem("auth_token", "test"); });
    await page.route("**/rrb/exams", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ exams: [{ id: "rrb-gd-1", title: "Test 1", type: "full", total_qs: 100, duration_s: 5400 }] }),
      });
    });
    await page.reload();
    await page.click(".exam-card button.btn-primary, .exam-card [onclick*='startExam']");
    await expect(page).toHaveURL(/exam\.html/);
  });
});
