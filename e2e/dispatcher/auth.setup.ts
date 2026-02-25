import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, "../.auth/dispatcher.json");

setup("authenticate as dispatcher", async ({ page }) => {
  // If auth state file exists and is recent (< 10 min old), skip login
  if (fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile);
    const ageMs = Date.now() - stats.mtimeMs;
    if (ageMs < 10 * 60 * 1000) {
      const state = JSON.parse(fs.readFileSync(authFile, "utf-8"));
      await page.context().addCookies(state.cookies || []);
      await page.goto("/dispatcher/dashboard");
      try {
        await expect(
          page.getByRole("heading", { name: /Welcome back/i })
        ).toBeVisible({ timeout: 5000 });
        return; // Auth state is still valid
      } catch {
        // Auth state expired, proceed to login
      }
    }
  }

  await page.goto("/login");
  await page.getByLabel("Email address").fill("dispatcher@test.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Handle rate limiting — wait and retry once
  const errorBox = page.getByText("Too many login attempts");
  const dispatcherUrl = page
    .waitForURL("**/dispatcher**", { timeout: 5000 })
    .catch(() => null);

  const result = await Promise.race([
    errorBox.waitFor({ timeout: 5000 }).then(() => "rate-limited" as const),
    dispatcherUrl.then(() => "success" as const),
  ]).catch(() => "success" as const);

  if (result === "rate-limited") {
    await page.waitForTimeout(35000);
    await page.getByRole("button", { name: "Sign in" }).click();
  }

  await page.waitForURL("**/dispatcher**", { timeout: 20000 });

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
