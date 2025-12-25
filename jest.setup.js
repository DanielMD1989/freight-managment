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
process.env.DATABASE_URL = 'postgresql://test@localhost:5432/freight_test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.EMAIL_PROVIDER = 'console';

// Mock Prisma client for tests
jest.mock('@/lib/db', () => {
  let userIdCounter = 1;
  let orgIdCounter = 1;
  let loadIdCounter = 1;
  let truckIdCounter = 1;

  return {
    db: {
      user: {
        create: jest.fn(({ data }) => Promise.resolve({
          id: `user-${userIdCounter++}`,
          email: data.email,
          password: data.password,
          name: data.name,
          role: data.role,
          organizationId: data.organizationId || null,
          emailVerified: data.emailVerified || false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findUnique: jest.fn(),
        findMany: jest.fn(() => Promise.resolve([])),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
      },
      organization: {
        create: jest.fn(({ data }) => Promise.resolve({
          id: `org-${orgIdCounter++}`,
          name: data.name,
          type: data.type,
          verificationStatus: data.verificationStatus || 'PENDING',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findUnique: jest.fn(),
        findMany: jest.fn(() => Promise.resolve([])),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
      },
      load: {
        create: jest.fn(({ data }) => Promise.resolve({
          id: `load-${loadIdCounter++}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findUnique: jest.fn(),
        findMany: jest.fn(() => Promise.resolve([])),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
      },
      truck: {
        create: jest.fn(({ data }) => Promise.resolve({
          id: `truck-${truckIdCounter++}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findUnique: jest.fn(),
        findMany: jest.fn(() => Promise.resolve([])),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
      },
      auditLog: {
        create: jest.fn(() => Promise.resolve({ id: 'audit-1' })),
        createMany: jest.fn(() => Promise.resolve({ count: 0 })),
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
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
      $transaction: jest.fn((callback) => {
        if (typeof callback === 'function') {
          return callback({});
        }
        return Promise.resolve();
      }),
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
