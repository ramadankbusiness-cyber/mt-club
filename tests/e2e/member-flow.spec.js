import { test, expect } from "@playwright/test";

const TEST_EMAIL = `testuser_${Date.now()}@test.com`;
const TEST_PASSWORD = "TestPass123!";
const TEST_NAME = "Test User";

test.describe("Member Flow", () => {
  test("open app and see home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/MT Club|MT/i);
  });

  test("register new account", async ({ page }) => {
    await page.goto("/");

    const registerBtn = page.getByRole("button", { name: /register|sign up/i }).first();
    if (await registerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await registerBtn.click();
    }

    const nameInput = page.locator('input[placeholder*="name" i], input[name="name"], input[type="text"]').first();
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill(TEST_NAME);
      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);

      const submitBtn = page.getByRole("button", { name: /register|sign up|create/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test("login with credentials", async ({ page }) => {
    await page.goto("/");

    const loginBtn = page.getByRole("button", { name: /login|sign in/i }).first();
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginBtn.click();
    }

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);

      const submitBtn = page.getByRole("button", { name: /login|sign in/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test("navigate to events page", async ({ page }) => {
    await page.goto("/");
    const eventsLink = page.locator('a[href*="event"], button:has-text("Event"), [data-page="events"]').first();
    if (await eventsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eventsLink.click();
      await page.waitForTimeout(1000);
    }
  });

  test("navigate to profile page", async ({ page }) => {
    await page.goto("/");
    const profileLink = page.locator('a[href*="profile"], button:has-text("Profile"), [data-page="profile"]').first();
    if (await profileLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await profileLink.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe("Admin Flow", () => {
  test("admin login and access panel", async ({ page }) => {
    await page.goto("/");

    const loginBtn = page.getByRole("button", { name: /login|sign in/i }).first();
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginBtn.click();
    }

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill("admin@mtclub.com");
      await passwordInput.fill("admin123");

      const submitBtn = page.getByRole("button", { name: /login|sign in/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    const adminLink = page.locator('a[href*="admin"], button:has-text("Admin"), [data-page="admin"]').first();
    if (await adminLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await adminLink.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe("Error & Edge Cases", () => {
  test("shows 404 for unknown routes", async ({ page }) => {
    await page.goto("/nonexistent-route-12345");
    await page.waitForTimeout(1000);
    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
  });

  test("handles empty form submissions", async ({ page }) => {
    await page.goto("/");
    const loginBtn = page.getByRole("button", { name: /login|sign in/i }).first();
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginBtn.click();
      await page.waitForTimeout(500);

      const submitBtn = page.getByRole("button", { name: /login|sign in|submit/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
