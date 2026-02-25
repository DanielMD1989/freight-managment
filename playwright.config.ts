import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "off",
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
      dependencies: ["carrier-workflow"],
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
  ],
});
