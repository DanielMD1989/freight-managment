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
const dbUserCount = await prisma.user.count();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies([
  { name: "session", value: cookie, domain: "localhost", path: "/", httpOnly: true },
]);
const page = await ctx.newPage();
await page.goto("http://localhost:3000/admin/users", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);

const dom = await page.evaluate(() => {
  return {
    text: document.body.innerText,
    hasTotalLabel: /total/i.test(document.body.innerText),
    rowCount: document.querySelectorAll("tbody tr").length,
  };
});

// Look for any "X users" or "Total: X" or "of N users" text
const m1 = dom.text.match(/(\d+)\s+users?(?!:)/i);
const m2 = dom.text.match(/of\s+(\d+)\s+users/i);
const m3 = dom.text.match(/Total:?\s+(\d+)/i);
console.log("DB user count:", dbUserCount);
console.log("Visible matches:");
console.log("  /(\\d+)\\s+users?/:", m1 ? m1[0] : "(no match)");
console.log("  /of\\s+(\\d+)\\s+users/:", m2 ? m2[0] : "(no match)");
console.log("  /Total:?\\s+(\\d+)/:", m3 ? m3[0] : "(no match)");
console.log("Visible <tbody tr> rows on page:", dom.rowCount);
console.log("\nFirst 25 lines of page text:");
console.log(dom.text.split("\n").slice(0, 25).join("\n"));

await browser.close();
await prisma.$disconnect();
await pool.end();
