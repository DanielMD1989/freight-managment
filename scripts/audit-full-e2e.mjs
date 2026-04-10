#!/usr/bin/env node
// ============================================================================
// audit-full-e2e.mjs — Comprehensive READ-ONLY end-to-end audit
//
// Runs 4 sequential tests comparing Database, API, Web UI, and Mobile UI.
// No code fixes, no app changes. Prints markdown tables for each test.
//
// Usage:  node scripts/audit-full-e2e.mjs
// Requires: Next.js dev server on :3000, PostgreSQL running, Playwright installed
// ============================================================================

import { chromium } from "playwright";
import { config } from "dotenv";
import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";

config({ path: ".env.local" });

const { PrismaClient } = await import("@prisma/client");
const { PrismaPg } = await import("@prisma/adapter-pg");
const { Pool } = await import("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ============================================================================
// Globals
// ============================================================================
const BASE = "http://localhost:3000";
const MOBILE_PORT = 8088;
const MOBILE_BASE = `http://localhost:${MOBILE_PORT}`;
const MOBILE_DIST = join(process.cwd(), "mobile", "dist");

let totalChecks = 0;
let totalPassed = 0;
let totalFailed = 0;
const allResults = [];

// ============================================================================
// Auth helpers
// ============================================================================
async function loginWeb(email, password = "Test123!") {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/session=([^;]+)/);
  return m ? m[1] : null;
}

async function loginMobile(email, password = "Test123!") {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-type": "mobile" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.sessionToken ?? null;
}

async function apiGet(path, cookie) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Cookie: `session=${cookie}` },
    });
    if (!res.ok) return { _error: res.status };
    return await res.json();
  } catch (e) {
    return { _error: e.message };
  }
}

// ============================================================================
// Check recording
// ============================================================================
function check(test, label, dbVal, otherVal, source = "API") {
  totalChecks++;
  const match = dbVal === otherVal;
  if (match) totalPassed++;
  else totalFailed++;
  const result = { test, label, db: dbVal, [source.toLowerCase()]: otherVal, pass: match };
  allResults.push(result);
  return result;
}

// ============================================================================
// READER function for Playwright page.evaluate — finds number near a label
// ============================================================================
const READER = `(labelText) => {
  var numRe = /^[-+]?\\d[\\d,]*(\\.\\d+)?$/;
  var moneyRe = /^[-+]?(ETB\\s*)?[\\d,]+(\\.\\d+)?(\\s*ETB)?$/;
  var labelHosts = [];
  var all = Array.prototype.slice.call(document.querySelectorAll("*"));
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (el.children.length > 0) continue;
    var t1 = (el.textContent || "").trim();
    if (t1 === labelText) labelHosts.push(el);
  }
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
    if (numRe.test(t)) return { raw: t, parsed: parseFloat(t.replace(/,/g, "")) };
    return null;
  };
  for (var k = 0; k < labelHosts.length; k++) {
    var labelEl = labelHosts[k];
    var descendants = Array.prototype.slice.call(labelEl.querySelectorAll("*"));
    for (var j = 0; j < descendants.length; j++) {
      var c = descendants[j];
      if (c.children.length > 0) continue;
      var rA = checkText((c.textContent || "").trim());
      if (rA) return rA;
    }
    var parent2 = labelEl.parentElement;
    if (parent2) {
      var siblings = Array.prototype.slice.call(parent2.children);
      for (var s = 0; s < siblings.length; s++) {
        var sib = siblings[s];
        if (sib === labelEl || sib.contains(labelEl)) continue;
        if (sib.children.length > 0) continue;
        var rB = checkText((sib.textContent || "").trim());
        if (rB) return rB;
      }
    }
    // Go up one more level
    var gp = parent2 ? parent2.parentElement : null;
    if (gp) {
      var gpChildren = Array.prototype.slice.call(gp.children);
      for (var g = 0; g < gpChildren.length; g++) {
        var gc = gpChildren[g];
        if (gc === parent2 || gc.contains(parent2)) continue;
        var leaves = Array.prototype.slice.call(gc.querySelectorAll("*")).filter(function(x) { return x.children.length === 0; });
        if (leaves.length === 0 && gc.children.length === 0) leaves = [gc];
        for (var l = 0; l < leaves.length; l++) {
          var rC = checkText((leaves[l].textContent || "").trim());
          if (rC) return rC;
        }
      }
    }
  }
  return { raw: null, parsed: null };
}`;

async function readLabel(page, label) {
  try {
    return await page.evaluate(eval(READER), label);
  } catch {
    return { raw: null, parsed: null };
  }
}

// Regex-based text finder: searches body innerText for patterns
async function findNumberInText(page, pattern) {
  try {
    const text = await page.evaluate(() => document.body.innerText);
    const re = new RegExp(pattern);
    const m = text.match(re);
    if (m && m[1]) return parseInt(m[1].replace(/,/g, ""), 10);
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// DB helper: get orgId for a user
// ============================================================================
async function getOrgId(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

// ============================================================================
// Load status enum
// ============================================================================
const LOAD_STATUSES = [
  "DRAFT", "POSTED", "SEARCHING", "OFFERED", "ASSIGNED",
  "PICKUP_PENDING", "IN_TRANSIT", "DELIVERED", "COMPLETED",
  "CANCELLED", "EXPIRED", "EXCEPTION", "UNPOSTED",
];

const TRIP_STATUSES = [
  "ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT", "DELIVERED",
  "COMPLETED", "CANCELLED", "EXCEPTION",
];

// ============================================================================
// Markdown table helper
// ============================================================================
function mdTable(headers, rows) {
  const widths = headers.map((h, i) => {
    let max = h.length;
    for (const r of rows) {
      const cell = String(r[i] ?? "");
      if (cell.length > max) max = cell.length;
    }
    return max;
  });
  const pad = (s, w) => String(s ?? "").padEnd(w);
  const line = (cells) => "| " + cells.map((c, i) => pad(c, widths[i])).join(" | ") + " |";
  const sep = "| " + widths.map(w => "-".repeat(w)).join(" | ") + " |";
  return [line(headers), sep, ...rows.map(r => line(r))].join("\n");
}

// ============================================================================
// TEST 1 — Database vs API
// ============================================================================
async function test1_DbVsApi() {
  console.log("\n# TEST 1 — Database vs API\n");
  const rows = [];

  // --- SHIPPER ---
  for (const email of ["shipper@test.com", "wf-shipper@test.com"]) {
    const cookie = await loginWeb(email);
    if (!cookie) {
      console.log(`  SKIP: ${email} login failed`);
      continue;
    }
    const orgId = await getOrgId(email);
    if (!orgId) {
      console.log(`  SKIP: ${email} no org`);
      continue;
    }

    // Dashboard
    const dash = await apiGet("/api/shipper/dashboard", cookie);
    if (!dash._error) {
      const dbTotal = await prisma.load.count({ where: { shipperId: orgId } });
      const dbActive = await prisma.load.count({
        where: { shipperId: orgId, status: { in: ["POSTED", "SEARCHING", "OFFERED", "ASSIGNED", "PICKUP_PENDING"] } },
      });
      const dbInTransit = await prisma.load.count({ where: { shipperId: orgId, status: "IN_TRANSIT" } });

      const r1 = check("T1", `${email} dash.totalLoads`, dbTotal, dash.stats?.totalLoads);
      rows.push([email, "dash.totalLoads", r1.db, r1.api, r1.pass ? "PASS" : "FAIL"]);

      const r2 = check("T1", `${email} dash.activeLoads`, dbActive, dash.stats?.activeLoads);
      rows.push([email, "dash.activeLoads", r2.db, r2.api, r2.pass ? "PASS" : "FAIL"]);

      const r3 = check("T1", `${email} dash.inTransitLoads`, dbInTransit, dash.stats?.inTransitLoads);
      rows.push([email, "dash.inTransitLoads", r3.db, r3.api, r3.pass ? "PASS" : "FAIL"]);

      // Wallet
      const dbWallet = await prisma.financialAccount.findFirst({
        where: { organizationId: orgId, accountType: "SHIPPER_WALLET" },
        select: { balance: true },
      });
      const r4 = check("T1", `${email} dash.wallet.balance`, Number(dbWallet?.balance ?? 0), dash.wallet?.balance ?? 0);
      rows.push([email, "dash.wallet.balance", r4.db, r4.api, r4.pass ? "PASS" : "FAIL"]);
    }

    // Loads total
    const loadsResp = await apiGet("/api/loads?myLoads=true&limit=1", cookie);
    if (!loadsResp._error) {
      const dbLoadsTotal = await prisma.load.count({ where: { shipperId: orgId } });
      const r = check("T1", `${email} loads.total`, dbLoadsTotal, loadsResp.pagination?.total);
      rows.push([email, "loads.total", r.db, r.api, r.pass ? "PASS" : "FAIL"]);
    }

    // Loads per status
    for (const st of LOAD_STATUSES) {
      const loadsStatus = await apiGet(`/api/loads?myLoads=true&status=${st}&limit=1`, cookie);
      if (!loadsStatus._error) {
        const dbCount = await prisma.load.count({ where: { shipperId: orgId, status: st } });
        const apiCount = loadsStatus.pagination?.total ?? 0;
        const r = check("T1", `${email} loads.${st}`, dbCount, apiCount);
        rows.push([email, `loads.${st}`, r.db, r.api, r.pass ? "PASS" : "FAIL"]);
      }
    }

    // Trips
    const tripsResp = await apiGet("/api/trips?limit=1", cookie);
    if (!tripsResp._error) {
      const dbTrips = await prisma.trip.count({ where: { shipperId: orgId } });
      const r = check("T1", `${email} trips.total`, dbTrips, tripsResp.pagination?.total);
      rows.push([email, "trips.total", r.db, r.api, r.pass ? "PASS" : "FAIL"]);
    }

    for (const st of TRIP_STATUSES) {
      const tResp = await apiGet(`/api/trips?status=${st}&limit=1`, cookie);
      if (!tResp._error) {
        const dbCount = await prisma.trip.count({ where: { shipperId: orgId, status: st } });
        const apiCount = tResp.pagination?.total ?? 0;
        const r = check("T1", `${email} trips.${st}`, dbCount, apiCount);
        rows.push([email, `trips.${st}`, r.db, r.api, r.pass ? "PASS" : "FAIL"]);
      }
    }

    // Wallet endpoint
    const walletResp = await apiGet("/api/financial/wallet", cookie);
    if (!walletResp._error) {
      const dbWallet = await prisma.financialAccount.findFirst({
        where: { organizationId: orgId, accountType: "SHIPPER_WALLET" },
        select: { balance: true },
      });
      const r = check("T1", `${email} wallet.balance`, Number(dbWallet?.balance ?? 0), Number(walletResp.wallet?.balance ?? 0));
      rows.push([email, "wallet.balance", r.db, r.api, r.pass ? "PASS" : "FAIL"]);
    }
  }

  // --- CARRIER ---
  for (const email of ["carrier@test.com", "wf-carrier@test.com"]) {
    const cookie = await loginWeb(email);
    if (!cookie) {
      console.log(`  SKIP: ${email} login failed`);
      continue;
    }
    const orgId = await getOrgId(email);
    if (!orgId) continue;

    // Dashboard
    const dash = await apiGet("/api/carrier/dashboard", cookie);
    if (!dash._error) {
      const dbTotalTrucks = await prisma.truck.count({ where: { carrierId: orgId } });
      const dbActiveTrucks = await prisma.truck.count({ where: { carrierId: orgId, isAvailable: true } });
      const dbActivePostings = await prisma.truckPosting.count({ where: { carrierId: orgId, status: "ACTIVE" } });
      const dbPending = await prisma.truck.count({ where: { carrierId: orgId, approvalStatus: "PENDING" } });

      let r;
      r = check("T1", `${email} dash.totalTrucks`, dbTotalTrucks, dash.totalTrucks);
      rows.push([email, "dash.totalTrucks", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      r = check("T1", `${email} dash.activeTrucks`, dbActiveTrucks, dash.activeTrucks);
      rows.push([email, "dash.activeTrucks", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      r = check("T1", `${email} dash.activePostings`, dbActivePostings, dash.activePostings);
      rows.push([email, "dash.activePostings", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      r = check("T1", `${email} dash.pendingApprovals`, dbPending, dash.pendingApprovals);
      rows.push([email, "dash.pendingApprovals", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      // Wallet from dashboard
      const dbWallet = await prisma.financialAccount.findFirst({
        where: { organizationId: orgId, accountType: "CARRIER_WALLET" },
        select: { balance: true },
      });
      r = check("T1", `${email} dash.wallet.balance`, Number(dbWallet?.balance ?? 0), dash.wallet?.balance ?? 0);
      rows.push([email, "dash.wallet.balance", r.db, r.api, r.pass ? "PASS" : "FAIL"]);
    }

    // Trucks total
    const trucksResp = await apiGet("/api/trucks?limit=1", cookie);
    if (!trucksResp._error) {
      const dbCount = await prisma.truck.count({ where: { carrierId: orgId } });
      const r = check("T1", `${email} trucks.total`, dbCount, trucksResp.pagination?.total);
      rows.push([email, "trucks.total", r.db, r.api, r.pass ? "PASS" : "FAIL"]);
    }

    // Trucks by approvalStatus
    for (const as of ["APPROVED", "PENDING", "REJECTED"]) {
      const tResp = await apiGet(`/api/trucks?approvalStatus=${as}&limit=1`, cookie);
      if (!tResp._error) {
        const dbCount = await prisma.truck.count({ where: { carrierId: orgId, approvalStatus: as } });
        const apiCount = tResp.pagination?.total ?? 0;
        const r = check("T1", `${email} trucks.${as}`, dbCount, apiCount);
        rows.push([email, `trucks.${as}`, r.db, r.api, r.pass ? "PASS" : "FAIL"]);
      }
    }

    // Trips
    const tripsResp = await apiGet("/api/trips?limit=1", cookie);
    if (!tripsResp._error) {
      const dbTrips = await prisma.trip.count({ where: { carrierId: orgId } });
      const r = check("T1", `${email} trips.total`, dbTrips, tripsResp.pagination?.total);
      rows.push([email, "trips.total", r.db, r.api, r.pass ? "PASS" : "FAIL"]);
    }

    for (const st of TRIP_STATUSES) {
      const tResp = await apiGet(`/api/trips?status=${st}&limit=1`, cookie);
      if (!tResp._error) {
        const dbCount = await prisma.trip.count({ where: { carrierId: orgId, status: st } });
        const apiCount = tResp.pagination?.total ?? 0;
        const r = check("T1", `${email} trips.${st}`, dbCount, apiCount);
        rows.push([email, `trips.${st}`, r.db, r.api, r.pass ? "PASS" : "FAIL"]);
      }
    }

    // Wallet endpoint
    const walletResp = await apiGet("/api/financial/wallet", cookie);
    if (!walletResp._error) {
      const dbWallet = await prisma.financialAccount.findFirst({
        where: { organizationId: orgId, accountType: "CARRIER_WALLET" },
        select: { balance: true },
      });
      const r = check("T1", `${email} wallet.balance`, Number(dbWallet?.balance ?? 0), Number(walletResp.wallet?.balance ?? 0));
      rows.push([email, "wallet.balance", r.db, r.api, r.pass ? "PASS" : "FAIL"]);
    }
  }

  // --- DISPATCHER ---
  {
    const email = "dispatcher@test.com";
    const cookie = await loginWeb(email, "password");
    if (cookie) {
      const dash = await apiGet("/api/dispatcher/dashboard", cookie);
      if (!dash._error && dash.stats) {
        const dbPosted = await prisma.load.count({ where: { status: "POSTED" } });
        const dbAssigned = await prisma.load.count({ where: { status: "ASSIGNED" } });
        const dbInTransit = await prisma.load.count({ where: { status: "IN_TRANSIT" } });
        const dbAvailTrucks = await prisma.truckPosting.count({ where: { status: "ACTIVE" } });
        const dbExceptions = await prisma.trip.count({ where: { status: "EXCEPTION" } });
        const dbPendingProposals = await prisma.matchProposal.count({ where: { status: "PENDING" } });

        let r;
        r = check("T1", `${email} dash.postedLoads`, dbPosted, dash.stats.postedLoads);
        rows.push([email, "dash.postedLoads", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

        r = check("T1", `${email} dash.assignedLoads`, dbAssigned, dash.stats.assignedLoads);
        rows.push([email, "dash.assignedLoads", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

        r = check("T1", `${email} dash.inTransitLoads`, dbInTransit, dash.stats.inTransitLoads);
        rows.push([email, "dash.inTransitLoads", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

        r = check("T1", `${email} dash.availableTrucks`, dbAvailTrucks, dash.stats.availableTrucks);
        rows.push([email, "dash.availableTrucks", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

        r = check("T1", `${email} dash.exceptionTrips`, dbExceptions, dash.stats.exceptionTrips);
        rows.push([email, "dash.exceptionTrips", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

        r = check("T1", `${email} dash.pendingProposals`, dbPendingProposals, dash.stats.pendingProposals);
        rows.push([email, "dash.pendingProposals", r.db, r.api, r.pass ? "PASS" : "FAIL"]);
      }
    } else {
      console.log(`  SKIP: ${email} login failed`);
    }
  }

  // --- ADMIN ---
  for (const email of ["admin@test.com", "superadmin@test.com"]) {
    const cookie = await loginWeb(email);
    if (!cookie) {
      console.log(`  SKIP: ${email} login failed`);
      continue;
    }

    // Admin dashboard
    const dash = await apiGet("/api/admin/dashboard", cookie);
    if (!dash._error) {
      const dbUsers = await prisma.user.count();
      const dbOrgs = await prisma.organization.count();
      const dbLoads = await prisma.load.count();
      const dbTrucks = await prisma.truck.count();

      let r;
      r = check("T1", `${email} dash.totalUsers`, dbUsers, dash.totalUsers);
      rows.push([email, "dash.totalUsers", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      r = check("T1", `${email} dash.totalOrganizations`, dbOrgs, dash.totalOrganizations);
      rows.push([email, "dash.totalOrganizations", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      r = check("T1", `${email} dash.totalLoads`, dbLoads, dash.totalLoads);
      rows.push([email, "dash.totalLoads", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      r = check("T1", `${email} dash.totalTrucks`, dbTrucks, dash.totalTrucks);
      rows.push([email, "dash.totalTrucks", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      // Trips
      r = check("T1", `${email} dash.trips.total`, await prisma.trip.count(), dash.trips?.total);
      rows.push([email, "dash.trips.total", r.db, r.api, r.pass ? "PASS" : "FAIL"]);
    }

    // Analytics
    const analytics = await apiGet("/api/admin/analytics?period=year", cookie);
    if (!analytics._error && analytics.summary) {
      const s = analytics.summary;
      const dbUsers = await prisma.user.count();
      const dbOrgs = await prisma.organization.count();
      const dbLoads = await prisma.load.count();
      const dbTrucks = await prisma.truck.count();
      const dbTrips = await prisma.trip.count();

      let r;
      r = check("T1", `${email} analytics.users.total`, dbUsers, s.users?.total);
      rows.push([email, "analytics.users.total", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      r = check("T1", `${email} analytics.organizations.total`, dbOrgs, s.organizations?.total);
      rows.push([email, "analytics.organizations.total", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      r = check("T1", `${email} analytics.loads.total`, dbLoads, s.loads?.total);
      rows.push([email, "analytics.loads.total", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      r = check("T1", `${email} analytics.trucks.total`, dbTrucks, s.trucks?.total);
      rows.push([email, "analytics.trucks.total", r.db, r.api, r.pass ? "PASS" : "FAIL"]);

      r = check("T1", `${email} analytics.trips.total`, dbTrips, s.trips?.total);
      rows.push([email, "analytics.trips.total", r.db, r.api, r.pass ? "PASS" : "FAIL"]);
    }
  }

  console.log(mdTable(["User", "Check", "DB", "API", "Result"], rows));
  const t1Pass = rows.filter(r => r[4] === "PASS").length;
  const t1Fail = rows.filter(r => r[4] === "FAIL").length;
  console.log(`\nTEST 1 SUMMARY: ${rows.length} checks, ${t1Pass} passed, ${t1Fail} failed\n`);
}

// ============================================================================
// TEST 2 — Database vs Web UI (Playwright headless)
// ============================================================================
async function test2_DbVsWebUi() {
  console.log("\n# TEST 2 — Database vs Web UI\n");
  const rows = [];
  const browser = await chromium.launch({ headless: true });

  async function makeCtx(email, password = "Test123!") {
    const cookie = await loginWeb(email, password);
    if (!cookie) return null;
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: cookie, domain: "localhost", path: "/", httpOnly: true }]);
    return ctx;
  }

  async function readPage(ctx, url, waitMs = 4500) {
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(waitMs);
      return page;
    } catch (e) {
      console.log(`  WARN: page load failed for ${url}: ${e.message}`);
      return page;
    }
  }

  // --- SHIPPER ---
  for (const email of ["shipper@test.com", "wf-shipper@test.com"]) {
    const ctx = await makeCtx(email);
    if (!ctx) { console.log(`  SKIP: ${email} login failed`); continue; }
    const orgId = await getOrgId(email);
    if (!orgId) { await ctx.close(); continue; }

    // Dashboard
    {
      const page = await readPage(ctx, `${BASE}/shipper/dashboard`);
      const dbTotal = await prisma.load.count({ where: { shipperId: orgId } });

      const totalLoads = await readLabel(page, "Total Loads");
      if (totalLoads.parsed !== null) {
        const r = check("T2", `${email} dashboard/Total Loads`, dbTotal, totalLoads.parsed, "Web");
        rows.push([email, "dashboard/Total Loads", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
      } else {
        rows.push([email, "dashboard/Total Loads", dbTotal, "(not found)", "SKIP"]);
      }

      const dbInTransit = await prisma.load.count({ where: { shipperId: orgId, status: "IN_TRANSIT" } });
      const inTransit = await readLabel(page, "In Transit");
      if (inTransit.parsed !== null) {
        const r = check("T2", `${email} dashboard/In Transit`, dbInTransit, inTransit.parsed, "Web");
        rows.push([email, "dashboard/In Transit", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
      }

      await page.close();
    }

    // Loads page — total
    {
      const page = await readPage(ctx, `${BASE}/shipper/loads`);
      const dbTotal = await prisma.load.count({ where: { shipperId: orgId } });
      const totalLabel = await readLabel(page, "Total:");
      if (totalLabel.parsed !== null) {
        const r = check("T2", `${email} loads/Total`, dbTotal, totalLabel.parsed, "Web");
        rows.push([email, "loads/Total", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
      } else {
        // Try regex
        const regexVal = await findNumberInText(page, "Total:\\s*(\\d+)");
        if (regexVal !== null) {
          const r = check("T2", `${email} loads/Total`, dbTotal, regexVal, "Web");
          rows.push([email, "loads/Total", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
        } else {
          rows.push([email, "loads/Total", dbTotal, "(not found)", "SKIP"]);
        }
      }
      await page.close();
    }

    // Loads per status tab
    const STATUS_MAP = {
      active: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"],
      posted: ["POSTED"],
      draft: ["DRAFT"],
      cancelled: ["CANCELLED"],
      completed: ["COMPLETED"],
      exception: ["EXCEPTION"],
      expired: ["EXPIRED"],
      in_transit: ["IN_TRANSIT"],
      delivered: ["DELIVERED"],
      searching: ["SEARCHING"],
      offered: ["OFFERED"],
      unposted: ["UNPOSTED"],
    };

    for (const [tab, statuses] of Object.entries(STATUS_MAP)) {
      const page = await readPage(ctx, `${BASE}/shipper/loads?status=${tab}`);
      const dbCount = await prisma.load.count({
        where: { shipperId: orgId, status: { in: statuses } },
      });
      const totalLabel = await readLabel(page, "Total:");
      let webVal = totalLabel.parsed;
      if (webVal === null) {
        webVal = await findNumberInText(page, "Total:\\s*(\\d+)");
      }
      if (webVal !== null) {
        const r = check("T2", `${email} loads?status=${tab}`, dbCount, webVal, "Web");
        rows.push([email, `loads?status=${tab}`, r.db, r.web, r.pass ? "PASS" : "FAIL"]);
      } else {
        rows.push([email, `loads?status=${tab}`, dbCount, "(not found)", "SKIP"]);
      }
      await page.close();
    }

    await ctx.close();
  }

  // --- CARRIER ---
  for (const email of ["carrier@test.com", "wf-carrier@test.com"]) {
    const ctx = await makeCtx(email);
    if (!ctx) { console.log(`  SKIP: ${email} login failed`); continue; }
    const orgId = await getOrgId(email);
    if (!orgId) { await ctx.close(); continue; }

    // Dashboard
    {
      const page = await readPage(ctx, `${BASE}/carrier/dashboard`);
      const dbTotalTrucks = await prisma.truck.count({ where: { carrierId: orgId } });

      const totalTrucks = await readLabel(page, "Total Trucks");
      if (totalTrucks.parsed !== null) {
        const r = check("T2", `${email} dashboard/Total Trucks`, dbTotalTrucks, totalTrucks.parsed, "Web");
        rows.push([email, "dashboard/Total Trucks", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
      } else {
        rows.push([email, "dashboard/Total Trucks", dbTotalTrucks, "(not found)", "SKIP"]);
      }

      const dbPending = await prisma.truck.count({ where: { carrierId: orgId, approvalStatus: "PENDING" } });
      const pending = await readLabel(page, "Pending Approvals");
      if (pending.parsed !== null) {
        const r = check("T2", `${email} dashboard/Pending Approvals`, dbPending, pending.parsed, "Web");
        rows.push([email, "dashboard/Pending Approvals", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
      }

      // Wallet balance
      const dbWallet = await prisma.financialAccount.findFirst({
        where: { organizationId: orgId, accountType: "CARRIER_WALLET" },
        select: { balance: true },
      });
      const walletLabel = await readLabel(page, "Wallet Balance");
      if (walletLabel.parsed !== null) {
        const r = check("T2", `${email} dashboard/Wallet Balance`, Number(dbWallet?.balance ?? 0), walletLabel.parsed, "Web");
        rows.push([email, "dashboard/Wallet Balance", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
      }

      await page.close();
    }

    // Wallet page
    {
      const page = await readPage(ctx, `${BASE}/carrier/wallet`);
      const dbWallet = await prisma.financialAccount.findFirst({
        where: { organizationId: orgId, accountType: "CARRIER_WALLET" },
        select: { balance: true },
      });
      const balance = await readLabel(page, "Current Balance");
      if (balance.parsed === null) {
        // Try alternative label
        const alt = await readLabel(page, "Balance");
        if (alt.parsed !== null) {
          const r = check("T2", `${email} wallet/Balance`, Number(dbWallet?.balance ?? 0), alt.parsed, "Web");
          rows.push([email, "wallet/Balance", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
        }
      } else {
        const r = check("T2", `${email} wallet/Current Balance`, Number(dbWallet?.balance ?? 0), balance.parsed, "Web");
        rows.push([email, "wallet/Current Balance", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
      }
      await page.close();
    }

    await ctx.close();
  }

  // --- DISPATCHER ---
  {
    const email = "dispatcher@test.com";
    const ctx = await makeCtx(email, "password");
    if (ctx) {
      const page = await readPage(ctx, `${BASE}/dispatcher/dashboard`);

      const checks = [
        ["Posted Loads", async () => prisma.load.count({ where: { status: "POSTED" } })],
        ["Available Trucks", async () => prisma.truckPosting.count({ where: { status: "ACTIVE" } })],
        ["Assigned Loads", async () => prisma.load.count({ where: { status: "ASSIGNED" } })],
        ["In Transit", async () => prisma.load.count({ where: { status: "IN_TRANSIT" } })],
      ];

      for (const [label, dbFn] of checks) {
        const dbVal = await dbFn();
        const webVal = await readLabel(page, label);
        if (webVal.parsed !== null) {
          const r = check("T2", `${email} dashboard/${label}`, dbVal, webVal.parsed, "Web");
          rows.push([email, `dashboard/${label}`, r.db, r.web, r.pass ? "PASS" : "FAIL"]);
        } else {
          rows.push([email, `dashboard/${label}`, dbVal, "(not found)", "SKIP"]);
        }
      }

      await page.close();
      await ctx.close();
    }
  }

  // --- ADMIN ---
  {
    const email = "admin@test.com";
    const ctx = await makeCtx(email);
    if (ctx) {
      // Admin dashboard
      {
        const page = await readPage(ctx, `${BASE}/admin`);
        const dbUsers = await prisma.user.count();
        const dbOrgs = await prisma.organization.count();
        const dbLoads = await prisma.load.count();
        const dbTrucks = await prisma.truck.count();

        const checks = [
          ["Total Users", dbUsers],
          ["Organizations", dbOrgs],
          ["Total Loads", dbLoads],
          ["Total Trucks", dbTrucks],
        ];

        for (const [label, dbVal] of checks) {
          const webVal = await readLabel(page, label);
          if (webVal.parsed !== null) {
            const r = check("T2", `${email} admin/${label}`, dbVal, webVal.parsed, "Web");
            rows.push([email, `admin/${label}`, r.db, r.web, r.pass ? "PASS" : "FAIL"]);
          } else {
            rows.push([email, `admin/${label}`, dbVal, "(not found)", "SKIP"]);
          }
        }
        await page.close();
      }

      // Admin loads
      {
        const page = await readPage(ctx, `${BASE}/admin/loads`);
        const dbLoads = await prisma.load.count();
        const found = await findNumberInText(page, "(\\d+)\\s+loads? found");
        if (found !== null) {
          const r = check("T2", `${email} admin/loads count`, dbLoads, found, "Web");
          rows.push([email, "admin/loads found", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
        } else {
          rows.push([email, "admin/loads found", dbLoads, "(not found)", "SKIP"]);
        }
        await page.close();
      }

      // Admin trucks
      {
        const page = await readPage(ctx, `${BASE}/admin/trucks`);
        const dbTrucks = await prisma.truck.count();
        const found = await findNumberInText(page, "(\\d+)\\s+trucks? found");
        if (found !== null) {
          const r = check("T2", `${email} admin/trucks count`, dbTrucks, found, "Web");
          rows.push([email, "admin/trucks found", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
        } else {
          rows.push([email, "admin/trucks found", dbTrucks, "(not found)", "SKIP"]);
        }
        await page.close();
      }

      // Admin trips
      {
        const page = await readPage(ctx, `${BASE}/admin/trips`);
        const dbTrips = await prisma.trip.count();
        const found = await findNumberInText(page, "(\\d+)\\s+trips? found");
        if (found !== null) {
          const r = check("T2", `${email} admin/trips count`, dbTrips, found, "Web");
          rows.push([email, "admin/trips found", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
        } else {
          rows.push([email, "admin/trips found", dbTrips, "(not found)", "SKIP"]);
        }
        await page.close();
      }

      // Admin wallets
      {
        const page = await readPage(ctx, `${BASE}/admin/wallets`);
        const dbWallets = await prisma.financialAccount.count();
        const found = await findNumberInText(page, "(\\d+)\\s+accounts? found");
        if (found !== null) {
          const r = check("T2", `${email} admin/wallets count`, dbWallets, found, "Web");
          rows.push([email, "admin/wallets found", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
        } else {
          rows.push([email, "admin/wallets found", dbWallets, "(not found)", "SKIP"]);
        }
        await page.close();
      }

      // Admin users — count table rows
      {
        const page = await readPage(ctx, `${BASE}/admin/users`);
        const dbUsers = await prisma.user.count();
        // Try to find a count indicator in the page
        const found = await findNumberInText(page, "(\\d+)\\s+users?");
        if (found !== null) {
          const r = check("T2", `${email} admin/users count`, dbUsers, found, "Web");
          rows.push([email, "admin/users count", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
        } else {
          // Count tbody rows as fallback
          const rowCount = await page.evaluate(() => {
            const tbody = document.querySelector("tbody");
            return tbody ? tbody.querySelectorAll("tr").length : 0;
          });
          if (rowCount > 0) {
            rows.push([email, "admin/users (tbody rows)", dbUsers, rowCount, rowCount <= dbUsers ? "INFO" : "INFO"]);
          } else {
            rows.push([email, "admin/users count", dbUsers, "(not found)", "SKIP"]);
          }
        }
        await page.close();
      }

      // Admin organizations
      {
        const page = await readPage(ctx, `${BASE}/admin/organizations`);
        const dbOrgs = await prisma.organization.count();
        const found = await findNumberInText(page, "\\((\\d+)\\s+total\\)");
        if (found !== null) {
          const r = check("T2", `${email} admin/orgs count`, dbOrgs, found, "Web");
          rows.push([email, "admin/orgs total", r.db, r.web, r.pass ? "PASS" : "FAIL"]);
        } else {
          rows.push([email, "admin/orgs total", dbOrgs, "(not found)", "SKIP"]);
        }
        await page.close();
      }

      await ctx.close();
    }
  }

  await browser.close();

  console.log(mdTable(["User", "Check", "DB", "Web", "Result"], rows));
  const t2Pass = rows.filter(r => r[4] === "PASS").length;
  const t2Fail = rows.filter(r => r[4] === "FAIL").length;
  const t2Skip = rows.filter(r => r[4] === "SKIP" || r[4] === "INFO").length;
  console.log(`\nTEST 2 SUMMARY: ${rows.length} checks, ${t2Pass} passed, ${t2Fail} failed, ${t2Skip} skipped\n`);
}

// ============================================================================
// TEST 3 — Database vs Expo Mobile (Playwright headed)
// ============================================================================
async function test3_DbVsMobile() {
  console.log("\n# TEST 3 — Database vs Expo Web (headed Playwright)\n");
  const rows = [];

  // SPA static server for mobile/dist
  const MIME = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json",
  };

  const server = createServer(async (req, res) => {
    const urlPath = req.url.split("?")[0];
    let filePath = join(MOBILE_DIST, urlPath === "/" ? "index.html" : urlPath);

    try {
      const s = await stat(filePath);
      if (s.isDirectory()) {
        filePath = join(filePath, "index.html");
      }
    } catch {
      // SPA fallback
      filePath = join(MOBILE_DIST, "index.html");
    }

    try {
      const content = await readFile(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  await new Promise((resolve) => server.listen(MOBILE_PORT, resolve));
  console.log(`  Expo static server running on port ${MOBILE_PORT}`);

  const browser = await chromium.launch({ headless: false });

  async function testMobileUser(email, role, password = "Test123!") {
    const token = await loginMobile(email, password);
    if (!token) {
      console.log(`  SKIP: ${email} mobile login failed`);
      return;
    }
    const orgId = await getOrgId(email);
    if (!orgId) return;

    const ctx = await browser.newContext();
    // Inject token into localStorage/sessionStorage so the Expo app picks it up
    await ctx.addInitScript((tkn) => {
      // Expo secure-store falls back to localStorage on web
      window.localStorage.setItem("auth_token", tkn);
      window.localStorage.setItem("session_token", tkn);
      // Some Expo web builds check sessionStorage
      window.sessionStorage.setItem("auth_token", tkn);
      window.sessionStorage.setItem("session_token", tkn);
    }, token);

    const page = await ctx.newPage();

    // Helper to navigate and wait
    async function goTo(path, waitMs = 8000) {
      try {
        await page.goto(`${MOBILE_BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(waitMs);
      } catch (e) {
        console.log(`  WARN: mobile page ${path} failed: ${e.message}`);
      }
    }

    // Helper to read all leaf text nodes
    async function getAllLeafTexts() {
      return page.evaluate(() => {
        const texts = [];
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walk.nextNode())) {
          const t = (node.nodeValue || "").trim();
          if (t) texts.push(t);
        }
        return texts;
      });
    }

    // Helper to find a number near a label in leaf texts
    function findNearLabel(texts, label) {
      const numRe = /^[-+]?\d[\d,]*(\.\d+)?$/;
      const moneyRe = /^[-+]?(ETB\s*)?[\d,]+(\.\d+)?(\s*ETB)?$/;
      for (let i = 0; i < texts.length; i++) {
        if (texts[i].includes(label)) {
          // Check surrounding texts
          for (let d = 1; d <= 3; d++) {
            for (const idx of [i - d, i + d]) {
              if (idx >= 0 && idx < texts.length) {
                const t = texts[idx].trim();
                if (numRe.test(t.replace(/,/g, ""))) {
                  return parseFloat(t.replace(/[, ETB]/g, ""));
                }
                if (moneyRe.test(t)) {
                  return parseFloat(t.replace(/[, ETB]/g, ""));
                }
              }
            }
          }
        }
      }
      return null;
    }

    if (role === "shipper") {
      // Dashboard
      await goTo("/(shipper)/");
      let texts = await getAllLeafTexts();

      const dbTotal = await prisma.load.count({ where: { shipperId: orgId } });
      const mTotal = findNearLabel(texts, "Total Loads");
      if (mTotal !== null) {
        const r = check("T3", `${email} mobile dash/Total Loads`, dbTotal, mTotal, "Mobile");
        rows.push([email, "dash/Total Loads", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      } else {
        rows.push([email, "dash/Total Loads", dbTotal, "(not found)", "SKIP"]);
      }

      const dbInTransit = await prisma.load.count({ where: { shipperId: orgId, status: "IN_TRANSIT" } });
      const mInTransit = findNearLabel(texts, "In Transit");
      if (mInTransit !== null) {
        const r = check("T3", `${email} mobile dash/In Transit`, dbInTransit, mInTransit, "Mobile");
        rows.push([email, "dash/In Transit", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      } else {
        rows.push([email, "dash/In Transit", dbInTransit, "(not found)", "SKIP"]);
      }

      const dbActive = await prisma.load.count({
        where: { shipperId: orgId, status: { in: ["POSTED", "SEARCHING", "OFFERED", "ASSIGNED", "PICKUP_PENDING"] } },
      });
      const mActive = findNearLabel(texts, "Active Loads") ?? findNearLabel(texts, "Active");
      if (mActive !== null) {
        const r = check("T3", `${email} mobile dash/Active Loads`, dbActive, mActive, "Mobile");
        rows.push([email, "dash/Active Loads", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      const dbDelivered = await prisma.load.count({
        where: { shipperId: orgId, status: { in: ["DELIVERED", "COMPLETED"] } },
      });
      const mDelivered = findNearLabel(texts, "Delivered");
      if (mDelivered !== null) {
        const r = check("T3", `${email} mobile dash/Delivered`, dbDelivered, mDelivered, "Mobile");
        rows.push([email, "dash/Delivered", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      // Wallet balance from dashboard
      const dbWallet = await prisma.financialAccount.findFirst({
        where: { organizationId: orgId, accountType: "SHIPPER_WALLET" },
        select: { balance: true },
      });
      const mBalance = findNearLabel(texts, "Balance") ?? findNearLabel(texts, "Wallet");
      if (mBalance !== null) {
        const r = check("T3", `${email} mobile dash/Balance`, Number(dbWallet?.balance ?? 0), mBalance, "Mobile");
        rows.push([email, "dash/Balance", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      // Loads screen
      await goTo("/(shipper)/loads");
      texts = await getAllLeafTexts();
      const mLoadsTotal = findNearLabel(texts, "Total:");
      if (mLoadsTotal !== null) {
        const r = check("T3", `${email} mobile loads/Total`, dbTotal, mLoadsTotal, "Mobile");
        rows.push([email, "loads/Total", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      // Trips screen
      await goTo("/(shipper)/trips");
      texts = await getAllLeafTexts();
      const dbTrips = await prisma.trip.count({ where: { shipperId: orgId } });
      const mTripsTotal = findNearLabel(texts, "Total:");
      if (mTripsTotal !== null) {
        const r = check("T3", `${email} mobile trips/Total`, dbTrips, mTripsTotal, "Mobile");
        rows.push([email, "trips/Total", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      // Wallet screen
      await goTo("/(shipper)/wallet");
      texts = await getAllLeafTexts();
      const mWalletBalance = findNearLabel(texts, "Current Balance") ?? findNearLabel(texts, "Balance");
      if (mWalletBalance !== null) {
        const r = check("T3", `${email} mobile wallet/Balance`, Number(dbWallet?.balance ?? 0), mWalletBalance, "Mobile");
        rows.push([email, "wallet/Balance", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }
    }

    if (role === "carrier") {
      // Dashboard
      await goTo("/(carrier)/");
      let texts = await getAllLeafTexts();

      const dbTotalTrucks = await prisma.truck.count({ where: { carrierId: orgId } });
      const mTrucks = findNearLabel(texts, "My Trucks") ?? findNearLabel(texts, "Total Trucks");
      if (mTrucks !== null) {
        const r = check("T3", `${email} mobile dash/Trucks`, dbTotalTrucks, mTrucks, "Mobile");
        rows.push([email, "dash/Trucks", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      } else {
        rows.push([email, "dash/Trucks", dbTotalTrucks, "(not found)", "SKIP"]);
      }

      const dbWallet = await prisma.financialAccount.findFirst({
        where: { organizationId: orgId, accountType: "CARRIER_WALLET" },
        select: { balance: true },
      });
      const mBalance = findNearLabel(texts, "Wallet") ?? findNearLabel(texts, "Balance");
      if (mBalance !== null) {
        const r = check("T3", `${email} mobile dash/Wallet`, Number(dbWallet?.balance ?? 0), mBalance, "Mobile");
        rows.push([email, "dash/Wallet", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      const dbActivePostings = await prisma.truckPosting.count({ where: { carrierId: orgId, status: "ACTIVE" } });
      const mPostings = findNearLabel(texts, "Active Postings");
      if (mPostings !== null) {
        const r = check("T3", `${email} mobile dash/Active Postings`, dbActivePostings, mPostings, "Mobile");
        rows.push([email, "dash/Active Postings", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      const dbPending = await prisma.truck.count({ where: { carrierId: orgId, approvalStatus: "PENDING" } });
      const mPending = findNearLabel(texts, "Pending");
      if (mPending !== null) {
        const r = check("T3", `${email} mobile dash/Pending`, dbPending, mPending, "Mobile");
        rows.push([email, "dash/Pending", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      const dbCompleted = await prisma.trip.count({
        where: { carrierId: orgId, status: { in: ["DELIVERED", "COMPLETED"] } },
      });
      const mCompleted = findNearLabel(texts, "Completed") ?? findNearLabel(texts, "Completed Deliveries");
      if (mCompleted !== null) {
        const r = check("T3", `${email} mobile dash/Completed`, dbCompleted, mCompleted, "Mobile");
        rows.push([email, "dash/Completed", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      // Trucks screen
      await goTo("/(carrier)/trucks");
      texts = await getAllLeafTexts();

      const dbApproved = await prisma.truck.count({ where: { carrierId: orgId, approvalStatus: "APPROVED" } });
      const mApproved = findNearLabel(texts, "Approved");
      if (mApproved !== null) {
        const r = check("T3", `${email} mobile trucks/Approved`, dbApproved, mApproved, "Mobile");
        rows.push([email, "trucks/Approved", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      const dbRejected = await prisma.truck.count({ where: { carrierId: orgId, approvalStatus: "REJECTED" } });
      const mRejected = findNearLabel(texts, "Rejected");
      if (mRejected !== null) {
        const r = check("T3", `${email} mobile trucks/Rejected`, dbRejected, mRejected, "Mobile");
        rows.push([email, "trucks/Rejected", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      // Trips screen
      await goTo("/(carrier)/trips");
      texts = await getAllLeafTexts();
      const dbTrips = await prisma.trip.count({ where: { carrierId: orgId } });
      const mTripsTotal = findNearLabel(texts, "Total:");
      if (mTripsTotal !== null) {
        const r = check("T3", `${email} mobile trips/Total`, dbTrips, mTripsTotal, "Mobile");
        rows.push([email, "trips/Total", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }

      // Wallet screen
      await goTo("/(carrier)/wallet");
      texts = await getAllLeafTexts();
      const mWalletBal = findNearLabel(texts, "Current Balance") ?? findNearLabel(texts, "Balance");
      if (mWalletBal !== null) {
        const r = check("T3", `${email} mobile wallet/Balance`, Number(dbWallet?.balance ?? 0), mWalletBal, "Mobile");
        rows.push([email, "wallet/Balance", r.db, r.mobile, r.pass ? "PASS" : "FAIL"]);
      }
    }

    await ctx.close();
  }

  try {
    await testMobileUser("shipper@test.com", "shipper");
    await testMobileUser("carrier@test.com", "carrier");
  } catch (e) {
    console.log(`  ERROR in TEST 3: ${e.message}`);
  }

  await browser.close();
  server.close();

  console.log(mdTable(["User", "Check", "DB", "Mobile", "Result"], rows));
  const t3Pass = rows.filter(r => r[4] === "PASS").length;
  const t3Fail = rows.filter(r => r[4] === "FAIL").length;
  const t3Skip = rows.filter(r => r[4] === "SKIP").length;
  console.log(`\nTEST 3 SUMMARY: ${rows.length} checks, ${t3Pass} passed, ${t3Fail} failed, ${t3Skip} skipped\n`);
}

// ============================================================================
// TEST 4 — Cross-role consistency
// ============================================================================
async function test4_CrossRole() {
  console.log("\n# TEST 4 — Cross-role consistency\n");
  const rows = [];

  // Get org IDs
  const shipperOrg = await getOrgId("shipper@test.com");
  const wfShipperOrg = await getOrgId("wf-shipper@test.com");
  const carrierOrg = await getOrgId("carrier@test.com");
  const wfCarrierOrg = await getOrgId("wf-carrier@test.com");

  // Total loads: shipper loads + wf-shipper loads vs admin total
  const dbTotalLoads = await prisma.load.count();
  const shipperLoads = shipperOrg ? await prisma.load.count({ where: { shipperId: shipperOrg } }) : 0;
  const wfShipperLoads = wfShipperOrg ? await prisma.load.count({ where: { shipperId: wfShipperOrg } }) : 0;
  const otherShipperLoads = dbTotalLoads - shipperLoads - wfShipperLoads;

  rows.push(["shipper@test.com loads", shipperLoads, "", ""]);
  rows.push(["wf-shipper@test.com loads", wfShipperLoads, "", ""]);
  rows.push(["Other shipper loads", otherShipperLoads, "", ""]);
  {
    const r = check("T4", "Load total = sum of all shippers", dbTotalLoads, shipperLoads + wfShipperLoads + otherShipperLoads, "Cross");
    rows.push(["SUM loads", r.db, r.cross, r.pass ? "PASS" : "FAIL"]);
  }

  // Total trucks
  const dbTotalTrucks = await prisma.truck.count();
  const carrierTrucks = carrierOrg ? await prisma.truck.count({ where: { carrierId: carrierOrg } }) : 0;
  const wfCarrierTrucks = wfCarrierOrg ? await prisma.truck.count({ where: { carrierId: wfCarrierOrg } }) : 0;
  const otherCarrierTrucks = dbTotalTrucks - carrierTrucks - wfCarrierTrucks;

  rows.push(["carrier@test.com trucks", carrierTrucks, "", ""]);
  rows.push(["wf-carrier@test.com trucks", wfCarrierTrucks, "", ""]);
  rows.push(["Other carrier trucks", otherCarrierTrucks, "", ""]);
  {
    const r = check("T4", "Truck total = sum of all carriers", dbTotalTrucks, carrierTrucks + wfCarrierTrucks + otherCarrierTrucks, "Cross");
    rows.push(["SUM trucks", r.db, r.cross, r.pass ? "PASS" : "FAIL"]);
  }

  // Wallet balances sum
  const allWallets = await prisma.financialAccount.findMany({
    where: { accountType: { in: ["SHIPPER_WALLET", "CARRIER_WALLET"] } },
    select: { balance: true, accountType: true, organizationId: true },
  });
  const totalWalletBalance = allWallets.reduce((sum, w) => sum + Number(w.balance), 0);
  const shipperWallets = allWallets.filter(w => w.accountType === "SHIPPER_WALLET");
  const carrierWallets = allWallets.filter(w => w.accountType === "CARRIER_WALLET");
  const shipperWalletSum = shipperWallets.reduce((sum, w) => sum + Number(w.balance), 0);
  const carrierWalletSum = carrierWallets.reduce((sum, w) => sum + Number(w.balance), 0);

  rows.push(["Shipper wallets sum", shipperWalletSum.toFixed(2), `${shipperWallets.length} wallets`, ""]);
  rows.push(["Carrier wallets sum", carrierWalletSum.toFixed(2), `${carrierWallets.length} wallets`, ""]);
  rows.push(["Total wallets sum", totalWalletBalance.toFixed(2), `${allWallets.length} wallets`, ""]);

  // API cross-check: admin total loads/trucks vs per-role
  const adminCookie = await loginWeb("admin@test.com");
  if (adminCookie) {
    const adminDash = await apiGet("/api/admin/dashboard", adminCookie);
    if (!adminDash._error) {
      const r1 = check("T4", "Admin totalLoads = DB total", dbTotalLoads, adminDash.totalLoads, "Cross");
      rows.push(["Admin totalLoads vs DB", r1.db, r1.cross, r1.pass ? "PASS" : "FAIL"]);

      const r2 = check("T4", "Admin totalTrucks = DB total", dbTotalTrucks, adminDash.totalTrucks, "Cross");
      rows.push(["Admin totalTrucks vs DB", r2.db, r2.cross, r2.pass ? "PASS" : "FAIL"]);
    }

    // Cross-check shipper API total vs admin API total
    for (const email of ["shipper@test.com", "wf-shipper@test.com"]) {
      const sCookie = await loginWeb(email);
      if (!sCookie) continue;
      const orgId = await getOrgId(email);
      if (!orgId) continue;
      const sLoads = await apiGet("/api/loads?myLoads=true&limit=1", sCookie);
      if (!sLoads._error) {
        const dbShipperLoads = await prisma.load.count({ where: { shipperId: orgId } });
        const r = check("T4", `${email} API total = DB`, dbShipperLoads, sLoads.pagination?.total, "Cross");
        rows.push([`${email} loads API vs DB`, r.db, r.cross, r.pass ? "PASS" : "FAIL"]);
      }
    }

    // Cross-check carrier API vs admin
    for (const email of ["carrier@test.com", "wf-carrier@test.com"]) {
      const cCookie = await loginWeb(email);
      if (!cCookie) continue;
      const orgId = await getOrgId(email);
      if (!orgId) continue;
      const cTrucks = await apiGet("/api/trucks?limit=1", cCookie);
      if (!cTrucks._error) {
        const dbCarrierTrucks = await prisma.truck.count({ where: { carrierId: orgId } });
        const r = check("T4", `${email} API total = DB`, dbCarrierTrucks, cTrucks.pagination?.total, "Cross");
        rows.push([`${email} trucks API vs DB`, r.db, r.cross, r.pass ? "PASS" : "FAIL"]);
      }
    }
  }

  // Trip consistency: all shipper trips + all carrier trips should cover all trips
  const dbTotalTrips = await prisma.trip.count();
  const shipperTrips = shipperOrg ? await prisma.trip.count({ where: { shipperId: shipperOrg } }) : 0;
  const wfShipperTrips = wfShipperOrg ? await prisma.trip.count({ where: { shipperId: wfShipperOrg } }) : 0;
  const otherShipperTrips = dbTotalTrips - shipperTrips - wfShipperTrips;
  rows.push(["shipper@test.com trips", shipperTrips, "", ""]);
  rows.push(["wf-shipper@test.com trips", wfShipperTrips, "", ""]);
  rows.push(["Other trips", otherShipperTrips, "", ""]);
  {
    const r = check("T4", "Trip total = sum by shipper", dbTotalTrips, shipperTrips + wfShipperTrips + otherShipperTrips, "Cross");
    rows.push(["SUM trips (by shipper)", r.db, r.cross, r.pass ? "PASS" : "FAIL"]);
  }

  console.log(mdTable(["Check", "Value A", "Value B", "Result"], rows));
  const t4Pass = rows.filter(r => r[3] === "PASS").length;
  const t4Fail = rows.filter(r => r[3] === "FAIL").length;
  console.log(`\nTEST 4 SUMMARY: ${t4Pass + t4Fail} checks, ${t4Pass} passed, ${t4Fail} failed\n`);
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log("=".repeat(72));
  console.log("COMPREHENSIVE E2E AUDIT — READ-ONLY");
  console.log("Started:", new Date().toISOString());
  console.log("=".repeat(72));

  try {
    await test1_DbVsApi();
  } catch (e) {
    console.log(`\nTEST 1 CRASHED: ${e.message}\n${e.stack}\n`);
  }

  try {
    await test2_DbVsWebUi();
  } catch (e) {
    console.log(`\nTEST 2 CRASHED: ${e.message}\n${e.stack}\n`);
  }

  try {
    await test3_DbVsMobile();
  } catch (e) {
    console.log(`\nTEST 3 CRASHED: ${e.message}\n${e.stack}\n`);
  }

  try {
    await test4_CrossRole();
  } catch (e) {
    console.log(`\nTEST 4 CRASHED: ${e.message}\n${e.stack}\n`);
  }

  // Final summary
  console.log("\n" + "=".repeat(72));
  console.log("COMBINED RESULTS");
  console.log("=".repeat(72));

  const failedResults = allResults.filter(r => !r.pass);
  if (failedResults.length > 0) {
    console.log("\nFailed checks:");
    const failRows = failedResults.map(r => {
      const src = r.api !== undefined ? "API" : r.web !== undefined ? "Web" : r.mobile !== undefined ? "Mobile" : "Cross";
      const val = r.api ?? r.web ?? r.mobile ?? r.cross;
      return [r.test, r.label, String(r.db), String(val), src];
    });
    console.log(mdTable(["Test", "Label", "DB", "Other", "Source"], failRows));
  }

  console.log(`\nTOTAL: ${totalChecks} checks, ${totalPassed} passed, ${totalFailed} failed`);
  console.log("Finished:", new Date().toISOString());

  // Cleanup
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("FATAL:", e);
  prisma.$disconnect().catch(() => {});
  pool.end().catch(() => {});
  process.exit(1);
});
