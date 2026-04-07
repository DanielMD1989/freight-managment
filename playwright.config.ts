import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  // CI gets 2 retries for known shared-state flakes (SF-1/SF-3/SF-8 and
  // similar). Local runs stay at 0 so flakes are visible to the developer.
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // CI runs headless; local runs headed for visibility
    headless: !!process.env.CI,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "off",
    launchOptions: {
      // No slowMo in CI — ~3x faster
      slowMo: process.env.CI ? 0 : 500,
    },
  },
  projects: [
    {
      name: "shipper-setup",
      testMatch: /shipper\/auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        storageState: "e2e/.auth/shipper.json",
      },
      dependencies: ["shipper-setup"],
      testIgnore: [
        /\.setup\.ts/,
        /workflow\.spec\.ts/,
        /deep-.*\.spec\.ts/,
        /carrier\//,
        /admin\//,
      ],
    },
    {
      name: "deep",
      use: {
        browserName: "chromium",
        storageState: "e2e/.auth/shipper.json",
      },
      dependencies: ["shipper-setup"],
      testMatch: /shipper\/deep-.*\.spec\.ts/,
    },
    {
      name: "workflow",
      use: {
        browserName: "chromium",
      },
      testMatch: /workflow\.spec\.ts/,
    },
    {
      name: "carrier-setup",
      testMatch: /carrier\/auth\.setup\.ts/,
    },
    {
      name: "carrier-deep",
      use: {
        browserName: "chromium",
        storageState: "e2e/.auth/carrier.json",
      },
      dependencies: ["carrier-setup"],
      testMatch: /carrier\/deep-.*\.spec\.ts/,
    },
    {
      name: "carrier-workflow",
      use: {
        browserName: "chromium",
      },
      testMatch: /carrier\/workflow\.spec\.ts/,
    },
    {
      name: "admin-setup",
      testMatch: /admin\/auth\.setup\.ts/,
      // carrier-workflow dependency removed: it's a multi-step lifecycle
      // test that's fragile against shared seed state. admin-setup only
      // needs admin login, not the workflow.
      // dependencies: ["carrier-workflow"],
    },
    {
      name: "admin-deep",
      use: {
        browserName: "chromium",
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["admin-setup"],
      testMatch: /admin\/deep-.*\.spec\.ts/,
    },
    {
      name: "dispatcher-setup",
      testMatch: /dispatcher\/auth\.setup\.ts/,
    },
    {
      name: "dispatcher-deep",
      use: {
        browserName: "chromium",
        storageState: "e2e/.auth/dispatcher.json",
      },
      dependencies: ["dispatcher-setup"],
      testMatch: /dispatcher\/deep-.*\.spec\.ts/,
    },
    {
      name: "platform-lifecycle",
      use: {
        browserName: "chromium",
      },
      testMatch: /platform-lifecycle.*\.spec\.ts/,
    },
    {
      name: "mobile-expo",
      use: {
        browserName: "chromium",
        baseURL: "http://localhost:8081",
        viewport: { width: 414, height: 896 },
      },
      // Real Expo web build click-through tests. No setup dependency —
      // each spec logs in fresh against the running Expo dev server.
      testMatch: /mobile\/deep-.*\.spec\.ts/,
    },
  ],
});
