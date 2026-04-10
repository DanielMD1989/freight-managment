import { config } from "dotenv";
config({ path: ".env.local" });
const { PrismaClient } = await import("@prisma/client");
const { PrismaPg } = await import("@prisma/adapter-pg");
const { Pool } = await import("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const totalUsers = await prisma.user.count();
const totalOrgs = await prisma.organization.count();
const totalLoads = await prisma.load.count();
const totalTrucks = await prisma.truck.count();
const trucksApproved = await prisma.truck.count({ where: { approvalStatus: "APPROVED" } });
const trucksPending = await prisma.truck.count({ where: { approvalStatus: "PENDING" } });
const totalTrips = await prisma.trip.count();
// "Active Trips" on the analytics card uses the API field summary.trips.active
// Per lib/admin/metrics.ts getTripMetrics, active = trips with status not in (COMPLETED, CANCELLED)
const activeTrips = await prisma.trip.count({
  where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
});
const completedTripsInPeriod = await prisma.trip.count({
  where: { status: { in: ["DELIVERED", "COMPLETED"] } },
});
const cancelledTripsInPeriod = await prisma.trip.count({
  where: { status: "CANCELLED" },
});
const openDisputes = await prisma.dispute.count({ where: { status: "OPEN" } });

// Loads "active" per analytics = POSTED + SEARCHING + OFFERED
// Loads "inProgress" = ASSIGNED + PICKUP_PENDING + IN_TRANSIT
const loadsActive = await prisma.load.count({
  where: { status: { in: ["POSTED", "SEARCHING", "OFFERED"] } },
});
const loadsInProgress = await prisma.load.count({
  where: { status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] } },
});

// Per-status load counts (for the StatusDistribution chart)
const loadStatuses = ["DRAFT","POSTED","SEARCHING","OFFERED","ASSIGNED","PICKUP_PENDING","IN_TRANSIT","DELIVERED","COMPLETED","EXCEPTION","CANCELLED","EXPIRED","UNPOSTED"];
const byStatus = {};
for (const s of loadStatuses) {
  byStatus[s] = await prisma.load.count({ where: { status: s } });
}

// Platform Revenue = the platform wallet computed balance
const platformWallet = await prisma.financialAccount.findFirst({
  where: { accountType: "PLATFORM_REVENUE" },
});
const platformBalance = platformWallet ? Number(platformWallet.balance) : 0;

// Service Fees Collected (period) = sum of journal entries for SERVICE_FEE_DEDUCT
// in the period — the page header says "Mar 10 - Apr 9" which is the default 30-day window
const since = new Date();
since.setDate(since.getDate() - 30);
const serviceFeesAgg = await prisma.journalEntry.count({
  where: {
    transactionType: "SERVICE_FEE_DEDUCT",
    createdAt: { gte: since },
  },
});

// Transaction Volume = sum of all journal entries (any type) in the period
const txCountInPeriod = await prisma.journalEntry.count({
  where: { createdAt: { gte: since } },
});
const txLines = await prisma.journalLine.findMany({
  where: { journalEntry: { createdAt: { gte: since } } },
  select: { amount: true },
});
const txVolume = txLines.reduce((s, l) => s + Number(l.amount), 0) / 2; // each tx has 2 lines (debit+credit)

console.log(JSON.stringify({
  totalUsers, totalOrgs, totalLoads, totalTrucks,
  trucksApproved, trucksPending,
  totalTrips, activeTrips,
  completedTripsInPeriod, cancelledTripsInPeriod,
  openDisputes,
  loadsActive, loadsInProgress,
  byStatus,
  platformBalance,
  serviceFeesCount: serviceFeesAgg,
  txCountInPeriod,
  txVolumeApprox: txVolume,
}, null, 2));

await prisma.$disconnect();
await pool.end();
