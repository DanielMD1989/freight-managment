import { db } from "../lib/db";

async function main() {
  console.log("Finding a pending truck to reject for testing...");

  // Find a pending truck
  const pendingTruck = await db.truck.findFirst({
    where: { approvalStatus: "PENDING" },
    select: { id: true, licensePlate: true, approvalStatus: true },
  });

  if (!pendingTruck) {
    console.log("No pending trucks found. Creating a test truck...");

    // Find a carrier org
    const carrier = await db.organization.findFirst({
      where: { type: "CARRIER_COMPANY" },
      select: { id: true },
    });

    if (!carrier) {
      console.log("No carrier organization found");
      return;
    }

    // Create a test truck
    const newTruck = await db.truck.create({
      data: {
        licensePlate: "TEST-REJECT-01",
        truckType: "FLATBED",
        capacity: 10000,
        carrierId: carrier.id,
        approvalStatus: "REJECTED",
        rejectionReason:
          "Test rejection: Invalid license plate format. Please update and resubmit.",
      },
    });

    console.log("Created rejected test truck:", newTruck.licensePlate);
    return;
  }

  // Reject the truck
  const rejected = await db.truck.update({
    where: { id: pendingTruck.id },
    data: {
      approvalStatus: "REJECTED",
      rejectionReason:
        "Test rejection: Invalid license plate format. Please update and resubmit.",
    },
  });

  console.log("Rejected truck:", rejected.licensePlate);
  console.log("Status:", rejected.approvalStatus);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
