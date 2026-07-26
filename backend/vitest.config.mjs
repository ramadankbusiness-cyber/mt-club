import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      JWT_SECRET: "MTCLUB_SECRET",
    },
    include: ["tests/**/*.{test,spec}.{js,mjs}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["routes/**/*.js", "middleware/**/*.js", "utils/**/*.js"],
      exclude: ["tests/**", "config/**", "seed.js"],
      thresholds: {
        statements: 25,
        branches: 18,
        functions: 25,
        lines: 28,
      },
    },
  },
});
