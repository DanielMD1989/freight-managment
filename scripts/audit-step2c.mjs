// Step 2b — Expo Shipper Trips
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
const mime = {
  ".html":"text/html",".js":"application/javascript",".css":"text/css",
  ".json":"application/json",".png":"image/png",".jpg":"image/jpeg",
  ".svg":"image/svg+xml",".ttf":"font/ttf",".woff":"font/woff",
  ".woff2":"font/woff2",".ico":"image/x-icon",".map":"application/json",
};
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  let filePath = path.join(EXPO_DIST, urlPath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(EXPO_DIST, "index.html");
  }
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

const token = await login("shipper@test.com");
const user = await prisma.user.findUnique({
  where: { email: "shipper@test.com" },
  select: { organizationId: true },
});
const totalLoads = await prisma.trip.count({ where: { shipperId: user.organizationId } });
console.log("DB total loads (shipper@test.com):", totalLoads);

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const ctx = await browser.newContext();
await ctx.addInitScript((tok) => {
  try { sessionStorage.setItem("session_token", tok); } catch {}
}, token);
const page = await ctx.newPage();

// Boot the app at root, wait for auth + redirect to /(shipper)/, then click "My Loads"
await page.goto("http://localhost:8088/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);

// Try the literal Expo Router group-prefixed URL
console.log("Navigating to /(shipper)/trips with literal parens...");
await page.goto("http://localhost:8088/(shipper)/trips", { waitUntil: "domcontentloaded" });
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
  return { url: location.href, title: document.title, leaves };
});
console.log("Final URL:", dump.url);
console.log("Title:", dump.title);
console.log("\nAll leaf texts on the rendered Expo screen:");
for (let i = 0; i < dump.leaves.length; i++) console.log(`  [${i}] ${dump.leaves[i]}`);

await page.waitForTimeout(2000);
await browser.close();
server.close();
await prisma.$disconnect();
await pool.end();
