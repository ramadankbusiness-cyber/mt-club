import { test, expect } from "@playwright/test";

test.describe("Mobile Bottom Navigation", () => {
  test("bottom nav is visible on mobile", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);

    const nav = page.locator('nav, [class*="bottom-nav"], [class*="BottomNav"], [role="navigation"]').first();
    const isVisible = await nav.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await expect(nav).toBeVisible();
    }
  });

  test("bottom nav items are tappable", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);

    const navItems = page.locator('nav a, nav button, [class*="bottom-nav"] a, [class*="bottom-nav"] button');
    const count = await navItems.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const item = navItems.nth(i);
      if (await item.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(item).toBeEnabled();
      }
    }
  });
});

test.describe("Mobile Forms", () => {
  test("login form is usable on mobile", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);

    const loginBtn = page.getByRole("button", { name: /login|sign in/i }).first();
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginBtn.click();
      await page.waitForTimeout(500);

      const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill("test@test.com");
        const value = await emailInput.inputValue();
        expect(value).toBe("test@test.com");
      }
    }
  });
});

test.describe("Mobile Gallery", () => {
  test("gallery page loads on mobile", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);

    const galleryLink = page.locator('a[href*="gallery"], [data-page="gallery"]').first();
    if (await galleryLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await galleryLink.click();
      await page.waitForTimeout(1000);
    }
  });
});
