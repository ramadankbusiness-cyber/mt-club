import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/frontend/setup.js"],
    include: ["tests/frontend/**/*.{test,spec}.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json", "html"],
      reportsDirectory: "./coverage/frontend",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/**/*.css"],
      thresholds: {
        statements: 5,
        branches: 3,
        functions: 5,
        lines: 5,
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
