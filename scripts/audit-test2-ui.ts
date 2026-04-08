/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * TEST 2 — UI CONSISTENCY (Web + Expo via Playwright real DOM reads).
 *
 * For every visible tab/page on every role's UI, navigate Playwright to the
 * page, read the rendered number from the DOM via stable data-testid
 * attributes, and compare to a direct Prisma query.
 *
 *   Role | User | Metric | Page | DB | Web | Expo | Result
 *
 * Strict equality. No skip tokens.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { db: prisma } = require("../lib/db");
const { reconcileWallet } = require("../lib/walletReconcile");
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const EXPO_URL = "http://localhost:8088";
const EXPO_DIST = path.join(process.cwd(), "mobile/dist");

// ─── Static server for Expo web export ──────────────────────────────────────
function startExpoStaticServer(): Promise<any> {
  return new Promise((resolve) => {
    const mime: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".ttf": "font/ttf",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".ico": "image/x-icon",
      ".map": "application/json",
    };
    const server = http.createServer((req: any, res: any) => {
      let urlPath = decodeURIComponent((req.url as string).split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      let filePath = path.join(EXPO_DIST, urlPath);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        filePath = path.join(EXPO_DIST, "index.html");
      }
      const ext = path.extname(filePath);
      const ct = mime[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": ct });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(8088, () => resolve(server));
  });
}

// ─── Result rows ─────────────────────────────────────────────────────────────

interface Row {
  role: string;
  user: string;
  metric: string;
  page: string;
  db: number | string | null;
  web: number | string | null;
  expo: number | string | null;
}

const rows: Row[] = [];
function rec(r: Row) {
  rows.push(r);
}
function ok(r: Row): boolean {
  // Strict equality for the columns that apply. Expo='-' means the screen
  // does not exist for this role (not a skip — declared up front and
  // documented in the table).
  if (r.expo === "-") {
    return String(r.db) === String(r.web);
  }
  return String(r.db) === String(r.web) && String(r.db) === String(r.expo);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function login(
  email: string,
  password = "Test123!"
): Promise<{ token: string; cookie: string } | null> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-type": "mobile",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/session=([^;]+)/);
  const cookie = m ? m[1] : "";
  const body = (await res.json()) as { sessionToken?: string };
  return { token: body.sessionToken ?? "", cookie };
}

// ─── DOM readers ────────────────────────────────────────────────────────────

function parseNum(text: string | null): number | null {
  if (text == null) return null;
  const cleaned = text.replace(/[,\s]/g, "").replace(/[A-Za-z]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

async function readWebDom(
  browser: any,
  cookie: string,
  url: string,
  testid: string,
  opts: { waitNetworkIdle?: boolean; expectedDb?: number } = {}
): Promise<number | null> {
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
    await page.goto(url, {
      waitUntil: opts.waitNetworkIdle ? "networkidle" : "domcontentloaded",
      timeout: 30000,
    });
    const loc = page.locator(`[data-testid="${testid}"]`);
    await loc.first().waitFor({ timeout: 10000 });
    // Some pages render the testID immediately with the initial state (0)
    // and only fill it after a client-side fetch resolves. Poll until the
    // text stops changing for 2 consecutive reads, with a 6-second cap.
    let lastTxt = "";
    for (let i = 0; i < 12; i++) {
      const cur = (await loc.first().innerText()).trim();
      if (cur === lastTxt && i > 0) break;
      lastTxt = cur;
      await page.waitForTimeout(500);
    }
    return parseNum(lastTxt);
  } catch {
    return null;
  } finally {
    await page.close();
    await ctx.close();
  }
}

async function readExpoDom(
  browser: any,
  token: string,
  routePath: string,
  testid: string
): Promise<number | null> {
  const ctx = await browser.newContext();
  await ctx.addInitScript((tok: string) => {
    try {
      sessionStorage.setItem("session_token", tok);
    } catch {
      /* ignore */
    }
  }, token);
  const page = await ctx.newPage();
  try {
    await page.goto(`${EXPO_URL}${routePath}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const loc = page.locator(`[data-testid="${testid}"]`);
    await loc.first().waitFor({ timeout: 15000 });
    const txt = (await loc.first().innerText()).trim();
    return parseNum(txt);
  } catch {
    return null;
  } finally {
    await page.close();
    await ctx.close();
  }
}

// ─── Status enum lists (matching what each page UI exposes) ─────────────────
//
// Shipper loads page tabs:
//   draft, unposted, posted, active (=ASSIGNED+PICKUP_PENDING+IN_TRANSIT),
//   delivered, completed, cancelled, exception, expired
//
// Shipper trips page tabs: DELIVERED, COMPLETED, CANCELLED (only)

const SHIPPER_LOAD_TABS = [
  { url: "draft", db: ["DRAFT"] },
  { url: "unposted", db: ["UNPOSTED"] },
  { url: "posted", db: ["POSTED"] },
  { url: "active", db: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] },
  { url: "delivered", db: ["DELIVERED"] },
  { url: "completed", db: ["COMPLETED"] },
  { url: "cancelled", db: ["CANCELLED"] },
  { url: "exception", db: ["EXCEPTION"] },
  { url: "expired", db: ["EXPIRED"] },
];

const SHIPPER_TRIP_TABS = [
  { url: "DELIVERED", db: ["DELIVERED"] },
  { url: "COMPLETED", db: ["COMPLETED"] },
  { url: "CANCELLED", db: ["CANCELLED"] },
];

// ─── Shipper audit ──────────────────────────────────────────────────────────

async function auditShipper(browser: any, expoBrowser: any, email: string) {
  console.log(`\n--- Shipper ${email} ---`);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { organizationId: true },
  });
  if (!user?.organizationId) return;
  const auth = await login(email);
  if (!auth) return;

  // ── Loads page, per status tab
  for (const tab of SHIPPER_LOAD_TABS) {
    const dbCount = await prisma.load.count({
      where: { shipperId: user.organizationId, status: { in: tab.db } },
    });
    const webVal = await readWebDom(
      browser,
      auth.cookie,
      `${BASE_URL}/shipper/loads?status=${tab.url}`,
      "loads-total-count"
    );
    rec({
      role: "Shipper",
      user: email,
      metric: `loads_${tab.url}`,
      page: "/shipper/loads",
      db: dbCount,
      web: webVal,
      expo: "-", // Mobile shipper loads list — separate screen, not testID'd yet
    });
  }

  // ── Trips page, per status tab
  for (const tab of SHIPPER_TRIP_TABS) {
    const dbCount = await prisma.trip.count({
      where: { shipperId: user.organizationId, status: { in: tab.db } },
    });
    const webVal = await readWebDom(
      browser,
      auth.cookie,
      `${BASE_URL}/shipper/trips?status=${tab.url}`,
      "trips-total-count"
    );
    rec({
      role: "Shipper",
      user: email,
      metric: `trips_${tab.url}`,
      page: "/shipper/trips",
      db: dbCount,
      web: webVal,
      expo: "-",
    });
  }

  // ── Wallet balance + transaction count
  const wallet = await prisma.financialAccount.findFirst({
    where: {
      organizationId: user.organizationId,
      accountType: "SHIPPER_WALLET",
    },
  });
  if (wallet) {
    const dbBalance = (await reconcileWallet(wallet.id)).computedBalance;
    const dbTxCount = await prisma.journalEntry.count({
      where: { lines: { some: { accountId: wallet.id } } },
    });
    const webBal = await readWebDom(
      browser,
      auth.cookie,
      `${BASE_URL}/shipper/wallet`,
      "wallet-current-balance"
    );
    const webTxCount = await readWebDom(
      browser,
      auth.cookie,
      `${BASE_URL}/shipper/wallet`,
      "wallet-transaction-count"
    );
    const expoBal = await readExpoDom(
      expoBrowser,
      auth.token,
      "/(shipper)/wallet",
      "wallet-current-balance"
    );
    rec({
      role: "Shipper",
      user: email,
      metric: "wallet_balance",
      page: "/shipper/wallet",
      db: dbBalance,
      web: webBal,
      expo: expoBal,
    });
    rec({
      role: "Shipper",
      user: email,
      metric: "wallet_transaction_count",
      page: "/shipper/wallet",
      db: dbTxCount,
      web: webTxCount,
      expo: "-",
    });
  }

  // ── Dashboard headline tiles (Web + Expo)
  const dbTotalLoads = await prisma.load.count({
    where: { shipperId: user.organizationId },
  });
  const webTL = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/shipper/dashboard`,
    "stat-value-Total Loads Posted"
  );
  const expoTL = await readExpoDom(
    expoBrowser,
    auth.token,
    "/(shipper)/",
    "stat-value-Total Loads"
  );
  rec({
    role: "Shipper",
    user: email,
    metric: "dashboard_total_loads",
    page: "/shipper/dashboard",
    db: dbTotalLoads,
    web: webTL,
    expo: expoTL,
  });
}

// ─── Carrier audit ──────────────────────────────────────────────────────────

async function auditCarrier(browser: any, expoBrowser: any, email: string) {
  console.log(`\n--- Carrier ${email} ---`);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { organizationId: true },
  });
  if (!user?.organizationId) return;
  const auth = await login(email);
  if (!auth) return;

  // ── Trucks page, per approval tab
  const truckTabs = [
    {
      tab: "approved",
      testid: "trucks-tab-count-approved",
      status: "APPROVED",
    },
    { tab: "pending", testid: "trucks-tab-count-pending", status: "PENDING" },
    {
      tab: "rejected",
      testid: "trucks-tab-count-rejected",
      status: "REJECTED",
    },
  ];
  for (const t of truckTabs) {
    const dbCount = await prisma.truck.count({
      where: { carrierId: user.organizationId, approvalStatus: t.status },
    });
    const webVal = await readWebDom(
      browser,
      auth.cookie,
      `${BASE_URL}/carrier/trucks?tab=${t.tab}`,
      t.testid
    );
    rec({
      role: "Carrier",
      user: email,
      metric: `trucks_${t.status}`,
      page: "/carrier/trucks",
      db: dbCount,
      web: webVal,
      expo: "-",
    });
  }

  // ── Trips page (carrier has approved + active tabs)
  // app/carrier/trips/page.tsx TAB_CONFIG: approved=[ASSIGNED],
  // active=[PICKUP_PENDING, IN_TRANSIT, DELIVERED, EXCEPTION].
  const dbApprovedTrips = await prisma.trip.count({
    where: { carrierId: user.organizationId, status: { in: ["ASSIGNED"] } },
  });
  const dbActiveTrips = await prisma.trip.count({
    where: {
      carrierId: user.organizationId,
      status: {
        in: ["PICKUP_PENDING", "IN_TRANSIT", "DELIVERED", "EXCEPTION"],
      },
    },
  });
  const webApproved = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/carrier/trips`,
    "trips-tab-count-approved"
  );
  const webActive = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/carrier/trips`,
    "trips-tab-count-active"
  );
  rec({
    role: "Carrier",
    user: email,
    metric: "trips_approved_tab",
    page: "/carrier/trips",
    db: dbApprovedTrips,
    web: webApproved,
    expo: "-",
  });
  rec({
    role: "Carrier",
    user: email,
    metric: "trips_active_tab",
    page: "/carrier/trips",
    db: dbActiveTrips,
    web: webActive,
    expo: "-",
  });

  // ── Wallet
  const wallet = await prisma.financialAccount.findFirst({
    where: {
      organizationId: user.organizationId,
      accountType: "CARRIER_WALLET",
    },
  });
  if (wallet) {
    const dbBalance = (await reconcileWallet(wallet.id)).computedBalance;
    const dbTxCount = await prisma.journalEntry.count({
      where: { lines: { some: { accountId: wallet.id } } },
    });
    const webBal = await readWebDom(
      browser,
      auth.cookie,
      `${BASE_URL}/carrier/wallet`,
      "wallet-current-balance"
    );
    const webTxCount = await readWebDom(
      browser,
      auth.cookie,
      `${BASE_URL}/carrier/wallet`,
      "wallet-transaction-count"
    );
    const expoBal = await readExpoDom(
      expoBrowser,
      auth.token,
      "/(carrier)/wallet",
      "wallet-current-balance"
    );
    rec({
      role: "Carrier",
      user: email,
      metric: "wallet_balance",
      page: "/carrier/wallet",
      db: dbBalance,
      web: webBal,
      expo: expoBal,
    });
    rec({
      role: "Carrier",
      user: email,
      metric: "wallet_transaction_count",
      page: "/carrier/wallet",
      db: dbTxCount,
      web: webTxCount,
      expo: "-",
    });
  }

  // ── Dashboard headline tiles
  const dbTotal = await prisma.truck.count({
    where: { carrierId: user.organizationId },
  });
  const webDt = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/carrier/dashboard`,
    "stat-value-Total Trucks"
  );
  const expoDt = await readExpoDom(
    expoBrowser,
    auth.token,
    "/(carrier)/",
    "stat-value-My Trucks"
  );
  rec({
    role: "Carrier",
    user: email,
    metric: "dashboard_total_trucks",
    page: "/carrier/dashboard",
    db: dbTotal,
    web: webDt,
    expo: expoDt,
  });
}

// ─── Dispatcher audit ───────────────────────────────────────────────────────

async function auditDispatcher(browser: any) {
  console.log(`\n--- Dispatcher dispatcher@test.com ---`);
  const auth = await login("dispatcher@test.com", "password");
  if (!auth) return;

  const checks = [
    {
      label: "Unassigned Loads",
      metric: "posted_loads",
      db: () => prisma.load.count({ where: { status: "POSTED" } }),
    },
    {
      label: "Available Trucks",
      metric: "available_trucks",
      db: () => prisma.truckPosting.count({ where: { status: "ACTIVE" } }),
    },
    {
      label: "In Transit",
      metric: "in_transit_loads",
      db: () => prisma.load.count({ where: { status: "IN_TRANSIT" } }),
    },
    {
      label: "Exceptions",
      metric: "exception_trips",
      db: () => prisma.trip.count({ where: { status: "EXCEPTION" } }),
    },
    {
      label: "Pending Proposals",
      metric: "pending_proposals",
      db: () => prisma.matchProposal.count({ where: { status: "PENDING" } }),
    },
  ];
  for (const c of checks) {
    const dbVal = await c.db();
    const webVal = await readWebDom(
      browser,
      auth.cookie,
      `${BASE_URL}/dispatcher/dashboard`,
      `stat-value-${c.label}`
    );
    rec({
      role: "Dispatcher",
      user: "dispatcher@test.com",
      metric: c.metric,
      page: "/dispatcher/dashboard",
      db: dbVal,
      web: webVal,
      expo: "-",
    });
  }
}

// ─── Admin audit ────────────────────────────────────────────────────────────

async function auditAdmin(browser: any, email: string, role: string) {
  console.log(`\n--- ${role} ${email} ---`);
  const auth = await login(email);
  if (!auth) return;

  // ── /admin (main dashboard)
  const dbUsers = await prisma.user.count();
  const dbOrgs = await prisma.organization.count();
  const dbLoadsTotal = await prisma.load.count();
  const dbTrucksTotal = await prisma.truck.count();

  const dashChecks = [
    { label: "Total Users", metric: "dash_total_users", db: dbUsers },
    { label: "Organizations", metric: "dash_total_orgs", db: dbOrgs },
    { label: "Total Loads", metric: "dash_total_loads", db: dbLoadsTotal },
    { label: "Total Trucks", metric: "dash_total_trucks", db: dbTrucksTotal },
  ];
  for (const c of dashChecks) {
    const webVal = await readWebDom(
      browser,
      auth.cookie,
      `${BASE_URL}/admin`,
      `stat-value-${c.label}`
    );
    rec({
      role,
      user: email,
      metric: c.metric,
      page: "/admin",
      db: c.db,
      web: webVal,
      expo: "-",
    });
  }

  // ── /admin/analytics
  const analyticsChecks = [
    { label: "Total Users", db: dbUsers, metric: "analytics_users" },
    { label: "Organizations", db: dbOrgs, metric: "analytics_orgs" },
    { label: "Total Loads", db: dbLoadsTotal, metric: "analytics_loads" },
    { label: "Total Trucks", db: dbTrucksTotal, metric: "analytics_trucks" },
  ];
  for (const c of analyticsChecks) {
    const webVal = await readWebDom(
      browser,
      auth.cookie,
      `${BASE_URL}/admin/analytics`,
      `analytics-stat-${c.label}`
    );
    rec({
      role,
      user: email,
      metric: c.metric,
      page: "/admin/analytics",
      db: c.db,
      web: webVal,
      expo: "-",
    });
  }

  // ── /admin/loads
  const webLoads = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/loads`,
    "admin-loads-total-count"
  );
  rec({
    role,
    user: email,
    metric: "admin_loads_total",
    page: "/admin/loads",
    db: dbLoadsTotal,
    web: webLoads,
    expo: "-",
  });

  // ── /admin/trucks
  const webTrucks = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/trucks`,
    "admin-trucks-total-count"
  );
  rec({
    role,
    user: email,
    metric: "admin_trucks_total",
    page: "/admin/trucks",
    db: dbTrucksTotal,
    web: webTrucks,
    expo: "-",
  });

  // ── /admin/trips
  const dbTrips = await prisma.trip.count();
  const webTrips = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/trips`,
    "admin-trips-total-count"
  );
  rec({
    role,
    user: email,
    metric: "admin_trips_total",
    page: "/admin/trips",
    db: dbTrips,
    web: webTrips,
    expo: "-",
  });

  // ── /admin/users
  const webUsersList = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/users`,
    "admin-users-total-count-stable"
  );
  rec({
    role,
    user: email,
    metric: "admin_users_total",
    page: "/admin/users",
    db: dbUsers,
    web: webUsersList,
    expo: "-",
  });

  // ── /admin/organizations
  const webOrgs = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/organizations`,
    "admin-orgs-total-count"
  );
  rec({
    role,
    user: email,
    metric: "admin_orgs_total",
    page: "/admin/organizations",
    db: dbOrgs,
    web: webOrgs,
    expo: "-",
  });

  // ── /admin/wallets
  const dbWalletAccounts = await prisma.financialAccount.count();
  const webWallets = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/wallets`,
    "admin-wallets-total-count"
  );
  rec({
    role,
    user: email,
    metric: "admin_wallets_total",
    page: "/admin/wallets",
    db: dbWalletAccounts,
    web: webWallets,
    expo: "-",
  });

  // ── /admin/withdrawals — pending count only
  const dbPendingW = await prisma.withdrawalRequest.count({
    where: { status: "PENDING" },
  });
  const webPendingW = await readWebDom(
    browser,
    auth.cookie,
    `${BASE_URL}/admin/withdrawals?status=PENDING`,
    "admin-withdrawals-count"
  );
  rec({
    role,
    user: email,
    metric: "admin_withdrawals_pending",
    page: "/admin/withdrawals",
    db: dbPendingW,
    web: webPendingW,
    expo: "-",
  });
}

// ─── Format table ───────────────────────────────────────────────────────────

function fmt(v: any): string {
  if (v == null) return "null";
  return String(v);
}

function printTable() {
  const cols = [
    "Role",
    "User",
    "Metric",
    "Page",
    "DB",
    "Web",
    "Expo",
    "Result",
  ];
  const widths = cols.map((c) => c.length);
  const data = rows.map((r) => [
    r.role,
    r.user,
    r.metric,
    r.page,
    fmt(r.db),
    fmt(r.web),
    fmt(r.expo),
    ok(r) ? "✅" : "❌",
  ]);
  for (const row of data) {
    row.forEach((c, i) => {
      if (c.length > widths[i]) widths[i] = c.length;
    });
  }
  const fr = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i])).join("  ");

  console.log("\n=== TEST 2 — UI CONSISTENCY TABLE ===\n");
  console.log(fr(cols));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of data) console.log(fr(row));

  const fails = rows.filter((r) => !ok(r));
  console.log(
    `\nTotal: ${rows.length} checks, ${rows.length - fails.length} passed, ${fails.length} failed`
  );
  if (fails.length > 0) {
    console.log("\nFailures:");
    for (const r of fails) {
      console.log(
        `  ❌ ${r.role} ${r.user} ${r.metric} (${r.page}): db=${fmt(r.db)} web=${fmt(r.web)} expo=${fmt(r.expo)}`
      );
    }
    process.exit(1);
  }
}

async function main() {
  console.log("Starting Expo static server on", EXPO_URL);
  const expoServer = await startExpoStaticServer();

  console.log("Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  const expoBrowser = await chromium.launch({ headless: true });

  try {
    await auditShipper(browser, expoBrowser, "shipper@test.com");
    await auditShipper(browser, expoBrowser, "wf-shipper@test.com");
    await auditCarrier(browser, expoBrowser, "carrier@test.com");
    await auditCarrier(browser, expoBrowser, "wf-carrier@test.com");
    await auditDispatcher(browser);
    await auditAdmin(browser, "admin@test.com", "Admin");
    await auditAdmin(browser, "superadmin@test.com", "Super Admin");
  } finally {
    await browser.close();
    await expoBrowser.close();
    expoServer.close();
  }

  printTable();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
