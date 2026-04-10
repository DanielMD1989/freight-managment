// Step 1g — read /shipper/wallet transactions row-by-row for shipper@test.com
// READ-ONLY. Reads every transaction visible on screen.
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

const cookie = await login("shipper@test.com");
const user = await prisma.user.findUnique({
  where: { email: "shipper@test.com" },
  select: { organizationId: true },
});
const wallet = await prisma.financialAccount.findFirst({
  where: { organizationId: user.organizationId, accountType: "SHIPPER_WALLET" },
});
const dbLines = await prisma.journalLine.findMany({
  where: { accountId: wallet.id },
  include: { journalEntry: { select: { transactionType: true, description: true, createdAt: true } } },
  orderBy: { createdAt: "desc" },
});
const dbRows = dbLines.map(l => ({
  id: l.id,
  type: l.journalEntry.transactionType,
  description: l.journalEntry.description,
  amount: Number(l.amount),
  isDebit: l.isDebit,
  createdAt: l.journalEntry.createdAt.toISOString(),
}));
console.log("DB rows:", dbRows.length);
for (const r of dbRows) {
  console.log(`  ${r.isDebit ? "-" : "+"}${r.amount} ETB | ${r.type} | "${r.description}"`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies([
  { name: "session", value: cookie, domain: "localhost", path: "/", httpOnly: true },
]);
const page = await ctx.newPage();
await page.goto("http://localhost:3000/shipper/wallet", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);

// Walk every "Transaction History" row. From the JSX:
// <div className="divide-y..."><div className="px-6 py-4...">{row content}</div>...</div>
// Each row has class containing "px-6 py-4" and has a child with "+50,000 ETB" or "-X ETB"
// Let me grab every text on the page that looks like an amount with sign
const visibleRows = await page.evaluate(() => {
  const out = [];
  // The transaction list section is anchored by id="transactions"
  const section = document.getElementById("transactions");
  if (!section) return { error: "no #transactions section", rows: [] };
  // Find every leaf element with text matching +/- amount ETB
  const all = Array.from(section.querySelectorAll("p, span, div"));
  const amountRe = /^[+-]\s*ETB\s*[\d,]+(\.\d+)?$/;
  for (const el of all) {
    if (el.children.length > 0) continue;
    const t = (el.textContent || "").trim();
    if (amountRe.test(t)) {
      // Find the row container — walk up until we find a div with siblings
      let rowParent = el;
      for (let i = 0; i < 6; i++) {
        if (!rowParent.parentElement) break;
        rowParent = rowParent.parentElement;
        if (rowParent.className && rowParent.className.includes && rowParent.className.includes("px-6 py-4")) break;
      }
      const rowText = (rowParent.textContent || "").trim().replace(/\s+/g, " ");
      out.push({ amount: t, rowText: rowText.slice(0, 200) });
    }
  }
  return { rows: out };
});
console.log("\nWeb visible transaction rows:", visibleRows.rows.length);
for (const r of visibleRows.rows) {
  console.log(`  ${r.amount}  | ${r.rowText}`);
}

// Also read the "X recent transactions" subtitle near the balance card
const subtitleText = await page.evaluate(() => {
  const m = document.body.innerText.match(/(\d+)\s+recent transactions?/i);
  return m ? { count: parseInt(m[1]), raw: m[0] } : null;
});
console.log("\nSubtitle 'recent transactions':", JSON.stringify(subtitleText));

await browser.close();
await prisma.$disconnect();
await pool.end();
