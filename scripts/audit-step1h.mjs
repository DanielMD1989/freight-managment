// Step 1h — read /carrier/trips for carrier@test.com
// READ-ONLY. Reads visible tab counts.
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

const cookie = await login("carrier@test.com");
const user = await prisma.user.findUnique({
  where: { email: "carrier@test.com" },
  select: { organizationId: true },
});

// app/carrier/trips/page.tsx TAB_CONFIG:
//   approved (label "Ready to Start") = ["ASSIGNED"]
//   active   (label "Active Trips")   = ["PICKUP_PENDING", "IN_TRANSIT", "DELIVERED", "EXCEPTION"]
const dbApproved = await prisma.trip.count({
  where: { carrierId: user.organizationId, status: { in: ["ASSIGNED"] } },
});
const dbActive = await prisma.trip.count({
  where: {
    carrierId: user.organizationId,
    status: { in: ["PICKUP_PENDING", "IN_TRANSIT", "DELIVERED", "EXCEPTION"] },
  },
});

console.log("DB Ready to Start (ASSIGNED):", dbApproved);
console.log("DB Active Trips (PP/IT/DLV/EXC):", dbActive);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies([
  { name: "session", value: cookie, domain: "localhost", path: "/", httpOnly: true },
]);
const page = await ctx.newPage();
await page.goto("http://localhost:3000/carrier/trips", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);

// Read every visible numeric token in the tab bar area, plus the full body innerText
// for context
const dom = await page.evaluate(() => {
  const out = { tabButtons: [], bodyTextSnippet: "", visibleNumbers: [] };
  // Find every <button> in the page that contains "Ready to Start" or "Active Trips"
  const buttons = Array.from(document.querySelectorAll("button"));
  for (const b of buttons) {
    const t = (b.textContent || "").trim().replace(/\s+/g, " ");
    if (t.includes("Ready to Start") || t.includes("Active Trips")) {
      out.tabButtons.push(t);
    }
  }
  // Also grab the part of innerText surrounding "Trips"
  const lines = document.body.innerText.split("\n").map(s => s.trim()).filter(Boolean);
  out.bodyTextSnippet = lines.slice(0, 30).join(" | ");
  return out;
});
console.log("\nWeb tab buttons (with badge text if rendered):");
for (const t of dom.tabButtons) console.log("  " + t);
console.log("\nFirst 30 visible lines of page text:");
console.log(dom.bodyTextSnippet);

await browser.close();
await prisma.$disconnect();
await pool.end();
