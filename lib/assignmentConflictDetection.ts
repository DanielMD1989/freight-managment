/**
 * Sprint 4: Assignment Conflict Detection
 *
 * Prevents double-booking and detects scheduling conflicts
 * before assigning trucks to loads
 */

import { db } from '@/lib/db';

export interface ConflictCheck {
  hasConflict: boolean;
  conflicts: AssignmentConflict[];
  warnings: AssignmentWarning[];
}

export interface AssignmentConflict {
  type: 'TRUCK_ALREADY_ASSIGNED' | 'LOAD_ALREADY_ASSIGNED' | 'SCHEDULE_CONFLICT';
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
}

export interface AssignmentWarning {
  type: 'TRUCK_UNAVAILABLE' | 'GPS_NOT_VERIFIED' | 'TRUCK_TYPE_MISMATCH' | 'SCHEDULE_TIGHT';
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
}

/**
 * Check for assignment conflicts before assigning a truck to a load
 *
 * @param truckId - ID of the truck to assign
 * @param loadId - ID of the load to assign
 * @param pickupDate - Pickup date of the load
 * @param deliveryDate - Delivery date of the load
 * @returns Conflict check result
 */
export async function checkAssignmentConflicts(
  truckId: string,
  loadId: string,
  pickupDate: Date,
  deliveryDate: Date
): Promise<ConflictCheck> {
  const conflicts: AssignmentConflict[] = [];
  const warnings: AssignmentWarning[] = [];

  // 1. Check if truck is already assigned to another active load
  const truckAssignments = await db.load.findMany({
    where: {
      assignedTruckId: truckId,
      status: {
        in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'],
      },
      id: {
        not: loadId, // Exclude current load if re-assigning
      },
    },
    select: {
      id: true,
      status: true,
      pickupCity: true,
      deliveryCity: true,
      pickupDate: true,
      deliveryDate: true,
    },
  });

  if (truckAssignments.length > 0) {
    const activeLoad = truckAssignments[0];
    conflicts.push({
      type: 'TRUCK_ALREADY_ASSIGNED',
      message: `Truck is already assigned to load ${activeLoad.id} (${activeLoad.status})`,
      details: {
        existingLoadId: activeLoad.id,
        existingLoadStatus: activeLoad.status,
        existingRoute: `${activeLoad.pickupCity} → ${activeLoad.deliveryCity}`,
      },
    });
  }

  // 2. Check if load is already assigned to another truck
  const loadAssignment = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      status: true,
      assignedTruckId: true,
      assignedTruck: {
        select: {
          id: true,
          licensePlate: true,
        },
      },
    },
  });

  if (loadAssignment?.assignedTruckId && loadAssignment.assignedTruckId !== truckId) {
    conflicts.push({
      type: 'LOAD_ALREADY_ASSIGNED',
      message: `Load is already assigned to truck ${loadAssignment.assignedTruck?.licensePlate}`,
      details: {
        existingTruckId: loadAssignment.assignedTruckId,
        existingTruckPlate: loadAssignment.assignedTruck?.licensePlate,
      },
    });
  }

  // 3. Check for schedule conflicts with other loads
  // Find loads assigned to this truck that overlap with the new load's schedule
  const scheduleConflicts = await db.load.findMany({
    where: {
      assignedTruckId: truckId,
      id: {
        not: loadId,
      },
      OR: [
        // New load starts during existing load
        {
          AND: [
            { pickupDate: { lte: pickupDate } },
            { deliveryDate: { gte: pickupDate } },
          ],
        },
        // New load ends during existing load
        {
          AND: [
            { pickupDate: { lte: deliveryDate } },
            { deliveryDate: { gte: deliveryDate } },
          ],
        },
        // New load completely contains existing load
        {
          AND: [
            { pickupDate: { gte: pickupDate } },
            { deliveryDate: { lte: deliveryDate } },
          ],
        },
      ],
      status: {
        in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'],
      },
    },
    select: {
      id: true,
      pickupCity: true,
      deliveryCity: true,
      pickupDate: true,
      deliveryDate: true,
    },
  });

  if (scheduleConflicts.length > 0) {
    scheduleConflicts.forEach((conflictLoad) => {
      conflicts.push({
        type: 'SCHEDULE_CONFLICT',
        message: `Schedule overlaps with load ${conflictLoad.id}`,
        details: {
          conflictLoadId: conflictLoad.id,
          conflictRoute: `${conflictLoad.pickupCity} → ${conflictLoad.deliveryCity}`,
          conflictPickup: conflictLoad.pickupDate,
          conflictDelivery: conflictLoad.deliveryDate,
        },
      });
    });
  }

  // 4. Check truck availability and warnings
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: {
      id: true,
      isAvailable: true,
      truckType: true,
      imei: true,
      gpsVerifiedAt: true,
    },
  });

  if (truck && !truck.isAvailable) {
    warnings.push({
      type: 'TRUCK_UNAVAILABLE',
      message: 'Truck is marked as unavailable',
      details: { isAvailable: false },
    });
  }

  // 5. Check GPS verification
  if (truck && (!truck.imei || !truck.gpsVerifiedAt)) {
    warnings.push({
      type: 'GPS_NOT_VERIFIED',
      message: 'Truck does not have verified GPS device',
      details: {
        hasImei: !!truck.imei,
        isVerified: !!truck.gpsVerifiedAt,
      },
    });
  }

  // 6. Check truck type match
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: { truckType: true },
  });

  if (truck && load && truck.truckType !== load.truckType) {
    warnings.push({
      type: 'TRUCK_TYPE_MISMATCH',
      message: `Truck type ${truck.truckType} does not match required type ${load.truckType}`,
      details: {
        truckType: truck.truckType,
        requiredType: load.truckType,
      },
    });
  }

  // 7. Check for tight scheduling (less than 4 hours between loads)
  const nearbyLoads = await db.load.findMany({
    where: {
      assignedTruckId: truckId,
      id: { not: loadId },
      status: {
        in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'],
      },
      OR: [
        // Ends shortly before new load starts
        {
          deliveryDate: {
            gte: new Date(pickupDate.getTime() - 4 * 60 * 60 * 1000), // 4 hours before
            lte: pickupDate,
          },
        },
        // Starts shortly after new load ends
        {
          pickupDate: {
            gte: deliveryDate,
            lte: new Date(deliveryDate.getTime() + 4 * 60 * 60 * 1000), // 4 hours after
          },
        },
      ],
    },
    select: {
      id: true,
      deliveryDate: true,
      deliveryCity: true,
    },
  });

  if (nearbyLoads.length > 0) {
    warnings.push({
      type: 'SCHEDULE_TIGHT',
      message: 'Schedule has tight timing with adjacent loads',
      details: {
        adjacentLoads: nearbyLoads.length,
      },
    });
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    warnings,
  };
}

/**
 * Get all active assignments for a truck
 *
 * @param truckId - ID of the truck
 * @returns List of active load assignments
 */
export async function getTruckActiveAssignments(truckId: string) {
  return db.load.findMany({
    where: {
      assignedTruckId: truckId,
      status: {
        in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'],
      },
    },
    select: {
      id: true,
      status: true,
      pickupCity: true,
      deliveryCity: true,
      pickupDate: true,
      deliveryDate: true,
      createdAt: true,
    },
    orderBy: {
      pickupDate: 'asc',
    },
  });
}

/**
 * Get conflict summary for assignment dashboard
 *
 * @returns Summary of assignment conflicts across all trucks
 */
export async function getConflictSummary() {
  // Find all trucks with multiple active assignments (potential conflicts)
  const trucksWithMultipleLoads = await db.load.groupBy({
    by: ['assignedTruckId'],
    where: {
      assignedTruckId: { not: null },
      status: {
        in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'],
      },
    },
    _count: true,
    having: {
      assignedTruckId: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  return {
    trucksWithConflicts: trucksWithMultipleLoads.length,
    totalConflicts: trucksWithMultipleLoads.reduce((sum, t) => sum + t._count - 1, 0),
  };
}
