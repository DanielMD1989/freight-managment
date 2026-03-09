import { defineConfig } from "@playwright/test";

export default defineConfig({
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report-blueprint" }],
    ["list"],
  ],
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "off",
  },
  projects: [
    // ── Setup: authenticate each role (reuses existing auth.setup.ts files) ─────

    {
      name: "bp-shipper-setup",
      testDir: "./e2e",
      testMatch: /shipper\/auth\.setup\.ts/,
    },
    {
      name: "bp-carrier-setup",
      testDir: "./e2e",
      testMatch: /carrier\/auth\.setup\.ts/,
    },
    {
      name: "bp-dispatcher-setup",
      testDir: "./e2e",
      testMatch: /dispatcher\/auth\.setup\.ts/,
    },
    {
      name: "bp-admin-setup",
      testDir: "./e2e",
      testMatch: /admin\/auth\.setup\.ts/,
      // admin-setup does NOT depend on carrier-workflow (unlike original config)
    },

    // ── Blueprint spec project ────────────────────────────────────────────────

    {
      name: "blueprint",
      testDir: "./tests/e2e",
      use: {
        browserName: "chromium",
      },
      dependencies: [
        "bp-shipper-setup",
        "bp-carrier-setup",
        "bp-dispatcher-setup",
        "bp-admin-setup",
      ],
    },
  ],
});
