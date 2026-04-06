/**
 * Wallet Reconciliation Script — read-only audit
 *
 * For every wallet in the database, computes whether the stored balance
 * matches the journal entries, and prints a drift report.
 *
 * Usage:
 *   npx tsx scripts/reconcile-wallets.ts
 *
 * Exit codes:
 *   0 — all wallets in sync
 *   1 — at least one wallet has drift > 0.01 ETB
 *
 * This script is read-only — it does NOT modify any data. To fix drift,
 * use the seed scripts (which now atomically reset balance + journal) or
 * investigate the root cause of the drift before adjusting manually.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://danieldamitew@localhost:5432/freight_db?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

interface WalletReconciliation {
  walletId: string;
  organizationId: string | null;
  accountType: string;
  storedBalance: number;
  computedBalance: number;
  drift: number;
  isInSync: boolean;
  byType: Record<string, { credits: number; debits: number }>;
  lineCount: number;
}

async function reconcileWallet(
  walletId: string
): Promise<WalletReconciliation> {
  const wallet = await db.financialAccount.findUnique({
    where: { id: walletId },
    select: {
      id: true,
      organizationId: true,
      accountType: true,
      balance: true,
    },
  });
  if (!wallet) throw new Error(`Wallet not found: ${walletId}`);

  const lines = await db.journalLine.findMany({
    where: { accountId: walletId },
    select: {
      amount: true,
      isDebit: true,
      journalEntry: { select: { transactionType: true } },
    },
  });

  let totalCredits = 0;
  let totalDebits = 0;
  const byType: Record<string, { credits: number; debits: number }> = {};

  for (const line of lines) {
    const amount = Number(line.amount);
    const type = line.journalEntry.transactionType;
    if (!byType[type]) byType[type] = { credits: 0, debits: 0 };
    if (line.isDebit) {
      totalDebits += amount;
      byType[type].debits += amount;
    } else {
      totalCredits += amount;
      byType[type].credits += amount;
    }
  }

  const computedBalance = totalCredits - totalDebits;
  const storedBalance = Number(wallet.balance);
  const drift = storedBalance - computedBalance;

  return {
    walletId: wallet.id,
    organizationId: wallet.organizationId,
    accountType: wallet.accountType,
    storedBalance,
    computedBalance,
    drift,
    isInSync: Math.abs(drift) <= 0.01,
    byType,
    lineCount: lines.length,
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-ET", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function main() {
  console.log("========================================");
  console.log("    WALLET LEDGER RECONCILIATION");
  console.log("========================================\n");

  const wallets = await db.financialAccount.findMany({
    where: {
      accountType: {
        in: ["SHIPPER_WALLET", "CARRIER_WALLET", "PLATFORM_REVENUE"],
      },
    },
    select: {
      id: true,
      accountType: true,
      organization: { select: { name: true } },
    },
    orderBy: [{ accountType: "asc" }, { createdAt: "asc" }],
  });

  console.log(`Auditing ${wallets.length} wallets...\n`);

  let inSyncCount = 0;
  let driftCount = 0;
  const driftReports: WalletReconciliation[] = [];

  for (const w of wallets) {
    const report = await reconcileWallet(w.id);
    const orgName = w.organization?.name || "(platform)";
    const label = `${report.accountType.padEnd(16)} | ${orgName.slice(0, 30).padEnd(30)} | ${w.id.slice(0, 25)}`;

    if (report.isInSync) {
      inSyncCount++;
      console.log(
        `  ✓ ${label} | balance=${fmt(report.storedBalance).padStart(15)} | lines=${report.lineCount}`
      );
    } else {
      driftCount++;
      driftReports.push(report);
      console.log(
        `  ✗ ${label} | stored=${fmt(report.storedBalance).padStart(15)} | computed=${fmt(report.computedBalance).padStart(15)} | DRIFT=${fmt(report.drift).padStart(15)}`
      );
    }
  }

  console.log("\n========================================");
  console.log(`Summary: ${inSyncCount} in sync, ${driftCount} with drift`);
  console.log("========================================\n");

  if (driftCount > 0) {
    console.log("DRIFT DETAILS:\n");
    for (const r of driftReports) {
      console.log(`Wallet ${r.walletId} (${r.accountType})`);
      console.log(`  Stored balance:   ${fmt(r.storedBalance)}`);
      console.log(`  Computed balance: ${fmt(r.computedBalance)}`);
      console.log(`  Drift:            ${fmt(r.drift)}`);
      console.log(`  Journal lines:    ${r.lineCount}`);
      if (Object.keys(r.byType).length > 0) {
        console.log("  By transaction type:");
        for (const [type, data] of Object.entries(r.byType)) {
          if (data.credits > 0 || data.debits > 0) {
            console.log(
              `    ${type.padEnd(20)} credits=${fmt(data.credits).padStart(15)}  debits=${fmt(data.debits).padStart(15)}`
            );
          }
        }
      }
      console.log();
    }

    console.log("To fix drift:");
    console.log(
      "  1. For test data: re-run `npx tsx scripts/seed-test-data.ts`"
    );
    console.log(
      "  2. For demo data: re-run `npx tsx scripts/seed-demo-data.ts`"
    );
    console.log(
      "  3. For production: investigate root cause before manual fix"
    );
    console.log();
  }

  await db.$disconnect();
  await pool.end();

  process.exit(driftCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Reconciliation failed:", e);
  pool.end().catch(() => {});
  process.exit(2);
});
