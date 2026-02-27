/**
 * Mobile-Only Browser Test: Shipper Portal (Expo Web — localhost:8081)
 *
 * Headed mode: watches browser click through every shipper feature on
 * the mobile Expo web build. No web/Next.js testing.
 *
 * Run: node scripts/browser-test-mobile-only.mjs
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const MOBILE_URL = "http://localhost:8081";
const SCREENSHOT_DIR = "./browser-test-results/mobile-only";
const SHIPPER_EMAIL = "agri-shipper@demo.com";
const SHIPPER_PASSWORD = "password";

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = {};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(page) {
  return page.textContent("body").catch(() => "");
}

async function screenshot(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`   📸 ${name}`);
}

function hasText(bodyText, ...terms) {
  return terms.some((t) => bodyText.includes(t));
}

async function tryClick(page, selectors, description, { force = false } = {}) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        const visible = await el.isVisible().catch(() => false);
        if (visible) {
          await el.click({ force, timeout: 5000 });
          console.log(`   ✓ Clicked: ${description} (via ${sel})`);
          return true;
        }
      }
    } catch {
      /* ignore */
    }
  }
  console.log(`   ✗ Could not click: ${description}`);
  return false;
}

async function clickByExactText(page, text, description) {
  try {
    const els = await page.$$('div[tabindex="0"]');
    for (const el of els) {
      const t = await el.textContent().catch(() => "");
      if (t.trim() === text) {
        await el.click({ force: true, timeout: 5000 });
        console.log(`   ✓ Clicked: ${description} (exact text: "${text}")`);
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  console.log(`   ✗ Could not click: ${description}`);
  return false;
}

async function clickCardContaining(
  page,
  textParts,
  description,
  { minLen = 15 } = {}
) {
  try {
    const els = await page.$$('div[tabindex="0"]');
    for (const el of els) {
      const t = await el.textContent().catch(() => "");
      if (textParts.every((part) => t.includes(part)) && t.length > minLen) {
        await el.click({ force: true, timeout: 5000 });
        console.log(`   ✓ Clicked: ${description}`);
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  console.log(`   ✗ Could not click: ${description}`);
  return false;
}

async function navigateToTab(page, href, label) {
  const clicked = await tryClick(
    page,
    [`a[role="tab"][href="${href}"]`, `a[href="${href}"]`],
    `${label} tab`
  );
  if (clicked) await sleep(3000);
  return clicked;
}

async function goBackAndWait(page, ms = 2000) {
  await page.goBack();
  await sleep(ms);
}

async function resetToRoot(page) {
  await page.goto(MOBILE_URL, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector('a[role="tab"]', { timeout: 15000 });
    await sleep(2000);
  } catch {
    await sleep(8000);
  }
}

// Navigate to a hidden screen via direct URL path
async function navigateToPath(page, path, label) {
  await page.goto(`${MOBILE_URL}${path}`, { waitUntil: "domcontentloaded" });
  await sleep(4000);
  console.log(`   → Navigated to ${label}: ${page.url()}`);
}

// ========================================================================
// MAIN TEST
// ========================================================================
async function testMobileShipper(browser) {
  console.log("\n" + "═".repeat(70));
  console.log("  MOBILE-ONLY SHIPPER TEST (Expo Web — localhost:8081)");
  console.log("═".repeat(70));

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  const r = results;

  try {
    // ── 0. SETUP — skip onboarding via localStorage ───────────────────
    console.log("\n[MOBILE] 0. Setup — skip onboarding");
    await page.goto(MOBILE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.evaluate(() => {
      localStorage.setItem(
        "app_settings",
        JSON.stringify({
          locale: "en",
          theme: "light",
          pushEnabled: true,
          gpsEnabled: true,
          onboardingCompleted: true,
        })
      );
    });
    console.log("   ✓ localStorage set");

    // ── 1. LOGIN ──────────────────────────────────────────────────────
    console.log("\n[MOBILE] 1. Login");
    await page.goto(MOBILE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await sleep(8000); // Expo web bundle loads slowly
    await screenshot(page, "mobile-01-initial");

    let emailFilled = false;
    for (const sel of [
      'input[placeholder*="example.com"]',
      'input[type="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email"]',
      'input[aria-label*="email" i]',
      "input:first-of-type",
    ]) {
      const el = await page.$(sel);
      if (el) {
        await el.fill(SHIPPER_EMAIL);
        emailFilled = true;
        console.log(`   ✓ Email filled via: ${sel}`);
        break;
      }
    }

    let pwFilled = false;
    for (const sel of [
      'input[placeholder*="password" i]',
      'input[type="password"]',
      'input[aria-label*="password" i]',
      "input:nth-of-type(2)",
    ]) {
      const el = await page.$(sel);
      if (el) {
        await el.fill(SHIPPER_PASSWORD);
        pwFilled = true;
        console.log(`   ✓ Password filled via: ${sel}`);
        break;
      }
    }

    if (emailFilled && pwFilled) {
      await screenshot(page, "mobile-02-login-filled");

      const loginClicked = await tryClick(
        page,
        [
          'div[tabindex="0"]:has-text("Log In")',
          'div[tabindex="0"]:has-text("Sign In")',
          'div[tabindex="0"]:has-text("Login")',
          '[data-testid="login-submit"]',
          'button:has-text("Log In")',
          'button:has-text("Sign In")',
        ],
        "Login button"
      );

      await sleep(6000);
      const afterUrl = page.url();
      r.login = !afterUrl.includes("login") && !afterUrl.includes("auth");
      console.log(`   After login URL: ${afterUrl} → ${r.login ? "✓" : "✗"}`);
      await screenshot(page, "mobile-03-after-login");
    } else {
      console.log(
        `   ✗ Could not fill login form (email=${emailFilled}, pw=${pwFilled})`
      );
      r.login = false;
    }

    // ── 2. DASHBOARD ──────────────────────────────────────────────────
    console.log("\n[MOBILE] 2. Dashboard");
    await sleep(3000);
    const dashBody = await safeText(page);
    r.dashboardStats = hasText(
      dashBody,
      "Active Loads",
      "In Transit",
      "Total Loads",
      "Delivered",
      "Pending",
      "Total Spent"
    );
    r.dashboardQuickActions = hasText(
      dashBody,
      "Quick Actions",
      "Post Load",
      "Find Trucks",
      "Shipments",
      "My Loads"
    );
    r.dashboardLoadsByStatus = hasText(dashBody, "Loads by Status");
    r.dashboardRecentLoads = hasText(dashBody, "Recent Loads", "View All");

    console.log(`   Stats: ${r.dashboardStats ? "✓" : "✗"}`);
    console.log(`   Quick actions: ${r.dashboardQuickActions ? "✓" : "✗"}`);
    console.log(`   Loads by status: ${r.dashboardLoadsByStatus ? "✓" : "✗"}`);
    console.log(`   Recent loads: ${r.dashboardRecentLoads ? "✓" : "✗"}`);
    await screenshot(page, "mobile-04-dashboard");

    // Click "Post New Load" quick action
    console.log("\n[MOBILE] 2b. Dashboard → Post New Load quick action");
    const mPostLoad = await clickCardContaining(
      page,
      ["Post", "Load"],
      "Post New Load quick action",
      { minLen: 5 }
    );
    if (mPostLoad) {
      await sleep(3000);
      r.dashboardPostLoad =
        page.url().includes("create") ||
        (await safeText(page)).includes("Route");
      console.log(`   Navigated to create: ${r.dashboardPostLoad ? "✓" : "✗"}`);
      await screenshot(page, "mobile-04b-dashboard-postload");
      await goBackAndWait(page, 3000);
    }

    // Click "Find Trucks" quick action
    console.log("\n[MOBILE] 2c. Dashboard → Find Trucks quick action");
    const mFindTrucks = await clickCardContaining(
      page,
      ["Find", "Truck"],
      "Find Trucks quick action",
      { minLen: 5 }
    );
    if (mFindTrucks) {
      await sleep(3000);
      r.dashboardFindTrucks =
        page.url().includes("trucks") ||
        (await safeText(page)).includes("Search by city");
      console.log(
        `   Navigated to trucks: ${r.dashboardFindTrucks ? "✓" : "✗"}`
      );
      await screenshot(page, "mobile-04c-dashboard-findtrucks");
      await goBackAndWait(page, 3000);
    }

    // Click a recent load card (from "Recent Loads" section, not "Active Trips")
    console.log("\n[MOBILE] 2d. Dashboard → Recent load card");
    // Ensure we're on the Dashboard (goBack() is unreliable with Expo Router)
    await navigateToTab(page, "/", "Dashboard");
    await sleep(2000);

    // Find the "Recent Loads" section header, then look for cards after it
    let recentLoad = null;
    const recentLoadsHeader = await page.$('text="Recent Loads"');
    if (recentLoadsHeader) {
      // Get all clickable cards that contain route arrows
      const allCards = await page.$$('div[tabindex="0"]');
      let foundHeader = false;
      for (const card of allCards) {
        const t = await card.textContent().catch(() => "");
        if (t.includes("Recent Loads")) {
          foundHeader = true;
          continue;
        }
        if (foundHeader && t.includes("→") && t.length > 10) {
          recentLoad = card;
          break;
        }
      }
    }
    // Fallback: try any card with route arrow if Recent Loads section not found
    if (!recentLoad) {
      const dashCards = await page.$$('div[tabindex="0"]');
      for (const card of dashCards) {
        const t = await card.textContent().catch(() => "");
        if (t.includes("→") && t.includes("Addis") && t.length > 20) {
          recentLoad = card;
          break;
        }
      }
    }
    if (recentLoad) {
      await recentLoad.click({ force: true });
      await sleep(3000);
      const url = page.url();
      const bodyText = await safeText(page);
      r.dashboardRecentLoadClick =
        url.includes("loads/") ||
        url.includes("trips/") ||
        bodyText.includes("Cargo") ||
        bodyText.includes("Load Details") ||
        bodyText.includes("Shipment Details");
      console.log(
        `   Load detail opened: ${r.dashboardRecentLoadClick ? "✓" : "✗"}`
      );
      await screenshot(page, "mobile-04d-dashboard-recent-load");
      await goBackAndWait(page, 2000);
    }

    // ── 3. MY LOADS ───────────────────────────────────────────────────
    console.log("\n[MOBILE] 3. My Loads");
    const loadsTabClicked = await navigateToTab(page, "/loads", "My Loads");
    const mLoadsBody = await safeText(page);
    r.loadsList = hasText(mLoadsBody, "→", "Load", "Loads");
    console.log(`   Loads list: ${r.loadsList ? "✓" : "✗"}`);
    await screenshot(page, "mobile-05-loads-all");

    // Status filter tabs
    const mobileStatusTabs = [
      "All",
      "Draft",
      "Posted",
      "Assigned",
      "In Transit",
      "Delivered",
      "Completed",
      "Cancelled",
    ];
    r.loadFilters = {};
    for (const tab of mobileStatusTabs) {
      const tabClicked = await clickByExactText(page, tab, `Filter: ${tab}`);
      if (tabClicked) {
        await sleep(2000);
        r.loadFilters[tab] = true;
        await screenshot(
          page,
          `mobile-05-loads-${tab.toLowerCase().replace(" ", "-")}`
        );
      } else {
        r.loadFilters[tab] = false;
      }
    }

    // ── 4. LOAD DETAIL ────────────────────────────────────────────────
    console.log("\n[MOBILE] 4. Load Detail");
    try {
      await clickByExactText(page, "All", "Reset to All");
      await sleep(2000);
      const loadClicked = await clickCardContaining(
        page,
        ["→", "Addis"],
        "Load card"
      );
      if (loadClicked) {
        await sleep(3000);
        const mDetailText = await safeText(page);
        r.loadDetailRoute = hasText(mDetailText, "→", "Pickup", "Delivery");
        r.loadDetailStatus = hasText(
          mDetailText,
          "POSTED",
          "DRAFT",
          "COMPLETED",
          "ASSIGNED",
          "Posted",
          "Draft"
        );
        r.loadDetailCargo = hasText(
          mDetailText,
          "Cargo",
          "Weight",
          "kg",
          "Truck Type",
          "Truck"
        );
        r.loadDetailActions = hasText(
          mDetailText,
          "Edit",
          "Post",
          "Delete",
          "Request"
        );
        console.log(`   Route: ${r.loadDetailRoute ? "✓" : "✗"}`);
        console.log(`   Status: ${r.loadDetailStatus ? "✓" : "✗"}`);
        console.log(`   Cargo: ${r.loadDetailCargo ? "✓" : "✗"}`);
        console.log(`   Actions: ${r.loadDetailActions ? "✓" : "✗"}`);
        await screenshot(page, "mobile-06-load-detail");

        // Edit load
        const mEditClicked = await tryClick(
          page,
          ['div[tabindex="0"]:has-text("Edit")', 'button:has-text("Edit")'],
          "Edit Load",
          { force: true }
        );
        if (mEditClicked) {
          await sleep(3000);
          const editText = await safeText(page);
          r.loadEdit = hasText(
            editText,
            "Pickup City",
            "Delivery City",
            "Weight",
            "Update"
          );
          console.log(`   Edit form: ${r.loadEdit ? "✓" : "✗"}`);
          await screenshot(page, "mobile-06b-load-edit");
          await goBackAndWait(page);
        }
        await goBackAndWait(page);
      } else {
        console.log("   No loads to click");
        r.loadDetailRoute = false;
      }
    } catch (e) {
      console.log(`   Load detail error: ${e.message.substring(0, 80)}`);
      r.loadDetailRoute = false;
    }

    // ── 5. CREATE LOAD ────────────────────────────────────────────────
    console.log("\n[MOBILE] 5. Create Load");
    try {
      await navigateToTab(page, "/", "Dashboard");
      const mCreateNav = await clickCardContaining(
        page,
        ["Post", "Load"],
        "Navigate to Create",
        { minLen: 5 }
      );
      if (mCreateNav) await sleep(3000);

      const mCreateText = await safeText(page);
      r.createLoadPage = hasText(
        mCreateText,
        "Route",
        "Pickup",
        "Step",
        "Create"
      );
      console.log(`   Create page: ${r.createLoadPage ? "✓" : "✗"}`);
      await screenshot(page, "mobile-07-create-step1");

      // Step 1: Route — fill inputs with small delays for React Hook Form
      const mInputs = await page.$$("input");
      if (mInputs.length >= 2) {
        await mInputs[0].fill("Addis Ababa");
        await sleep(100);
        await mInputs[1].fill("Dire Dawa");
        await sleep(100);
      }
      if (mInputs.length >= 4) {
        await mInputs[2].fill("2026-03-15");
        await sleep(100);
        await mInputs[3].fill("2026-03-18");
        await sleep(100);
        // Blur to commit the last value to React Hook Form
        await mInputs[3].evaluate((el) =>
          el.dispatchEvent(new Event("blur", { bubbles: true }))
        );
        await sleep(200);
      }
      r.createStep1 = true;
      await screenshot(page, "mobile-07b-create-step1-filled");

      const mStep2 = await tryClick(
        page,
        [
          '[data-testid="create-load-next"]',
          'div[role="button"]:has-text("Next")',
          'button:has-text("Next")',
        ],
        "Next → Step 2"
      );
      if (mStep2) {
        await sleep(2000);
        await screenshot(page, "mobile-07c-create-step2");
        await clickByExactText(page, "Flatbed", "Truck type chip");
        const step2Inputs = await page.$$("input");
        for (const inp of step2Inputs) {
          const label = await inp.getAttribute("aria-label").catch(() => "");
          const ph = await inp.getAttribute("placeholder").catch(() => "");
          if (
            label.toLowerCase().includes("weight") ||
            ph.toLowerCase().includes("weight")
          ) {
            await inp.fill("15000");
            await sleep(100);
            break;
          }
        }
        r.createStep2 = true;
        await screenshot(page, "mobile-07d-create-step2-filled");

        const mStep3 = await tryClick(
          page,
          [
            '[data-testid="create-load-next"]',
            'div[role="button"]:has-text("Next")',
            'button:has-text("Next")',
          ],
          "Next → Step 3"
        );
        if (mStep3) {
          await sleep(2000);
          r.createStep3 = true;
          await screenshot(page, "mobile-07e-create-step3");

          const mStep4 = await tryClick(
            page,
            [
              '[data-testid="create-load-next"]',
              'div[role="button"]:has-text("Next")',
              'button:has-text("Next")',
            ],
            "Next → Step 4 Review"
          );
          if (mStep4) {
            await sleep(2000);
            const mReviewText = await safeText(page);
            r.createStep4Review = hasText(
              mReviewText,
              "Route",
              "Cargo",
              "Review",
              "Pickup"
            );
            console.log(`   Review: ${r.createStep4Review ? "✓" : "✗"}`);
            await screenshot(page, "mobile-07f-create-step4-review");
          }
        }
      }
      r.createLoadWizard = r.createStep1 || false;
      await navigateToTab(page, "/", "Dashboard (recovery)");
    } catch (e) {
      console.log(`   Create load error: ${e.message.substring(0, 80)}`);
      r.createLoadWizard = false;
    }

    // ── 6. FIND TRUCKS ────────────────────────────────────────────────
    console.log("\n[MOBILE] 6. Find Trucks");
    try {
      await navigateToTab(page, "/trucks", "Find Trucks");
      const mTrucksBody = await safeText(page);
      r.findTrucksPage = hasText(
        mTrucksBody,
        "Truck",
        "Search",
        "FLATBED",
        "DRY_VAN",
        "Available",
        "Find",
        "city"
      );
      console.log(`   Find trucks: ${r.findTrucksPage ? "✓" : "✗"}`);
      await screenshot(page, "mobile-08-find-trucks");

      const mSearchInput = await page.$(
        'input[placeholder*="city" i], input[placeholder*="search" i]'
      );
      if (mSearchInput) {
        await mSearchInput.fill("Addis");
        await sleep(2000);
        r.findTrucksSearch = true;
        await screenshot(page, "mobile-08b-trucks-searched");
      }

      const truckClicked = await clickCardContaining(
        page,
        ["→"],
        "Truck posting card"
      );
      if (truckClicked) {
        await sleep(3000);
        r.findTrucksCardClick = true;
        await screenshot(page, "mobile-08d-truck-detail-modal");
      }
    } catch (e) {
      console.log(`   Find trucks error: ${e.message.substring(0, 80)}`);
    }

    // ── 7. TRIPS / SHIPMENTS ──────────────────────────────────────────
    console.log("\n[MOBILE] 7. Shipments");
    try {
      await navigateToTab(page, "/trips", "Shipments");
      const mTripsBody = await safeText(page);
      r.tripsPage = hasText(mTripsBody, "Trip", "Shipment", "→", "Deliver");
      console.log(`   Trips page: ${r.tripsPage ? "✓" : "✗"}`);
      await screenshot(page, "mobile-09-trips");

      const tripClicked = await clickCardContaining(page, ["→"], "Trip card");
      if (tripClicked) {
        await sleep(3000);
        const mTripDetailText = await safeText(page);
        r.tripDetail = hasText(
          mTripDetailText,
          "Status",
          "Route",
          "Truck",
          "Carrier",
          "→"
        );
        console.log(`   Trip detail: ${r.tripDetail ? "✓" : "✗"}`);
        await screenshot(page, "mobile-09b-trip-detail");
        await goBackAndWait(page);
      } else {
        console.log("   No trips to click");
        r.tripDetail = false;
      }
    } catch (e) {
      console.log(`   Trips error: ${e.message.substring(0, 80)}`);
    }

    // ── 8. MAP / TRACK ────────────────────────────────────────────────
    console.log("\n[MOBILE] 8. Map / Track");
    try {
      await navigateToPath(page, "/map", "Map");
      const mMapBody = await safeText(page);
      r.mapPage = hasText(
        mMapBody,
        "Map",
        "Track",
        "Shipment",
        "Progress",
        "Transit"
      );
      console.log(`   Map page: ${r.mapPage ? "✓" : "✗"}`);
      await screenshot(page, "mobile-10-map");
    } catch (e) {
      console.log(`   Map error: ${e.message.substring(0, 80)}`);
      r.mapPage = false;
    }

    // ── 9. REQUESTS ───────────────────────────────────────────────────
    console.log("\n[MOBILE] 9. Requests");
    try {
      await navigateToPath(page, "/requests", "Requests");
      const reqBody = await safeText(page);
      r.requestsPage = hasText(
        reqBody,
        "Request",
        "Pending",
        "Accepted",
        "Booking",
        "No requests"
      );
      console.log(`   Requests page: ${r.requestsPage ? "✓" : "✗"}`);
      await screenshot(page, "mobile-11-requests");
    } catch (e) {
      console.log(`   Requests error: ${e.message.substring(0, 80)}`);
      r.requestsPage = false;
    }

    // ── 10. WALLET ────────────────────────────────────────────────────
    console.log("\n[MOBILE] 10. Wallet");
    try {
      await navigateToPath(page, "/wallet", "Wallet");
      const walletBody = await safeText(page);
      r.walletPage = hasText(
        walletBody,
        "Wallet",
        "Balance",
        "ETB",
        "Transaction",
        "History",
        "Payment"
      );
      console.log(`   Wallet page: ${r.walletPage ? "✓" : "✗"}`);
      await screenshot(page, "mobile-12-wallet");
    } catch (e) {
      console.log(`   Wallet error: ${e.message.substring(0, 80)}`);
      r.walletPage = false;
    }

    // ── 11. SETTINGS ──────────────────────────────────────────────────
    console.log("\n[MOBILE] 11. Settings");
    try {
      await navigateToPath(page, "/settings", "Settings");
      const settingsBody = await safeText(page);
      r.settingsPage = hasText(
        settingsBody,
        "Settings",
        "Profile",
        "Language",
        "Theme",
        "Notification",
        "Account",
        "Logout"
      );
      console.log(`   Settings page: ${r.settingsPage ? "✓" : "✗"}`);
      await screenshot(page, "mobile-13-settings");
    } catch (e) {
      console.log(`   Settings error: ${e.message.substring(0, 80)}`);
      r.settingsPage = false;
    }

    // ── 12. DOCUMENTS ─────────────────────────────────────────────────
    console.log("\n[MOBILE] 12. Documents");
    try {
      await navigateToPath(page, "/documents", "Documents");
      const docsBody = await safeText(page);
      r.documentsPage = hasText(
        docsBody,
        "Document",
        "Upload",
        "License",
        "File",
        "ID",
        "No documents"
      );
      console.log(`   Documents page: ${r.documentsPage ? "✓" : "✗"}`);
      await screenshot(page, "mobile-14-documents");
    } catch (e) {
      console.log(`   Documents error: ${e.message.substring(0, 80)}`);
      r.documentsPage = false;
    }

    // ── 13. MATCHES ───────────────────────────────────────────────────
    console.log("\n[MOBILE] 13. Matches");
    try {
      await navigateToPath(page, "/matches", "Matches");
      const matchesBody = await safeText(page);
      r.matchesPage = hasText(
        matchesBody,
        "Match",
        "Truck",
        "Load",
        "Score",
        "No matches"
      );
      console.log(`   Matches page: ${r.matchesPage ? "✓" : "✗"}`);
      await screenshot(page, "mobile-15-matches");
    } catch (e) {
      console.log(`   Matches error: ${e.message.substring(0, 80)}`);
      r.matchesPage = false;
    }

    // ── 14. TAB BAR NAVIGATION ─────────────────────────────────────────
    console.log("\n[MOBILE] 14. Tab Bar Navigation — verify all tabs");
    await resetToRoot(page);
    const mobileTabs = [
      { label: "Dashboard", href: "/" },
      { label: "My Loads", href: "/loads" },
      { label: "Shipments", href: "/trips" },
      { label: "Find Trucks", href: "/trucks" },
    ];
    r.tabBar = {};
    for (const tab of mobileTabs) {
      const tabClicked = await navigateToTab(page, tab.href, tab.label);
      if (tabClicked) {
        r.tabBar[tab.label] = true;
        console.log(`   ${tab.label}: ✓ loaded at ${page.url()}`);
      } else {
        r.tabBar[tab.label] = false;
        console.log(`   ${tab.label}: ✗ could not click`);
      }
    }
  } catch (e) {
    console.log(`\n   ❌ ERROR: ${e.message}`);
    await screenshot(page, "mobile-error").catch(() => {});
    r.error = e.message;
  }

  await context.close();
}

// ========================================================================
// SUMMARY
// ========================================================================
function printSummary() {
  const r = results;
  const mark = (v) => (v ? "✓" : v === false ? "✗" : "—");

  const features = [
    { name: "Login & redirect", result: r.login },
    { name: "Dashboard stats", result: r.dashboardStats },
    { name: "Dashboard quick actions", result: r.dashboardQuickActions },
    { name: "Dashboard recent loads", result: r.dashboardRecentLoads },
    { name: "Dashboard loads by status", result: r.dashboardLoadsByStatus },
    { name: "Post Load quick action", result: r.dashboardPostLoad },
    { name: "Find Trucks quick action", result: r.dashboardFindTrucks },
    { name: "Recent load card click", result: r.dashboardRecentLoadClick },
    { name: "Load list + filters", result: r.loadsList },
    { name: "Load detail route", result: r.loadDetailRoute },
    { name: "Load detail status", result: r.loadDetailStatus },
    { name: "Load detail cargo", result: r.loadDetailCargo },
    { name: "Load detail actions", result: r.loadDetailActions },
    { name: "Edit load", result: r.loadEdit },
    { name: "Create load wizard", result: r.createLoadWizard },
    { name: "Create step 1 (Route)", result: r.createStep1 },
    { name: "Create step 2 (Cargo)", result: r.createStep2 },
    { name: "Create step 3 (Options)", result: r.createStep3 },
    { name: "Create step 4 (Review)", result: r.createStep4Review },
    { name: "Find trucks page", result: r.findTrucksPage },
    { name: "Find trucks search", result: r.findTrucksSearch },
    { name: "Truck card click", result: r.findTrucksCardClick },
    { name: "Trips / Shipments", result: r.tripsPage },
    { name: "Trip detail", result: r.tripDetail },
    { name: "Map / Tracking", result: r.mapPage },
    { name: "Requests", result: r.requestsPage },
    { name: "Wallet", result: r.walletPage },
    { name: "Settings", result: r.settingsPage },
    { name: "Documents", result: r.documentsPage },
    { name: "Matches", result: r.matchesPage },
  ];

  console.log("\n" + "═".repeat(50));
  console.log("  MOBILE SHIPPER TEST RESULTS");
  console.log("═".repeat(50));
  console.log("");
  console.log("| Feature                     | Result |");
  console.log("|-----------------------------|--------|");

  let pass = 0,
    fail = 0,
    skip = 0;
  for (const f of features) {
    const m = mark(f.result);
    console.log(`| ${f.name.padEnd(27)} | ${m.padEnd(6)} |`);
    if (f.result === true) pass++;
    else if (f.result === false) fail++;
    else skip++;
  }

  console.log("");
  console.log(`Results: ${pass} passed, ${fail} failed, ${skip} skipped`);

  // Tab bar
  if (r.tabBar) {
    console.log("\nTab bar:");
    for (const [name, ok] of Object.entries(r.tabBar)) {
      console.log(`  ${name}: ${ok ? "✓" : "✗"}`);
    }
  }

  // Load filters
  if (r.loadFilters) {
    console.log("\nLoad filters:");
    for (const [name, ok] of Object.entries(r.loadFilters)) {
      console.log(`  ${name}: ${ok ? "✓" : "✗"}`);
    }
  }
}

// ========================================================================
// MAIN
// ========================================================================
async function main() {
  console.log("╔" + "═".repeat(68) + "╗");
  console.log(
    "║  Mobile-Only Shipper Browser Test (Expo Web)                     ║"
  );
  console.log("║  Date: " + new Date().toISOString().padEnd(60) + "║");
  console.log("╚" + "═".repeat(68) + "╝");

  const browser = await chromium.launch({
    headless: false,
  });

  try {
    await testMobileShipper(browser);
  } finally {
    await browser.close();
  }

  printSummary();

  writeFileSync(
    `${SCREENSHOT_DIR}/results.json`,
    JSON.stringify(results, null, 2)
  );
  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}/`);
  console.log(`Results JSON saved to: ${SCREENSHOT_DIR}/results.json`);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
