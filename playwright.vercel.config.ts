import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/vercel",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["junit", { outputFile: "playwright-vercel-results.xml" }]],
  use: {
    baseURL: "https://playfunded-gamma.vercel.app",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
