// Step 1j — read /admin/analytics for admin@test.com
// READ-ONLY. Reads every visible numeric label and value on the page.
import { chromium } from "playwright";
import { config } from "dotenv";
config({ path: ".env.local" });
const { PrismaClient } = await import("@prisma/client");
const { PrismaPg } = await import("@prisma/adapter-pg");
const { Pool } = await import("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function login(email, password = "Test123!") {
  const res = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/session=([^;]+)/);
  return m ? m[1] : null;
}

const cookie = await login("admin@test.com");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies([
  { name: "session", value: cookie, domain: "localhost", path: "/", httpOnly: true },
]);
const page = await ctx.newPage();
await page.goto("http://localhost:3000/admin/analytics", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);

// Walk EVERY leaf element on the page; pair each numeric leaf with its
// nearest non-numeric leaf neighbor (preceding or following).
const dump = await page.evaluate(() => {
  const all = Array.prototype.slice.call(document.querySelectorAll("*"));
  const leaves = [];
  for (const el of all) {
    if (el.children.length > 0) continue;
    const t = (el.textContent || "").trim();
    if (!t) continue;
    leaves.push(t);
  }
  return leaves;
});

console.log("All leaf texts on /admin/analytics (in document order):\n");
for (let i = 0; i < dump.length; i++) {
  console.log(`  [${i}] ${dump[i]}`);
}

await browser.close();
await prisma.$disconnect();
await pool.end();
