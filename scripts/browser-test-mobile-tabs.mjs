/**
 * Mobile tab navigation test - clicks bottom tab bar
 * Run: node scripts/browser-test-mobile-tabs.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const URL = "http://localhost:8081";
const DIR = "./browser-test-results";
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  // Load and skip onboarding
  console.log("Loading...");
  await page.goto(URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelectorAll("div").length > 20,
    { timeout: 30000 }
  );
  await sleep(3000);

  // Skip onboarding
  const skipBtn = await page.$(
    'div:has-text("Skip"):not(:has(div:has-text("Skip")))'
  );
  if (skipBtn) {
    await skipBtn.click();
    await sleep(2000);
  }

  // Login
  console.log("Logging in...");
  const emailInput = await page.$('input[type="email"]');
  const pwInput = await page.$('input[type="password"]');
  if (emailInput && pwInput) {
    await emailInput.fill("agri-shipper@demo.com");
    await pwInput.fill("password");
    const loginBtn = await page.$('div[role="button"]:has-text("Log In")');
    if (loginBtn) await loginBtn.click();
    await sleep(5000);
  }

  console.log("On dashboard. Testing tabs...\n");

  // Capture the bottom tab bar area
  // Bottom tabs are: Dashboard | My Loads | Shipments | Find Trucks
  // They're likely <a> tags or divs with role="tab" at the bottom of the page

  // Helper to click bottom tab by text
  async function clickBottomTab(tabText) {
    // Find all links first (Expo Router tabs render as <a>)
    const links = await page.$$("a");
    for (const link of links) {
      const txt = (await link.textContent().catch(() => "")).trim();
      const href = await link.getAttribute("href").catch(() => "");
      if (txt.toLowerCase().includes(tabText.toLowerCase())) {
        console.log(`  Clicking tab link: "${txt}" -> ${href}`);
        await link.click();
        await sleep(3000);
        return true;
      }
    }

    // Fallback: Try div[role="button"] at bottom of viewport
    const btns = await page.$$('div[role="button"]');
    for (const btn of btns) {
      const txt = (await btn.textContent().catch(() => "")).trim();
      if (txt.toLowerCase().includes(tabText.toLowerCase())) {
        console.log(`  Clicking tab button: "${txt}"`);
        await btn.click();
        await sleep(3000);
        return true;
      }
    }
    return false;
  }

  // 1. Dashboard (already on it)
  console.log("1. Dashboard");
  await page.screenshot({
    path: `${DIR}/mobile-tab-01-dashboard.png`,
    fullPage: true,
  });

  // Scroll down to see more of dashboard
  await page.evaluate(() => window.scrollTo(0, 600));
  await sleep(1000);
  await page.screenshot({
    path: `${DIR}/mobile-tab-01b-dashboard-scroll.png`,
    fullPage: true,
  });

  // 2. My Loads tab
  console.log("\n2. My Loads tab");
  if (await clickBottomTab("My Loads")) {
    await page.screenshot({
      path: `${DIR}/mobile-tab-02-my-loads.png`,
      fullPage: true,
    });
    const txt = await page.textContent("body");
    console.log(`  Content: ${txt.substring(0, 300)}`);

    // Scroll to see load cards
    await page.evaluate(() => window.scrollTo(0, 400));
    await sleep(1000);
    await page.screenshot({
      path: `${DIR}/mobile-tab-02b-loads-scroll.png`,
      fullPage: true,
    });
  }

  // 3. Shipments tab
  console.log("\n3. Shipments tab");
  if (await clickBottomTab("Shipment")) {
    await page.screenshot({
      path: `${DIR}/mobile-tab-03-shipments.png`,
      fullPage: true,
    });
    const txt = await page.textContent("body");
    console.log(`  Content: ${txt.substring(0, 300)}`);
  }

  // 4. Find Trucks tab
  console.log("\n4. Find Trucks tab");
  if (await clickBottomTab("Find Trucks")) {
    await page.screenshot({
      path: `${DIR}/mobile-tab-04-trucks.png`,
      fullPage: true,
    });
    const txt = await page.textContent("body");
    console.log(`  Content: ${txt.substring(0, 300)}`);

    // Scroll to see truck posting cards
    await page.evaluate(() => window.scrollTo(0, 400));
    await sleep(1000);
    await page.screenshot({
      path: `${DIR}/mobile-tab-04b-trucks-scroll.png`,
      fullPage: true,
    });

    // Try clicking a truck card to open booking modal
    console.log("\n5. Booking modal...");
    const cards = await page.$$('div[role="button"]');
    for (const card of cards) {
      const txt = (await card.textContent().catch(() => "")).trim();
      if (
        txt.includes("Book") ||
        txt.includes("Request") ||
        txt.includes("FLATBED") ||
        txt.includes("DRY_VAN") ||
        txt.includes("Flatbed")
      ) {
        console.log(`  Clicking card: "${txt.substring(0, 60)}"`);
        await card.click();
        await sleep(2000);
        await page.screenshot({
          path: `${DIR}/mobile-tab-05-booking.png`,
          fullPage: true,
        });
        break;
      }
    }
  }

  // 6. Go back to My Loads and click a load for detail
  console.log("\n6. Load Detail...");
  if (await clickBottomTab("My Loads")) {
    await sleep(2000);
    // Click first load card
    const loadCards = await page.$$('div[role="button"]');
    for (const card of loadCards) {
      const txt = (await card.textContent().catch(() => "")).trim();
      if (
        txt.includes("Addis Ababa") ||
        txt.includes("→") ||
        txt.includes("POSTED") ||
        txt.includes("COMPLETED")
      ) {
        console.log(`  Clicking load: "${txt.substring(0, 80)}"`);
        await card.click();
        await sleep(3000);
        await page.screenshot({
          path: `${DIR}/mobile-tab-06-load-detail.png`,
          fullPage: true,
        });
        const detailTxt = await page.textContent("body");
        console.log(`  Detail: ${detailTxt.substring(0, 300)}`);
        break;
      }
    }
  }

  await browser.close();
  console.log("\nDone. Screenshots in:", DIR);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
