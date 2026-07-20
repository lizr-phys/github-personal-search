import { defineConfig, devices } from "@playwright/test";

const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: testBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev --port 3100",
    url: `${testBaseUrl}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      GPS_DEMO_MODE: "true",
      GPS_RUNTIME_STORE: "memory",
      GPS_ENABLE_TEST_RESET: "true",
      APP_URL: "http://127.0.0.1:3100",
      SESSION_SECRET: "playwright-session-secret-at-least-32-characters",
    },
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    { name: "edge", use: { ...devices["Desktop Chrome"], channel: "msedge" } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "safari", use: { ...devices["Desktop Safari"] } },
    { name: "android-chrome", use: { ...devices["Pixel 5"] } },
    { name: "ios-safari", use: { ...devices["iPhone 13"] } },
  ],
});
