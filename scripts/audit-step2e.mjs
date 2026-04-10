// Step 2e — Expo Carrier Dashboard
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
const mime = { ".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".ttf":"font/ttf",".woff":"font/woff",".woff2":"font/woff2",".ico":"image/x-icon" };
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  let filePath = path.join(EXPO_DIST, urlPath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) filePath = path.join(EXPO_DIST, "index.html");
  res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});
await new Promise(r => server.listen(8088, r));

async function login(email, password = "Test123!") {
  const res = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-type": "mobile" },
    body: JSON.stringify({ email, password }),
  });
  return (await res.json()).sessionToken;
}

const token = await login("carrier@test.com");
const user = await prisma.user.findUnique({
  where: { email: "carrier@test.com" }, select: { organizationId: true },
});
const totalTrucks = await prisma.truck.count({ where: { carrierId: user.organizationId } });
const approved = await prisma.truck.count({ where: { carrierId: user.organizationId, approvalStatus: "APPROVED" } });
const pending = await prisma.truck.count({ where: { carrierId: user.organizationId, approvalStatus: "PENDING" } });
const activePostings = await prisma.truckPosting.count({ where: { carrierId: user.organizationId, status: "ACTIVE" } });
const completedDeliveries = await prisma.trip.count({ where: { carrierId: user.organizationId, status: { in: ["DELIVERED","COMPLETED"] } } });
const inTransitTrips = await prisma.trip.count({ where: { carrierId: user.organizationId, status: "IN_TRANSIT" } });
const wallet = await prisma.financialAccount.findFirst({ where: { organizationId: user.organizationId, accountType: "CARRIER_WALLET" } });
console.log("DB:", { totalTrucks, approved, pending, activePostings, completedDeliveries, inTransitTrips, walletBalance: Number(wallet.balance) });

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const ctx = await browser.newContext();
await ctx.addInitScript(tok => { try { sessionStorage.setItem("session_token", tok); } catch {} }, token);
const page = await ctx.newPage();
await page.goto("http://localhost:8088/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
const dump = await page.evaluate(() => {
  const all = Array.prototype.slice.call(document.querySelectorAll("*"));
  const leaves = [];
  for (const el of all) {
    if (el.children.length > 0) continue;
    const t = (el.textContent || "").trim();
    if (!t || t.length > 60) continue;
    leaves.push(t);
  }
  return { url: location.href, leaves };
});
console.log("Final URL:", dump.url);
console.log("\nAll leaf texts on rendered carrier dashboard:");
for (let i = 0; i < dump.leaves.length; i++) console.log(`  [${i}] ${dump.leaves[i]}`);

await page.waitForTimeout(2000);
await browser.close();
server.close();
await prisma.$disconnect();
await pool.end();
