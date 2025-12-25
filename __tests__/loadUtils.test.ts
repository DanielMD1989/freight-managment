/**
 * Test Suite for Load Utility Functions
 * Tests age calculation, RPM/tRPM computation, and privacy masking
 */

import {
  calculateAge,
  formatAge,
  calculateRPM,
  calculateTRPM,
  maskCompany,
  canSeeContact,
} from "../lib/loadUtils";

// Test utilities
const testResults: { name: string; passed: boolean; error?: string }[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    testResults.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    testResults.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ||
        `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertNull(actual: any, message?: string) {
  if (actual !== null) {
    throw new Error(message || `Expected null, got ${JSON.stringify(actual)}`);
  }
}

function assertNotNull(actual: any, message?: string) {
  if (actual === null) {
    throw new Error(message || `Expected non-null value, got null`);
  }
}

console.log("🧪 Running Load Utility Tests\n");
console.log("=" + "=".repeat(60) + "\n");

// ==========================================
// Age Calculation Tests
// ==========================================
console.log("📅 Age Calculation Tests\n");

test("calculateAge uses postedAt when available", () => {
  const now = new Date();
  const postedAt = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
  const createdAt = new Date(now.getTime() - 120 * 60 * 1000); // 2 hours ago

  const age = calculateAge(postedAt, createdAt);
  assertEqual(age >= 29 && age <= 31, true, "Age should be ~30 minutes");
});

test("calculateAge falls back to createdAt when postedAt is null", () => {
  const now = new Date();
  const createdAt = new Date(now.getTime() - 120 * 60 * 1000); // 2 hours ago

  const age = calculateAge(null, createdAt);
  assertEqual(age >= 119 && age <= 121, true, "Age should be ~120 minutes");
});

test("formatAge shows minutes for < 60 minutes", () => {
  assertEqual(formatAge(5), "5m");
  assertEqual(formatAge(45), "45m");
  assertEqual(formatAge(59), "59m");
});

test("formatAge shows hours and minutes for < 24 hours", () => {
  assertEqual(formatAge(60), "1h");
  assertEqual(formatAge(90), "1h 30m");
  assertEqual(formatAge(150), "2h 30m");
  assertEqual(formatAge(1439), "23h 59m");
});

test("formatAge shows days for >= 24 hours", () => {
  assertEqual(formatAge(1440), "1d");
  assertEqual(formatAge(2880), "2d");
  assertEqual(formatAge(10080), "7d");
});

// ==========================================
// RPM Calculation Tests
// ==========================================
console.log("\n💰 RPM Calculation Tests\n");

test("calculateRPM computes correct rate per km", () => {
  const rpm = calculateRPM(25000, 515);
  assertEqual(rpm, 48.54, "RPM should be 25000 / 515 = 48.54");
});

test("calculateRPM returns null for null tripKm", () => {
  const rpm = calculateRPM(25000, null);
  assertNull(rpm, "RPM should be null when tripKm is null");
});

test("calculateRPM returns null for zero tripKm", () => {
  const rpm = calculateRPM(25000, 0);
  assertNull(rpm, "RPM should be null when tripKm is 0");
});

test("calculateRPM returns null for negative tripKm", () => {
  const rpm = calculateRPM(25000, -100);
  assertNull(rpm, "RPM should be null when tripKm is negative");
});

test("calculateRPM handles Decimal-like objects", () => {
  const decimalLike = { toString: () => "515" };
  const rpm = calculateRPM(25000, decimalLike);
  assertEqual(rpm, 48.54, "RPM should handle Decimal-like objects");
});

// ==========================================
// tRPM Calculation Tests
// ==========================================
console.log("\n📊 tRPM Calculation Tests\n");

test("calculateTRPM computes correct total rate per km with all deadhead", () => {
  const trpm = calculateTRPM(25000, 515, 25, 30);
  // Total km = 515 + 25 + 30 = 570
  // tRPM = 25000 / 570 = 43.86
  assertEqual(trpm, 43.86, "tRPM should be 25000 / 570 = 43.86");
});

test("calculateTRPM computes correct total rate per km with no deadhead", () => {
  const trpm = calculateTRPM(25000, 515, null, null);
  // Total km = 515 + 0 + 0 = 515
  // tRPM = 25000 / 515 = 48.54 (same as RPM)
  assertEqual(trpm, 48.54, "tRPM should equal RPM when no deadhead");
});

test("calculateTRPM returns null when total km is zero", () => {
  const trpm = calculateTRPM(25000, 0, 0, 0);
  assertNull(trpm, "tRPM should be null when total km is 0");
});

test("calculateTRPM returns null when all distances are null", () => {
  const trpm = calculateTRPM(25000, null, null, null);
  assertNull(trpm, "tRPM should be null when all distances are null");
});

test("calculateTRPM handles partial deadhead data", () => {
  const trpm = calculateTRPM(25000, 515, 25, null);
  // Total km = 515 + 25 + 0 = 540
  // tRPM = 25000 / 540 = 46.30
  assertEqual(trpm, 46.3, "tRPM should handle partial deadhead data");
});

// ==========================================
// Privacy Masking Tests
// ==========================================
console.log("\n🔒 Privacy Masking Tests\n");

test("maskCompany returns 'Anonymous Shipper' when isAnonymous is true", () => {
  const masked = maskCompany(true, "ABC Logistics");
  assertEqual(masked, "Anonymous Shipper");
});

test("maskCompany returns company name when isAnonymous is false", () => {
  const masked = maskCompany(false, "ABC Logistics");
  assertEqual(masked, "ABC Logistics");
});

test("maskCompany returns 'Unknown Company' when company is null and not anonymous", () => {
  const masked = maskCompany(false, null);
  assertEqual(masked, "Unknown Company");
});

// ==========================================
// Contact Visibility Tests
// ==========================================
console.log("\n👤 Contact Visibility Tests\n");

test("canSeeContact returns true for ADMIN role", () => {
  const canSee = canSeeContact(null, "org1", null, "ADMIN");
  assertEqual(canSee, true, "Admin should always see contact");
});

test("canSeeContact returns true for PLATFORM_OPS role", () => {
  const canSee = canSeeContact(null, "org1", null, "PLATFORM_OPS");
  assertEqual(canSee, true, "Platform Ops should always see contact");
});

test("canSeeContact returns true when load assigned to user's organization", () => {
  const canSee = canSeeContact("truck1", "org1", "org1", "CARRIER");
  assertEqual(
    canSee,
    true,
    "Carrier should see contact when load is assigned to their truck"
  );
});

test("canSeeContact returns false when load assigned to different organization", () => {
  const canSee = canSeeContact("truck1", "org1", "org2", "CARRIER");
  assertEqual(
    canSee,
    false,
    "Carrier should not see contact when load is assigned to different carrier"
  );
});

test("canSeeContact returns false when load is not assigned", () => {
  const canSee = canSeeContact(null, "org1", null, "CARRIER");
  assertEqual(
    canSee,
    false,
    "Carrier should not see contact when load is not assigned"
  );
});

test("canSeeContact returns false for SHIPPER viewing unassigned load", () => {
  const canSee = canSeeContact(null, "org1", null, "SHIPPER");
  assertEqual(
    canSee,
    false,
    "Shipper should not see contact of unassigned loads from other shippers"
  );
});

// ==========================================
// Test Summary
// ==========================================
console.log("\n" + "=".repeat(60));
console.log("\n📊 Test Summary\n");

const totalTests = testResults.length;
const passedTests = testResults.filter((t) => t.passed).length;
const failedTests = testResults.filter((t) => !t.passed).length;

console.log(`Total Tests: ${totalTests}`);
console.log(`✓ Passed: ${passedTests}`);
console.log(`✗ Failed: ${failedTests}`);

if (failedTests > 0) {
  console.log("\n❌ Failed Tests:\n");
  testResults
    .filter((t) => !t.passed)
    .forEach((t) => {
      console.log(`  - ${t.name}`);
      console.log(`    ${t.error}`);
    });
  process.exit(1);
} else {
  console.log("\n✅ All tests passed!\n");
  process.exit(0);
}
