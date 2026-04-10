// Step 1a — read /shipper/loads?status=completed for shipper@test.com
// READ-ONLY. No app code touched. Reads visible DOM.
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
  }
  return { raw: null, parsed: null };
}`;

async function readLabel(page, label) {
  const fn = eval(READER);
  return await page.evaluate(fn, label);
}

const cookie = await login("shipper@test.com");
if (!cookie) throw new Error("login failed");

const user = await prisma.user.findUnique({
  where: { email: "shipper@test.com" },
  select: { organizationId: true },
});

// "active" tab in app/shipper/loads/page.tsx STATUS_MAP =
//   "ASSIGNED,PICKUP_PENDING,IN_TRANSIT"
const dbCount = await prisma.load.count({
  where: {
    shipperId: user.organizationId,
    status: "COMPLETED",
  },
});

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies([
  {
    name: "session",
    value: cookie,
    domain: "localhost",
    path: "/",
    httpOnly: true,
  },
]);
const page = await ctx.newPage();
await page.goto("http://localhost:3000/shipper/loads?status=completed", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(4000);
const found = await readLabel(page, "Total:");
const visiblePageText = await page.evaluate(() => {
  // Capture the area around 'Total:' so the report can show what's there
  var t = document.body.innerText.split("\n");
  var idx = t.findIndex(x => x.trim() === "Total:");
  if (idx === -1) return "(label 'Total:' not found in page text)";
  return t.slice(Math.max(0, idx - 1), idx + 4).join(" | ");
});
console.log(JSON.stringify({
  url: "/shipper/loads?status=completed",
  dbCount,
  webRaw: found.raw,
  webParsed: found.parsed,
  domSnippet: visiblePageText,
}, null, 2));
await browser.close();
await prisma.$disconnect();
await pool.end();
