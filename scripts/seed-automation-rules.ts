/**
 * Sprint 7: Seed Default Automation Rules
 *
 * Create default system automation rules to replace hardcoded thresholds
 * from Sprint 5 exception detection
 */

import { db } from '../lib/db';

async function seedAutomationRules() {
  console.log('🌱 Seeding automation rules...');

  // Get or create system admin user
  const systemUser = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  });

  if (!systemUser) {
    console.error('❌ No SUPER_ADMIN user found. Please create one first.');
    process.exit(1);
  }

  const createdBy = systemUser.id;

  // Rule 1: Late Pickup Detection (replaces checkLatePickup)
  const latePickupRule = await db.automationRule.upsert({
    where: {
      id: 'system-late-pickup',
    },
    create: {
      id: 'system-late-pickup',
      name: 'Late Pickup Detection (2hr Grace)',
      description: 'Automatically detect and escalate late pickups with 2-hour grace period',
      ruleType: 'TIME_BASED',
      trigger: 'ON_SCHEDULE',
      isSystem: true,
      priority: 100,
      schedulePattern: '*/5 * * * *', // Every 5 minutes
      conditions: {
        graceHours: 2,
        hoursLateForHigh: 4,
        statuses: ['ASSIGNED', 'PICKUP_PENDING'],
      },
      actions: [
        {
          type: 'CREATE_ESCALATION',
          escalationType: 'LATE_PICKUP',
          priority: 'MEDIUM',
          title: 'Pickup is late',
          description: 'Scheduled pickup has not occurred within grace period',
        },
      ],
      createdBy,
    },
    update: {},
  });

  console.log('✓ Created Late Pickup Detection rule');

  // Rule 2: Late Delivery Detection (replaces checkLateDelivery)
  const lateDeliveryRule = await db.automationRule.upsert({
    where: {
      id: 'system-late-delivery',
    },
    create: {
      id: 'system-late-delivery',
      name: 'Late Delivery Detection (2hr Grace)',
      description: 'Automatically detect and escalate late deliveries with 2-hour grace period',
      ruleType: 'TIME_BASED',
      trigger: 'ON_SCHEDULE',
      isSystem: true,
      priority: 100,
      schedulePattern: '*/5 * * * *', // Every 5 minutes
      conditions: {
        graceHours: 2,
        hoursLateForHigh: 4,
        statuses: ['IN_TRANSIT'],
      },
      actions: [
        {
          type: 'CREATE_ESCALATION',
          escalationType: 'LATE_DELIVERY',
          priority: 'HIGH',
          title: 'Delivery is late',
          description: 'Scheduled delivery has not occurred within grace period',
        },
      ],
      createdBy,
    },
    update: {},
  });

  console.log('✓ Created Late Delivery Detection rule');

  // Rule 3: GPS Offline Detection (replaces checkGpsOffline)
  const gpsOfflineRule = await db.automationRule.upsert({
    where: {
      id: 'system-gps-offline',
    },
    create: {
      id: 'system-gps-offline',
      name: 'GPS Offline Detection (4hr Threshold)',
      description: 'Automatically detect and escalate when GPS device goes offline for 4+ hours',
      ruleType: 'GPS_BASED',
      trigger: 'ON_SCHEDULE',
      isSystem: true,
      priority: 90,
      schedulePattern: '*/10 * * * *', // Every 10 minutes
      conditions: {
        gpsOfflineHours: 4,
        gpsOfflineHoursForCritical: 8,
        statuses: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'],
      },
      actions: [
        {
          type: 'CREATE_ESCALATION',
          escalationType: 'GPS_OFFLINE',
          priority: 'HIGH',
          title: 'GPS device offline',
          description: 'GPS device has not reported position for extended period',
        },
        {
          type: 'SEND_NOTIFICATION',
          notificationType: 'GPS_OFFLINE',
          notificationTitle: 'GPS Offline Alert',
          notificationMessage: 'GPS device offline - unable to track load',
        },
      ],
      createdBy,
    },
    update: {},
  });

  console.log('✓ Created GPS Offline Detection rule');

  // Rule 4: Stalled Load Detection (replaces checkStalledLoad)
  const stalledLoadRule = await db.automationRule.upsert({
    where: {
      id: 'system-stalled-load',
    },
    create: {
      id: 'system-stalled-load',
      name: 'Stalled Load Detection (<1km in 4hr)',
      description: 'Automatically detect when truck has not moved during transit (possible breakdown)',
      ruleType: 'GPS_BASED',
      trigger: 'ON_SCHEDULE',
      isSystem: true,
      priority: 95,
      schedulePattern: '*/15 * * * *', // Every 15 minutes
      conditions: {
        stalledThresholdKm: 1,
        stalledCheckHours: 4,
        statuses: ['IN_TRANSIT'],
      },
      actions: [
        {
          type: 'CREATE_ESCALATION',
          escalationType: 'TRUCK_BREAKDOWN',
          priority: 'CRITICAL',
          title: 'Truck possibly stalled',
          description: 'Truck has not moved significantly - possible breakdown or issue',
        },
        {
          type: 'SEND_NOTIFICATION',
          notificationType: 'TRUCK_STALLED',
          notificationTitle: 'Truck Stalled Alert',
          notificationMessage: 'Truck has not moved - urgent attention required',
        },
      ],
      createdBy,
    },
    update: {},
  });

  console.log('✓ Created Stalled Load Detection rule');

  // Rule 5: Load Assignment Notification (new)
  const assignmentNotificationRule = await db.automationRule.upsert({
    where: {
      id: 'system-load-assigned-notification',
    },
    create: {
      id: 'system-load-assigned-notification',
      name: 'Load Assignment Notifications',
      description: 'Send notifications when load is assigned to carrier',
      ruleType: 'THRESHOLD_BASED',
      trigger: 'ON_LOAD_ASSIGNED',
      isSystem: true,
      priority: 50,
      schedulePattern: null,
      conditions: {},
      actions: [
        {
          type: 'SEND_NOTIFICATION',
          notificationType: 'LOAD_ASSIGNED',
          notificationTitle: 'Load Assigned',
          notificationMessage: 'A new load has been assigned to your carrier',
        },
      ],
      createdBy,
    },
    update: {},
  });

  console.log('✓ Created Load Assignment Notification rule');

  console.log('\n✅ Automation rules seeded successfully!');
  console.log(`   - ${latePickupRule.id}`);
  console.log(`   - ${lateDeliveryRule.id}`);
  console.log(`   - ${gpsOfflineRule.id}`);
  console.log(`   - ${stalledLoadRule.id}`);
  console.log(`   - ${assignmentNotificationRule.id}`);
}

seedAutomationRules()
  .catch((error) => {
    console.error('❌ Error seeding automation rules:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
