import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "tests/e2e/report" }],
    ["list"],
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...({ viewport: { width: 1280, height: 720 }, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }) },
    },
    {
      name: "mobile-android",
      use: { ...({ viewport: { width: 412, height: 915 }, userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36", isMobile: true, hasTouch: true }) },
    },
  ],
  webServer: [
    {
      command: "cd backend && node server.js",
      port: 5001,
      reuseExistingServer: true,
      timeout: 15000,
    },
    {
      command: "npx vite --port 5173",
      port: 5173,
      reuseExistingServer: true,
      timeout: 15000,
    },
  ],
});
