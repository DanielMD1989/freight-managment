// Step 2a — Expo Shipper Dashboard
// READ-ONLY. Headed Chromium so the user can see the browser open.
import { chromium } from "playwright";
import { config } from "dotenv";
import http from "http";
import fs from "fs";
import path from "path";
config({ path: ".env.local" });
const { PrismaClient } = await import("@prisma/client");
const { PrismaPg } = await import("@prisma/adapter-pg");
const { Pool } = await import("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const EXPO_DIST = path.join(process.cwd(), "mobile/dist");
const EXPO_PORT = 8088;

// ─── Static server for the Expo web export ───
const mime = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".map": "application/json",
};
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
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
await new Promise(r => server.listen(EXPO_PORT, r));
console.log(`Expo static server on http://localhost:${EXPO_PORT}`);

// ─── Auth ───
async function login(email, password = "Test123!") {
  const res = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-type": "mobile" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("login failed: " + res.status);
  const body = await res.json();
  return body.sessionToken;
}

const token = await login("shipper@test.com");
console.log("Got bearer token");

// ─── DB ground truth ───
const user = await prisma.user.findUnique({
  where: { email: "shipper@test.com" },
  select: { organizationId: true },
});
const totalLoads = await prisma.load.count({ where: { shipperId: user.organizationId } });
const activeLoadsApi = await prisma.load.count({
  where: { shipperId: user.organizationId, status: { in: ["POSTED","SEARCHING","OFFERED","ASSIGNED","PICKUP_PENDING"] } },
});
const inTransit = await prisma.load.count({ where: { shipperId: user.organizationId, status: "IN_TRANSIT" } });
const delivered = await prisma.load.count({
  where: { shipperId: user.organizationId, status: { in: ["DELIVERED","COMPLETED"] }, updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
});
console.log("DB:", { totalLoads, activeLoadsApi, inTransit, delivered });

// ─── HEADED Chromium ───
const browser = await chromium.launch({ headless: false, slowMo: 300 });
const ctx = await browser.newContext();
// Inject session_token into sessionStorage BEFORE the app boots so the
// mobile auth store picks it up on initialize()
await ctx.addInitScript((tok) => {
  try { sessionStorage.setItem("session_token", tok); } catch {}
}, token);
const page = await ctx.newPage();

console.log("Navigating to http://localhost:8088/ (Expo root)...");
await page.goto(`http://localhost:${EXPO_PORT}/`, { waitUntil: "domcontentloaded" });
// Wait for the app to authenticate, redirect to (shipper)/, and render the dashboard
await page.waitForTimeout(8000);

const dump = await page.evaluate(() => {
  const all = Array.prototype.slice.call(document.querySelectorAll("*"));
  const leaves = [];
  for (const el of all) {
    if (el.children.length > 0) continue;
    const t = (el.textContent || "").trim();
    if (!t || t.length > 40) continue;
    leaves.push(t);
  }
  return {
    leaves,
    url: location.href,
    title: document.title,
  };
});
console.log("Final URL:", dump.url);
console.log("Title:", dump.title);
console.log("\nAll leaf texts on the rendered Expo screen:");
for (let i = 0; i < dump.leaves.length; i++) {
  console.log(`  [${i}] ${dump.leaves[i]}`);
}

// Keep browser visible briefly
await page.waitForTimeout(3000);
await browser.close();
server.close();
await prisma.$disconnect();
await pool.end();
