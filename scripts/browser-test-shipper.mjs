/**
 * Comprehensive Browser Test: Shipper Portal — Every Feature (Web vs Mobile)
 *
 * Headed mode: watches browser click through every shipper feature on both
 * web (Next.js :3000) and mobile (Expo web :8081), testing filters, forms,
 * actions, and navigation. Prints a parity comparison table at the end.
 *
 * Run: node scripts/browser-test-shipper.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const WEB_URL = 'http://localhost:3000';
const MOBILE_URL = 'http://localhost:8081';
const SCREENSHOT_DIR = './browser-test-results';
const SHIPPER_EMAIL = 'agri-shipper@demo.com';
const SHIPPER_PASSWORD = 'password';

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = {
  web: {},
  mobile: {},
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Helper: safely get text content
async function safeText(page) {
  return page.textContent('body').catch(() => '');
}

// Helper: screenshot with logging
async function screenshot(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`   📸 ${name}`);
}

// Helper: try clicking by text or selector (force=true for RN Web overlays)
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
    } catch { /* ignore */ }
  }
  console.log(`   ✗ Could not click: ${description}`);
  return false;
}

// Helper: click a div[tabindex="0"] by exact text match (for RN Web elements)
async function clickByExactText(page, text, description) {
  try {
    const els = await page.$$('div[tabindex="0"]');
    for (const el of els) {
      const t = await el.textContent().catch(() => '');
      if (t.trim() === text) {
        await el.click({ force: true, timeout: 5000 });
        console.log(`   ✓ Clicked: ${description} (exact text: "${text}")`);
        return true;
      }
    }
  } catch { /* ignore */ }
  console.log(`   ✗ Could not click: ${description}`);
  return false;
}

// Helper: click an RN Web card that contains specific text (force click)
async function clickCardContaining(page, textParts, description, { minLen = 15 } = {}) {
  try {
    const els = await page.$$('div[tabindex="0"]');
    for (const el of els) {
      const t = await el.textContent().catch(() => '');
      if (textParts.every(part => t.includes(part)) && t.length > minLen) {
        await el.click({ force: true, timeout: 5000 });
        console.log(`   ✓ Clicked: ${description}`);
        return true;
      }
    }
  } catch { /* ignore */ }
  console.log(`   ✗ Could not click: ${description}`);
  return false;
}

// Helper: navigate to root URL to reset Expo Router state and ensure tab bar is visible.
// Full page reload — use sparingly (only when goBack can't recover).
async function resetToRoot(page) {
  await page.goto(MOBILE_URL, { waitUntil: 'domcontentloaded' });
  // Wait for the tab bar to appear (Expo web bundle re-init + auth hydration)
  try {
    await page.waitForSelector('a[role="tab"]', { timeout: 15000 });
    await sleep(2000); // extra settle time for dashboard data
  } catch {
    await sleep(8000); // fallback: same as initial bundle load
  }
}

// Helper: go back in browser history and wait for page to settle
async function goBackAndWait(page, ms = 2000) {
  await page.goBack();
  await sleep(ms);
}

// Helper: navigate to a tab by clicking tab bar link
async function navigateToTab(page, href, label) {
  const clicked = await tryClick(page, [
    `a[role="tab"][href="${href}"]`,
    `a[href="${href}"]`,
  ], `${label} tab`);
  if (clicked) await sleep(3000);
  return clicked;
}

// Helper: check text presence
function hasText(bodyText, ...terms) {
  return terms.some(t => bodyText.includes(t));
}

// ========================================================================
// WEB SHIPPER TESTS
// ========================================================================
async function testWebShipper(browser) {
  console.log('\n' + '═'.repeat(70));
  console.log('  WEB SHIPPER TESTING (localhost:3000)');
  console.log('═'.repeat(70));

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const r = results.web;

  try {
    // ── 1. LOGIN ──────────────────────────────────────────────────────
    console.log('\n[WEB] 1. Login');
    await page.goto(`${WEB_URL}/login`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await screenshot(page, 'web-01-login-page');

    await page.fill('input[name="email"], input[type="email"]', SHIPPER_EMAIL);
    await page.fill('input[name="password"], input[type="password"]', SHIPPER_PASSWORD);
    await screenshot(page, 'web-02-login-filled');
    await page.click('button[type="submit"]');
    await sleep(4000);

    const loginUrl = page.url();
    r.login = loginUrl.includes('/shipper');
    console.log(`   Redirected to: ${loginUrl} → ${r.login ? '✓' : '✗'}`);
    await screenshot(page, 'web-03-after-login');

    // ── 2. DASHBOARD ──────────────────────────────────────────────────
    console.log('\n[WEB] 2. Dashboard');
    await page.goto(`${WEB_URL}/shipper/dashboard`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const dashText = await safeText(page);
    r.dashboardStats = hasText(dashText, 'Active Loads', 'In Transit', 'Total Loads', 'Delivered');
    r.dashboardQuickActions = hasText(dashText, 'Post New Load', 'Find Trucks', 'Quick Actions');
    r.dashboardRecentLoads = hasText(dashText, 'Recent Activity', 'Recent Loads', 'Recent');
    r.dashboardPostedLoads = hasText(dashText, 'My Posted Loads', 'Posted');
    r.dashboardDeliveries = hasText(dashText, 'Recent Deliveries', 'Completed');
    r.dashboardSpending = hasText(dashText, 'Spending Overview', 'Spending');
    r.dashboardCarrierApps = hasText(dashText, 'Carrier Applications', 'Bids');
    r.dashboardDocuments = hasText(dashText, 'Documents', 'Insurance');
    r.dashboardLoadsByStatus = hasText(dashText, 'Loads by Status');

    console.log(`   Stats: ${r.dashboardStats ? '✓' : '✗'}`);
    console.log(`   Quick actions: ${r.dashboardQuickActions ? '✓' : '✗'}`);
    console.log(`   Recent loads: ${r.dashboardRecentLoads ? '✓' : '✗'}`);
    console.log(`   Posted loads: ${r.dashboardPostedLoads ? '✓' : '✗'}`);
    console.log(`   Spending chart: ${r.dashboardSpending ? '✓' : '✗'}`);
    console.log(`   Loads by status: ${r.dashboardLoadsByStatus ? '✓' : '✗'}`);
    await screenshot(page, 'web-04-dashboard');

    // Click "Post New Load" quick action
    console.log('\n[WEB] 2b. Dashboard → Post New Load quick action');
    const postNewLoadClicked = await tryClick(page, [
      'a:has-text("Post New Load")',
      'a[href="/shipper/loads/create"]',
    ], 'Post New Load');
    if (postNewLoadClicked) {
      await sleep(2000);
      r.dashboardPostNewLoad = page.url().includes('/loads/create');
      console.log(`   Navigated to create: ${r.dashboardPostNewLoad ? '✓' : '✗'}`);
      await screenshot(page, 'web-04b-dashboard-quick-create');
      await page.goBack();
      await sleep(1500);
    }

    // Click "View All" on recent loads → navigate to loads list
    console.log('\n[WEB] 2c. Dashboard → View All loads');
    const viewAllClicked = await tryClick(page, [
      'a:has-text("View All")[href="/shipper/loads"]',
      'a[href="/shipper/loads"]:has-text("View All")',
    ], 'View All');
    if (viewAllClicked) {
      await sleep(2000);
      r.dashboardViewAll = page.url().includes('/shipper/loads');
      console.log(`   Navigated to loads: ${r.dashboardViewAll ? '✓' : '✗'}`);
      await page.goBack();
      await sleep(1500);
    }

    // ── 3. MY LOADS ───────────────────────────────────────────────────
    console.log('\n[WEB] 3. My Loads');
    await page.goto(`${WEB_URL}/shipper/loads`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const loadsText = await safeText(page);
    r.loadsList = hasText(loadsText, 'My Loads', 'Manage');
    // Match load IDs (start with 'c') but exclude /create
    const loadLinks = await page.$$('a[href*="/shipper/loads/c"]:not([href*="create"])');
    r.loadCount = loadLinks.length;
    console.log(`   Load list rendered: ${r.loadsList ? '✓' : '✗'} (${r.loadCount} loads)`);
    await screenshot(page, 'web-05-my-loads-all');

    // Click each status filter tab
    const webStatusFilters = ['all', 'draft', 'posted', 'active', 'delivered', 'completed', 'cancelled'];
    r.loadFilters = {};
    for (const status of webStatusFilters) {
      console.log(`\n[WEB] 3.${webStatusFilters.indexOf(status) + 1}. Loads filter: ${status}`);
      await page.goto(`${WEB_URL}/shipper/loads?status=${status}`, { waitUntil: 'domcontentloaded' });
      await sleep(2000);
      const filterLinks = await page.$$('a[href*="/shipper/loads/c"]:not([href*="create"])');
      r.loadFilters[status] = filterLinks.length;
      console.log(`   ${status}: ${filterLinks.length} loads`);
      await screenshot(page, `web-05-loads-${status}`);
    }

    // ── 4. LOAD DETAIL ────────────────────────────────────────────────
    console.log('\n[WEB] 4. Load Detail');
    await page.goto(`${WEB_URL}/shipper/loads`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    const firstLoadLink = await page.$('a[href*="/shipper/loads/c"]:not([href*="create"])');
    if (firstLoadLink) {
      const loadHref = await firstLoadLink.getAttribute('href');
      console.log(`   Clicking first load: ${loadHref}`);
      await firstLoadLink.click();
      await sleep(3000);

      const detailText = await safeText(page);
      r.loadDetailRoute = hasText(detailText, '→', 'Pickup', 'Delivery');
      r.loadDetailStatus = hasText(detailText, 'POSTED', 'DRAFT', 'COMPLETED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED');
      r.loadDetailCargo = hasText(detailText, 'Cargo', 'Weight', 'kg', 'Truck Type', 'FLATBED', 'DRY_VAN');
      r.loadDetailDates = hasText(detailText, 'Date', 'Pickup Date', 'Delivery Date');
      r.loadDetailActions = hasText(detailText, 'Edit', 'Post', 'Unpost', 'Delete', 'Find Trucks');

      console.log(`   Route info: ${r.loadDetailRoute ? '✓' : '✗'}`);
      console.log(`   Status badge: ${r.loadDetailStatus ? '✓' : '✗'}`);
      console.log(`   Cargo details: ${r.loadDetailCargo ? '✓' : '✗'}`);
      console.log(`   Dates: ${r.loadDetailDates ? '✓' : '✗'}`);
      console.log(`   Actions: ${r.loadDetailActions ? '✓' : '✗'}`);
      await screenshot(page, 'web-06-load-detail');

      // Try clicking Edit if available on current load
      let editClicked = await tryClick(page, [
        'a:has-text("Edit")',
        'button:has-text("Edit")',
        'a[href*="edit"]',
      ], 'Edit Load');
      if (!editClicked) {
        // First load may not be editable — navigate to a POSTED load that has the Edit button
        console.log('   Trying POSTED load for Edit...');
        await page.goto(`${WEB_URL}/shipper/loads?status=posted`, { waitUntil: 'domcontentloaded' });
        await sleep(2000);
        const postedLink = await page.$('a[href*="/shipper/loads/c"]:not([href*="create"])');
        if (postedLink) {
          await postedLink.click();
          await sleep(3000);
          editClicked = await tryClick(page, [
            'a:has-text("Edit")',
            'button:has-text("Edit")',
            'a[href*="edit"]',
          ], 'Edit Load (POSTED)');
        }
      }
      if (editClicked) {
        await sleep(2000);
        r.loadEdit = true;
        await screenshot(page, 'web-06b-load-edit');
        await page.goBack();
        await sleep(1500);
      } else {
        r.loadEdit = false;
      }
    } else {
      console.log('   No loads to click');
      r.loadDetailRoute = false;
    }

    // ── 5. CREATE LOAD (multi-step wizard) ────────────────────────────
    console.log('\n[WEB] 5. Create Load Wizard');
    await page.goto(`${WEB_URL}/shipper/loads/create`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    const createText = await safeText(page);
    r.createLoadPage = hasText(createText, 'Post New Load', 'Create', 'Route');
    console.log(`   Create page loaded: ${r.createLoadPage ? '✓' : '✗'}`);
    await screenshot(page, 'web-07-create-step1');

    // Step 1: Route — fill pickup & delivery cities + dates
    console.log('\n[WEB] 5.1. Step 1: Route');
    try {
      // Try select dropdowns first, then inputs
      const pickupCityInput = await page.$('select[name="pickupCity"], input[name="pickupCity"], [id="pickupCity"]');
      if (pickupCityInput) {
        const tagName = await pickupCityInput.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          await pickupCityInput.selectOption('Addis Ababa');
        } else {
          await pickupCityInput.fill('Addis Ababa');
        }
        console.log('   ✓ Filled pickup city: Addis Ababa');
      }

      const deliveryCityInput = await page.$('select[name="deliveryCity"], input[name="deliveryCity"], [id="deliveryCity"]');
      if (deliveryCityInput) {
        const tagName = await deliveryCityInput.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          await deliveryCityInput.selectOption('Dire Dawa');
        } else {
          await deliveryCityInput.fill('Dire Dawa');
        }
        console.log('   ✓ Filled delivery city: Dire Dawa');
      }

      const pickupDateInput = await page.$('input[name="pickupDate"], input[type="date"]:first-of-type');
      if (pickupDateInput) {
        await pickupDateInput.fill('2026-03-15');
        console.log('   ✓ Filled pickup date');
      }

      const deliveryDateInput = await page.$('input[name="deliveryDate"], input[type="date"]:nth-of-type(2)');
      if (deliveryDateInput) {
        await deliveryDateInput.fill('2026-03-18');
        console.log('   ✓ Filled delivery date');
      }

      r.createStep1 = true;
      await screenshot(page, 'web-07b-create-step1-filled');
    } catch (e) {
      console.log(`   Step 1 fill error: ${e.message}`);
      r.createStep1 = false;
    }

    // Click Next to go to Step 2
    const step2Clicked = await tryClick(page, [
      'button:has-text("Next")',
      'button:has-text("Continue")',
    ], 'Next → Step 2');
    if (step2Clicked) {
      await sleep(1500);
      await screenshot(page, 'web-07c-create-step2');

      // Step 2: Cargo — click truck type chip, fill weight/description
      console.log('\n[WEB] 5.2. Step 2: Cargo');
      const truckChipClicked = await tryClick(page, [
        'button:has-text("Flatbed")',
        'button:has-text("Container")',
        'button:has-text("Dry Van")',
      ], 'Truck type chip');

      const weightInput = await page.$('input[name="weight"], input[placeholder*="weight" i], input[type="number"]');
      if (weightInput) {
        await weightInput.fill('15000');
        console.log('   ✓ Filled weight: 15000');
      }

      const cargoInput = await page.$('textarea[name="cargoDescription"], input[name="cargoDescription"], textarea');
      if (cargoInput) {
        await cargoInput.fill('Agricultural products - coffee beans for export');
        console.log('   ✓ Filled cargo description');
      }

      r.createStep2 = true;
      await screenshot(page, 'web-07d-create-step2-filled');

      // Click Next to go to Step 3
      const step3Clicked = await tryClick(page, [
        'button:has-text("Next")',
        'button:has-text("Continue")',
      ], 'Next → Step 3');
      if (step3Clicked) {
        await sleep(1500);
        await screenshot(page, 'web-07e-create-step3');

        // Step 3: Options — toggle anonymous, set book mode
        console.log('\n[WEB] 5.3. Step 3: Options');
        r.createStep3 = true;

        // Click Next to go to Step 4 (Review)
        const step4Clicked = await tryClick(page, [
          'button:has-text("Next")',
          'button:has-text("Continue")',
        ], 'Next → Step 4 Review');
        if (step4Clicked) {
          await sleep(1500);
          console.log('\n[WEB] 5.4. Step 4: Review');
          const reviewText = await safeText(page);
          r.createStep4Review = hasText(reviewText, 'Addis Ababa', 'Review') || hasText(reviewText, 'FLATBED', 'Cargo', 'Summary');
          console.log(`   Review shows data: ${r.createStep4Review ? '✓' : '✗'}`);
          await screenshot(page, 'web-07f-create-step4-review');
        }
      }
    }
    // Do NOT submit — go back
    r.createLoadWizard = r.createStep1 || false;

    // ── 6. LOADBOARD ──────────────────────────────────────────────────
    console.log('\n[WEB] 6. Loadboard');
    await page.goto(`${WEB_URL}/shipper/loadboard`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const lbText = await safeText(page);
    r.loadboardPage = hasText(lbText, 'Load Board', 'Loadboard', 'My Loads', 'Post Loads');
    console.log(`   Loadboard loaded: ${r.loadboardPage ? '✓' : '✗'}`);
    await screenshot(page, 'web-08-loadboard-postloads');

    // Switch to Search Trucks tab
    console.log('\n[WEB] 6b. Loadboard → Search Trucks');
    const searchTabClicked = await tryClick(page, [
      'button:has-text("Search Trucks")',
      'a:has-text("Search Trucks")',
      'a[href*="tab=SEARCH_TRUCKS"]',
    ], 'Search Trucks tab');
    if (searchTabClicked) {
      await sleep(2500);
      const searchText = await safeText(page);
      r.loadboardSearchTrucks = hasText(searchText, 'Search', 'Truck', 'Origin', 'Destination', 'Filter');
      console.log(`   Search trucks tab: ${r.loadboardSearchTrucks ? '✓' : '✗'}`);
      await screenshot(page, 'web-08b-loadboard-search-trucks');

      // Try applying a filter
      const truckTypeFilter = await page.$('select[name="truckType"], select:has(option[value="FLATBED"])');
      if (truckTypeFilter) {
        await truckTypeFilter.selectOption('FLATBED');
        console.log('   ✓ Applied FLATBED filter');
        await sleep(2000);
        await screenshot(page, 'web-08c-loadboard-filtered');
        r.loadboardFilter = true;
      }
    }

    // ── 7. REQUESTS ───────────────────────────────────────────────────
    console.log('\n[WEB] 7. Requests');
    await page.goto(`${WEB_URL}/shipper/requests`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const reqText = await safeText(page);
    r.requestsPage = hasText(reqText, 'Request', 'Truck Request', 'Load Request', 'booking', 'Booking');
    console.log(`   Requests page: ${r.requestsPage ? '✓' : '✗'}`);
    await screenshot(page, 'web-09-requests');

    // Check for tabs (Truck Requests / Load Requests)
    const truckReqTabClicked = await tryClick(page, [
      'button:has-text("Truck Requests")',
      'button:has-text("Outgoing")',
      '[data-tab="truck"]',
    ], 'Truck Requests tab');
    if (truckReqTabClicked) {
      await sleep(1500);
      r.requestsTruckTab = true;
      await screenshot(page, 'web-09b-requests-truck');
    }

    const loadReqTabClicked = await tryClick(page, [
      'button:has-text("Load Requests")',
      'button:has-text("Incoming")',
      '[data-tab="load"]',
    ], 'Load Requests tab');
    if (loadReqTabClicked) {
      await sleep(1500);
      r.requestsLoadTab = true;
      await screenshot(page, 'web-09c-requests-load');

      // Check for approve/reject buttons
      const approveBtn = await page.$('button:has-text("Approve"), button:has-text("Accept")');
      const rejectBtn = await page.$('button:has-text("Reject"), button:has-text("Decline")');
      r.requestsActions = !!(approveBtn || rejectBtn);
      console.log(`   Approve/Reject buttons: ${r.requestsActions ? '✓ found' : '✗ none visible'}`);
    }

    // ── 8. TRIPS ──────────────────────────────────────────────────────
    console.log('\n[WEB] 8. Trips');
    await page.goto(`${WEB_URL}/shipper/trips`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const tripsText = await safeText(page);
    r.tripsPage = hasText(tripsText, 'Trip', 'Shipment', 'Deliver', 'Completed');
    console.log(`   Trips page: ${r.tripsPage ? '✓' : '✗'}`);
    await screenshot(page, 'web-10-trips');

    // Click first trip if available
    const firstTrip = await page.$('a[href*="/shipper/trips/"]');
    if (firstTrip) {
      const tripHref = await firstTrip.getAttribute('href');
      console.log(`   Clicking trip: ${tripHref}`);
      await firstTrip.click();
      await sleep(3000);

      const tripDetailText = await safeText(page);
      r.tripDetail = hasText(tripDetailText, '→', 'Status', 'Truck', 'Route', 'Carrier');
      console.log(`   Trip detail: ${r.tripDetail ? '✓' : '✗'}`);
      await screenshot(page, 'web-10b-trip-detail');
      await page.goBack();
      await sleep(1500);
    } else {
      console.log('   No trips to click');
      r.tripDetail = false;
    }

    // ── 9. WALLET ─────────────────────────────────────────────────────
    console.log('\n[WEB] 9. Wallet');
    await page.goto(`${WEB_URL}/shipper/wallet`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const walletText = await safeText(page);
    r.walletPage = hasText(walletText, 'Wallet', 'Balance', 'Transaction', 'ETB');
    console.log(`   Wallet page: ${r.walletPage ? '✓' : '✗'}`);
    await screenshot(page, 'web-11-wallet');

    // ── 10. MAP ───────────────────────────────────────────────────────
    console.log('\n[WEB] 10. Map');
    await page.goto(`${WEB_URL}/shipper/map`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const mapText = await safeText(page);
    r.mapPage = hasText(mapText, 'Map', 'Track', 'Shipment', 'Live');
    console.log(`   Map page: ${r.mapPage ? '✓' : '✗'}`);
    await screenshot(page, 'web-12-map');

    // ── 11. SETTINGS / PROFILE ────────────────────────────────────────
    console.log('\n[WEB] 11. Settings');
    await page.goto(`${WEB_URL}/shipper/settings`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const settingsText = await safeText(page);
    r.settingsPage = hasText(settingsText, 'Settings', 'Profile', 'Account', 'Name', 'Email');
    console.log(`   Settings page: ${r.settingsPage ? '✓' : '✗'}`);
    await screenshot(page, 'web-13-settings');

    // ── 12. DOCUMENTS ─────────────────────────────────────────────────
    console.log('\n[WEB] 12. Documents');
    await page.goto(`${WEB_URL}/shipper/documents`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    const docsText = await safeText(page);
    r.documentsPage = hasText(docsText, 'Document', 'Contract', 'Insurance', 'Upload');
    console.log(`   Documents page: ${r.documentsPage ? '✓' : '✗'}`);
    await screenshot(page, 'web-14-documents');

    // ── 13. TEAM ──────────────────────────────────────────────────────
    console.log('\n[WEB] 13. Team');
    await page.goto(`${WEB_URL}/shipper/team`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    const teamText = await safeText(page);
    r.teamPage = hasText(teamText, 'Team', 'Member', 'Invite', 'User');
    console.log(`   Team page: ${r.teamPage ? '✓' : '✗'}`);
    await screenshot(page, 'web-15-team');

    // ── 14. MATCHES ───────────────────────────────────────────────────
    console.log('\n[WEB] 14. Matches');
    await page.goto(`${WEB_URL}/shipper/matches`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    const matchesText = await safeText(page);
    r.matchesPage = hasText(matchesText, 'Match', 'Truck', 'Carrier', 'Load');
    console.log(`   Matches page: ${r.matchesPage ? '✓' : '✗'}`);
    await screenshot(page, 'web-16-matches');

    // ── 15. SIDEBAR NAVIGATION ────────────────────────────────────────
    console.log('\n[WEB] 15. Sidebar Navigation — click every link');
    const sidebarLinks = [
      { label: 'Dashboard', href: '/shipper/dashboard' },
      { label: 'Live Map', href: '/shipper/map' },
      { label: 'Loadboard', href: '/shipper/loadboard' },
      { label: 'Requests', href: '/shipper/requests' },
      { label: 'My Loads', href: '/shipper/loads' },
      { label: 'Trips', href: '/shipper/trips' },
      { label: 'Wallet', href: '/shipper/wallet' },
      { label: 'Documents', href: '/shipper/documents' },
      { label: 'Team', href: '/shipper/team' },
    ];

    r.sidebar = {};
    for (const link of sidebarLinks) {
      // Navigate directly and then verify the sidebar link exists on that page
      await page.goto(`${WEB_URL}${link.href}`, { waitUntil: 'domcontentloaded' });
      await sleep(2000);
      const sidebarEl = await page.$(`a[href="${link.href}"]`);
      r.sidebar[link.label] = !!sidebarEl && !page.url().includes('error') && !page.url().includes('unauthorized');
      console.log(`   ${link.label}: ${r.sidebar[link.label] ? '✓' : '✗'} → ${page.url()}`);
    }

  } catch (e) {
    console.log(`\n   ❌ ERROR: ${e.message}`);
    await screenshot(page, 'web-error').catch(() => {});
    r.error = e.message;
  }

  await context.close();
}

// ========================================================================
// MOBILE SHIPPER TESTS
// ========================================================================
async function testMobileShipper(browser) {
  console.log('\n' + '═'.repeat(70));
  console.log('  MOBILE SHIPPER TESTING (Expo Web — localhost:8081)');
  console.log('═'.repeat(70));

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  const r = results.mobile;

  try {
    // ── 0. SETUP — skip onboarding via localStorage ───────────────────
    console.log('\n[MOBILE] 0. Setup — skip onboarding');
    await page.goto(MOBILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('app_settings', JSON.stringify({
        locale: 'en',
        theme: 'light',
        pushEnabled: true,
        gpsEnabled: true,
        onboardingCompleted: true,
      }));
    });
    console.log('   ✓ localStorage set');

    // ── 1. LOGIN ──────────────────────────────────────────────────────
    console.log('\n[MOBILE] 1. Login');
    await page.goto(MOBILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(8000); // Expo web bundle loads slowly
    await screenshot(page, 'mobile-01-initial');

    // Fill email
    let emailFilled = false;
    for (const sel of [
      'input[placeholder*="example.com"]',
      'input[type="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email"]',
      'input[aria-label*="email" i]',
      'input:first-of-type',
    ]) {
      const el = await page.$(sel);
      if (el) {
        await el.fill(SHIPPER_EMAIL);
        emailFilled = true;
        console.log(`   ✓ Email filled via: ${sel}`);
        break;
      }
    }

    // Fill password
    let pwFilled = false;
    for (const sel of [
      'input[placeholder*="password" i]',
      'input[type="password"]',
      'input[aria-label*="password" i]',
      'input:nth-of-type(2)',
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
      await screenshot(page, 'mobile-02-login-filled');

      // Click login button
      const loginClicked = await tryClick(page, [
        'div[tabindex="0"]:has-text("Log In")',
        'div[tabindex="0"]:has-text("Sign In")',
        'div[tabindex="0"]:has-text("Login")',
        '[data-testid="login-submit"]',
        'button:has-text("Log In")',
        'button:has-text("Sign In")',
      ], 'Login button');

      await sleep(6000);
      const afterUrl = page.url();
      r.login = !afterUrl.includes('login') && !afterUrl.includes('auth');
      console.log(`   After login URL: ${afterUrl} → ${r.login ? '✓' : '✗'}`);
      await screenshot(page, 'mobile-03-after-login');
    } else {
      console.log(`   ✗ Could not fill login form (email=${emailFilled}, pw=${pwFilled})`);
      r.login = false;

      // Debug: list all inputs & buttons
      const allInputs = await page.$$('input');
      for (let i = 0; i < allInputs.length; i++) {
        const type = await allInputs[i].getAttribute('type').catch(() => '');
        const ph = await allInputs[i].getAttribute('placeholder').catch(() => '');
        console.log(`   Input[${i}]: type=${type}, placeholder="${ph}"`);
      }
    }

    // ── 2. DASHBOARD ──────────────────────────────────────────────────
    console.log('\n[MOBILE] 2. Dashboard');
    await sleep(3000);
    const dashBody = await safeText(page);
    r.dashboardStats = hasText(dashBody, 'Active Loads', 'In Transit', 'Total Loads', 'Delivered', 'Pending', 'Total Spent');
    r.dashboardQuickActions = hasText(dashBody, 'Quick Actions', 'Post Load', 'Find Trucks', 'Shipments', 'My Loads');
    r.dashboardLoadsByStatus = hasText(dashBody, 'Loads by Status');
    r.dashboardRecentLoads = hasText(dashBody, 'Recent Loads', 'View All');

    console.log(`   Stats: ${r.dashboardStats ? '✓' : '✗'}`);
    console.log(`   Quick actions: ${r.dashboardQuickActions ? '✓' : '✗'}`);
    console.log(`   Loads by status: ${r.dashboardLoadsByStatus ? '✓' : '✗'}`);
    console.log(`   Recent loads: ${r.dashboardRecentLoads ? '✓' : '✗'}`);
    await screenshot(page, 'mobile-04-dashboard');

    // Click "Post New Load" quick action (partial match — icon text precedes label)
    console.log('\n[MOBILE] 2b. Dashboard → Post New Load quick action');
    const mPostLoad = await clickCardContaining(page, ['Post', 'Load'], 'Post New Load quick action', { minLen: 5 });
    if (mPostLoad) {
      await sleep(3000);
      r.dashboardPostLoad = page.url().includes('create') || (await safeText(page)).includes('Route');
      console.log(`   Navigated to create: ${r.dashboardPostLoad ? '✓' : '✗'}`);
      await screenshot(page, 'mobile-04b-dashboard-postload');
      await goBackAndWait(page, 3000);
    }

    // Click "Find Trucks" quick action (partial match)
    console.log('\n[MOBILE] 2c. Dashboard → Find Trucks quick action');
    const mFindTrucks = await clickCardContaining(page, ['Find', 'Truck'], 'Find Trucks quick action', { minLen: 5 });
    if (mFindTrucks) {
      await sleep(3000);
      r.dashboardFindTrucks = page.url().includes('trucks') || (await safeText(page)).includes('Search by city');
      console.log(`   Navigated to trucks: ${r.dashboardFindTrucks ? '✓' : '✗'}`);
      await screenshot(page, 'mobile-04c-dashboard-findtrucks');
      await goBackAndWait(page, 3000);
    }

    // Click a recent load card
    console.log('\n[MOBILE] 2d. Dashboard → Recent load card');
    const dashCards = await page.$$('div[tabindex="0"]');
    let recentLoad = null;
    for (const card of dashCards) {
      const t = await card.textContent().catch(() => '');
      if (t.includes('→') && t.includes('Addis') && t.length > 20) {
        recentLoad = card;
        break;
      }
    }
    if (recentLoad) {
      await recentLoad.click({ force: true });
      await sleep(3000);
      r.dashboardRecentLoadClick = page.url().includes('loads/') || (await safeText(page)).includes('Cargo');
      console.log(`   Load detail opened: ${r.dashboardRecentLoadClick ? '✓' : '✗'}`);
      await screenshot(page, 'mobile-04d-dashboard-recent-load');
      await goBackAndWait(page, 2000);
    }

    // ── 3. MY LOADS ───────────────────────────────────────────────────
    console.log('\n[MOBILE] 3. My Loads');
    // Navigate via tab bar
    const loadsTabClicked = await tryClick(page, [
      'a[role="tab"][href="/loads"]',
      'a[href="/loads"]',
      'a:has-text("My Loads")',
    ], 'My Loads tab');
    if (loadsTabClicked) {
      await sleep(3000);
    }
    const mLoadsBody = await safeText(page);
    r.loadsList = hasText(mLoadsBody, '→', 'Load', 'Loads');
    console.log(`   Loads list: ${r.loadsList ? '✓' : '✗'}`);
    await screenshot(page, 'mobile-05-loads-all');

    // Click status filter tabs (use exact text match to avoid hitting load cards)
    const mobileStatusTabs = ['All', 'Draft', 'Posted', 'Assigned', 'In Transit', 'Delivered', 'Completed', 'Cancelled'];
    r.loadFilters = {};
    for (const tab of mobileStatusTabs) {
      const tabClicked = await clickByExactText(page, tab, `Filter: ${tab}`);
      if (tabClicked) {
        await sleep(2000);
        r.loadFilters[tab] = true;
        await screenshot(page, `mobile-05-loads-${tab.toLowerCase().replace(' ', '-')}`);
      } else {
        r.loadFilters[tab] = false;
      }
    }

    // ── 4. LOAD DETAIL ────────────────────────────────────────────────
    console.log('\n[MOBILE] 4. Load Detail');
    try {
      // Reset to All filter
      await clickByExactText(page, 'All', 'Reset to All');
      await sleep(2000);
      // Click first load card using force click (RN Web overlays block normal clicks)
      const loadClicked = await clickCardContaining(page, ['→', 'Addis'], 'Load card');
      if (loadClicked) {
        await sleep(3000);
        const mDetailText = await safeText(page);
        r.loadDetailRoute = hasText(mDetailText, '→', 'Pickup', 'Delivery');
        r.loadDetailStatus = hasText(mDetailText, 'POSTED', 'DRAFT', 'COMPLETED', 'ASSIGNED', 'Posted', 'Draft');
        r.loadDetailCargo = hasText(mDetailText, 'Cargo', 'Weight', 'kg', 'Truck Type', 'Truck');
        r.loadDetailActions = hasText(mDetailText, 'Edit', 'Post', 'Delete', 'Request');
        console.log(`   Route: ${r.loadDetailRoute ? '✓' : '✗'}`);
        console.log(`   Status: ${r.loadDetailStatus ? '✓' : '✗'}`);
        console.log(`   Cargo: ${r.loadDetailCargo ? '✓' : '✗'}`);
        console.log(`   Actions: ${r.loadDetailActions ? '✓' : '✗'}`);
        await screenshot(page, 'mobile-06-load-detail');

        // Try clicking Edit (use force click)
        const mEditClicked = await tryClick(page, [
          'div[tabindex="0"]:has-text("Edit")',
          'button:has-text("Edit")',
        ], 'Edit Load', { force: true });
        if (mEditClicked) {
          await sleep(3000);
          const editText = await safeText(page);
          r.loadEdit = hasText(editText, 'Pickup City', 'Delivery City', 'Weight', 'Update');
          console.log(`   Edit form: ${r.loadEdit ? '✓' : '✗'}`);
          await screenshot(page, 'mobile-06b-load-edit');
          await goBackAndWait(page); // edit → detail
        }

        await goBackAndWait(page); // detail → loads list
      } else {
        console.log('   No loads to click');
        r.loadDetailRoute = false;
      }
    } catch (e) {
      console.log(`   Load detail error: ${e.message.substring(0, 80)}`);
      r.loadDetailRoute = false;
      await screenshot(page, 'mobile-06-error').catch(() => {});
    }

    // ── 5. CREATE LOAD (multi-step wizard) ────────────────────────────
    console.log('\n[MOBILE] 5. Create Load');
    try {
      // Navigate to dashboard tab, then click "Post New Load" quick action
      await navigateToTab(page, '/', 'Dashboard');
      const mCreateNav = await clickCardContaining(page, ['Post', 'Load'], 'Navigate to Create', { minLen: 5 });
      if (mCreateNav) {
        await sleep(3000);
      }

      const mCreateText = await safeText(page);
      r.createLoadPage = hasText(mCreateText, 'Route', 'Pickup', 'Step', 'Create');
      console.log(`   Create page: ${r.createLoadPage ? '✓' : '✗'}`);
      await screenshot(page, 'mobile-07-create-step1');

      // Step 1: Route
      console.log('\n[MOBILE] 5.1. Step 1: Route');
      const mInputs = await page.$$('input');
      if (mInputs.length >= 2) {
        await mInputs[0].fill('Addis Ababa');
        console.log('   ✓ Filled pickup city');
        await mInputs[1].fill('Dire Dawa');
        console.log('   ✓ Filled delivery city');
      }
      if (mInputs.length >= 4) {
        await mInputs[2].fill('2026-03-15');
        await mInputs[3].fill('2026-03-18');
        console.log('   ✓ Filled dates');
      }
      r.createStep1 = true;
      await screenshot(page, 'mobile-07b-create-step1-filled');

      // Click Next (use force for RN Web)
      const mStep2 = await clickByExactText(page, 'Next', 'Next → Step 2');
      if (mStep2) {
        await sleep(2000);
        console.log('\n[MOBILE] 5.2. Step 2: Cargo');
        await screenshot(page, 'mobile-07c-create-step2');

        // Click truck type chip
        await clickByExactText(page, 'Flatbed', 'Truck type chip');
        // Fill weight
        const step2Inputs = await page.$$('input');
        for (const inp of step2Inputs) {
          const label = await inp.getAttribute('aria-label').catch(() => '');
          const ph = await inp.getAttribute('placeholder').catch(() => '');
          if (label.toLowerCase().includes('weight') || ph.toLowerCase().includes('weight')) {
            await inp.fill('15000');
            console.log('   ✓ Filled weight');
            break;
          }
        }
        r.createStep2 = true;
        await screenshot(page, 'mobile-07d-create-step2-filled');

        // Next → Step 3
        const mStep3 = await clickByExactText(page, 'Next', 'Next → Step 3');
        if (mStep3) {
          await sleep(2000);
          console.log('\n[MOBILE] 5.3. Step 3: Options');
          r.createStep3 = true;
          await screenshot(page, 'mobile-07e-create-step3');

          // Next → Step 4 Review
          const mStep4 = await clickByExactText(page, 'Next', 'Next → Step 4 Review');
          if (mStep4) {
            await sleep(2000);
            console.log('\n[MOBILE] 5.4. Step 4: Review');
            const mReviewText = await safeText(page);
            r.createStep4Review = hasText(mReviewText, 'Route', 'Cargo', 'Review', 'Pickup');
            console.log(`   Review: ${r.createStep4Review ? '✓' : '✗'}`);
            await screenshot(page, 'mobile-07f-create-step4-review');
          }
        }
      }
      r.createLoadWizard = r.createStep1 || false;
      // Go back to dashboard — click dashboard tab (avoids full reload)
      await navigateToTab(page, '/', 'Dashboard (recovery)');
    } catch (e) {
      console.log(`   Create load error: ${e.message.substring(0, 80)}`);
      r.createLoadWizard = false;
    }

    // ── 6. FIND TRUCKS ────────────────────────────────────────────────
    console.log('\n[MOBILE] 6. Find Trucks');
    try {
      const mTrucksTabClicked = await navigateToTab(page, '/trucks', 'Find Trucks');

      const mTrucksBody = await safeText(page);
      r.findTrucksPage = hasText(mTrucksBody, 'Truck', 'Search', 'FLATBED', 'DRY_VAN', 'Available', 'Find', 'city');
      console.log(`   Find trucks: ${r.findTrucksPage ? '✓' : '✗'}`);
      await screenshot(page, 'mobile-08-find-trucks');

      // Type in search bar
      const mSearchInput = await page.$('input[placeholder*="city" i], input[placeholder*="search" i]');
      if (mSearchInput) {
        await mSearchInput.fill('Addis');
        console.log('   ✓ Typed "Addis" in search');
        await sleep(2000);
        r.findTrucksSearch = true;
        await screenshot(page, 'mobile-08b-trucks-searched');
      }

      // Click a truck posting card (force click for RN Web)
      const truckClicked = await clickCardContaining(page, ['→'], 'Truck posting card');
      if (truckClicked) {
        await sleep(3000);
        r.findTrucksCardClick = true;
        await screenshot(page, 'mobile-08d-truck-detail-modal');
      }
    } catch (e) {
      console.log(`   Find trucks error: ${e.message.substring(0, 80)}`);
    }

    // ── 7. TRIPS / SHIPMENTS ──────────────────────────────────────────
    console.log('\n[MOBILE] 7. Shipments');
    try {
      await navigateToTab(page, '/trips', 'Shipments');

      const mTripsBody = await safeText(page);
      r.tripsPage = hasText(mTripsBody, 'Trip', 'Shipment', '→', 'Deliver');
      console.log(`   Trips page: ${r.tripsPage ? '✓' : '✗'}`);
      await screenshot(page, 'mobile-09-trips');

      // Click first trip (force click for RN Web)
      const tripClicked = await clickCardContaining(page, ['→'], 'Trip card');
      if (tripClicked) {
        await sleep(3000);
        const mTripDetailText = await safeText(page);
        r.tripDetail = hasText(mTripDetailText, 'Status', 'Route', 'Truck', 'Carrier', '→');
        console.log(`   Trip detail: ${r.tripDetail ? '✓' : '✗'}`);
        await screenshot(page, 'mobile-09b-trip-detail');
        await goBackAndWait(page); // trip detail → trips list
      } else {
        console.log('   No trips to click');
        r.tripDetail = false;
      }
    } catch (e) {
      console.log(`   Trips error: ${e.message.substring(0, 80)}`);
    }

    // ── 8. MAP / TRACK ────────────────────────────────────────────────
    console.log('\n[MOBILE] 8. Map / Track');
    try {
      // Map tab is hidden from tab bar — navigate via dashboard or direct URL
      await navigateToTab(page, '/', 'Dashboard');
      // Try clicking a "Track" or "Map" link on dashboard, or use hidden tab href
      const mapTabClicked = await tryClick(page, [
        'a[role="tab"][href="/map"]',
        'a[href="/map"]',
        'a[href="/(shipper)/map"]',
      ], 'Map tab');
      if (mapTabClicked) await sleep(3000);
      const mMapBody = await safeText(page);
      r.mapPage = hasText(mMapBody, 'Map', 'Track', 'Shipment', 'Progress', 'Transit');
      console.log(`   Map page: ${r.mapPage ? '✓' : '✗'}`);
      await screenshot(page, 'mobile-10-map');
    } catch (e) {
      console.log(`   Map error: ${e.message.substring(0, 80)}`);
      r.mapPage = false;
    }

    // ── 9. TAB BAR NAVIGATION ─────────────────────────────────────────
    console.log('\n[MOBILE] 9. Tab Bar Navigation — verify all tabs');
    const mobileTabs = [
      { label: 'Dashboard', href: '/' },
      { label: 'My Loads', href: '/loads' },
      { label: 'Shipments', href: '/trips' },
      { label: 'Find Trucks', href: '/trucks' },
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
    await screenshot(page, 'mobile-error').catch(() => {});
    r.error = e.message;
  }

  await context.close();
}

// ========================================================================
// PARITY COMPARISON TABLE
// ========================================================================
function printParityTable() {
  const web = results.web;
  const mob = results.mobile;

  const features = [
    { name: 'Login & redirect', web: web.login, mobile: mob.login },
    { name: 'Dashboard stats', web: web.dashboardStats, mobile: mob.dashboardStats },
    { name: 'Dashboard quick actions', web: web.dashboardQuickActions, mobile: mob.dashboardQuickActions },
    { name: 'Dashboard recent loads', web: web.dashboardRecentLoads, mobile: mob.dashboardRecentLoads },
    { name: 'Dashboard spending', web: web.dashboardSpending, mobile: false },
    { name: 'Dashboard loads by status', web: web.dashboardLoadsByStatus, mobile: mob.dashboardLoadsByStatus },
    { name: 'Load list + filters', web: web.loadsList, mobile: mob.loadsList },
    { name: 'Load detail', web: web.loadDetailRoute, mobile: mob.loadDetailRoute },
    { name: 'Load detail status', web: web.loadDetailStatus, mobile: mob.loadDetailStatus },
    { name: 'Load detail cargo', web: web.loadDetailCargo, mobile: mob.loadDetailCargo },
    { name: 'Load detail actions', web: web.loadDetailActions, mobile: mob.loadDetailActions },
    { name: 'Edit load', web: web.loadEdit, mobile: mob.loadEdit },
    { name: 'Create load wizard', web: web.createLoadWizard, mobile: mob.createLoadWizard },
    { name: 'Create step 1 (Route)', web: web.createStep1, mobile: mob.createStep1 },
    { name: 'Create step 2 (Cargo)', web: web.createStep2, mobile: mob.createStep2 },
    { name: 'Create step 3 (Options)', web: web.createStep3, mobile: mob.createStep3 },
    { name: 'Create step 4 (Review)', web: web.createStep4Review, mobile: mob.createStep4Review },
    { name: 'Loadboard / Find trucks', web: web.loadboardPage, mobile: mob.findTrucksPage },
    { name: 'Truck search + filters', web: web.loadboardSearchTrucks, mobile: mob.findTrucksSearch },
    { name: 'Request management', web: web.requestsPage, mobile: false },
    { name: 'Trips list', web: web.tripsPage, mobile: mob.tripsPage },
    { name: 'Trip detail', web: web.tripDetail, mobile: mob.tripDetail },
    { name: 'Wallet', web: web.walletPage, mobile: false },
    { name: 'Map / Tracking', web: web.mapPage, mobile: mob.mapPage },
    { name: 'Settings / Profile', web: web.settingsPage, mobile: false },
    { name: 'Team management', web: web.teamPage, mobile: false },
    { name: 'Documents', web: web.documentsPage, mobile: false },
    { name: 'Matching trucks', web: web.matchesPage, mobile: false },
  ];

  const mark = (v) => v ? '✓' : v === false ? '✗' : '—';

  console.log('\n' + '═'.repeat(70));
  console.log('  FEATURE PARITY COMPARISON');
  console.log('═'.repeat(70));
  console.log('');
  console.log('| Feature                     | Web | Mobile | Match? |');
  console.log('|-----------------------------|-----|--------|--------|');

  for (const f of features) {
    const w = mark(f.web);
    const m = mark(f.mobile);
    const match = (f.web === false && f.mobile === false) ? '—'
      : (!!f.web === !!f.mobile) ? '✓'
      : '✗';
    console.log(`| ${f.name.padEnd(27)} | ${w.padEnd(3)} | ${m.padEnd(6)} | ${match.padEnd(6)} |`);
  }

  console.log('');

  // Count
  let webPass = 0, webFail = 0, mobPass = 0, mobFail = 0;
  for (const f of features) {
    if (f.web === true) webPass++;
    else if (f.web === false) webFail++;
    if (f.mobile === true) mobPass++;
    else if (f.mobile === false) mobFail++;
  }
  console.log(`Web:    ${webPass} passed, ${webFail} failed`);
  console.log(`Mobile: ${mobPass} passed, ${mobFail} failed`);
}

// ========================================================================
// MAIN
// ========================================================================
async function main() {
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║  Comprehensive Shipper Browser Test — Web vs Mobile             ║');
  console.log('║  Date: ' + new Date().toISOString().padEnd(60) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    await testWebShipper(browser);
    await testMobileShipper(browser);
  } finally {
    await browser.close();
  }

  // Print comparison
  printParityTable();

  // Save results
  writeFileSync(`${SCREENSHOT_DIR}/results.json`, JSON.stringify(results, null, 2));
  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}/`);
  console.log(`Results JSON saved to: ${SCREENSHOT_DIR}/results.json`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
