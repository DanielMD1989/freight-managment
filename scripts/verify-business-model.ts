#!/usr/bin/env npx tsx
/**
 * E2E Automated Verification Script
 *
 * Verifies business model compliance:
 * - NO price fields in forms
 * - Service fee displays exist
 * - Contact to negotiate boxes exist
 * - Verified badges exist
 *
 * Run: npx tsx scripts/verify-business-model.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  file?: string;
  line?: number;
}

const results: CheckResult[] = [];
const projectRoot = path.resolve(__dirname, '..');

function readFile(filePath: string): string {
  const fullPath = path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) {
    return '';
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function checkFileExists(filePath: string): boolean {
  return fs.existsSync(path.join(projectRoot, filePath));
}

function addResult(result: CheckResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${result.name}`);
  if (result.details) {
    console.log(`   ${result.details}`);
  }
}

// ============================================
// PART 1: NO PRICE FIELDS (Business Model)
// ============================================

console.log('\n========================================');
console.log('PART 1: NO PRICE FIELDS VERIFICATION');
console.log('========================================\n');

// Check 1.1: Mobile Post Load Screen - NO price inputs
const postLoadScreen = readFile('mobile/lib/features/shipper/screens/post_load_screen.dart');
if (postLoadScreen) {
  const hasPriceField = /TextFormField.*(?:price|rate|fare|cost)/i.test(postLoadScreen);
  const hasBaseFare = /baseFareEtb|baseFare/i.test(postLoadScreen);
  const hasPerKm = /perKmEtb|perKm.*rate/i.test(postLoadScreen);

  addResult({
    name: 'Mobile Post Load: No price input fields',
    status: !hasPriceField ? 'PASS' : 'FAIL',
    details: hasPriceField ? 'Found price-related TextFormField' : 'No price fields found',
    file: 'mobile/lib/features/shipper/screens/post_load_screen.dart'
  });

  addResult({
    name: 'Mobile Post Load: No baseFareEtb field',
    status: !hasBaseFare ? 'PASS' : 'FAIL',
    details: hasBaseFare ? 'Found baseFare references' : 'No baseFare fields',
    file: 'mobile/lib/features/shipper/screens/post_load_screen.dart'
  });
} else {
  addResult({
    name: 'Mobile Post Load Screen',
    status: 'WARN',
    details: 'File not found'
  });
}

// Check 1.2: Mobile Truck Posting - NO expectedRate
const postTruckScreen = readFile('mobile/lib/features/carrier/screens/carrier_post_trucks_screen.dart');
if (postTruckScreen) {
  const hasExpectedRate = /expectedRate|expected_rate/i.test(postTruckScreen);
  const hasPriceInput = /TextFormField.*(?:price|rate)/i.test(postTruckScreen);

  addResult({
    name: 'Mobile Post Truck: No expectedRate field',
    status: !hasExpectedRate && !hasPriceInput ? 'PASS' : 'FAIL',
    details: hasExpectedRate ? 'Found expectedRate references' : 'No price fields',
    file: 'mobile/lib/features/carrier/screens/carrier_post_trucks_screen.dart'
  });
}

// Check 1.3: Web Load Request Modal - NO proposedRate input
const loadRequestModal = readFile('app/carrier/loadboard/LoadRequestModal.tsx');
if (loadRequestModal) {
  const hasProposedRateInput = /<input.*proposedRate|name="proposedRate"/i.test(loadRequestModal);
  const hasCommentNoPricing = /price negotiation happens outside/i.test(loadRequestModal);

  addResult({
    name: 'Web Load Request Modal: No proposedRate input',
    status: !hasProposedRateInput ? 'PASS' : 'FAIL',
    details: hasCommentNoPricing ? 'Has explicit "price negotiation outside" comment' : 'No proposedRate input found',
    file: 'app/carrier/loadboard/LoadRequestModal.tsx'
  });
}

// Check 1.4: Web Truck Booking Modal - NO offeredRate input
const truckBookingModal = readFile('app/shipper/loadboard/TruckBookingModal.tsx');
if (truckBookingModal) {
  const hasOfferedRateInput = /<input.*offeredRate|name="offeredRate"/i.test(truckBookingModal);
  const hasCommentNoPricing = /price negotiation happens outside/i.test(truckBookingModal);

  addResult({
    name: 'Web Truck Booking Modal: No offeredRate input',
    status: !hasOfferedRateInput ? 'PASS' : 'FAIL',
    details: hasCommentNoPricing ? 'Has explicit "price negotiation outside" comment' : 'No offeredRate input found',
    file: 'app/shipper/loadboard/TruckBookingModal.tsx'
  });
}

// ============================================
// PART 2: SERVICE FEE DISPLAYS
// ============================================

console.log('\n========================================');
console.log('PART 2: SERVICE FEE DISPLAYS');
console.log('========================================\n');

// Check 2.1: Mobile Carrier Loadboard - Service fee display
const carrierLoadboard = readFile('mobile/lib/features/carrier/screens/carrier_loadboard_screen.dart');
if (carrierLoadboard) {
  const hasServiceFee = /serviceFee|service.*fee/i.test(carrierLoadboard);

  addResult({
    name: 'Mobile Carrier Loadboard: Service fee display',
    status: hasServiceFee ? 'PASS' : 'FAIL',
    details: hasServiceFee ? 'Service fee display found' : 'No service fee display',
    file: 'mobile/lib/features/carrier/screens/carrier_loadboard_screen.dart'
  });
}

// Check 2.2: Mobile Shipper Truckboard - Service fee info
const shipperTruckboard = readFile('mobile/lib/features/shipper/screens/shipper_truckboard_screen.dart');
if (shipperTruckboard) {
  const hasServiceFeeInfo = /service.*fee|calculated.*booking/i.test(shipperTruckboard);

  addResult({
    name: 'Mobile Shipper Truckboard: Service fee info',
    status: hasServiceFeeInfo ? 'PASS' : 'FAIL',
    details: hasServiceFeeInfo ? 'Service fee info found' : 'No service fee info',
    file: 'mobile/lib/features/shipper/screens/shipper_truckboard_screen.dart'
  });
}

// Check 2.3: Web SearchLoadsTab - Service fee column
const searchLoadsTab = readFile('app/carrier/loadboard/SearchLoadsTab.tsx');
if (searchLoadsTab) {
  const hasServiceFeeColumn = /serviceFee|Service Fee/i.test(searchLoadsTab);

  addResult({
    name: 'Web SearchLoadsTab: Service fee column',
    status: hasServiceFeeColumn ? 'PASS' : 'FAIL',
    details: hasServiceFeeColumn ? 'Service fee column found' : 'No service fee column',
    file: 'app/carrier/loadboard/SearchLoadsTab.tsx'
  });
}

// Check 2.4: Web SearchTrucksTab - Service fee column
const searchTrucksTab = readFile('app/shipper/loadboard/SearchTrucksTab.tsx');
if (searchTrucksTab) {
  const hasServiceFeeColumn = /serviceFee|Service Fee|Calculated on booking/i.test(searchTrucksTab);

  addResult({
    name: 'Web SearchTrucksTab: Service fee column',
    status: hasServiceFeeColumn ? 'PASS' : 'FAIL',
    details: hasServiceFeeColumn ? 'Service fee column found' : 'No service fee column',
    file: 'app/shipper/loadboard/SearchTrucksTab.tsx'
  });
}

// ============================================
// PART 3: CONTACT TO NEGOTIATE BOXES
// ============================================

console.log('\n========================================');
console.log('PART 3: CONTACT TO NEGOTIATE BOXES');
console.log('========================================\n');

// Mobile screens
const mobileRequestScreens = [
  { path: 'mobile/lib/features/carrier/screens/carrier_load_requests_screen.dart', name: 'Carrier Load Requests' },
  { path: 'mobile/lib/features/carrier/screens/carrier_truck_requests_screen.dart', name: 'Carrier Truck Requests' },
  { path: 'mobile/lib/features/shipper/screens/shipper_load_requests_screen.dart', name: 'Shipper Load Requests' },
  { path: 'mobile/lib/features/shipper/screens/shipper_truck_requests_screen.dart', name: 'Shipper Truck Requests' },
];

for (const screen of mobileRequestScreens) {
  const content = readFile(screen.path);
  if (content) {
    const hasContactBox = /ContactToNegotiate|Contact.*Negotiate|url_launcher|launchUrl.*tel:/i.test(content);

    addResult({
      name: `Mobile ${screen.name}: Contact to negotiate`,
      status: hasContactBox ? 'PASS' : 'FAIL',
      details: hasContactBox ? 'Contact box found' : 'No contact box',
      file: screen.path
    });
  }
}

// Web screens
const webRequestClients = [
  { path: 'app/carrier/requests/MyLoadRequestsClient.tsx', name: 'Carrier My Load Requests' },
  { path: 'app/carrier/requests/ShipperRequestsClient.tsx', name: 'Carrier Shipper Requests' },
  { path: 'app/shipper/requests/LoadRequestsClient.tsx', name: 'Shipper Load Requests' },
  { path: 'app/shipper/requests/TruckRequestsClient.tsx', name: 'Shipper Truck Requests' },
];

for (const client of webRequestClients) {
  const content = readFile(client.path);
  if (content) {
    const hasContactBox = /Contact.*Negotiate|tel:|sms:|mailto:/i.test(content);
    const hasApprovedCheck = /status.*===.*'APPROVED'|status.*===.*"APPROVED"/i.test(content);

    addResult({
      name: `Web ${client.name}: Contact to negotiate`,
      status: hasContactBox && hasApprovedCheck ? 'PASS' : 'FAIL',
      details: hasContactBox ? 'Contact box with APPROVED check found' : 'No contact box',
      file: client.path
    });
  }
}

// ============================================
// PART 4: VERIFIED BADGES
// ============================================

console.log('\n========================================');
console.log('PART 4: VERIFIED BADGES');
console.log('========================================\n');

// Check mobile loadboard for verified badge
if (carrierLoadboard) {
  const hasVerifiedBadge = /isVerified|verified.*badge|✓.*Verified/i.test(carrierLoadboard);

  addResult({
    name: 'Mobile Carrier Loadboard: Shipper verified badge',
    status: hasVerifiedBadge ? 'PASS' : 'FAIL',
    details: hasVerifiedBadge ? 'Verified badge found' : 'No verified badge',
    file: 'mobile/lib/features/carrier/screens/carrier_loadboard_screen.dart'
  });
}

if (shipperTruckboard) {
  const hasVerifiedBadge = /isVerified|verified.*badge|✓.*Verified|carrierIsVerified/i.test(shipperTruckboard);

  addResult({
    name: 'Mobile Shipper Truckboard: Carrier verified badge',
    status: hasVerifiedBadge ? 'PASS' : 'FAIL',
    details: hasVerifiedBadge ? 'Verified badge found' : 'No verified badge',
    file: 'mobile/lib/features/shipper/screens/shipper_truckboard_screen.dart'
  });
}

// ============================================
// PART 5: GPS & DISTANCE
// ============================================

console.log('\n========================================');
console.log('PART 5: GPS & DISTANCE');
console.log('========================================\n');

// Check GPS service exists
addResult({
  name: 'Mobile GPS Service exists',
  status: checkFileExists('mobile/lib/core/services/gps_service.dart') ? 'PASS' : 'FAIL',
  details: 'GPS service file',
  file: 'mobile/lib/core/services/gps_service.dart'
});

// Check GPS API endpoints
addResult({
  name: 'API GPS Position endpoint',
  status: checkFileExists('app/api/gps/position/route.ts') ? 'PASS' : 'FAIL',
  details: 'GPS position API route',
  file: 'app/api/gps/position/route.ts'
});

addResult({
  name: 'API GPS Positions endpoint',
  status: checkFileExists('app/api/gps/positions/route.ts') ? 'PASS' : 'FAIL',
  details: 'GPS positions API route',
  file: 'app/api/gps/positions/route.ts'
});

// ============================================
// PART 6: CORRIDOR & SERVICE FEE CALCULATION
// ============================================

console.log('\n========================================');
console.log('PART 6: CORRIDOR & SERVICE FEE');
console.log('========================================\n');

// Check Corridor API
addResult({
  name: 'Corridor calculate-fee API',
  status: checkFileExists('app/api/corridors/calculate-fee/route.ts') ? 'PASS' : 'FAIL',
  details: 'Service fee calculation endpoint',
  file: 'app/api/corridors/calculate-fee/route.ts'
});

// Check service fee calculation lib
addResult({
  name: 'Service fee calculation library',
  status: checkFileExists('lib/serviceFeeCalculation.ts') ? 'PASS' : 'FAIL',
  details: 'Fee calculation module',
  file: 'lib/serviceFeeCalculation.ts'
});

// Check Corridor model in Prisma schema
const prismaSchema = readFile('prisma/schema.prisma');
if (prismaSchema) {
  const hasCorridorModel = /model\s+Corridor\s*\{/i.test(prismaSchema);
  const hasDistanceKm = /distanceKm/i.test(prismaSchema);
  const hasPricePerKm = /pricePerKm/i.test(prismaSchema);

  addResult({
    name: 'Prisma Corridor model with distance & pricing',
    status: hasCorridorModel && hasDistanceKm && hasPricePerKm ? 'PASS' : 'FAIL',
    details: `Model: ${hasCorridorModel}, distanceKm: ${hasDistanceKm}, pricePerKm: ${hasPricePerKm}`,
    file: 'prisma/schema.prisma'
  });
}

// ============================================
// SUMMARY
// ============================================

console.log('\n========================================');
console.log('VERIFICATION SUMMARY');
console.log('========================================\n');

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const warnings = results.filter(r => r.status === 'WARN').length;

console.log(`Total Checks: ${results.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⚠️  Warnings: ${warnings}`);

if (failed > 0) {
  console.log('\n❌ FAILED CHECKS:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`   - ${r.name}`);
    if (r.file) console.log(`     File: ${r.file}`);
  });
}

console.log('\n========================================');
if (failed === 0) {
  console.log('🎉 ALL VERIFICATIONS PASSED!');
  console.log('Codebase is ready for E2E testing.');
} else {
  console.log('⚠️  SOME VERIFICATIONS FAILED');
  console.log('Please fix the issues before E2E testing.');
}
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
