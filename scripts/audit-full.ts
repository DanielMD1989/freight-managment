/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Full 4-surface data consistency audit.
 *
 * For every role × every metric, compares:
 *   - DB    (Prisma direct query, ground truth)
 *   - API   (real HTTP fetch with real auth)
 *   - Web   (Playwright drives real Chromium against http://localhost:3000)
 *   - Expo  (Playwright drives a static-served Expo web export at
 *            http://localhost:8088, with sessionStorage.session_token
 *            injected before navigation. Reads the rendered DOM via
 *            testID-mapped data-testid attributes.)
 *
 * Output: a per-row table you can read top-to-bottom.
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
      // Expo Router web export uses index.html as a SPA fallback for all routes.
      let filePath = path.join(EXPO_DIST, urlPath);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        // SPA fallback
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

// ─── Result table ────────────────────────────────────────────────────────────

type Surface = "DB" | "API" | "Web" | "Expo";
type Cell = number | string | "n/a" | null;

interface Row {
  role: string;
  user: string;
  metric: string;
  values: Record<Surface, Cell>;
  notes?: string;
}

const rows: Row[] = [];

function record(row: Row) {
  rows.push(row);
}

function passOf(row: Row): boolean {
  const cells = Object.entries(row.values).filter(
    ([, v]) => v !== "n/a" && v !== null
  );
  if (cells.length === 0) return false;
  const first = String(cells[0][1]);
  return cells.every(([, v]) => String(v) === first);
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
  if (!res.ok) {
    console.error(`login ${email} failed: ${res.status}`);
    return null;
  }
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/session=([^;]+)/);
  const cookie = m ? m[1] : "";
  const body = (await res.json()) as { sessionToken?: string };
  return { token: body.sessionToken ?? "", cookie };
}

async function apiGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-client-type": "mobile",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// ─── Web reader (Playwright) ────────────────────────────────────────────────

async function readStatCard(page: any, title: string): Promise<string | null> {
  try {
    const locator = page.locator(`[data-testid="stat-value-${title}"]`);
    await locator.first().waitFor({ timeout: 5000 });
    return (await locator.first().innerText()).trim();
  } catch {
    return null;
  }
}

function parseNum(text: string | null): number | null {
  if (text == null) return null;
  const cleaned = text.replace(/[,\s]/g, "").replace(/[A-Za-z]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ─── Expo runtime reader (Playwright against the real web export) ──────────
//
// Uses sessionStorage injection (the mobile app on web reads session_token
// from sessionStorage via expo-secure-store's web fallback). After the token
// is injected, navigating to / triggers the auth check, which fetches
// /api/auth/me, sets the user, and the root layout redirects to the
// role-specific group ((shipper)/ or (carrier)/).

async function readExpoStat(
  expoCtx: any,
  token: string,
  routePath: string,
  testId: string
): Promise<string | null> {
  const page = await expoCtx.newPage();
  try {
    // Inject session_token BEFORE the app boots
    await page.addInitScript((tok: string) => {
      try {
        sessionStorage.setItem("session_token", tok);
        // Also seed userId/role to skip the auth/me round trip if possible
      } catch {
        /* ignore */
      }
    }, token);
    await page.goto(`${EXPO_URL}${routePath}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    // Wait for the dashboard to hydrate and render the stat tile
    const loc = page.locator(`[data-testid="${testId}"]`);
    await loc.first().waitFor({ timeout: 15000 });
    const txt = (await loc.first().innerText()).trim();
    return txt;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

// ─── Phase 1: DB + API + Web for every shipper ───────────────────────────────

async function auditShippers(browser: any, expoCtx: any) {
  console.log("\n=== Auditing every Shipper ===");
  const shippers = await prisma.organization.findMany({
    where: { type: "SHIPPER" },
    include: {
      users: {
        where: { role: "SHIPPER", status: "ACTIVE" },
        take: 1,
        select: { email: true },
      },
    },
  });

  for (const org of shippers) {
    const user = org.users[0];
    if (!user) continue;
    console.log(`  -> ${user.email} (${org.name})`);

    // L1 — DB
    const totalLoads = await prisma.load.count({
      where: { shipperId: org.id },
    });
    const inTransitLoads = await prisma.load.count({
      where: { shipperId: org.id, status: "IN_TRANSIT" },
    });
    const wallet = await prisma.financialAccount.findFirst({
      where: { organizationId: org.id, accountType: "SHIPPER_WALLET" },
    });
    const walletBalance = wallet
      ? (await reconcileWallet(wallet.id)).computedBalance
      : 0;

    // L2 — API
    const auth = await login(user.email);
    if (!auth) continue;
    const dash = (await apiGet("/api/shipper/dashboard", auth.token)) ?? {};
    const apiTotalLoads = dash.stats?.totalLoads;
    const apiInTransit = dash.stats?.inTransitLoads;
    const apiWalletBalance = dash.wallet?.balance;

    // L3 — Web (skip orgs without wallet — won't render dashboard the same)
    let webTotalLoads: string | null = "n/a";
    let webInTransit: string | null = "n/a";
    let webWallet: number | string | null = "n/a";
    if (wallet) {
      const ctx = await browser.newContext();
      await ctx.addCookies([
        {
          name: "session",
          value: auth.cookie,
          domain: "localhost",
          path: "/",
          httpOnly: true,
        },
      ]);
      const page = await ctx.newPage();
      try {
        await page.goto(`${BASE_URL}/shipper/dashboard`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        webTotalLoads = await readStatCard(page, "Total Loads Posted");
        webInTransit = await readStatCard(page, "Active Shipments");
      } finally {
        await page.close();
      }
      // Navigate to wallet page in same auth context to read balance
      const wpage = await ctx.newPage();
      try {
        await wpage.goto(`${BASE_URL}/shipper/wallet`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        const balLoc = wpage.locator('[data-testid="wallet-current-balance"]');
        await balLoc.first().waitFor({ timeout: 5000 });
        const txt = (await balLoc.first().innerText()).trim();
        webWallet = parseNum(txt);
      } catch {
        webWallet = null;
      } finally {
        await wpage.close();
        await ctx.close();
      }
    }

    // L4 — Expo runtime: drive the real Expo web export with the auth token
    let expoTotalLoads: number | string | null = null;
    let expoInTransit: number | string | null = null;
    let expoWallet: number | string | null = null;
    if (wallet) {
      // Mobile labels: "Total Loads" → totalLoads, "In Transit" → inTransitLoads
      const t1 = await readExpoStat(
        expoCtx,
        auth.token,
        "/(shipper)/",
        "stat-value-Total Loads"
      );
      expoTotalLoads = t1 != null ? parseNum(t1) : null;
      const t2 = await readExpoStat(
        expoCtx,
        auth.token,
        "/(shipper)/",
        "stat-value-In Transit"
      );
      expoInTransit = t2 != null ? parseNum(t2) : null;
      const t3 = await readExpoStat(
        expoCtx,
        auth.token,
        "/(shipper)/wallet",
        "wallet-current-balance"
      );
      expoWallet = t3 != null ? parseNum(t3) : null;
    } else {
      expoTotalLoads = "n/a";
      expoInTransit = "n/a";
      expoWallet = "n/a";
    }

    record({
      role: "Shipper",
      user: user.email,
      metric: "loads_total",
      values: {
        DB: totalLoads,
        API: apiTotalLoads ?? null,
        Web:
          webTotalLoads != null && webTotalLoads !== "n/a"
            ? parseNum(webTotalLoads)
            : webTotalLoads,
        Expo: expoTotalLoads,
      },
    });

    record({
      role: "Shipper",
      user: user.email,
      metric: "loads_in_transit",
      values: {
        DB: inTransitLoads,
        API: apiInTransit ?? null,
        Web:
          webInTransit != null && webInTransit !== "n/a"
            ? parseNum(webInTransit)
            : webInTransit,
        Expo: expoInTransit,
      },
    });

    record({
      role: "Shipper",
      user: user.email,
      metric: "wallet_balance",
      values: {
        DB: walletBalance,
        API: apiWalletBalance ?? null,
        Web: webWallet,
        Expo: expoWallet,
      },
    });
  }
}

// ─── Phase 2: Carriers ──────────────────────────────────────────────────────

async function auditCarriers(browser: any, expoCtx: any) {
  console.log("\n=== Auditing every Carrier ===");
  const carriers = await prisma.organization.findMany({
    where: {
      type: {
        in: [
          "CARRIER_COMPANY",
          "CARRIER_INDIVIDUAL",
          "CARRIER_ASSOCIATION",
          "FLEET_OWNER",
        ],
      },
    },
    include: {
      users: {
        where: { role: "CARRIER", status: "ACTIVE" },
        take: 1,
        select: { email: true },
      },
    },
  });

  for (const org of carriers) {
    const user = org.users[0];
    if (!user) continue;
    console.log(`  -> ${user.email} (${org.name})`);

    const totalTrucks = await prisma.truck.count({
      where: { carrierId: org.id },
    });
    const activeTrucks = await prisma.truck.count({
      where: { carrierId: org.id, approvalStatus: "APPROVED" },
    });
    const wallet = await prisma.financialAccount.findFirst({
      where: { organizationId: org.id, accountType: "CARRIER_WALLET" },
    });
    const walletBalance = wallet
      ? (await reconcileWallet(wallet.id)).computedBalance
      : 0;

    const auth = await login(user.email);
    if (!auth) continue;
    const dash = (await apiGet("/api/carrier/dashboard", auth.token)) ?? {};

    let webTotal: string | null = "n/a";
    let webActive: string | null = "n/a";
    let webWallet: number | string | null = "n/a";
    if (wallet) {
      const ctx = await browser.newContext();
      await ctx.addCookies([
        {
          name: "session",
          value: auth.cookie,
          domain: "localhost",
          path: "/",
          httpOnly: true,
        },
      ]);
      const page = await ctx.newPage();
      try {
        await page.goto(`${BASE_URL}/carrier/dashboard`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        webTotal = await readStatCard(page, "Total Trucks");
        webActive = await readStatCard(page, "Available Trucks");
      } finally {
        await page.close();
      }
      const wpage = await ctx.newPage();
      try {
        await wpage.goto(`${BASE_URL}/carrier/wallet`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        const balLoc = wpage.locator('[data-testid="wallet-current-balance"]');
        await balLoc.first().waitFor({ timeout: 5000 });
        const txt = (await balLoc.first().innerText()).trim();
        webWallet = parseNum(txt);
      } catch {
        webWallet = null;
      } finally {
        await wpage.close();
        await ctx.close();
      }
    }

    // L4 — Expo runtime
    let expoTotal: number | string | null = null;
    let expoActive: number | string | null = null;
    let expoWalletM: number | string | null = null;
    if (wallet) {
      // Mobile carrier labels: "My Trucks" → totalTrucks, "Available" → activeTrucks
      const t1 = await readExpoStat(
        expoCtx,
        auth.token,
        "/(carrier)/",
        "stat-value-My Trucks"
      );
      expoTotal = t1 != null ? parseNum(t1) : null;
      const t2 = await readExpoStat(
        expoCtx,
        auth.token,
        "/(carrier)/",
        "stat-value-Available"
      );
      expoActive = t2 != null ? parseNum(t2) : null;
      const t3 = await readExpoStat(
        expoCtx,
        auth.token,
        "/(carrier)/wallet",
        "wallet-current-balance"
      );
      expoWalletM = t3 != null ? parseNum(t3) : null;
    } else {
      expoTotal = "n/a";
      expoActive = "n/a";
      expoWalletM = "n/a";
    }

    record({
      role: "Carrier",
      user: user.email,
      metric: "trucks_total",
      values: {
        DB: totalTrucks,
        API: dash.totalTrucks ?? null,
        Web:
          webTotal != null && webTotal !== "n/a"
            ? parseNum(webTotal)
            : webTotal,
        Expo: expoTotal,
      },
    });

    record({
      role: "Carrier",
      user: user.email,
      metric: "trucks_active",
      values: {
        DB: activeTrucks,
        API: dash.activeTrucks ?? null,
        Web:
          webActive != null && webActive !== "n/a"
            ? parseNum(webActive)
            : webActive,
        Expo: expoActive,
      },
    });

    record({
      role: "Carrier",
      user: user.email,
      metric: "wallet_balance",
      values: {
        DB: walletBalance,
        API: dash.wallet?.balance ?? null,
        Web: webWallet,
        Expo: expoWalletM,
      },
    });
  }
}

// ─── Phase 3: Dispatcher ────────────────────────────────────────────────────

async function auditDispatcher(browser: any) {
  console.log("\n=== Auditing Dispatcher ===");
  const dbPosted = await prisma.load.count({ where: { status: "POSTED" } });
  const dbAvailable = await prisma.truckPosting.count({
    where: { status: "ACTIVE" },
  });

  const auth = await login("dispatcher@test.com", "password");
  if (!auth) return;
  const dash = (await apiGet("/api/dispatcher/dashboard", auth.token)) ?? {};

  const ctx = await browser.newContext();
  await ctx.addCookies([
    {
      name: "session",
      value: auth.cookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    },
  ]);
  const page = await ctx.newPage();
  let webPosted: string | null = "n/a";
  let webAvailable: string | null = "n/a";
  try {
    await page.goto(`${BASE_URL}/dispatcher/dashboard`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    webPosted = await readStatCard(page, "Unassigned Loads"); // dispatcher labels postedLoads as "Unassigned Loads"
    webAvailable = await readStatCard(page, "Available Trucks");
  } finally {
    await page.close();
    await ctx.close();
  }

  record({
    role: "Dispatcher",
    user: "dispatcher@test.com",
    metric: "posted_loads",
    values: {
      DB: dbPosted,
      API: dash.stats?.postedLoads ?? null,
      Web:
        webPosted != null && webPosted !== "n/a"
          ? parseNum(webPosted)
          : webPosted,
      Expo: "n/a",
    },
    notes:
      "Dispatcher is web-only (no mobile screen). Web label: 'Unassigned Loads'",
  });

  record({
    role: "Dispatcher",
    user: "dispatcher@test.com",
    metric: "available_trucks",
    values: {
      DB: dbAvailable,
      API: dash.stats?.availableTrucks ?? null,
      Web:
        webAvailable != null && webAvailable !== "n/a"
          ? parseNum(webAvailable)
          : webAvailable,
      Expo: "n/a",
    },
    notes: "Dispatcher is web-only",
  });
}

// ─── Phase 4: Admin / Super Admin ───────────────────────────────────────────

async function auditAdmin(browser: any, email: string, role: string) {
  console.log(`\n=== Auditing ${role} (${email}) ===`);
  const totalUsers = await prisma.user.count();
  const totalOrgs = await prisma.organization.count();
  const totalLoads = await prisma.load.count();
  const totalTrucks = await prisma.truck.count();

  const auth = await login(email);
  if (!auth) return;
  const analytics =
    (await apiGet("/api/admin/analytics?period=year", auth.token)) ?? {};

  const ctx = await browser.newContext();
  await ctx.addCookies([
    {
      name: "session",
      value: auth.cookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    },
  ]);
  const page = await ctx.newPage();
  let webUsers: string | null = "n/a";
  let webOrgs: string | null = "n/a";
  let webLoads: string | null = "n/a";
  let webTrucks: string | null = "n/a";
  try {
    await page.goto(`${BASE_URL}/admin`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    webUsers = await readStatCard(page, "Total Users");
    webOrgs = await readStatCard(page, "Organizations");
    webLoads = await readStatCard(page, "Total Loads");
    webTrucks = await readStatCard(page, "Total Trucks");
  } finally {
    await page.close();
    await ctx.close();
  }

  record({
    role,
    user: email,
    metric: "total_users",
    values: {
      DB: totalUsers,
      API: analytics.summary?.users?.total ?? null,
      Web:
        webUsers != null && webUsers !== "n/a" ? parseNum(webUsers) : webUsers,
      Expo: "n/a",
    },
    notes: "Admin is web-only",
  });
  record({
    role,
    user: email,
    metric: "total_organizations",
    values: {
      DB: totalOrgs,
      API: analytics.summary?.organizations?.total ?? null,
      Web: webOrgs != null && webOrgs !== "n/a" ? parseNum(webOrgs) : webOrgs,
      Expo: "n/a",
    },
  });
  record({
    role,
    user: email,
    metric: "total_loads",
    values: {
      DB: totalLoads,
      API: analytics.summary?.loads?.total ?? null,
      Web:
        webLoads != null && webLoads !== "n/a" ? parseNum(webLoads) : webLoads,
      Expo: "n/a",
    },
  });
  record({
    role,
    user: email,
    metric: "total_trucks",
    values: {
      DB: totalTrucks,
      API: analytics.summary?.trucks?.total ?? null,
      Web:
        webTrucks != null && webTrucks !== "n/a"
          ? parseNum(webTrucks)
          : webTrucks,
      Expo: "n/a",
    },
  });
}

// ─── Format table ────────────────────────────────────────────────────────────

function fmt(v: Cell): string {
  if (v === null) return "null";
  if (v === "n/a") return "n/a";
  return String(v);
}

function printTable() {
  const cols = ["Role", "User", "Metric", "DB", "API", "Web", "Expo", "Result"];
  const widths = cols.map((c) => c.length);

  const data = rows.map((r) => {
    const result = passOf(r) ? "✅" : "❌";
    return [
      r.role,
      r.user,
      r.metric,
      fmt(r.values.DB),
      fmt(r.values.API),
      fmt(r.values.Web),
      fmt(r.values.Expo),
      result,
    ];
  });

  for (const row of data) {
    row.forEach((cell, i) => {
      if (cell.length > widths[i]) widths[i] = cell.length;
    });
  }

  const fmtRow = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i])).join("  ");

  console.log("\n" + fmtRow(cols));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of data) {
    console.log(fmtRow(row));
  }

  const fails = rows.filter((r) => !passOf(r));
  console.log(
    `\nTotal: ${rows.length} checks, ${rows.length - fails.length} passed, ${fails.length} failed`
  );
  if (fails.length > 0) {
    console.log("\nFailures:");
    for (const r of fails) {
      console.log(
        `  ❌ ${r.role} ${r.user} ${r.metric}: DB=${fmt(r.values.DB)} API=${fmt(r.values.API)} Web=${fmt(r.values.Web)} Expo=${fmt(r.values.Expo)}`
      );
      if (r.notes) console.log(`     note: ${r.notes}`);
    }
    process.exit(1);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Starting Expo static server on", EXPO_URL);
  const expoServer = await startExpoStaticServer();

  console.log("Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  const expoCtx = await browser.newContext();

  try {
    await auditShippers(browser, expoCtx);
    await auditCarriers(browser, expoCtx);
    await auditDispatcher(browser);
    await auditAdmin(browser, "admin@test.com", "Admin");
    await auditAdmin(browser, "superadmin@test.com", "Super Admin");
  } finally {
    await expoCtx.close();
    await browser.close();
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
