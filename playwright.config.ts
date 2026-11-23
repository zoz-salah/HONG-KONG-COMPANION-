import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 100000,
  use: {
    baseURL: process.env.HK_TEST_URL ?? "http://127.0.0.1:4380",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
    headless: true,
    actionTimeout: 10000,
  },
  reporter: "list",
});
