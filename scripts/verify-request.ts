import "dotenv/config";
import { db } from "../lib/db";

async function main() {
  const requests = await db.loadRequest.findMany({
    where: {
      truck: { licensePlate: "AA-12345" },
    },
    select: {
      id: true,
      status: true,
      respondedAt: true,
      createdAt: true,
      truck: { select: { licensePlate: true } },
      load: { select: { pickupCity: true, deliveryCity: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  console.log("Load request status:", JSON.stringify(requests, null, 2));
}

main().catch(console.error);
