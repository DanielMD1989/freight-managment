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
const dbUserCount = await prisma.organization.count();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies([
  { name: "session", value: cookie, domain: "localhost", path: "/", httpOnly: true },
]);
const page = await ctx.newPage();
await page.goto("http://localhost:3000/admin/organizations", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);

const dom = await page.evaluate(() => {
  return {
    text: document.body.innerText,
    hasTotalLabel: /total/i.test(document.body.innerText),
    rowCount: document.querySelectorAll("tbody tr").length,
  };
});

// Look for any "X organizations" or "Total: X" or "of N organizations" text
const m1 = dom.text.match(/(\d+)\s+organizations?(?!:)/i);
const m2 = dom.text.match(/of\s+(\d+)\s+organizations/i);
const m3 = dom.text.match(/Total:?\s+(\d+)/i);
console.log("DB organization.count:", dbUserCount);
console.log("Visible matches:");
console.log("  /(\\d+)\\s+organizations?/:", m1 ? m1[0] : "(no match)");
console.log("  /of\\s+(\\d+)\\s+organizations/:", m2 ? m2[0] : "(no match)");
console.log("  /Total:?\\s+(\\d+)/:", m3 ? m3[0] : "(no match)");
console.log("Visible <tbody tr> rows on page:", dom.rowCount);
// Look for "Total Organizations" stat card
const idx = dom.text.indexOf("Total Organizations");
if (idx >= 0) {
  console.log("\n'Total Organizations' card area (80 chars after label):");
  console.log("  " + dom.text.substring(idx, idx + 80).replace(/\n/g, " | "));
}
console.log("\nLines 25-65 of page text:");
console.log(dom.text.split("\n").slice(25, 65).join("\n"));

await browser.close();
await prisma.$disconnect();
await pool.end();
