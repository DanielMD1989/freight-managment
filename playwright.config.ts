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
      testIgnore: [/\.setup\.ts/, /workflow\.spec\.ts/],
    },
    {
      name: "workflow",
      use: {
        browserName: "chromium",
      },
      testMatch: /workflow\.spec\.ts/,
    },
  ],
});
