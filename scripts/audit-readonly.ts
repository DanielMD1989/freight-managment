/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * READ-ONLY DOM AUDIT
 *
 * The user's instructions:
 *  - No testIDs added.
 *  - No app code changed.
 *  - Open every page with Playwright as a real user would.
 *  - Read every visible number from the rendered DOM.
 *  - Compare to the database.
 *  - Report honestly.
 *  - If a number isn't on the page, write "not shown on UI".
 *  - If a number doesn't match the database, write the mismatch.
 *  - Do not change anything to make the test pass.
 *
 * Method:
 *  1. Login each role via /api/auth/login (HTTP only — no UI auth)
 *  2. Navigate Playwright to each page with the session cookie
 *  3. For each page, capture (a) the full visible text and
 *     (b) every number-bearing DOM node and the nearest preceding label.
 *  4. For each "expected metric" the user listed in the brief,
 *     try to find that number in the rendered DOM. If not found,
 *     report "not shown on UI". If found, compare to DB.
 *  5. Output a markdown report.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { db: prisma } = require("../lib/db");
const { reconcileWallet } = require("../lib/walletReconcile");
const { chromium } = require("playwright");

const BASE_URL = "http://localhost:3000";

interface PageReport {
  role: string;
  user: string;
  page: string;
  url: string;
  visibleNumbers: Array<{ label: string; value: string }>;
  metrics: Array<{
    metric: string;
    db: number | string;
    onScreen: string | "not shown on UI";
    match: "✅" | "❌" | "—" /* not shown */;
    note?: string;
  }>;
  pageText?: string;
  errors?: string[];
}

const reports: PageReport[] = [];

// ─── Auth ───────────────────────────────────────────────────────────────────

async function login(
  email: string,
  password = "Test123!"
): Promise<{ cookie: string } | null> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    console.error(`login ${email} → ${res.status}`);
    return null;
  }
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/session=([^;]+)/);
  return m ? { cookie: m[1] } : null;
}

// ─── DOM extraction (no testIDs — pure visible-text reading) ────────────────

/**
 * Find the number visible "near" a label using Playwright's text locators.
 * Strategy:
 *   1. Find the element whose visible text exactly matches the label
 *   2. Walk up to its grandparent (StatCard wraps icon + value + label)
 *   3. Within that grandparent, find elements whose text matches a number
 *      pattern AND is not the label itself
 *
 * Returns the parsed number, or null if no clean numeric is adjacent.
 */
async function readNumberByLabel(
  page: any,
  labelExact: string
): Promise<{ raw: string | null; parsed: number | null }> {
  // Pass the function as a string to avoid tsx __name() transpilation
  // which inserts undefined references into the browser context.
  const fnSource = `(labelText) => {
    var numRe = /^[-+]?\\d[\\d,]*(\\.\\d+)?$/;
    var moneyRe = /^[-+]?(ETB\\s*)?[\\d,]+(\\.\\d+)?(\\s*ETB)?$/;
    var percentRe = /^[\\d.]+%$/;
    var labelHosts = [];
    // Strategy 1: leaf elements whose text content is exactly the label
    var all = Array.prototype.slice.call(document.querySelectorAll("*"));
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.children.length > 0) continue;
      var t1 = (el.textContent || "").trim();
      if (t1 === labelText) labelHosts.push(el);
    }
    // Strategy 2: elements that have a TEXT NODE child whose trimmed value
    // equals the label (e.g. <button>Approved <span>20</span></button>).
    // The "host" is the parent element so the search walks from there.
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var tn = (node.nodeValue || "").trim();
      if (tn === labelText) {
        var parent = node.parentElement;
        if (parent && labelHosts.indexOf(parent) === -1) labelHosts.push(parent);
      }
    }
    if (labelHosts.length === 0) return { raw: null, parsed: null };
    var checkText = function (t) {
      if (!t || t.length > 30) return null;
      if (t === labelText) return null;
      if (/^(19|20|21)\\d{2}$/.test(t.replace(/,/g, ""))) return null;
      if (moneyRe.test(t)) {
        var n = parseFloat(t.replace(/[,% ETB]/g, "").trim());
        if (!isNaN(n)) return { raw: t, parsed: n };
      }
      if (numRe.test(t)) {
        return { raw: t, parsed: parseFloat(t.replace(/,/g, "")) };
      }
      if (percentRe.test(t)) {
        return { raw: t, parsed: parseFloat(t.replace(/%/g, "")) };
      }
      return null;
    };
    for (var k = 0; k < labelHosts.length; k++) {
      var labelEl = labelHosts[k];
      // Strategy A: descendants of labelEl (e.g. span inside button)
      var descendants = Array.prototype.slice.call(labelEl.querySelectorAll("*"));
      for (var j = 0; j < descendants.length; j++) {
        var c = descendants[j];
        if (c.children.length > 0) continue;
        var rA = checkText((c.textContent || "").trim());
        if (rA) return rA;
      }
      // Strategy B: only LEAF siblings of labelEl (or leaf children of
      // labelEl's parent). We do NOT recurse into siblings — if a sibling
      // has children of its own, it's its own labeled unit (e.g. another
      // button in a tab bar), and grabbing its inner number would be wrong.
      var parent = labelEl.parentElement;
      if (parent) {
        var siblings = Array.prototype.slice.call(parent.children);
        for (var s = 0; s < siblings.length; s++) {
          var sib = siblings[s];
          if (sib === labelEl || sib.contains(labelEl)) continue;
          // Only consider true leaves so we don't grab a number from a
          // peer "card" or "button" that has its own label.
          if (sib.children.length > 0) continue;
          var rB = checkText((sib.textContent || "").trim());
          if (rB) return rB;
        }
      }
    }
    return { raw: null, parsed: null };
  }`;
  try {
    // eslint-disable-next-line no-eval
    const fn = eval(fnSource);
    return await page.evaluate(fn, labelExact);
  } catch (e: any) {
    console.error(
      `  readNumberByLabel("${labelExact}") threw:`,
      e?.message ?? e
    );
    return { raw: null, parsed: null };
  }
}

async function getPageText(page: any): Promise<string> {
  return page.evaluate(() =>
    document.body.innerText.replace(/\s+/g, " ").trim()
  );
}

async function compareByLabel(
  page: any,
  metric: string,
  db: number | string,
  labelText: string
): Promise<PageReport["metrics"][number]> {
  const found = await readNumberByLabel(page, labelText);
  if (found.raw == null) {
    return {
      metric,
      db,
      onScreen: "not shown on UI",
      match: "—",
      note: `looked for label "${labelText}"`,
    };
  }
  if (found.parsed != null && found.parsed === Number(db)) {
    return { metric, db, onScreen: found.raw, match: "✅" };
  }
  return { metric, db, onScreen: found.raw, match: "❌" };
}

async function visitPage(
  browser: any,
  cookie: string,
  url: string,
  onPage: (page: any) => Promise<PageReport["metrics"]>
): Promise<PageReport["metrics"]> {
  const ctx = await browser.newContext();
  await ctx.addCookies([
    {
      name: "session",
      value: cookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    },
  ]);
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000); // hydration + client fetch
    return await onPage(page);
  } finally {
    await page.close();
    await ctx.close();
  }
}

// ─── Per-role audit ─────────────────────────────────────────────────────────

async function auditShipper(browser: any, email: string) {
  console.log(`\n--- Shipper ${email} ---`);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { organizationId: true },
  });
  if (!user?.organizationId) return;
  const auth = await login(email);
  if (!auth) return;

  // ── DB ground truth
  const dbTotalLoads = await prisma.load.count({
    where: { shipperId: user.organizationId },
  });
  const dbActiveLoads = await prisma.load.count({
    where: {
      shipperId: user.organizationId,
      status: {
        in: ["POSTED", "SEARCHING", "OFFERED", "ASSIGNED", "PICKUP_PENDING"],
      },
    },
  });
  const dbInTransit = await prisma.load.count({
    where: { shipperId: user.organizationId, status: "IN_TRANSIT" },
  });
  const dbDelivered = await prisma.load.count({
    where: {
      shipperId: user.organizationId,
      status: { in: ["DELIVERED", "COMPLETED"] },
    },
  });
  const dbDraft = await prisma.load.count({
    where: { shipperId: user.organizationId, status: "DRAFT" },
  });
  const dbPosted = await prisma.load.count({
    where: { shipperId: user.organizationId, status: "POSTED" },
  });
  const dbCancelled = await prisma.load.count({
    where: { shipperId: user.organizationId, status: "CANCELLED" },
  });
  const wallet = await prisma.financialAccount.findFirst({
    where: {
      organizationId: user.organizationId,
      accountType: "SHIPPER_WALLET",
    },
  });
  const dbBalance = wallet
    ? (await reconcileWallet(wallet.id)).computedBalance
    : 0;
  const dbTxCount = wallet
    ? await prisma.journalEntry.count({
        where: { lines: { some: { accountId: wallet.id } } },
      })
    : 0;
  const dbTripCount = await prisma.trip.count({
    where: { shipperId: user.organizationId },
  });

  // ── /shipper/dashboard
  const dashMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/shipper/dashboard`,
    async (page) => [
      await compareByLabel(
        page,
        "Total Loads (card)",
        dbTotalLoads,
        "Total Loads Posted"
      ),
      await compareByLabel(
        page,
        "Active Shipments (card)",
        dbInTransit,
        "Active Shipments"
      ),
      await compareByLabel(
        page,
        "Delivered This Month (card)",
        dbDelivered,
        "Delivered This Month"
      ),
      await compareByLabel(
        page,
        "Pending Loads (card)",
        dbActiveLoads,
        "Pending Loads"
      ),
    ]
  );
  reports.push({
    role: "Shipper",
    user: email,
    page: "Dashboard",
    url: "/shipper/dashboard",
    visibleNumbers: [],
    metrics: dashMetrics,
  });

  // ── /shipper/loads (default = all)
  const loadsMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/shipper/loads`,
    async (page) => [
      await compareByLabel(
        page,
        "Loads grand total (next to 'Total:' label)",
        dbTotalLoads,
        "Total:"
      ),
    ]
  );
  reports.push({
    role: "Shipper",
    user: email,
    page: "Loads list",
    url: "/shipper/loads",
    visibleNumbers: [],
    metrics: loadsMetrics,
  });

  // ── /shipper/loads?status=POSTED
  const loadsPostedMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/shipper/loads?status=posted`,
    async (page) => [
      await compareByLabel(
        page,
        "Loads filtered POSTED total",
        dbPosted,
        "Total:"
      ),
    ]
  );
  reports.push({
    role: "Shipper",
    user: email,
    page: "Loads list (POSTED filter)",
    url: "/shipper/loads?status=posted",
    visibleNumbers: [],
    metrics: loadsPostedMetrics,
  });

  // ── /shipper/loads?status=draft
  const loadsDraftMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/shipper/loads?status=draft`,
    async (page) => [
      await compareByLabel(
        page,
        "Loads filtered DRAFT total",
        dbDraft,
        "Total:"
      ),
    ]
  );
  reports.push({
    role: "Shipper",
    user: email,
    page: "Loads list (DRAFT filter)",
    url: "/shipper/loads?status=draft",
    visibleNumbers: [],
    metrics: loadsDraftMetrics,
  });

  // ── /shipper/loads?status=cancelled
  const loadsCancelledMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/shipper/loads?status=cancelled`,
    async (page) => [
      await compareByLabel(
        page,
        "Loads filtered CANCELLED total",
        dbCancelled,
        "Total:"
      ),
    ]
  );
  reports.push({
    role: "Shipper",
    user: email,
    page: "Loads list (CANCELLED filter)",
    url: "/shipper/loads?status=cancelled",
    visibleNumbers: [],
    metrics: loadsCancelledMetrics,
  });

  // ── /shipper/trips
  // Page only shows pagination text "Showing X to Y of N trips" if pages>1.
  // With 7 trips and limit=20, no pagination footer renders → no total visible.
  const tripsMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/shipper/trips`,
    async (page) => [
      await compareByLabel(
        page,
        "Shipper trips grand total (pagination footer)",
        dbTripCount,
        "trips"
      ),
    ]
  );
  reports.push({
    role: "Shipper",
    user: email,
    page: "Trips list",
    url: "/shipper/trips",
    visibleNumbers: [],
    metrics: tripsMetrics,
  });

  // ── /shipper/wallet
  const walletMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/shipper/wallet`,
    async (page) => [
      await compareByLabel(
        page,
        "Wallet Current Balance",
        dbBalance,
        "Current Balance"
      ),
    ]
  );
  reports.push({
    role: "Shipper",
    user: email,
    page: "Wallet",
    url: "/shipper/wallet",
    visibleNumbers: [],
    metrics: walletMetrics,
  });
}

async function auditCarrier(browser: any, email: string) {
  console.log(`\n--- Carrier ${email} ---`);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { organizationId: true },
  });
  if (!user?.organizationId) return;
  const auth = await login(email);
  if (!auth) return;

  const dbTotalTrucks = await prisma.truck.count({
    where: { carrierId: user.organizationId },
  });
  const dbApprovedTrucks = await prisma.truck.count({
    where: { carrierId: user.organizationId, approvalStatus: "APPROVED" },
  });
  const dbPendingTrucks = await prisma.truck.count({
    where: { carrierId: user.organizationId, approvalStatus: "PENDING" },
  });
  const dbRejectedTrucks = await prisma.truck.count({
    where: { carrierId: user.organizationId, approvalStatus: "REJECTED" },
  });
  // Active postings — the carrier dashboard's API returns activePostings, but
  // the dashboard JSX may not render it; we still measure DB so we can report.
  const dbActivePostings = await prisma.truckPosting.count({
    where: { carrierId: user.organizationId, status: "ACTIVE" },
  });
  void dbActivePostings;
  const dbCompletedTrips = await prisma.trip.count({
    where: {
      carrierId: user.organizationId,
      status: { in: ["DELIVERED", "COMPLETED"] },
    },
  });
  const dbInTransitTrips = await prisma.trip.count({
    where: { carrierId: user.organizationId, status: "IN_TRANSIT" },
  });
  const wallet = await prisma.financialAccount.findFirst({
    where: {
      organizationId: user.organizationId,
      accountType: "CARRIER_WALLET",
    },
  });
  const dbBalance = wallet
    ? (await reconcileWallet(wallet.id)).computedBalance
    : 0;
  const dbTxCount = wallet
    ? await prisma.journalEntry.count({
        where: { lines: { some: { accountId: wallet.id } } },
      })
    : 0;

  // ── /carrier/dashboard
  const dashMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/carrier/dashboard`,
    async (page) => [
      await compareByLabel(page, "Total Trucks", dbTotalTrucks, "Total Trucks"),
      await compareByLabel(
        page,
        "Available Trucks",
        dbApprovedTrucks,
        "Available Trucks"
      ),
      // The dashboard does NOT have a card titled "Active Postings"; the value is sent
      // in the API but the carrier dashboard renders "Trucks on Job", "Pending Approvals", etc.
      // We'll check whether "Active Postings" appears at all.
      await compareByLabel(
        page,
        "Active Postings (named card)",
        dbActivePostings,
        "Active Postings"
      ),
      await compareByLabel(
        page,
        "Pending Approvals (card)",
        dbPendingTrucks,
        "Pending Approvals"
      ),
    ]
  );
  reports.push({
    role: "Carrier",
    user: email,
    page: "Dashboard",
    url: "/carrier/dashboard",
    visibleNumbers: [],
    metrics: dashMetrics,
  });

  // ── /carrier/trucks (tab counts in tab buttons)
  const trucksMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/carrier/trucks`,
    async (page) => [
      await compareByLabel(
        page,
        "Trucks tab count APPROVED",
        dbApprovedTrucks,
        "Approved"
      ),
      await compareByLabel(
        page,
        "Trucks tab count PENDING",
        dbPendingTrucks,
        "Pending"
      ),
      await compareByLabel(
        page,
        "Trucks tab count REJECTED",
        dbRejectedTrucks,
        "Rejected"
      ),
    ]
  );
  reports.push({
    role: "Carrier",
    user: email,
    page: "Trucks list",
    url: "/carrier/trucks",
    visibleNumbers: [],
    metrics: trucksMetrics,
  });

  // ── /carrier/wallet
  const walletMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/carrier/wallet`,
    async (page) => [
      await compareByLabel(
        page,
        "Wallet Current Balance",
        dbBalance,
        "Current Balance"
      ),
    ]
  );
  reports.push({
    role: "Carrier",
    user: email,
    page: "Wallet",
    url: "/carrier/wallet",
    visibleNumbers: [],
    metrics: walletMetrics,
  });
}

async function auditDispatcher(browser: any) {
  console.log(`\n--- Dispatcher ---`);
  const auth = await login("dispatcher@test.com", "password");
  if (!auth) return;

  const dbPosted = await prisma.load.count({ where: { status: "POSTED" } });
  const dbAvailable = await prisma.truckPosting.count({
    where: { status: "ACTIVE" },
  });
  const dbAssigned = await prisma.load.count({ where: { status: "ASSIGNED" } });
  const dbInTransit = await prisma.load.count({
    where: { status: "IN_TRANSIT" },
  });
  const dbException = await prisma.trip.count({
    where: { status: "EXCEPTION" },
  });
  const dbPendingProposals = await prisma.matchProposal.count({
    where: { status: "PENDING" },
  });

  const dashMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/dispatcher/dashboard`,
    async (page) => [
      await compareByLabel(
        page,
        "Unassigned Loads (card)",
        dbPosted,
        "Unassigned Loads"
      ),
      await compareByLabel(
        page,
        "Available Trucks (card)",
        dbAvailable,
        "Available Trucks"
      ),
      await compareByLabel(
        page,
        "Assigned Loads (card)",
        dbAssigned,
        "Assigned Loads"
      ),
      await compareByLabel(
        page,
        "In Transit (card)",
        dbInTransit,
        "In Transit"
      ),
      await compareByLabel(
        page,
        "Exceptions (card)",
        dbException,
        "Exceptions"
      ),
      await compareByLabel(
        page,
        "Pending Proposals (card)",
        dbPendingProposals,
        "Pending Proposals"
      ),
    ]
  );
  reports.push({
    role: "Dispatcher",
    user: "dispatcher@test.com",
    page: "Dashboard",
    url: "/dispatcher/dashboard",
    visibleNumbers: [],
    metrics: dashMetrics,
  });
}

async function auditAdmin(browser: any, email: string, role: string) {
  console.log(`\n--- ${role} ---`);
  const auth = await login(email);
  if (!auth) return;

  const dbUsers = await prisma.user.count();
  const dbOrgs = await prisma.organization.count();
  const dbLoads = await prisma.load.count();
  const dbTrucks = await prisma.truck.count();
  const dbTrips = await prisma.trip.count();
  const dbDisputes = await prisma.dispute.count({ where: { status: "OPEN" } });
  const dbWithdrawals = await prisma.withdrawalRequest.count({
    where: { status: "PENDING" },
  });

  // ── /admin (main dashboard)
  const dashMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/admin`,
    async (page) => [
      await compareByLabel(page, "Total Users (card)", dbUsers, "Total Users"),
      await compareByLabel(
        page,
        "Organizations (card)",
        dbOrgs,
        "Organizations"
      ),
      await compareByLabel(page, "Total Loads (card)", dbLoads, "Total Loads"),
      await compareByLabel(
        page,
        "Total Trucks (card)",
        dbTrucks,
        "Total Trucks"
      ),
      await compareByLabel(
        page,
        "Open Disputes (card)",
        dbDisputes,
        "Open Disputes"
      ),
      await compareByLabel(
        page,
        "Pending Withdrawals (card)",
        dbWithdrawals,
        "Pending Withdrawals"
      ),
    ]
  );
  reports.push({
    role,
    user: email,
    page: "Dashboard",
    url: "/admin",
    visibleNumbers: [],
    metrics: dashMetrics,
  });

  // ── /admin/loads — page renders "{N} loads found" inside a single text node.
  // Use a regex extraction via page.evaluate.
  const loadsMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/loads`,
    async (page) => {
      const txt = await page.evaluate(() => {
        const m = document.body.innerText.match(/(\d[\d,]*)\s+loads found/);
        return m ? m[1] : null;
      });
      const parsed = txt ? parseInt(txt.replace(/,/g, "")) : null;
      return [
        parsed === null
          ? {
              metric: "Total loads (X loads found)",
              db: dbLoads,
              onScreen: "not shown on UI",
              match: "—" as const,
            }
          : parsed === dbLoads
            ? {
                metric: "Total loads (X loads found)",
                db: dbLoads,
                onScreen: `${parsed} loads found`,
                match: "✅" as const,
              }
            : {
                metric: "Total loads (X loads found)",
                db: dbLoads,
                onScreen: `${parsed} loads found`,
                match: "❌" as const,
              },
      ];
    }
  );
  reports.push({
    role,
    user: email,
    page: "Loads list",
    url: "/admin/loads",
    visibleNumbers: [],
    metrics: loadsMetrics,
  });

  // ── /admin/trucks
  const trucksMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/trucks`,
    async (page) => {
      const txt = await page.evaluate(() => {
        const m = document.body.innerText.match(/(\d[\d,]*)\s+trucks found/);
        return m ? m[1] : null;
      });
      const parsed = txt ? parseInt(txt.replace(/,/g, "")) : null;
      return [
        parsed === null
          ? {
              metric: "Total trucks (X trucks found)",
              db: dbTrucks,
              onScreen: "not shown on UI",
              match: "—" as const,
            }
          : parsed === dbTrucks
            ? {
                metric: "Total trucks (X trucks found)",
                db: dbTrucks,
                onScreen: `${parsed} trucks found`,
                match: "✅" as const,
              }
            : {
                metric: "Total trucks (X trucks found)",
                db: dbTrucks,
                onScreen: `${parsed} trucks found`,
                match: "❌" as const,
              },
      ];
    }
  );
  reports.push({
    role,
    user: email,
    page: "Trucks list",
    url: "/admin/trucks",
    visibleNumbers: [],
    metrics: trucksMetrics,
  });

  // ── /admin/trips
  const tripsMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/trips`,
    async (page) => {
      const txt = await page.evaluate(() => {
        const m = document.body.innerText.match(/(\d[\d,]*)\s+trips found/);
        return m ? m[1] : null;
      });
      const parsed = txt ? parseInt(txt.replace(/,/g, "")) : null;
      return [
        parsed === null
          ? {
              metric: "Total trips (X trips found)",
              db: dbTrips,
              onScreen: "not shown on UI",
              match: "—" as const,
            }
          : parsed === dbTrips
            ? {
                metric: "Total trips (X trips found)",
                db: dbTrips,
                onScreen: `${parsed} trips found`,
                match: "✅" as const,
              }
            : {
                metric: "Total trips (X trips found)",
                db: dbTrips,
                onScreen: `${parsed} trips found`,
                match: "❌" as const,
              },
      ];
    }
  );
  reports.push({
    role,
    user: email,
    page: "Trips list",
    url: "/admin/trips",
    visibleNumbers: [],
    metrics: tripsMetrics,
  });

  // ── /admin/withdrawals
  // The withdrawals page does not display a total count anywhere — only
  // the individual rows. Honest report: not shown on UI.
  const wMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/withdrawals?status=PENDING`,
    async (page) => {
      const txt = await page.evaluate(() => document.body.innerText);
      const m = txt.match(/(\d+)\s+(pending|withdrawal)/i);
      if (m) {
        const n = parseInt(m[1]);
        return [
          {
            metric: "Pending withdrawal count",
            db: dbWithdrawals,
            onScreen: m[0],
            match: (n === dbWithdrawals ? "✅" : "❌") as "✅" | "❌",
          },
        ];
      }
      return [
        {
          metric: "Pending withdrawal count",
          db: dbWithdrawals,
          onScreen: "not shown on UI",
          match: "—" as const,
        },
      ];
    }
  );
  reports.push({
    role,
    user: email,
    page: "Withdrawals (PENDING filter)",
    url: "/admin/withdrawals?status=PENDING",
    visibleNumbers: [],
    metrics: wMetrics,
  });

  // ── /admin/wallets
  const dbWalletAccounts = await prisma.financialAccount.count();
  const walletsMetrics = await visitPage(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/wallets`,
    async (page) => {
      const txt = await page.evaluate(() => {
        const m = document.body.innerText.match(/(\d[\d,]*)\s+accounts found/);
        return m ? m[1] : null;
      });
      const parsed = txt ? parseInt(txt.replace(/,/g, "")) : null;
      return [
        parsed === null
          ? {
              metric: "Wallet account count (X accounts found)",
              db: dbWalletAccounts,
              onScreen: "not shown on UI",
              match: "—" as const,
            }
          : {
              metric: "Wallet account count (X accounts found)",
              db: dbWalletAccounts,
              onScreen: `${parsed} accounts found`,
              match: (parsed === dbWalletAccounts ? "✅" : "❌") as "✅" | "❌",
            },
      ];
    }
  );
  reports.push({
    role,
    user: email,
    page: "Wallets list",
    url: "/admin/wallets",
    visibleNumbers: [],
    metrics: walletsMetrics,
  });
}

// ─── Render report ──────────────────────────────────────────────────────────

function renderMarkdown(): string {
  const lines: string[] = [];
  lines.push("# READ-ONLY UI AUDIT REPORT");
  lines.push("");
  lines.push(
    "Method: Playwright opens each page as the role's authenticated user, reads visible text from the rendered DOM, and compares to a direct Prisma query of the database. **Zero testIDs added. Zero app code changes.**"
  );
  lines.push("");
  let totalChecks = 0;
  let totalMatch = 0;
  let totalMiss = 0;
  let totalNotShown = 0;
  for (const r of reports) {
    lines.push(`## ${r.role} — ${r.user}`);
    lines.push(`### Page: ${r.page} (\`${r.url}\`)`);
    lines.push("");
    lines.push("| Metric | DB | On screen | Result |");
    lines.push("|---|---|---|---|");
    for (const m of r.metrics) {
      totalChecks++;
      if (m.match === "✅") totalMatch++;
      else if (m.match === "❌") totalMiss++;
      else totalNotShown++;
      const note = m.note ? ` _${m.note}_` : "";
      lines.push(
        `| ${m.metric} | ${m.db} | ${m.onScreen}${note} | ${m.match} |`
      );
    }
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total checks: ${totalChecks}`);
  lines.push(`- ✅ Number on screen matches DB: ${totalMatch}`);
  lines.push(`- ❌ Number on screen but does not match DB: ${totalMiss}`);
  lines.push(`- — Number not shown on UI at all: ${totalNotShown}`);
  return lines.join("\n");
}

async function main() {
  console.log("Launching headless Chromium for read-only audit...");
  const browser = await chromium.launch({ headless: true });

  try {
    await auditShipper(browser, "shipper@test.com");
    await auditShipper(browser, "wf-shipper@test.com");
    await auditCarrier(browser, "carrier@test.com");
    await auditCarrier(browser, "wf-carrier@test.com");
    await auditDispatcher(browser);
    await auditAdmin(browser, "admin@test.com", "Admin");
    await auditAdmin(browser, "superadmin@test.com", "Super Admin");
  } finally {
    await browser.close();
  }

  const md = renderMarkdown();
  console.log("\n" + md);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  fs.writeFileSync("/tmp/audit-readonly.md", md);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
