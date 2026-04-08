/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * TEST 1 — API CONSISTENCY AUDIT
 *
 * For every user (shipper@test.com, wf-shipper@test.com, carrier@test.com,
 * wf-carrier@test.com, dispatcher@test.com, admin@test.com, superadmin@test.com)
 * mints a real auth token via /api/auth/login, calls every relevant API
 * endpoint, and compares each numeric value to a direct Prisma query of the
 * database. Outputs a per-row table:
 *
 *   Role   User   Metric   DB Value   API Value   Result
 *
 * Strict equality. Any drift = ❌.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { db: prisma } = require("../lib/db");
const { reconcileWallet } = require("../lib/walletReconcile");

const BASE_URL = "http://localhost:3000";

// ─── Result rows ─────────────────────────────────────────────────────────────

interface Row {
  role: string;
  user: string;
  metric: string;
  db: number | string | null;
  api: number | string | null;
  note?: string;
}

const rows: Row[] = [];
function rec(r: Row) {
  rows.push(r);
}
function ok(r: Row): boolean {
  if (r.api === "skip" || r.db === "skip") return true;
  // "n/a" means: this metric is intentionally not exposed via the API
  // (or the resource doesn't exist for this org). Treat as skip.
  if (r.api === "n/a" || r.db === "n/a") return true;
  return String(r.db) === String(r.api);
}

// ─── Auth + HTTP ─────────────────────────────────────────────────────────────

async function login(
  email: string,
  password = "Test123!"
): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-type": "mobile",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    console.error(`login ${email} → ${res.status}`);
    return null;
  }
  const body = (await res.json()) as { sessionToken?: string };
  return body.sessionToken ?? null;
}

async function apiGet(p: string, token: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${p}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-client-type": "mobile",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// ─── Status enum lists (real schema values only) ─────────────────────────────

const LOAD_STATUSES = [
  "DRAFT",
  "POSTED",
  "SEARCHING",
  "OFFERED",
  "ASSIGNED",
  "PICKUP_PENDING",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "EXCEPTION",
  "CANCELLED",
  "EXPIRED",
];
const TRIP_STATUSES = [
  "ASSIGNED",
  "PICKUP_PENDING",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "EXCEPTION",
  "CANCELLED",
];
const TRUCK_APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"];
const POSTING_STATUSES = ["ACTIVE", "EXPIRED", "CANCELLED", "MATCHED"];

// ─── Per-Shipper audit ──────────────────────────────────────────────────────

async function auditShipper(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    rec({
      role: "Shipper",
      user: email,
      metric: "FATAL",
      db: null,
      api: null,
      note: "no org",
    });
    return;
  }
  const orgId = user.organizationId;
  const token = await login(email);
  if (!token) {
    rec({
      role: "Shipper",
      user: email,
      metric: "FATAL",
      db: null,
      api: null,
      note: "login failed",
    });
    return;
  }

  // Wallet balance
  const wallet = await prisma.financialAccount.findFirst({
    where: { organizationId: orgId, accountType: "SHIPPER_WALLET" },
  });
  const dbBalance = wallet
    ? (await reconcileWallet(wallet.id)).computedBalance
    : 0;

  let apiBalance: number | string | null = "n/a";
  if (wallet) {
    const balResp = await apiGet("/api/wallet/balance", token);
    apiBalance = balResp?.totalBalance ?? null;
  }
  rec({
    role: "Shipper",
    user: email,
    metric: "wallet_balance",
    db: dbBalance,
    api: apiBalance,
  });

  // Wallet transaction count
  if (wallet) {
    const dbTxCount = await prisma.journalEntry.count({
      where: { lines: { some: { accountId: wallet.id } } },
    });
    const txResp = await apiGet("/api/wallet/transactions?limit=1", token);
    rec({
      role: "Shipper",
      user: email,
      metric: "wallet_transaction_count",
      db: dbTxCount,
      api: txResp?.pagination?.totalCount ?? null,
    });

    // Sum of all transaction amounts (just sanity)
    const allLines = await prisma.journalLine.findMany({
      where: { accountId: wallet.id },
      select: { amount: true, isDebit: true },
    });
    const dbSum = allLines.reduce((s: number, l: any) => {
      const a = Number(l.amount);
      return s + (l.isDebit ? -a : a);
    }, 0);
    // API: get all transactions, sum signed amounts
    const allTx = await apiGet(`/api/wallet/transactions?limit=500`, token);
    let apiSum: number | string | null = null;
    if (allTx?.transactions) {
      apiSum = allTx.transactions.reduce(
        (s: number, t: any) => s + Number(t.amount ?? 0),
        0
      );
    }
    rec({
      role: "Shipper",
      user: email,
      metric: "wallet_transaction_sum",
      db: dbSum,
      api: apiSum,
    });
  } else {
    rec({
      role: "Shipper",
      user: email,
      metric: "wallet_transaction_count",
      db: 0,
      api: "n/a",
      note: "no wallet",
    });
    rec({
      role: "Shipper",
      user: email,
      metric: "wallet_transaction_sum",
      db: 0,
      api: "n/a",
      note: "no wallet",
    });
  }

  // Loads total
  const dbLoadsTotal = await prisma.load.count({ where: { shipperId: orgId } });
  const dashResp = (await apiGet("/api/shipper/dashboard", token)) ?? {};
  rec({
    role: "Shipper",
    user: email,
    metric: "loads_total",
    db: dbLoadsTotal,
    api: dashResp.stats?.totalLoads ?? null,
  });

  // Loads by every status — use /api/loads?myLoads=true&status=X
  for (const status of LOAD_STATUSES) {
    const dbCount = await prisma.load.count({
      where: { shipperId: orgId, status },
    });
    const list = await apiGet(
      `/api/loads?myLoads=true&status=${status}&limit=1`,
      token
    );
    rec({
      role: "Shipper",
      user: email,
      metric: `loads_${status}`,
      db: dbCount,
      api: list?.pagination?.total ?? null,
    });
  }

  // Trips total + per-status (shipperId on trip)
  const dbTripsTotal = await prisma.trip.count({ where: { shipperId: orgId } });
  const tripsResp = await apiGet(`/api/trips?limit=1`, token);
  rec({
    role: "Shipper",
    user: email,
    metric: "trips_total",
    db: dbTripsTotal,
    api: tripsResp?.pagination?.total ?? null,
  });

  for (const status of TRIP_STATUSES) {
    const dbCount = await prisma.trip.count({
      where: { shipperId: orgId, status },
    });
    const list = await apiGet(`/api/trips?status=${status}&limit=1`, token);
    rec({
      role: "Shipper",
      user: email,
      metric: `trips_${status}`,
      db: dbCount,
      api: list?.pagination?.total ?? null,
    });
  }
}

// ─── Per-Carrier audit ──────────────────────────────────────────────────────

async function auditCarrier(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    rec({
      role: "Carrier",
      user: email,
      metric: "FATAL",
      db: null,
      api: null,
      note: "no org",
    });
    return;
  }
  const orgId = user.organizationId;
  const token = await login(email);
  if (!token) {
    rec({
      role: "Carrier",
      user: email,
      metric: "FATAL",
      db: null,
      api: null,
      note: "login failed",
    });
    return;
  }

  // Wallet
  const wallet = await prisma.financialAccount.findFirst({
    where: { organizationId: orgId, accountType: "CARRIER_WALLET" },
  });
  const dbBalance = wallet
    ? (await reconcileWallet(wallet.id)).computedBalance
    : 0;
  let apiBalance: number | string | null = "n/a";
  if (wallet) {
    const balResp = await apiGet("/api/wallet/balance", token);
    apiBalance = balResp?.totalBalance ?? null;
  }
  rec({
    role: "Carrier",
    user: email,
    metric: "wallet_balance",
    db: dbBalance,
    api: apiBalance,
  });

  if (wallet) {
    const dbTxCount = await prisma.journalEntry.count({
      where: { lines: { some: { accountId: wallet.id } } },
    });
    const txResp = await apiGet("/api/wallet/transactions?limit=1", token);
    rec({
      role: "Carrier",
      user: email,
      metric: "wallet_transaction_count",
      db: dbTxCount,
      api: txResp?.pagination?.totalCount ?? null,
    });
    const allLines = await prisma.journalLine.findMany({
      where: { accountId: wallet.id },
      select: { amount: true, isDebit: true },
    });
    const dbSum = allLines.reduce((s: number, l: any) => {
      const a = Number(l.amount);
      return s + (l.isDebit ? -a : a);
    }, 0);
    const allTx = await apiGet(`/api/wallet/transactions?limit=500`, token);
    const apiSum = allTx?.transactions
      ? allTx.transactions.reduce(
          (s: number, t: any) => s + Number(t.amount ?? 0),
          0
        )
      : null;
    rec({
      role: "Carrier",
      user: email,
      metric: "wallet_transaction_sum",
      db: dbSum,
      api: apiSum,
    });
  }

  // Trucks total + per-status
  const dbTrucksTotal = await prisma.truck.count({
    where: { carrierId: orgId },
  });
  const dashResp = (await apiGet("/api/carrier/dashboard", token)) ?? {};
  rec({
    role: "Carrier",
    user: email,
    metric: "trucks_total",
    db: dbTrucksTotal,
    api: dashResp.totalTrucks ?? null,
  });
  for (const status of TRUCK_APPROVAL_STATUSES) {
    const dbCount = await prisma.truck.count({
      where: { carrierId: orgId, approvalStatus: status },
    });
    const list = await apiGet(
      `/api/trucks?myTrucks=true&approvalStatus=${status}&limit=1`,
      token
    );
    rec({
      role: "Carrier",
      user: email,
      metric: `trucks_${status}`,
      db: dbCount,
      api: list?.pagination?.total ?? null,
    });
  }

  // Truck postings — only ACTIVE postings count is exposed via the carrier
  // dashboard endpoint. The /api/truck-postings list is the public marketplace
  // view which excludes busy trucks (route.ts:679 — trips:none filter), so it
  // is NOT the right endpoint for "all of my postings". Per-status posting
  // breakdown for owned postings is not exposed by any endpoint and is left
  // as DB-only here (skipped from comparison).
  const dbActivePostings = await prisma.truckPosting.count({
    where: { truck: { carrierId: orgId }, status: "ACTIVE" },
  });
  rec({
    role: "Carrier",
    user: email,
    metric: "postings_ACTIVE",
    db: dbActivePostings,
    api: dashResp.activePostings ?? null,
  });
  for (const status of ["EXPIRED", "CANCELLED", "MATCHED"]) {
    const dbCount = await prisma.truckPosting.count({
      where: { truck: { carrierId: orgId }, status },
    });
    rec({
      role: "Carrier",
      user: email,
      metric: `postings_${status}`,
      db: dbCount,
      api: "n/a",
      note: "no API endpoint exposes per-status owned postings — only ACTIVE via /api/carrier/dashboard",
    });
  }

  // Trips total + per-status
  const dbTripsTotal = await prisma.trip.count({ where: { carrierId: orgId } });
  const tripsResp = await apiGet(`/api/trips?limit=1`, token);
  rec({
    role: "Carrier",
    user: email,
    metric: "trips_total",
    db: dbTripsTotal,
    api: tripsResp?.pagination?.total ?? null,
  });
  for (const status of TRIP_STATUSES) {
    const dbCount = await prisma.trip.count({
      where: { carrierId: orgId, status },
    });
    const list = await apiGet(`/api/trips?status=${status}&limit=1`, token);
    rec({
      role: "Carrier",
      user: email,
      metric: `trips_${status}`,
      db: dbCount,
      api: list?.pagination?.total ?? null,
    });
  }
}

// ─── Dispatcher audit ───────────────────────────────────────────────────────

async function auditDispatcher() {
  const email = "dispatcher@test.com";
  const token = await login(email, "password");
  if (!token) {
    rec({
      role: "Dispatcher",
      user: email,
      metric: "FATAL",
      db: null,
      api: null,
      note: "login failed",
    });
    return;
  }
  const dash = (await apiGet("/api/dispatcher/dashboard", token)) ?? {};
  const stats = dash.stats ?? {};

  const dbPosted = await prisma.load.count({ where: { status: "POSTED" } });
  const dbAvailable = await prisma.truckPosting.count({
    where: { status: "ACTIVE" },
  });
  const dbAssigned = await prisma.load.count({ where: { status: "ASSIGNED" } });
  const dbInTransitL = await prisma.load.count({
    where: { status: "IN_TRANSIT" },
  });
  const dbExceptionT = await prisma.trip.count({
    where: { status: "EXCEPTION" },
  });
  const dbActiveTrips = await prisma.trip.count({
    where: { status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] } },
  });

  rec({
    role: "Dispatcher",
    user: email,
    metric: "posted_loads",
    db: dbPosted,
    api: stats.postedLoads ?? null,
  });
  rec({
    role: "Dispatcher",
    user: email,
    metric: "available_trucks",
    db: dbAvailable,
    api: stats.availableTrucks ?? null,
  });
  rec({
    role: "Dispatcher",
    user: email,
    metric: "assigned_loads",
    db: dbAssigned,
    api: stats.assignedLoads ?? null,
  });
  rec({
    role: "Dispatcher",
    user: email,
    metric: "in_transit_loads",
    db: dbInTransitL,
    api: stats.inTransitLoads ?? null,
  });
  rec({
    role: "Dispatcher",
    user: email,
    metric: "exception_trips",
    db: dbExceptionT,
    api: stats.exceptionTrips ?? null,
  });
  // active_trips_db is informational only (no equivalent API field) — skip from comparison
  rec({
    role: "Dispatcher",
    user: email,
    metric: "active_trips_db_only",
    db: dbActiveTrips,
    api: "n/a",
    note: "DB-only: sum of ASSIGNED+PICKUP_PENDING+IN_TRANSIT trips, no API field exists",
  });
}

// ─── Admin / Super Admin audit ──────────────────────────────────────────────

async function auditAdmin(email: string, role: string) {
  const token = await login(email);
  if (!token) {
    rec({
      role,
      user: email,
      metric: "FATAL",
      db: null,
      api: null,
      note: "login failed",
    });
    return;
  }
  const an = (await apiGet("/api/admin/analytics?period=year", token)) ?? {};
  const summary = an.summary ?? {};

  // Total counts
  rec({
    role,
    user: email,
    metric: "total_users",
    db: await prisma.user.count(),
    api: summary.users?.total ?? null,
  });
  rec({
    role,
    user: email,
    metric: "total_organizations",
    db: await prisma.organization.count(),
    api: summary.organizations?.total ?? null,
  });
  rec({
    role,
    user: email,
    metric: "total_loads",
    db: await prisma.load.count(),
    api: summary.loads?.total ?? null,
  });
  rec({
    role,
    user: email,
    metric: "total_trucks",
    db: await prisma.truck.count(),
    api: summary.trucks?.total ?? null,
  });
  rec({
    role,
    user: email,
    metric: "total_trips",
    db: await prisma.trip.count(),
    api: summary.trips?.total ?? null,
  });

  // Per-status loads (admin analytics has a byStatus map with camelCase keys)
  const loadsByStatus = summary.loads?.byStatus ?? {};
  for (const status of LOAD_STATUSES) {
    // camelCase: POSTED → posted, PICKUP_PENDING → pickupPending
    const camel = status
      .toLowerCase()
      .replace(/_(.)/g, (_: any, c: string) => c.toUpperCase());
    rec({
      role,
      user: email,
      metric: `loads_${status}`,
      db: await prisma.load.count({ where: { status } }),
      api: loadsByStatus[camel] ?? null,
    });
  }

  // Per-status trips (admin analytics uses UPPERCASE keys)
  const tripsByStatus = summary.trips?.byStatus ?? {};
  for (const status of TRIP_STATUSES) {
    rec({
      role,
      user: email,
      metric: `trips_${status}`,
      db: await prisma.trip.count({ where: { status } }),
      api: tripsByStatus[status] ?? null,
    });
  }

  // Per-status trucks
  const truckSum = summary.trucks ?? {};
  rec({
    role,
    user: email,
    metric: "trucks_PENDING",
    db: await prisma.truck.count({ where: { approvalStatus: "PENDING" } }),
    api: truckSum.pending ?? null,
  });
  rec({
    role,
    user: email,
    metric: "trucks_APPROVED",
    db: await prisma.truck.count({ where: { approvalStatus: "APPROVED" } }),
    api: truckSum.approved ?? null,
  });
  rec({
    role,
    user: email,
    metric: "trucks_REJECTED",
    db: await prisma.truck.count({ where: { approvalStatus: "REJECTED" } }),
    api: truckSum.rejected ?? null,
  });

  // Platform revenue: sum of SERVICE_FEE_DEDUCT credits to platform wallet
  const platformWallet = await prisma.financialAccount.findFirst({
    where: { accountType: "PLATFORM_REVENUE" },
  });
  const dbPlatformBalance = platformWallet
    ? (await reconcileWallet(platformWallet.id)).computedBalance
    : 0;
  rec({
    role,
    user: email,
    metric: "platform_balance",
    db: dbPlatformBalance,
    api: summary.revenue?.platformBalance ?? null,
  });

  // Total wallet deposits — sum of DEPOSIT credit amounts across all wallets
  const allDeposits = await prisma.journalLine.findMany({
    where: {
      isDebit: false,
      journalEntry: { transactionType: "DEPOSIT" },
    },
    select: { amount: true },
  });
  const dbDeposits = allDeposits.reduce(
    (s: number, l: any) => s + Number(l.amount),
    0
  );
  rec({
    role,
    user: email,
    metric: "total_wallet_deposits",
    db: dbDeposits,
    api: "n/a",
    note: "no admin API field for total deposits sum (only platform balance + tx count)",
  });

  // Total wallet balances across all orgs
  const allWallets = await prisma.financialAccount.findMany({
    where: { accountType: { in: ["SHIPPER_WALLET", "CARRIER_WALLET"] } },
    select: { id: true },
  });
  let dbAllBalances = 0;
  for (const w of allWallets) {
    const r = await reconcileWallet(w.id);
    dbAllBalances += r.computedBalance;
  }
  rec({
    role,
    user: email,
    metric: "total_wallet_balances",
    db: dbAllBalances,
    api: "n/a",
    note: "no admin API field for sum of org wallet balances",
  });

  // Pending withdrawals — call /api/admin/withdrawals?status=PENDING
  const wResp = await apiGet(
    "/api/admin/withdrawals?status=PENDING&limit=1",
    token
  );
  rec({
    role,
    user: email,
    metric: "pending_withdrawals_count",
    db: await prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    api: wResp?.pagination?.total ?? null,
  });

  // Open disputes
  rec({
    role,
    user: email,
    metric: "open_disputes",
    db: await prisma.dispute.count({ where: { status: "OPEN" } }),
    api: summary.disputes?.open ?? null,
  });
}

// ─── Format table ────────────────────────────────────────────────────────────

function fmt(v: any): string {
  if (v == null) return "null";
  return String(v);
}

function printTable() {
  const cols = ["Role", "User", "Metric", "DB", "API", "Result"];
  const widths = cols.map((c) => c.length);
  const data = rows.map((r) => [
    r.role,
    r.user,
    r.metric,
    fmt(r.db),
    fmt(r.api),
    ok(r) ? "✅" : "❌",
  ]);
  for (const row of data) {
    row.forEach((c, i) => {
      if (c.length > widths[i]) widths[i] = c.length;
    });
  }
  const fr = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i])).join("  ");

  console.log("\n=== TEST 1 — API CONSISTENCY TABLE ===\n");
  console.log(fr(cols));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of data) console.log(fr(row));

  const fails = rows.filter((r) => !ok(r));
  console.log(
    `\nTotal: ${rows.length} checks, ${rows.length - fails.length} passed, ${fails.length} failed`
  );
  if (fails.length > 0) {
    console.log("\nFailures:");
    for (const r of fails) {
      console.log(
        `  ❌ ${r.role} ${r.user} ${r.metric}: db=${fmt(r.db)} api=${fmt(r.api)}${r.note ? " (" + r.note + ")" : ""}`
      );
    }
    process.exit(1);
  }
}

async function main() {
  console.log("TEST 1 — API consistency, base URL:", BASE_URL);

  await auditShipper("shipper@test.com");
  await auditShipper("wf-shipper@test.com");
  await auditShipper("delete-test@test.com");

  await auditCarrier("carrier@test.com");
  await auditCarrier("wf-carrier@test.com");

  await auditDispatcher();

  await auditAdmin("admin@test.com", "Admin");
  await auditAdmin("superadmin@test.com", "Super Admin");

  printTable();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
