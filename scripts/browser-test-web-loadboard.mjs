/**
 * Web Loadboard "Search Trucks" tab test + booking modal
 * Run: node scripts/browser-test-web-loadboard.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const WEB = "http://localhost:3000";
const DIR = "./browser-test-results";
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  // Login
  await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await page.fill(
    'input[name="email"], input[type="email"]',
    "agri-shipper@demo.com"
  );
  await page.fill('input[name="password"], input[type="password"]', "password");
  await page.click('button[type="submit"]');
  await sleep(4000);
  console.log("Logged in:", page.url());

  // Loadboard - Search Trucks tab
  console.log("\n1. Loadboard -> Search Trucks tab...");
  await page.goto(`${WEB}/shipper/loadboard`, {
    waitUntil: "domcontentloaded",
  });
  await sleep(3000);

  // Click "Search Trucks" tab
  const searchTrucksTab = await page.$(
    'button:has-text("Search Trucks"), a:has-text("Search Trucks"), [role="tab"]:has-text("Search Trucks")'
  );
  if (searchTrucksTab) {
    await searchTrucksTab.click();
    await sleep(3000);
    console.log("   Clicked Search Trucks tab");
  } else {
    console.log('   No "Search Trucks" tab found, checking all buttons...');
    const btns = await page.$$('button, [role="tab"], a');
    for (const btn of btns) {
      const txt = await btn.textContent().catch(() => "");
      if (txt.trim())
        console.log(`   Button: "${txt.trim().substring(0, 40)}"`);
    }
  }
  await page.screenshot({
    path: `${DIR}/web-09-search-trucks.png`,
    fullPage: true,
  });

  // Check for truck postings
  const body = await page.textContent("body");
  console.log(
    `   Has truck types: ${body.includes("FLATBED") || body.includes("Flatbed") || body.includes("DRY_VAN")}`
  );
  console.log(`   Has "Matching Trucks": ${body.includes("Matching Trucks")}`);

  // Try clicking "Matching Trucks" tab if exists
  const matchingTab = await page.$(
    'button:has-text("Matching Trucks"), [role="tab"]:has-text("Matching Trucks")'
  );
  if (matchingTab) {
    await matchingTab.click();
    await sleep(2000);
    await page.screenshot({
      path: `${DIR}/web-09b-matching-trucks.png`,
      fullPage: true,
    });
    console.log("   Matching Trucks tab clicked");
  }

  // Try to find and click a truck to open booking
  console.log("\n2. Try booking modal...");
  // Look for any "Book" or "Request" button
  const bookBtn = await page.$(
    'button:has-text("Book"), button:has-text("Request"), a:has-text("Book")'
  );
  if (bookBtn) {
    await bookBtn.click();
    await sleep(2000);
    await page.screenshot({
      path: `${DIR}/web-10-booking-modal.png`,
      fullPage: true,
    });
    console.log("   Booking modal opened");
  } else {
    console.log("   No Book/Request button found on this view");
  }

  // Navigate to load detail with "Find Trucks" action
  console.log("\n3. Load detail -> Find Trucks...");
  await page.goto(`${WEB}/shipper/loads`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  // Click the POSTED load "Find Trucks" link
  const findTrucksLink = await page.$('a:has-text("Find Trucks")');
  if (findTrucksLink) {
    await findTrucksLink.click();
    await sleep(3000);
    await page.screenshot({
      path: `${DIR}/web-11-find-trucks-from-load.png`,
      fullPage: true,
    });
    console.log(`   Find Trucks page: ${page.url()}`);
  } else {
    console.log('   No "Find Trucks" link on loads page');
  }

  // Load detail page for a POSTED load
  console.log("\n4. POSTED load detail...");
  await page.goto(`${WEB}/shipper/loads?status=posted`, {
    waitUntil: "domcontentloaded",
  });
  await sleep(2000);
  const postedLoadLink = await page.$(
    'a[href*="/shipper/loads/c"]:not([href*="create"])'
  );
  if (postedLoadLink) {
    const href = await postedLoadLink.getAttribute("href");
    console.log(`   Clicking load: ${href}`);
    await postedLoadLink.click();
    await sleep(3000);
    await page.screenshot({
      path: `${DIR}/web-12-posted-load-detail.png`,
      fullPage: true,
    });

    const detailBody = await page.textContent("body");
    console.log(
      `   Has POSTED status: ${detailBody.includes("POSTED") || detailBody.includes("Posted")}`
    );
    console.log(`   Has route info: ${detailBody.includes("Addis Ababa")}`);
    console.log(
      `   Has truck type: ${detailBody.includes("FLATBED") || detailBody.includes("Flatbed") || detailBody.includes("DRY_VAN") || detailBody.includes("Van")}`
    );
  }

  await browser.close();
  console.log("\nDone. Screenshots saved.");
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
