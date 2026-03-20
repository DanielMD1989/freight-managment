/**
 * G-M31-C1 Data Migration: Fix DEPOSIT JournalLine isDebit flag
 *
 * Problem: Admin topup route wrote isDebit=true for deposits, but the
 * codebase convention is isDebit=true = money OUT, isDebit=false = money IN.
 * This caused deposits to render as withdrawals on web wallet pages and
 * broke aggregate queries (total deposited, total withdrawn).
 *
 * Fix: Set isDebit=false on all DEPOSIT JournalLines linked to wallet accounts.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage: set -a && source .env && set +a && npx tsx scripts/fix-deposit-isdebit.ts
 */

import { db } from "../lib/db";

async function main() {
  try {
    // Step 1: Count affected rows
    const affected = await db.journalLine.count({
      where: {
        isDebit: true,
        journalEntry: { transactionType: "DEPOSIT" },
        account: {
          accountType: { in: ["SHIPPER_WALLET", "CARRIER_WALLET"] },
        },
      },
    });

    console.log(
      `[fix-deposit-isdebit] Found ${affected} DEPOSIT JournalLines with isDebit=true on wallet accounts`
    );

    if (affected === 0) {
      console.log("[fix-deposit-isdebit] Nothing to fix — already correct.");
      return;
    }

    // Step 2: Update in a transaction using raw SQL
    // Double-quoted column names required — PostgreSQL camelCase identifiers.
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.$executeRaw`
        UPDATE journal_lines
        SET "isDebit" = false
        WHERE "journalEntryId" IN (
          SELECT id FROM journal_entries
          WHERE "transactionType" = 'DEPOSIT'
        )
        AND "accountId" IN (
          SELECT id FROM financial_accounts
          WHERE "accountType" IN ('SHIPPER_WALLET', 'CARRIER_WALLET')
        )
        AND "isDebit" = true
      `;
      return result;
    });

    console.log(`[fix-deposit-isdebit] Updated ${updated} rows`);

    // Step 3: Verify — count should now be 0
    const remaining = await db.journalLine.count({
      where: {
        isDebit: true,
        journalEntry: { transactionType: "DEPOSIT" },
        account: {
          accountType: { in: ["SHIPPER_WALLET", "CARRIER_WALLET"] },
        },
      },
    });

    if (remaining === 0) {
      console.log(
        "[fix-deposit-isdebit] ✓ Verification passed — 0 incorrect rows remaining"
      );
    } else {
      console.error(
        `[fix-deposit-isdebit] ✗ Verification FAILED — ${remaining} rows still incorrect`
      );
      process.exit(1);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("[fix-deposit-isdebit] Fatal error:", err);
  process.exit(1);
});
