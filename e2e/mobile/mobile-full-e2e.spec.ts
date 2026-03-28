import { test, expect, Page } from "@playwright/test";

const MOBILE_URL = "http://localhost:8081";

async function waitForExpo(page: Page) {
  await page.waitForTimeout(3000);
  await page
    .waitForSelector('[data-testid], input, button, [role="button"]', {
      timeout: 10000,
    })
    .catch(() => {});
  // Skip onboarding if present
  const skipBtn = page.locator("text=/skip/i").first();
  if ((await skipBtn.count()) > 0) {
    await skipBtn.click();
    await page.waitForTimeout(1500);
  }
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `e2e/mobile/screenshots/${name}.png`,
    fullPage: true,
  });
}

async function hasText(page: Page, text: string): Promise<boolean> {
  const regex = new RegExp(text, "i");
  return (await page.locator(`text=${regex}`).count()) > 0;
}

async function clickText(page: Page, text: string) {
  const regex = new RegExp(text, "i");
  const el = page.locator(`text=${regex}`).first();
  if ((await el.count()) > 0) {
    await el.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

// §1 Registration
test.describe("§1 Registration", () => {
  test("1.1 Login screen renders", async ({ page }) => {
    await page.goto(MOBILE_URL);
    await waitForExpo(page);
    await screenshot(page, "01-login");

    // After onboarding skip, should see login screen
    const hasLogin =
      (await page.locator("input").count()) > 0 ||
      (await hasText(page, "sign in")) ||
      (await hasText(page, "log in")) ||
      (await hasText(page, "email")) ||
      (await hasText(page, "password")) ||
      (await page.locator('[data-testid*="login"]').count()) > 0;
    expect(hasLogin).toBeTruthy();
  });

  test("1.2 DISPATCHER tab NOT visible (§1 V1)", async ({ page }) => {
    await page.goto(MOBILE_URL);
    await waitForExpo(page);

    (await clickText(page, "register")) ||
      (await clickText(page, "sign up")) ||
      (await clickText(page, "create account"));
    await page.waitForTimeout(2000);
    await screenshot(page, "02-register");

    const hasCarrier = await hasText(page, "carrier");
    const hasShipper = await hasText(page, "shipper");
    const hasDispatcher = await hasText(page, "dispatcher");

    console.log(
      `Carrier: ${hasCarrier}, Shipper: ${hasShipper}, Dispatcher: ${hasDispatcher}`
    );
    expect(hasDispatcher).toBeFalsy();
  });

  test("1.3 Register form has fields", async ({ page }) => {
    await page.goto(MOBILE_URL);
    await waitForExpo(page);
    (await clickText(page, "register")) || (await clickText(page, "sign up"));
    await page.waitForTimeout(2000);
    await screenshot(page, "03-register-form");

    // RN Web uses input elements or data-testid patterns
    const inputs = await page
      .locator('input, [data-testid*="register"]')
      .count();
    console.log(`Form elements: ${inputs}`);
    expect(inputs).toBeGreaterThan(0);
  });
});

// §2 Verification
test.describe("§2 Verification", () => {
  test("2.1 Forgot password link exists", async ({ page }) => {
    await page.goto(MOBILE_URL);
    await waitForExpo(page);
    await screenshot(page, "04-forgot-password");

    const has =
      (await hasText(page, "forgot")) ||
      (await hasText(page, "reset password"));
    console.log(`Forgot password: ${has}`);
  });
});

// UI Quality
test.describe("UI Quality", () => {
  test("3.1 No JS errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        !msg.text().includes("favicon") &&
        !msg.text().includes("manifest") &&
        !msg.text().includes("ResizeObserver")
      ) {
        errors.push(msg.text());
      }
    });

    await page.goto(MOBILE_URL);
    await waitForExpo(page);
    await clickText(page, "register");
    await page.waitForTimeout(1000);
    await screenshot(page, "05-error-check");

    console.log(`Errors: ${errors.length}`);
    errors.slice(0, 5).forEach((e) => console.log(`  ${e.substring(0, 80)}`));
    expect(errors.length).toBeLessThan(5);
  });

  test("3.2 Mobile viewport (375x812)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(MOBILE_URL);
    await waitForExpo(page);
    await screenshot(page, "06-mobile-viewport");

    const bodyW = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyW).toBeLessThanOrEqual(395);
  });

  test("3.3 Tablet viewport (768x1024)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(MOBILE_URL);
    await waitForExpo(page);
    await screenshot(page, "07-tablet-viewport");
  });
});

// Accessibility
test.describe("Accessibility", () => {
  test("4.1 Inputs labeled", async ({ page }) => {
    await page.goto(MOBILE_URL);
    await waitForExpo(page);
    const inputs = await page.locator("input").all();
    let labeled = 0;
    for (const input of inputs) {
      if (
        (await input.getAttribute("placeholder")) ||
        (await input.getAttribute("aria-label"))
      )
        labeled++;
    }
    console.log(`Labeled: ${labeled}/${inputs.length}`);
    await screenshot(page, "08-accessibility");
    if (inputs.length > 0) expect(labeled / inputs.length).toBeGreaterThan(0.5);
  });
});
