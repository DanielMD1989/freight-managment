/**
 * Jest Setup File
 *
 * Sprint 9 - Story 9.10: Security Testing & QA
 *
 * Runs before all tests to set up test environment.
 */

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";
process.env.JWT_ENABLE_ENCRYPTION = "false"; // Disable encryption in tests (mock doesn't support EncryptJWT)
process.env.DATABASE_URL = "postgresql://test@localhost:5432/freight_test";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.EMAIL_PROVIDER = "console";

// Mock Prisma client for tests with in-memory storage
jest.mock("@/lib/db", () => {
  // In-memory stores for test data
  const stores = {
    users: new Map(),
    organizations: new Map(),
    loads: new Map(),
    trucks: new Map(),
    notifications: new Map(),
    truckPostings: new Map(),
    corridors: new Map(),
    financialAccounts: new Map(),
    journalEntries: new Map(),
    userMFAs: new Map(),
    trips: new Map(),
    loadRequests: new Map(),
    truckRequests: new Map(),
    matchProposals: new Map(),
    loadEvents: new Map(),
    ethiopianLocations: new Map(),
    sessions: new Map(),
    gpsPositions: new Map(),
    gpsDevices: new Map(),
    tripPods: new Map(),
    disputes: new Map(),
    withdrawalRequests: new Map(),
    systemSettings: new Map(),
    companyDocuments: new Map(),
    truckDocuments: new Map(),
    auditLogs: new Map(),
  };

  let userIdCounter = 1;
  let orgIdCounter = 1;
  let loadIdCounter = 1;
  let truckIdCounter = 1;
  let notificationIdCounter = 1;
  let truckPostingIdCounter = 1;
  let corridorIdCounter = 1;
  let financialAccountIdCounter = 1;
  let journalEntryIdCounter = 1;
  let userMFAIdCounter = 1;
  let tripIdCounter = 1;
  let loadRequestIdCounter = 1;
  let truckRequestIdCounter = 1;
  let matchProposalIdCounter = 1;
  let loadEventIdCounter = 1;
  let ethiopianLocationIdCounter = 1;
  let sessionIdCounter = 1;
  let gpsPositionIdCounter = 1;
  let gpsDeviceIdCounter = 1;
  let tripPodIdCounter = 1;
  let disputeIdCounter = 1;
  let withdrawalRequestIdCounter = 1;
  let systemSettingsIdCounter = 1;
  let companyDocumentIdCounter = 1;
  let truckDocumentIdCounter = 1;
  let auditLogIdCounter = 1;

  // Default values for different model types
  const modelDefaults = {
    org: {
      currentCommissionRatePercent: 2, // Default 2% commission
      totalCommissionPaidEtb: 0,
      isActive: true,
      verificationStatus: "PENDING",
      isFlagged: false,
      flagReason: null,
    },
    user: {
      isActive: true,
      emailVerified: false,
    },
    load: {
      serviceFeeStatus: "PENDING",
    },
    truck: { postings: [], gpsDevice: null },
    notification: {
      read: false,
    },
    truckPosting: {},
    corridor: {
      isActive: true,
      promoFlag: false,
      direction: "ONE_WAY",
    },
    financialAccount: {
      isActive: true,
      currency: "ETB",
    },
    journalEntry: {},
    userMFA: {
      enabled: false,
    },
    trip: {
      status: "ASSIGNED",
    },
    loadRequest: {
      status: "PENDING",
    },
    truckRequest: {
      status: "PENDING",
    },
    matchProposal: {
      status: "PENDING",
    },
    loadEvent: {},
    ethiopianLocation: {
      isActive: true,
    },
    session: {},
    gpsPosition: {},
    gpsDevice: {
      status: "ACTIVE",
    },
    tripPod: {},
    dispute: {
      status: "OPEN",
    },
    withdrawalRequest: {
      status: "PENDING",
    },
    systemSettings: {},
    companyDocument: {
      verificationStatus: "PENDING",
    },
    truckDocument: {
      verificationStatus: "PENDING",
    },
    auditLog: {
      severity: "INFO",
    },
  };

  // Helper to create model methods with in-memory storage
  const createModelMethods = (store, idPrefix, idCounter) => ({
    create: jest.fn(({ data }) => {
      const id = data.id || `${idPrefix}-${idCounter.value++}`;
      // When an explicit id is provided, advance counter past it to avoid future collisions
      if (data.id) {
        const match = data.id.match(new RegExp(`^${idPrefix}-(\\d+)$`));
        if (match) {
          const num = parseInt(match[1], 10) + 1;
          if (num > idCounter.value) idCounter.value = num;
        }
      }
      const defaults = modelDefaults[idPrefix] || {};
      const record = {
        id,
        ...defaults,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(id, record);
      return Promise.resolve(record);
    }),
    findUnique: jest.fn(({ where, include, select }) => {
      // Support lookup by id or any unique field (email, etc.)
      let record = store.get(where.id);
      if (!record && where) {
        // Search by other fields (e.g., where: { email: '...' })
        const entries = Object.entries(where).filter(([k]) => k !== "id");
        if (entries.length > 0) {
          record = Array.from(store.values()).find((r) =>
            entries.every(([key, value]) => {
              // Handle composite keys (e.g., originRegion_destinationRegion_direction: { ... })
              if (value && typeof value === "object" && !Array.isArray(value)) {
                return Object.entries(value).every(
                  ([subKey, subValue]) => r[subKey] === subValue
                );
              }
              return r[key] === value;
            })
          );
        }
      }
      if (!record) return Promise.resolve(null);

      // Handle includes for relationships
      if (include && record) {
        const result = { ...record };
        if (include.users && stores.users) {
          result.users = Array.from(stores.users.values()).filter(
            (u) => u.organizationId === record.id
          );
        }
        if (include.loads && stores.loads) {
          result.loads = Array.from(stores.loads.values()).filter(
            (l) => l.shipperId === record.id || l.corridorId === record.id
          );
        }
        if (include.corridor && stores.corridors && record.corridorId) {
          result.corridor = stores.corridors.get(record.corridorId);
        }
        if (include.createdBy && record.createdById && stores.users) {
          const user = stores.users.get(record.createdById);
          result.createdBy = user
            ? {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
              }
            : null;
        }
        if (
          include.organization &&
          record.organizationId &&
          stores.organizations
        ) {
          result.organization = stores.organizations.get(record.organizationId);
        }
        if (include.truck && record.truckId && stores.trucks) {
          result.truck = stores.trucks.get(record.truckId) || null;
        }
        // Handle _count
        if (include._count) {
          result._count = {};
          const countFields = include._count.select
            ? Object.keys(include._count.select)
            : [];
          for (const field of countFields) {
            result._count[field] = 0;
            if (field === "loads" && stores.loads) {
              result._count[field] = Array.from(stores.loads.values()).filter(
                (l) => l.corridorId === record.id || l.shipperId === record.id
              ).length;
            } else if (field === "users" && stores.users) {
              result._count[field] = Array.from(stores.users.values()).filter(
                (u) => u.organizationId === record.id
              ).length;
            } else if (field === "trucks" && stores.trucks) {
              result._count[field] = Array.from(stores.trucks.values()).filter(
                (t) => t.carrierId === record.id
              ).length;
            }
          }
        }
        return Promise.resolve(result);
      }
      // Handle select with nested relations (e.g., select: { organization: { select: {...} } })
      if (select && !include && record) {
        const result = { ...record };
        if (
          select.organization &&
          record.organizationId &&
          stores.organizations
        ) {
          const org = stores.organizations.get(record.organizationId);
          result.organization = org
            ? {
                id: org.id,
                name: org.name,
                type: org.type,
                isVerified: org.isVerified,
              }
            : null;
        }
        if (select.corridor && record.corridorId && stores.corridors) {
          result.corridor = stores.corridors.get(record.corridorId) || null;
        } else if (select.corridor && !record.corridorId) {
          result.corridor = null;
        }
        if (select.assignedTruck && record.assignedTruckId && stores.trucks) {
          const truck = stores.trucks.get(record.assignedTruckId);
          if (truck) {
            result.assignedTruck = { ...truck };
            if (select.assignedTruck.select?.carrierId !== undefined) {
              result.assignedTruck.carrierId = truck.carrierId;
            }
            if (
              select.assignedTruck.select?.carrier &&
              truck.carrierId &&
              stores.organizations
            ) {
              const carrier = stores.organizations.get(truck.carrierId);
              result.assignedTruck.carrier = carrier
                ? { id: carrier.id, name: carrier.name }
                : null;
            }
          } else {
            result.assignedTruck = null;
          }
        } else if (select.assignedTruck && !record.assignedTruckId) {
          result.assignedTruck = null;
        }
        if (select.shipper && record.shipperId && stores.organizations) {
          const shipper = stores.organizations.get(record.shipperId);
          result.shipper = shipper
            ? { id: shipper.id, name: shipper.name }
            : null;
        } else if (select.shipper && !record.shipperId) {
          result.shipper = null;
        }
        if (
          select.pickupLocation &&
          record.pickupLocationId &&
          stores.ethiopianLocations
        ) {
          result.pickupLocation =
            stores.ethiopianLocations.get(record.pickupLocationId) || null;
        } else if (select.pickupLocation) {
          result.pickupLocation = null;
        }
        if (
          select.deliveryLocation &&
          record.deliveryLocationId &&
          stores.ethiopianLocations
        ) {
          result.deliveryLocation =
            stores.ethiopianLocations.get(record.deliveryLocationId) || null;
        } else if (select.deliveryLocation) {
          result.deliveryLocation = null;
        }
        return Promise.resolve(result);
      }
      return Promise.resolve(record);
    }),
    findFirst: jest.fn(({ where, include } = {}) => {
      let records = Array.from(store.values());
      if (where) {
        records = records.filter((r) => {
          return Object.entries(where).every(([key, value]) => {
            if (value === undefined) return true;
            // Handle OR operator
            if (key === "OR" && Array.isArray(value)) {
              return value.some((condition) =>
                Object.entries(condition).every(([k, v]) => r[k] === v)
              );
            }
            // Handle nested objects (e.g., { in: [...] })
            if (value && typeof value === "object" && value.in) {
              return value.in.includes(r[key]);
            }
            if (value && typeof value === "object" && value.notIn) {
              return !value.notIn.includes(r[key]);
            }
            if (value && typeof value === "object" && value.not !== undefined) {
              return r[key] !== value.not;
            }
            // Handle nested relation filters (e.g., { assignedTruck: { carrierId: ... } })
            if (
              value &&
              typeof value === "object" &&
              !Array.isArray(value) &&
              !value.in &&
              !value.not &&
              !value.notIn
            ) {
              return true; // Skip complex relation filters in mock
            }
            return r[key] === value;
          });
        });
      }
      const record = records[0] || null;
      if (record && include) {
        // Handle includes for relationships
        if (include.corridor && stores.corridors && record.corridorId) {
          record.corridor = stores.corridors.get(record.corridorId);
        }
        if (include.assignedTruck && record.assignedTruckId && stores.trucks) {
          const truck = stores.trucks.get(record.assignedTruckId);
          record.assignedTruck = truck ? { ...truck } : null;
        }
        if (include.shipper && record.shipperId && stores.organizations) {
          record.shipper = stores.organizations.get(record.shipperId) || null;
        }
      }
      return Promise.resolve(record);
    }),
    findMany: jest.fn(
      ({ where, include, select, skip, take, orderBy } = {}) => {
        let records = Array.from(store.values());
        if (where) {
          records = records.filter((r) => {
            return Object.entries(where).every(([key, value]) => {
              if (value === undefined) return true;
              // Handle OR operator
              if (key === "OR" && Array.isArray(value)) {
                return value.some((condition) =>
                  Object.entries(condition).every(([k, v]) => {
                    if (
                      v &&
                      typeof v === "object" &&
                      v.contains !== undefined
                    ) {
                      return String(r[k] || "")
                        .toLowerCase()
                        .includes(String(v.contains).toLowerCase());
                    }
                    if (v && typeof v === "object" && v.gte !== undefined)
                      return (r[k] || 0) >= v.gte;
                    return r[k] === v;
                  })
                );
              }
              // Handle { in: [...] } operator
              if (value && typeof value === "object" && value.in) {
                return value.in.includes(r[key]);
              }
              // Handle { notIn: [...] } operator
              if (value && typeof value === "object" && value.notIn) {
                return !value.notIn.includes(r[key]);
              }
              // Handle { not: ... } operator
              if (
                value &&
                typeof value === "object" &&
                value.not !== undefined
              ) {
                return r[key] !== value.not;
              }
              // Handle { some: ... }, { none: ... } for array relations - skip
              if (
                value &&
                typeof value === "object" &&
                (value.some !== undefined || value.none !== undefined)
              ) {
                return true;
              }
              // Handle { gte: ... }, { lte: ... } operators
              if (
                value &&
                typeof value === "object" &&
                (value.gte !== undefined || value.lte !== undefined)
              ) {
                let pass = true;
                if (value.gte !== undefined)
                  pass = pass && (r[key] || 0) >= value.gte;
                if (value.lte !== undefined)
                  pass = pass && (r[key] || 0) <= value.lte;
                if (value.lt !== undefined)
                  pass = pass && (r[key] || 0) < value.lt;
                return pass;
              }
              // Handle { contains: ... } for string search
              if (
                value &&
                typeof value === "object" &&
                value.contains !== undefined
              ) {
                return String(r[key] || "")
                  .toLowerCase()
                  .includes(String(value.contains).toLowerCase());
              }
              // Handle nested relation filters (skip in mock)
              if (value && typeof value === "object" && !Array.isArray(value)) {
                return true;
              }
              return r[key] === value;
            });
          });
        }
        // Handle pagination
        if (skip) records = records.slice(skip);
        if (take) records = records.slice(0, take);

        // Handle include relationships and _count
        const incl = include || {};
        const countSpec = incl._count || (select && select._count);
        if (include || (select && select._count)) {
          records = records.map((record) => {
            const result = { ...record };
            // Handle _count
            if (countSpec) {
              result._count = {};
              const countFields = countSpec.select
                ? Object.keys(countSpec.select)
                : [];
              for (const field of countFields) {
                result._count[field] = 0;
                if (field === "loads" && stores.loads) {
                  result._count[field] = Array.from(
                    stores.loads.values()
                  ).filter(
                    (l) =>
                      l.corridorId === record.id || l.shipperId === record.id
                  ).length;
                } else if (field === "users" && stores.users) {
                  result._count[field] = Array.from(
                    stores.users.values()
                  ).filter((u) => u.organizationId === record.id).length;
                } else if (field === "trucks" && stores.trucks) {
                  result._count[field] = Array.from(
                    stores.trucks.values()
                  ).filter((t) => t.carrierId === record.id).length;
                } else if (field === "disputesAgainst" && stores.disputes) {
                  result._count[field] = Array.from(
                    stores.disputes.values()
                  ).filter((d) => d.disputedOrgId === record.id).length;
                }
              }
            }
            // Handle include.createdBy
            if (incl.createdBy && record.createdById && stores.users) {
              const user = stores.users.get(record.createdById);
              result.createdBy = user
                ? {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                  }
                : null;
            }
            // Handle include.organization
            if (
              incl.organization &&
              record.organizationId &&
              stores.organizations
            ) {
              const org = stores.organizations.get(record.organizationId);
              result.organization = org
                ? { id: org.id, name: org.name, type: org.type }
                : null;
            }
            // Handle include.truck (with nested carrier)
            if (incl.truck && record.truckId && stores.trucks) {
              const truck = stores.trucks.get(record.truckId);
              if (truck) {
                result.truck = {
                  ...truck,
                  id: truck.id,
                  licensePlate: truck.licensePlate,
                };
                if (truck.carrierId && stores.organizations) {
                  const carrier = stores.organizations.get(truck.carrierId);
                  result.truck.carrier = carrier
                    ? { id: carrier.id, name: carrier.name, type: carrier.type }
                    : null;
                }
              } else {
                result.truck = null;
              }
            }
            // Handle include.shipper
            if (incl.shipper && record.shipperId && stores.organizations) {
              const shipper = stores.organizations.get(record.shipperId);
              result.shipper = shipper
                ? { id: shipper.id, name: shipper.name, type: shipper.type }
                : null;
            }
            return result;
          });
        }
        // Handle select with nested relations (e.g., select: { organization: { select: {...} } })
        if (select && !include) {
          records = records.map((record) => {
            const result = { ...record };
            if (
              select.organization &&
              record.organizationId &&
              stores.organizations
            ) {
              const org = stores.organizations.get(record.organizationId);
              result.organization = org
                ? {
                    id: org.id,
                    name: org.name,
                    type: org.type,
                    isVerified: org.isVerified,
                  }
                : null;
            }
            return result;
          });
        }
        return Promise.resolve(records);
      }
    ),
    update: jest.fn(({ where, data }) => {
      const record = store.get(where.id);
      if (!record) return Promise.resolve(null);
      // Handle Prisma operators in data (e.g., { balance: { increment: 500 } })
      const resolvedData = {};
      for (const [key, value] of Object.entries(data)) {
        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          !(value instanceof Date)
        ) {
          if (value.increment !== undefined) {
            resolvedData[key] =
              (Number(record[key]) || 0) + Number(value.increment);
          } else if (value.decrement !== undefined) {
            resolvedData[key] =
              (Number(record[key]) || 0) - Number(value.decrement);
          } else {
            resolvedData[key] = value;
          }
        } else {
          resolvedData[key] = value;
        }
      }
      const updated = { ...record, ...resolvedData, updatedAt: new Date() };
      store.set(where.id, updated);
      return Promise.resolve(updated);
    }),
    updateMany: jest.fn(({ where, data } = {}) => {
      let count = 0;
      store.forEach((record, id) => {
        if (!where) {
          store.set(id, { ...record, ...data, updatedAt: new Date() });
          count++;
          return;
        }
        const matches = Object.entries(where).every(([key, value]) => {
          if (value === undefined) return true;
          if (value && typeof value === "object" && value.in)
            return value.in.includes(record[key]);
          if (value && typeof value === "object" && value.notIn)
            return !value.notIn.includes(record[key]);
          if (value && typeof value === "object" && value.not !== undefined)
            return record[key] !== value.not;
          return record[key] === value;
        });
        if (matches) {
          store.set(id, { ...record, ...data, updatedAt: new Date() });
          count++;
        }
      });
      return Promise.resolve({ count });
    }),
    delete: jest.fn(({ where }) => {
      const record = store.get(where.id);
      store.delete(where.id);
      return Promise.resolve(record);
    }),
    deleteMany: jest.fn(({ where } = {}) => {
      let count = 0;
      if (where?.id) {
        if (store.has(where.id)) {
          store.delete(where.id);
          count = 1;
        }
      } else {
        count = store.size;
        store.clear();
      }
      return Promise.resolve({ count });
    }),
    count: jest.fn(({ where } = {}) => {
      if (!where) return Promise.resolve(store.size);
      let count = 0;
      store.forEach((record) => {
        const matches = Object.entries(where).every(([key, value]) => {
          if (value === undefined) return true;
          if (value && typeof value === "object") {
            if (value.gte !== undefined && value.lt !== undefined) {
              return (
                (record[key] || 0) >= value.gte && (record[key] || 0) < value.lt
              );
            }
            if (value.gte !== undefined && value.lte !== undefined) {
              return (
                (record[key] || 0) >= value.gte &&
                (record[key] || 0) <= value.lte
              );
            }
            if (value.gte !== undefined) return (record[key] || 0) >= value.gte;
            if (value.lte !== undefined) return (record[key] || 0) <= value.lte;
            if (value.in) return value.in.includes(record[key]);
            if (value.not !== undefined) return record[key] !== value.not;
            if (value.contains !== undefined) {
              return String(record[key] || "")
                .toLowerCase()
                .includes(String(value.contains).toLowerCase());
            }
            return true;
          }
          return record[key] === value;
        });
        if (matches) count++;
      });
      return Promise.resolve(count);
    }),
    aggregate: jest.fn(({ where, _sum } = {}) => {
      const result = {};
      if (_sum) {
        result._sum = {};
        for (const field of Object.keys(_sum)) {
          result._sum[field] = 0;
        }
      }
      return Promise.resolve(result);
    }),
    groupBy: jest.fn(({ by, where, _count } = {}) => {
      return Promise.resolve([]);
    }),
    upsert: jest.fn(({ where, create, update }) => {
      let record = store.get(where.id);
      if (!record && where) {
        const entries = Object.entries(where).filter(([k]) => k !== "id");
        if (entries.length > 0) {
          record = Array.from(store.values()).find((r) =>
            entries.every(([key, value]) => r[key] === value)
          );
        }
      }
      if (record) {
        const updated = { ...record, ...update, updatedAt: new Date() };
        store.set(record.id, updated);
        return Promise.resolve(updated);
      }
      const id = create.id || `${idPrefix}-${idCounter.value++}`;
      const defaults = modelDefaults[idPrefix] || {};
      const newRecord = {
        id,
        ...defaults,
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(id, newRecord);
      return Promise.resolve(newRecord);
    }),
  });

  // Counter objects (so they can be passed by reference)
  const counters = {
    user: { value: userIdCounter },
    org: { value: orgIdCounter },
    load: { value: loadIdCounter },
    truck: { value: truckIdCounter },
    notification: { value: notificationIdCounter },
    truckPosting: { value: truckPostingIdCounter },
    corridor: { value: corridorIdCounter },
    financialAccount: { value: financialAccountIdCounter },
    journalEntry: { value: journalEntryIdCounter },
    userMFA: { value: userMFAIdCounter },
    trip: { value: tripIdCounter },
    loadRequest: { value: loadRequestIdCounter },
    truckRequest: { value: truckRequestIdCounter },
    matchProposal: { value: matchProposalIdCounter },
    loadEvent: { value: loadEventIdCounter },
    ethiopianLocation: { value: ethiopianLocationIdCounter },
    session: { value: sessionIdCounter },
    gpsPosition: { value: gpsPositionIdCounter },
    gpsDevice: { value: gpsDeviceIdCounter },
    tripPod: { value: tripPodIdCounter },
    dispute: { value: disputeIdCounter },
    withdrawalRequest: { value: withdrawalRequestIdCounter },
    systemSettings: { value: systemSettingsIdCounter },
    companyDocument: { value: companyDocumentIdCounter },
    truckDocument: { value: truckDocumentIdCounter },
    auditLog: { value: auditLogIdCounter },
  };

  const result = {
    db: {
      user: createModelMethods(stores.users, "user", counters.user),
      organization: createModelMethods(
        stores.organizations,
        "org",
        counters.org
      ),
      load: createModelMethods(stores.loads, "load", counters.load),
      truck: createModelMethods(stores.trucks, "truck", counters.truck),
      notification: createModelMethods(
        stores.notifications,
        "notification",
        counters.notification
      ),
      truckPosting: createModelMethods(
        stores.truckPostings,
        "truckPosting",
        counters.truckPosting
      ),
      corridor: createModelMethods(
        stores.corridors,
        "corridor",
        counters.corridor
      ),
      financialAccount: createModelMethods(
        stores.financialAccounts,
        "financialAccount",
        counters.financialAccount
      ),
      journalEntry: createModelMethods(
        stores.journalEntries,
        "journalEntry",
        counters.journalEntry
      ),
      userMFA: {
        ...createModelMethods(stores.userMFAs, "userMFA", counters.userMFA),
        // UserMFA has unique constraint on userId, so findUnique/update use userId
        findUnique: jest.fn(({ where }) => {
          const id = where.id || where.userId;
          // Search by userId if not found by id
          if (where.userId) {
            for (const record of stores.userMFAs.values()) {
              if (record.userId === where.userId)
                return Promise.resolve(record);
            }
          }
          return Promise.resolve(stores.userMFAs.get(id) || null);
        }),
        upsert: jest.fn(({ where, create, update }) => {
          const existingId = where.userId;
          let existing = null;
          for (const record of stores.userMFAs.values()) {
            if (record.userId === existingId) {
              existing = record;
              break;
            }
          }
          if (existing) {
            const updated = { ...existing, ...update, updatedAt: new Date() };
            stores.userMFAs.set(existing.id, updated);
            return Promise.resolve(updated);
          } else {
            const id = `userMFA-${counters.userMFA.value++}`;
            const record = {
              id,
              ...create,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            stores.userMFAs.set(id, record);
            return Promise.resolve(record);
          }
        }),
        update: jest.fn(({ where, data }) => {
          const userId = where.userId;
          for (const [id, record] of stores.userMFAs.entries()) {
            if (record.userId === userId) {
              const updated = { ...record, ...data, updatedAt: new Date() };
              stores.userMFAs.set(id, updated);
              return Promise.resolve(updated);
            }
          }
          return Promise.reject(new Error("Record not found"));
        }),
      },
      auditLog: {
        create: jest.fn(() => Promise.resolve({ id: "audit-1" })),
        createMany: jest.fn(() => Promise.resolve({ count: 0 })),
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
        count: jest.fn(() => Promise.resolve(0)),
      },
      companyDocument: {
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
      },
      truckDocument: {
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
      },
      document: {
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
      },
      trip: createModelMethods(stores.trips, "trip", counters.trip),
      loadRequest: {
        ...createModelMethods(
          stores.loadRequests,
          "loadRequest",
          counters.loadRequest
        ),
        findUnique: jest.fn(({ where, include }) => {
          const record = stores.loadRequests.get(where.id);
          if (!record) return Promise.resolve(null);
          if (include) {
            const result = { ...record };
            if (include.load && record.loadId) {
              result.load = stores.loads.get(record.loadId) || null;
            }
            if (include.truck && record.truckId) {
              result.truck = stores.trucks.get(record.truckId) || null;
            }
            if (include.carrier && record.carrierId) {
              result.carrier =
                stores.organizations.get(record.carrierId) || null;
            }
            return Promise.resolve(result);
          }
          return Promise.resolve(record);
        }),
        updateMany: jest.fn(({ where, data }) => {
          let count = 0;
          stores.loadRequests.forEach((record, id) => {
            const matches = Object.entries(where).every(([key, value]) => {
              if (value && typeof value === "object" && value.not !== undefined)
                return record[key] !== value.not;
              if (value && typeof value === "object" && value.in)
                return value.in.includes(record[key]);
              return record[key] === value;
            });
            if (matches) {
              stores.loadRequests.set(id, {
                ...record,
                ...data,
                updatedAt: new Date(),
              });
              count++;
            }
          });
          return Promise.resolve({ count });
        }),
      },
      truckRequest: {
        ...createModelMethods(
          stores.truckRequests,
          "truckRequest",
          counters.truckRequest
        ),
        findUnique: jest.fn(({ where, include }) => {
          const record = stores.truckRequests.get(where.id);
          if (!record) return Promise.resolve(null);
          if (include) {
            const result = { ...record };
            if (include.load && record.loadId) {
              result.load = stores.loads.get(record.loadId) || null;
            }
            if (include.truck && record.truckId) {
              const truck = stores.trucks.get(record.truckId);
              result.truck = truck
                ? { ...truck, carrierId: truck.carrierId }
                : null;
            }
            return Promise.resolve(result);
          }
          return Promise.resolve(record);
        }),
        updateMany: jest.fn(({ where, data }) => {
          let count = 0;
          stores.truckRequests.forEach((record, id) => {
            const matches = Object.entries(where).every(([key, value]) => {
              if (value && typeof value === "object" && value.not !== undefined)
                return record[key] !== value.not;
              if (value && typeof value === "object" && value.in)
                return value.in.includes(record[key]);
              return record[key] === value;
            });
            if (matches) {
              stores.truckRequests.set(id, {
                ...record,
                ...data,
                updatedAt: new Date(),
              });
              count++;
            }
          });
          return Promise.resolve({ count });
        }),
      },
      matchProposal: {
        ...createModelMethods(
          stores.matchProposals,
          "matchProposal",
          counters.matchProposal
        ),
        updateMany: jest.fn(({ where, data }) => {
          let count = 0;
          stores.matchProposals.forEach((record, id) => {
            const matches = Object.entries(where).every(([key, value]) => {
              if (value && typeof value === "object" && value.not !== undefined)
                return record[key] !== value.not;
              return record[key] === value;
            });
            if (matches) {
              stores.matchProposals.set(id, {
                ...record,
                ...data,
                updatedAt: new Date(),
              });
              count++;
            }
          });
          return Promise.resolve({ count });
        }),
      },
      loadEvent: createModelMethods(
        stores.loadEvents,
        "loadEvent",
        counters.loadEvent
      ),
      ethiopianLocation: createModelMethods(
        stores.ethiopianLocations,
        "ethiopianLocation",
        counters.ethiopianLocation
      ),
      session: createModelMethods(stores.sessions, "session", counters.session),
      gpsPosition: createModelMethods(
        stores.gpsPositions,
        "gpsPosition",
        counters.gpsPosition
      ),
      gpsDevice: createModelMethods(
        stores.gpsDevices,
        "gpsDevice",
        counters.gpsDevice
      ),
      tripPod: createModelMethods(stores.tripPods, "tripPod", counters.tripPod),
      dispute: createModelMethods(stores.disputes, "dispute", counters.dispute),
      withdrawalRequest: createModelMethods(
        stores.withdrawalRequests,
        "withdrawalRequest",
        counters.withdrawalRequest
      ),
      systemSettings: createModelMethods(
        stores.systemSettings,
        "systemSettings",
        counters.systemSettings
      ),
      companyDocument: createModelMethods(
        stores.companyDocuments,
        "companyDocument",
        counters.companyDocument
      ),
      truckDocument: createModelMethods(
        stores.truckDocuments,
        "truckDocument",
        counters.truckDocument
      ),
      auditLog: createModelMethods(
        stores.auditLogs,
        "auditLog",
        counters.auditLog
      ),
      $transaction: jest.fn(),
      // Expose stores for test access
      __stores: stores,
      // Helper to clear all stores between tests if needed
      _clearStores: () => {
        Object.values(stores).forEach((store) => store.clear());
      },
    },
  };

  // Fix $transaction: pass db (self-reference) so transactional code can access model methods
  const dbRef = result.db;
  dbRef.$transaction.mockImplementation((callback) => {
    if (typeof callback === "function") {
      return callback(dbRef);
    }
    // Array of promises
    if (Array.isArray(callback)) {
      return Promise.all(callback);
    }
    return Promise.resolve();
  });

  return result;
});

// Mock jose library to handle ESM imports in Jest
jest.mock("jose", () => {
  const crypto = require("crypto");

  return {
    SignJWT: class SignJWT {
      constructor(payload) {
        this.payload = { ...payload };
      }

      setProtectedHeader() {
        return this;
      }

      setIssuedAt() {
        this.payload.iat = Math.floor(Date.now() / 1000);
        return this;
      }

      setExpirationTime(duration) {
        const now = Math.floor(Date.now() / 1000);
        if (typeof duration === "string") {
          // Parse durations like '24h', '5m', '1d'
          const match = duration.match(/^(\d+)([smhd])$/);
          if (match) {
            const value = parseInt(match[1]);
            const unit = match[2];
            const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
            this.payload.exp = now + value * (multipliers[unit] || 3600);
          } else {
            this.payload.exp = now + 3600; // Default 1h
          }
        } else if (typeof duration === "number") {
          this.payload.exp = duration;
        } else {
          this.payload.exp = now + 3600;
        }
        return this;
      }

      async sign(secret) {
        // Ensure iat is set if not already
        if (!this.payload.iat) {
          this.payload.iat = Math.floor(Date.now() / 1000);
        }
        // Ensure exp is set if not already
        if (!this.payload.exp) {
          this.payload.exp = Math.floor(Date.now() / 1000) + 3600;
        }
        const header = Buffer.from(
          JSON.stringify({ alg: "HS256", typ: "JWT" })
        ).toString("base64url");
        const payload = Buffer.from(JSON.stringify(this.payload)).toString(
          "base64url"
        );
        const signature = crypto
          .createHmac("sha256", secret)
          .update(`${header}.${payload}`)
          .digest("base64url");

        return `${header}.${payload}.${signature}`;
      }
    },

    jwtVerify: async (token, secret) => {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }

      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

      // Verify signature
      const header = parts[0];
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${header}.${parts[1]}`)
        .digest("base64url");

      if (parts[2] !== expectedSignature) {
        throw new Error("Invalid signature");
      }

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error("Token expired");
      }

      return { payload };
    },
  };
});

// Extend Jest matchers if needed
expect.extend({
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    const pass = jwtRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid JWT`
          : `expected ${received} to be a valid JWT`,
    };
  },
});

// Mock console methods to reduce noise in tests (optional)
global.console = {
  ...console,
  // Uncomment to suppress logs during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};
