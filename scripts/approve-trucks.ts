import 'dotenv/config';
import { db } from '../lib/db';

async function main() {
  // Get all trucks
  const trucks = await db.truck.findMany({ select: { id: true, licensePlate: true, approvalStatus: true } });
  console.log('Current trucks:', trucks);

  // Update pending trucks to approved
  const result = await db.truck.updateMany({
    where: { approvalStatus: 'PENDING' },
    data: { approvalStatus: 'APPROVED' }
  });
  console.log('Updated trucks:', result.count);

  // Verify
  const updated = await db.truck.findMany({ select: { id: true, licensePlate: true, approvalStatus: true } });
  console.log('After update:', updated);
}

main().catch(console.error);
