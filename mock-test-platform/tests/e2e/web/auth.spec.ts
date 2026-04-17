import { test, expect, Page } from "@playwright/test";

const AUTH_BASE   = "/auth/fe/web";
const LOGIN_URL   = `${AUTH_BASE}/login.html`;
const HOME_URL    = `${AUTH_BASE}/home.html`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fillLogin(page: Page, email: string, password: string) {
  await page.fill('[name="email"], #email, input[type="email"]', email);
  await page.fill('[name="password"], #password, input[type="password"]', password);
  await page.click('button[type="submit"], .btn-primary');
}

async function seedToken(page: Page, token = "test-valid-token") {
  await page.evaluate((t) => {
    localStorage.setItem("auth_token", t);
    localStorage.setItem("name", "Test User");
  }, token);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Auth — Login", () => {
  test("login page renders input fields", async ({ page }) => {
    await page.goto(LOGIN_URL);
    await expect(page.locator('input[type="email"], #email')).toBeVisible();
    await expect(page.locator('input[type="password"], #password')).toBeVisible();
    await expect(page.locator('button[type="submit"], .btn-primary')).toBeVisible();
  });

  test("wrong credentials shows error message", async ({ page }) => {
    await page.goto(LOGIN_URL);
    await fillLogin(page, "wrong@example.com", "badpassword");
    // Error should appear — either an alert or an inline error div
    const errorVisible = await Promise.race([
      page.locator(".error, .alert-error, [role='alert'], #error-msg").waitFor({ state: "visible", timeout: 5000 }).then(() => true),
      page.waitForEvent("dialog").then(async (d) => { await d.dismiss(); return true; }),
    ]).catch(() => false);
    expect(errorVisible).toBe(true);
  });

  test("correct credentials stores token in localStorage", async ({ page }) => {
    await page.goto(LOGIN_URL);
    // Mock the auth API response
    await page.route("**/auth/login", async (route) => {
      await route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ token: "mock-jwt-token", name: "Alice", uid: "uid_alice" }),
      });
    });
    await fillLogin(page, "alice@example.com", "password123");
    await page.waitForURL(/home|dashboard/);
    const token = await page.evaluate(() => localStorage.getItem("auth_token"));
    expect(token).toBeTruthy();
  });

  test("logout removes token and redirects to login", async ({ page }) => {
    await page.goto(HOME_URL);
    await seedToken(page);
    await page.reload();
    await page.click('#logout-btn, [data-action="logout"], button:has-text("Logout")');
    await page.waitForURL(/login/);
    const token = await page.evaluate(() => localStorage.getItem("auth_token"));
    expect(token).toBeNull();
  });

  test("protected page without token redirects to login", async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem("auth_token"));
    await page.goto(HOME_URL);
    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Auth — Register", () => {
  const REG1_URL = `${AUTH_BASE}/register-1.html`;

  test("register step 1 shows name + email fields", async ({ page }) => {
    await page.goto(REG1_URL);
    await expect(page.locator('input[name="name"], #name')).toBeVisible();
    await expect(page.locator('input[type="email"], #email')).toBeVisible();
  });

  test("duplicate email shows error on step 1", async ({ page }) => {
    await page.goto(REG1_URL);
    await page.route("**/auth/register*", async (route) => {
      await route.fulfill({
        status:      409,
        contentType: "application/json",
        body:        JSON.stringify({ error: "Email already registered" }),
      });
    });
    await page.fill('input[name="name"], #name', "Alice");
    await page.fill('input[type="email"], #email', "alice@example.com");
    await page.click('button[type="submit"], .btn-primary');
    const err = page.locator(".error, .alert-error, [role='alert'], #error-msg");
    await expect(err).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Auth — Desktop layout", () => {
  test("two-column layout visible at 1200px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(LOGIN_URL);
    const aside = page.locator(".auth-layout-aside");
    await expect(aside).toBeVisible();
  });

  test("single column on mobile (375px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(LOGIN_URL);
    const aside = page.locator(".auth-layout-aside");
    // On mobile the aside should either be hidden or not overlap main
    const box = await aside.boundingBox().catch(() => null);
    if (box) expect(box.width).toBe(0);
  });
});
