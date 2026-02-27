/**
 * Comprehensive Browser Test: Carrier Portal — Every Feature (Web)
 *
 * Headed mode: watches browser click through every carrier feature on
 * web (Next.js :3000), testing tabs, forms, navigation, and detail views.
 * Prints a summary table at the end.
 *
 * Run: node scripts/browser-test-carrier.mjs
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const WEB_URL = "http://localhost:3000";
const SCREENSHOT_DIR = "./browser-test-results";
const CARRIER_EMAIL = "selam-admin@demo.com";
const CARRIER_PASSWORD = "password";

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = {
  web: {},
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Helper: safely get text content
async function safeText(page) {
  return page.textContent("body").catch(() => "");
}

// Helper: screenshot with logging
async function screenshot(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`   📸 ${name}`);
}

// Helper: try clicking by text or selector
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

// Helper: check text presence
function hasText(bodyText, ...terms) {
  return terms.some((t) => bodyText.includes(t));
}

// ========================================================================
// WEB CARRIER TESTS
// ========================================================================
async function testWebCarrier(browser) {
  console.log("\n" + "═".repeat(70));
  console.log("  WEB CARRIER TESTING (localhost:3000)");
  console.log("═".repeat(70));

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const r = results.web;

  try {
    // ── 1. LOGIN ──────────────────────────────────────────────────────
    console.log("\n[WEB] 1. Login");
    await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await screenshot(page, "carrier-01-login-page");

    await page.fill('input[name="email"], input[type="email"]', CARRIER_EMAIL);
    await page.fill(
      'input[name="password"], input[type="password"]',
      CARRIER_PASSWORD
    );
    await screenshot(page, "carrier-02-login-filled");
    await page.click('button[type="submit"]');
    await sleep(4000);

    const loginUrl = page.url();
    r.login = loginUrl.includes("/carrier");
    console.log(`   Redirected to: ${loginUrl} → ${r.login ? "✓" : "✗"}`);
    await screenshot(page, "carrier-03-after-login");

    // ── 2. DASHBOARD ──────────────────────────────────────────────────
    console.log("\n[WEB] 2. Dashboard");
    await page.goto(`${WEB_URL}/carrier/dashboard`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const dashText = await safeText(page);
    r.dashboardStats = hasText(
      dashText,
      "Total Trucks",
      "Available Trucks",
      "Trucks on Job",
      "Pending Approvals",
      "Wallet Balance"
    );
    r.dashboardQuickActions = hasText(
      dashText,
      "Post Truck",
      "Search Loads",
      "Register Truck"
    );
    r.dashboardSections = hasText(
      dashText,
      "My Active Jobs",
      "Available Loads",
      "Fleet Overview"
    );

    console.log(`   Stats: ${r.dashboardStats ? "✓" : "✗"}`);
    console.log(`   Quick actions: ${r.dashboardQuickActions ? "✓" : "✗"}`);
    console.log(`   Sections: ${r.dashboardSections ? "✓" : "✗"}`);
    await screenshot(page, "carrier-04-dashboard");

    // Scroll down to capture quick actions area
    await page.evaluate(() => window.scrollBy(0, 600));
    await sleep(1000);
    await screenshot(page, "carrier-04b-dashboard-quick-actions");
    await page.evaluate(() => window.scrollTo(0, 0));

    // ── 3. LOADBOARD ──────────────────────────────────────────────────
    console.log("\n[WEB] 3. Loadboard");
    await page.goto(`${WEB_URL}/carrier/loadboard`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const lbText = await safeText(page);
    r.loadboardPage = hasText(
      lbText,
      "My Trucks",
      "Load Board",
      "Loadboard",
      "Post"
    );
    console.log(`   Loadboard loaded: ${r.loadboardPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-05-loadboard-post-trucks");

    // Switch to Search Loads tab
    console.log("\n[WEB] 3b. Loadboard → Search Loads");
    const searchLoadsClicked = await tryClick(
      page,
      [
        'button:has-text("Search Loads")',
        'a:has-text("Search Loads")',
        'a[href*="tab=SEARCH_LOADS"]',
      ],
      "Search Loads tab"
    );
    if (searchLoadsClicked) {
      await sleep(2500);
      const searchText = await safeText(page);
      r.loadboardSearchLoads = hasText(
        searchText,
        "Search",
        "Load",
        "Origin",
        "Destination",
        "Filter"
      );
      console.log(`   Search Loads tab: ${r.loadboardSearchLoads ? "✓" : "✗"}`);
      await screenshot(page, "carrier-05b-loadboard-search-loads");
    } else {
      r.loadboardSearchLoads = false;
    }

    // ── 4. TRUCKS ─────────────────────────────────────────────────────
    console.log("\n[WEB] 4. Trucks");
    await page.goto(`${WEB_URL}/carrier/trucks`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const trucksText = await safeText(page);
    r.trucksPage = hasText(
      trucksText,
      "License Plate",
      "Type",
      "Capacity",
      "Actions"
    );
    console.log(`   Trucks page: ${r.trucksPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-06-trucks-approved");

    // Click tabs: Approved, Pending, Rejected
    r.trucksTabs = {};
    const truckTabs = ["Approved", "Pending", "Rejected"];
    for (const tab of truckTabs) {
      const clicked = await tryClick(
        page,
        [`button:has-text("${tab}")`, `a:has-text("${tab}")`],
        `${tab} tab`
      );
      if (clicked) {
        await sleep(2000);
        r.trucksTabs[tab] = true;
        if (tab === "Pending") {
          await screenshot(page, "carrier-06b-trucks-pending");
        }
      } else {
        r.trucksTabs[tab] = false;
      }
    }
    // Go back to Approved tab for next steps
    await tryClick(
      page,
      ['button:has-text("Approved")', 'a:has-text("Approved")'],
      "Back to Approved"
    );
    await sleep(2000);

    // ── 5. TRUCK DETAIL ───────────────────────────────────────────────
    console.log("\n[WEB] 5. Truck Detail");
    const viewLink = await page.$(
      'a:has-text("View"), a[href*="/carrier/trucks/"]'
    );
    if (viewLink) {
      const truckHref = await viewLink.getAttribute("href");
      console.log(`   Clicking truck: ${truckHref}`);
      await viewLink.click();
      await sleep(3000);

      const truckDetailText = await safeText(page);
      r.truckDetail = hasText(
        truckDetailText,
        "License Plate",
        "Truck Type",
        "Capacity",
        "Status"
      );
      console.log(`   Truck detail: ${r.truckDetail ? "✓" : "✗"}`);
      await screenshot(page, "carrier-06c-truck-detail");
      await page.goBack();
      await sleep(1500);
    } else {
      console.log("   No trucks to click");
      r.truckDetail = false;
    }

    // ── 6. TRUCK ADD FORM ─────────────────────────────────────────────
    console.log("\n[WEB] 6. Truck Add Form");
    await page.goto(`${WEB_URL}/carrier/trucks/add`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(2500);

    const addFormText = await safeText(page);
    r.truckAddForm = hasText(
      addFormText,
      "License",
      "Truck",
      "Plate",
      "Type",
      "Capacity",
      "Register"
    );
    console.log(`   Add form: ${r.truckAddForm ? "✓" : "✗"}`);
    await screenshot(page, "carrier-06d-truck-add-form");

    // ── 7. TRIPS ──────────────────────────────────────────────────────
    console.log("\n[WEB] 7. Trips");
    await page.goto(`${WEB_URL}/carrier/trips`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const tripsText = await safeText(page);
    r.tripsPage = hasText(
      tripsText,
      "Ready to Start",
      "Load",
      "Route",
      "Truck",
      "Status",
      "Actions"
    );
    console.log(`   Trips page: ${r.tripsPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-07-trips-ready");

    // Click Active Trips tab
    console.log("\n[WEB] 7b. Trips → Active Trips");
    const activeTripsClicked = await tryClick(
      page,
      ['button:has-text("Active Trips")', 'a:has-text("Active Trips")'],
      "Active Trips tab"
    );
    if (activeTripsClicked) {
      await sleep(2500);
      r.tripsActive = true;
      await screenshot(page, "carrier-07b-trips-active");
    } else {
      r.tripsActive = false;
    }

    // Go back to Ready to Start for trip detail click
    await tryClick(
      page,
      ['button:has-text("Ready to Start")', 'a:has-text("Ready to Start")'],
      "Back to Ready to Start"
    );
    await sleep(2000);

    // ── 8. TRIP DETAIL ────────────────────────────────────────────────
    console.log("\n[WEB] 8. Trip Detail");
    const tripLink = await page.$(
      'a[href*="/carrier/trips/"], button:has-text("Details"), a:has-text("Details"), a:has-text("View")'
    );
    if (tripLink) {
      const tripHref = await tripLink.getAttribute("href").catch(() => null);
      console.log(`   Clicking trip: ${tripHref || "(button)"}`);
      await tripLink.click();
      await sleep(3000);

      const tripDetailText = await safeText(page);
      r.tripDetail = hasText(
        tripDetailText,
        "Status",
        "Route",
        "Truck",
        "→",
        "Load"
      );
      console.log(`   Trip detail: ${r.tripDetail ? "✓" : "✗"}`);
      await screenshot(page, "carrier-07c-trip-detail");
      await page.goBack();
      await sleep(1500);
    } else {
      // Try Active Trips tab for trip detail
      await tryClick(
        page,
        ['button:has-text("Active Trips")'],
        "Active Trips (for detail)"
      );
      await sleep(2000);
      const activeTripLink = await page.$(
        'a[href*="/carrier/trips/"], button:has-text("Details"), a:has-text("Details")'
      );
      if (activeTripLink) {
        await activeTripLink.click();
        await sleep(3000);
        const tripDetailText = await safeText(page);
        r.tripDetail = hasText(
          tripDetailText,
          "Status",
          "Route",
          "Truck",
          "→",
          "Load"
        );
        console.log(
          `   Trip detail (from active): ${r.tripDetail ? "✓" : "✗"}`
        );
        await screenshot(page, "carrier-07c-trip-detail");
        await page.goBack();
        await sleep(1500);
      } else {
        console.log("   No trips to click");
        r.tripDetail = false;
      }
    }

    // ── 9. TRIP HISTORY ───────────────────────────────────────────────
    console.log("\n[WEB] 9. Trip History");
    await page.goto(`${WEB_URL}/carrier/trip-history`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const tripHistText = await safeText(page);
    r.tripHistory = hasText(
      tripHistText,
      "Trip",
      "History",
      "Completed",
      "Route",
      "Delivered"
    );
    console.log(`   Trip history: ${r.tripHistory ? "✓" : "✗"}`);
    await screenshot(page, "carrier-08-trip-history");

    // ── 10. MAP ───────────────────────────────────────────────────────
    console.log("\n[WEB] 10. Map");
    await page.goto(`${WEB_URL}/carrier/map`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const mapText = await safeText(page);
    r.mapPage = hasText(mapText, "Map", "Fleet", "Track", "Truck");
    console.log(`   Map page: ${r.mapPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-09-map");

    // ── 11. MATCHES ───────────────────────────────────────────────────
    console.log("\n[WEB] 11. Matches");
    await page.goto(`${WEB_URL}/carrier/matches`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(2500);

    const matchesText = await safeText(page);
    r.matchesPage = hasText(matchesText, "Match", "Load", "Truck", "Carrier");
    console.log(`   Matches page: ${r.matchesPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-10-matches");

    // ── 12. REQUESTS ──────────────────────────────────────────────────
    console.log("\n[WEB] 12. Requests");
    await page.goto(`${WEB_URL}/carrier/requests`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const reqText = await safeText(page);
    r.requestsPage = hasText(reqText, "Shipper Requests", "Request", "Load");
    console.log(`   Requests page: ${r.requestsPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-11-requests");

    // Click "My Load Requests" tab
    console.log("\n[WEB] 12b. Requests → My Load Requests");
    const loadReqClicked = await tryClick(
      page,
      ['button:has-text("My Load Requests")', 'a:has-text("My Load Requests")'],
      "My Load Requests tab"
    );
    if (loadReqClicked) {
      await sleep(2000);
      r.requestsLoadRequests = true;
      await screenshot(page, "carrier-11b-requests-load-requests");
    } else {
      r.requestsLoadRequests = false;
    }

    // Click "Match Proposals" tab
    console.log("\n[WEB] 12c. Requests → Match Proposals");
    const proposalsClicked = await tryClick(
      page,
      ['button:has-text("Match Proposals")', 'a:has-text("Match Proposals")'],
      "Match Proposals tab"
    );
    if (proposalsClicked) {
      await sleep(2000);
      r.requestsProposals = true;
      await screenshot(page, "carrier-11c-requests-proposals");
    } else {
      r.requestsProposals = false;
    }

    // ── 13. WALLET ────────────────────────────────────────────────────
    console.log("\n[WEB] 13. Wallet");
    await page.goto(`${WEB_URL}/carrier/wallet`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const walletText = await safeText(page);
    r.walletPage = hasText(
      walletText,
      "Wallet",
      "Balance",
      "Transaction",
      "ETB"
    );
    console.log(`   Wallet page: ${r.walletPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-12-wallet");

    // ── 14. DOCUMENTS ─────────────────────────────────────────────────
    console.log("\n[WEB] 14. Documents");
    await page.goto(`${WEB_URL}/carrier/documents`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(2500);

    const docsText = await safeText(page);
    r.documentsPage = hasText(
      docsText,
      "Document",
      "Upload",
      "Insurance",
      "License"
    );
    console.log(`   Documents page: ${r.documentsPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-13-documents");

    // ── 15. SETTINGS ──────────────────────────────────────────────────
    console.log("\n[WEB] 15. Settings");
    await page.goto(`${WEB_URL}/carrier/settings`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const settingsText = await safeText(page);
    r.settingsPage = hasText(
      settingsText,
      "Settings",
      "Profile",
      "Company",
      "Account",
      "Name",
      "Email"
    );
    console.log(`   Settings page: ${r.settingsPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-14-settings");

    // ── 16. TEAM ──────────────────────────────────────────────────────
    console.log("\n[WEB] 16. Team");
    await page.goto(`${WEB_URL}/carrier/team`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(2500);

    const teamText = await safeText(page);
    r.teamPage = hasText(teamText, "Team", "Member", "Invite", "Driver");
    console.log(`   Team page: ${r.teamPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-15-team");

    // ── 17. GPS ───────────────────────────────────────────────────────
    console.log("\n[WEB] 17. GPS");
    await page.goto(`${WEB_URL}/carrier/gps`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(2500);

    const gpsText = await safeText(page);
    r.gpsPage = hasText(gpsText, "GPS", "Track", "Device", "Location");
    console.log(`   GPS page: ${r.gpsPage ? "✓" : "✗"}`);
    await screenshot(page, "carrier-16-gps");

    // ── 18. SIDEBAR NAVIGATION ────────────────────────────────────────
    console.log("\n[WEB] 18. Sidebar Navigation — verify all links");
    const sidebarLinks = [
      { label: "Dashboard", href: "/carrier/dashboard" },
      { label: "Map", href: "/carrier/map" },
      { label: "Loadboard", href: "/carrier/loadboard" },
      { label: "Requests", href: "/carrier/requests" },
      { label: "My Trucks", href: "/carrier/trucks" },
      { label: "Trips", href: "/carrier/trips" },
      { label: "GPS Tracking", href: "/carrier/gps" },
      { label: "Wallet", href: "/carrier/wallet" },
      { label: "Documents", href: "/carrier/documents" },
    ];

    r.sidebar = {};
    for (const link of sidebarLinks) {
      await page.goto(`${WEB_URL}${link.href}`, {
        waitUntil: "domcontentloaded",
      });
      await sleep(2000);
      const sidebarEl = await page.$(`a[href="${link.href}"]`);
      r.sidebar[link.label] =
        !!sidebarEl &&
        !page.url().includes("error") &&
        !page.url().includes("unauthorized");
      console.log(
        `   ${link.label}: ${r.sidebar[link.label] ? "✓" : "✗"} → ${page.url()}`
      );
    }
  } catch (e) {
    console.log(`\n   ❌ ERROR: ${e.message}`);
    await screenshot(page, "carrier-error").catch(() => {});
    r.error = e.message;
  }

  await context.close();
}

// ========================================================================
// SUMMARY TABLE
// ========================================================================
function printSummaryTable() {
  const r = results.web;

  const features = [
    { name: "Login & redirect", value: r.login },
    { name: "Dashboard stats", value: r.dashboardStats },
    { name: "Dashboard quick actions", value: r.dashboardQuickActions },
    { name: "Dashboard sections", value: r.dashboardSections },
    { name: "Loadboard page", value: r.loadboardPage },
    { name: "Loadboard Search Loads", value: r.loadboardSearchLoads },
    { name: "Trucks page", value: r.trucksPage },
    { name: "Trucks tabs (Approved)", value: r.trucksTabs?.Approved },
    { name: "Trucks tabs (Pending)", value: r.trucksTabs?.Pending },
    { name: "Trucks tabs (Rejected)", value: r.trucksTabs?.Rejected },
    { name: "Truck detail", value: r.truckDetail },
    { name: "Truck add form", value: r.truckAddForm },
    { name: "Trips page", value: r.tripsPage },
    { name: "Trips Active tab", value: r.tripsActive },
    { name: "Trip detail", value: r.tripDetail },
    { name: "Trip history", value: r.tripHistory },
    { name: "Map page", value: r.mapPage },
    { name: "Matches page", value: r.matchesPage },
    { name: "Requests page", value: r.requestsPage },
    { name: "Requests Load Requests", value: r.requestsLoadRequests },
    { name: "Requests Proposals", value: r.requestsProposals },
    { name: "Wallet page", value: r.walletPage },
    { name: "Documents page", value: r.documentsPage },
    { name: "Settings page", value: r.settingsPage },
    { name: "Team page", value: r.teamPage },
    { name: "GPS page", value: r.gpsPage },
  ];

  // Add sidebar results
  if (r.sidebar) {
    for (const [label, value] of Object.entries(r.sidebar)) {
      features.push({ name: `Sidebar: ${label}`, value });
    }
  }

  const mark = (v) => (v === true ? "✓" : v === false ? "✗" : "—");

  console.log("\n" + "═".repeat(50));
  console.log("  CARRIER BROWSER TEST SUMMARY");
  console.log("═".repeat(50));
  console.log("");
  console.log("| Feature                       | Result |");
  console.log("|-------------------------------|--------|");

  let pass = 0,
    fail = 0;
  for (const f of features) {
    const m = mark(f.value);
    if (f.value === true) pass++;
    else if (f.value === false) fail++;
    console.log(`| ${f.name.padEnd(29)} | ${m.padEnd(6)} |`);
  }

  console.log("");
  console.log(
    `Total: ${pass} passed, ${fail} failed, ${features.length - pass - fail} skipped`
  );
}

// ========================================================================
// MAIN
// ========================================================================
async function main() {
  console.log("╔" + "═".repeat(68) + "╗");
  console.log(
    "║  Comprehensive Carrier Browser Test — Web Portal                 ║"
  );
  console.log("║  Date: " + new Date().toISOString().padEnd(60) + "║");
  console.log("╚" + "═".repeat(68) + "╝");

  const browser = await chromium.launch({
    headless: false,
  });

  try {
    await testWebCarrier(browser);
  } finally {
    await browser.close();
  }

  // Print summary
  printSummaryTable();

  // Save results
  writeFileSync(
    `${SCREENSHOT_DIR}/carrier-results.json`,
    JSON.stringify(results, null, 2)
  );
  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}/`);
  console.log(`Results JSON saved to: ${SCREENSHOT_DIR}/carrier-results.json`);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
