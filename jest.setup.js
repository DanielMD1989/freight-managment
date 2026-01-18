/**
 * Jest Setup File
 *
 * Sprint 9 - Story 9.10: Security Testing & QA
 *
 * Runs before all tests to set up test environment.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_ENABLE_ENCRYPTION = 'false'; // Disable encryption in tests (mock doesn't support EncryptJWT)
process.env.DATABASE_URL = 'postgresql://test@localhost:5432/freight_test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.EMAIL_PROVIDER = 'console';

// Mock Prisma client for tests with in-memory storage
jest.mock('@/lib/db', () => {
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

  // Default values for different model types
  const modelDefaults = {
    org: {
      currentCommissionRatePercent: 2, // Default 2% commission
      totalCommissionPaidEtb: 0,
      isActive: true,
      verificationStatus: 'PENDING',
    },
    user: {
      isActive: true,
      emailVerified: false,
    },
    load: {
      serviceFeeStatus: 'PENDING',
    },
    truck: {},
    notification: {
      read: false,
    },
    truckPosting: {},
    corridor: {
      isActive: true,
      promoFlag: false,
      direction: 'ONE_WAY',
    },
    financialAccount: {
      isActive: true,
      currency: 'ETB',
    },
    journalEntry: {},
  };

  // Helper to create model methods with in-memory storage
  const createModelMethods = (store, idPrefix, idCounter) => ({
    create: jest.fn(({ data }) => {
      const id = data.id || `${idPrefix}-${idCounter.value++}`;
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
      const record = store.get(where.id);
      if (!record) return Promise.resolve(null);

      // Handle includes for relationships
      if (include && record) {
        const result = { ...record };
        if (include.users && stores.users) {
          result.users = Array.from(stores.users.values()).filter(
            u => u.organizationId === record.id
          );
        }
        if (include.loads && stores.loads) {
          result.loads = Array.from(stores.loads.values()).filter(
            l => l.shipperId === record.id
          );
        }
        if (include.corridor && stores.corridors && record.corridorId) {
          result.corridor = stores.corridors.get(record.corridorId);
        }
        return Promise.resolve(result);
      }
      return Promise.resolve(record);
    }),
    findFirst: jest.fn(({ where, include } = {}) => {
      let records = Array.from(store.values());
      if (where) {
        records = records.filter(r => {
          return Object.entries(where).every(([key, value]) => {
            if (value === undefined) return true;
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
      }
      return Promise.resolve(record);
    }),
    findMany: jest.fn(({ where, include } = {}) => {
      let records = Array.from(store.values());
      if (where) {
        records = records.filter(r => {
          return Object.entries(where).every(([key, value]) => {
            if (value === undefined) return true;
            return r[key] === value;
          });
        });
      }
      return Promise.resolve(records);
    }),
    update: jest.fn(({ where, data }) => {
      const record = store.get(where.id);
      if (!record) return Promise.resolve(null);
      const updated = { ...record, ...data, updatedAt: new Date() };
      store.set(where.id, updated);
      return Promise.resolve(updated);
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
      store.forEach(record => {
        const matches = Object.entries(where).every(([key, value]) => record[key] === value);
        if (matches) count++;
      });
      return Promise.resolve(count);
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
  };

  return {
    db: {
      user: createModelMethods(stores.users, 'user', counters.user),
      organization: createModelMethods(stores.organizations, 'org', counters.org),
      load: createModelMethods(stores.loads, 'load', counters.load),
      truck: createModelMethods(stores.trucks, 'truck', counters.truck),
      notification: createModelMethods(stores.notifications, 'notification', counters.notification),
      truckPosting: createModelMethods(stores.truckPostings, 'truckPosting', counters.truckPosting),
      corridor: createModelMethods(stores.corridors, 'corridor', counters.corridor),
      financialAccount: createModelMethods(stores.financialAccounts, 'financialAccount', counters.financialAccount),
      journalEntry: createModelMethods(stores.journalEntries, 'journalEntry', counters.journalEntry),
      auditLog: {
        create: jest.fn(() => Promise.resolve({ id: 'audit-1' })),
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
      loadEvent: {
        create: jest.fn(() => Promise.resolve({ id: 'event-1' })),
      },
      $transaction: jest.fn((callback) => {
        if (typeof callback === 'function') {
          return callback({});
        }
        return Promise.resolve();
      }),
      // Helper to clear all stores between tests if needed
      _clearStores: () => {
        Object.values(stores).forEach(store => store.clear());
      },
    },
  };
});

// Mock jose library to handle ESM imports in Jest
jest.mock('jose', () => {
  const crypto = require('crypto');

  return {
    SignJWT: class SignJWT {
      constructor(payload) {
        this.payload = payload;
      }

      setProtectedHeader() {
        return this;
      }

      setIssuedAt() {
        return this;
      }

      setExpirationTime() {
        return this;
      }

      async sign(secret) {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify(this.payload)).toString('base64url');
        const signature = crypto
          .createHmac('sha256', secret)
          .update(`${header}.${payload}`)
          .digest('base64url');

        return `${header}.${payload}.${signature}`;
      }
    },

    jwtVerify: async (token, secret) => {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      // Verify signature
      const header = parts[0];
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${header}.${parts[1]}`)
        .digest('base64url');

      if (parts[2] !== expectedSignature) {
        throw new Error('Invalid signature');
      }

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
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
