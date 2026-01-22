import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * PHASE 4: Scalability - Configure connection pooling for 10K+ DAU
 *
 * Pool configuration optimized for:
 * - 10,000 daily active users
 * - ~50 requests/second peak
 * - Multiple server instances (horizontal scaling ready)
 */
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  // Connection pool configuration for scalability
  const pool = new Pool({
    connectionString,
    // Maximum connections per process (scale horizontally with more processes)
    max: parseInt(process.env.DB_POOL_MAX || "20"),
    // Minimum connections to keep ready
    min: parseInt(process.env.DB_POOL_MIN || "5"),
    // Close idle connections after 30 seconds
    idleTimeoutMillis: 30000,
    // Timeout for acquiring connection from pool
    connectionTimeoutMillis: 5000,
    // Maximum time a connection can be used before being released
    maxUses: 7500,
  });

  // Log pool errors
  pool.on("error", (err) => {
    console.error("[DB Pool] Unexpected error on idle client:", err);
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
