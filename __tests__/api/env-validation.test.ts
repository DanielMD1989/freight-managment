/**
 * Environment Validation Hardening Tests
 *
 * Tests for:
 * - verify-mfa production guard (Gap 1)
 * - CRON_SECRET startup validation (Gap 2)
 * - MFA_TOKEN_SECRET startup warning (Gap 3)
 * - ALLOWED_ORIGINS startup warning (Gap 4)
 */

import { validateConfig, Config } from "@/lib/config";

// Helper: build a production config with safe defaults
function makeProductionConfig(overrides?: Partial<Config["auth"]>): Config {
  return {
    version: "1.0.0",
    app: {
      nodeEnv: "production",
      port: 3000,
      publicUrl: "https://app.example.com",
      adminEmail: "admin@example.com",
      googleMapsApiKey: null,
      googleRoutesApiKey: null,
    },
    database: {
      url: "postgresql://prod:prod@db:5432/freight",
      poolMin: 10,
      poolMax: 100,
      healthCheckIntervalMs: 30000,
      pgBouncerEnabled: false,
    },
    auth: {
      jwtSecret: "production-secret-that-is-long-enough-32chars!",
      jwtEncryptionKey: "production-encrypt-key-32bytes!!",
      jwtExpiresIn: "7d",
      jwtEnableEncryption: true,
      nextAuthUrl: "https://app.example.com",
      nextAuthSecret: "prod-nextauth-secret",
      ...overrides,
    },
    redis: {
      enabled: true,
      url: "redis://redis:6379",
      host: "redis",
      port: 6379,
      password: null,
      db: 0,
    },
    storage: {
      provider: "s3",
      uploadDir: "uploads",
      awsRegion: "us-east-1",
      awsAccessKeyId: "AKIA...",
      awsSecretAccessKey: "secret",
      awsS3Bucket: "freight-uploads",
      cdnEnabled: false,
      cdnDomain: null,
      cloudinaryCloudName: null,
      cloudinaryApiKey: null,
      cloudinaryApiSecret: null,
    },
    email: {
      provider: "console",
      from: "noreply@example.com",
      fromName: "Freight Platform",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUser: null,
      smtpPassword: null,
      sendgridApiKey: null,
      resendApiKey: null,
    },
    sms: {
      afromessageApiKey: null,
      afromessageSenderName: "FreightMgt",
    },
    monitoring: {
      enabled: true,
      apiKey: null,
      cpuThreshold: 80,
      memoryThreshold: 85,
      slowQueryThresholdMs: 1000,
      errorRateThreshold: 5,
      eventLoopThresholdMs: 100,
      checkIntervalMs: 60000,
    },
    logging: {
      level: "info",
      format: "json",
      sampleRate: 1,
      requestLogging: true,
    },
    rateLimit: {
      enabled: true,
      bypassKey: null,
    },
    featureFlags: {
      selfDispatch: true,
      notifications: false,
      emailVerification: false,
    },
    gps: {
      serverPort: 5001,
      serverHost: "0.0.0.0",
    },
    payment: {
      chapaSecretKey: null,
      chapaPublicKey: null,
      chapaWebhookSecret: null,
    },
  };
}

describe("Environment Validation Hardening", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Isolate env mutations per test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ── Gap 1: verify-mfa production guard ──────────────────────────

  describe("verify-mfa production guard", () => {
    it("throws when both MFA_TOKEN_SECRET and JWT_SECRET are missing in production", async () => {
      // Clear secrets and set production mode
      delete process.env.MFA_TOKEN_SECRET;
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = "production";

      jest.resetModules();

      // Import chain (lib/auth → verify-mfa) will throw on missing secrets
      await expect(import("@/app/api/auth/verify-mfa/route")).rejects.toThrow(
        /must be set in production/
      );
    });

    it("does not throw when JWT_SECRET and JWT_ENCRYPTION_KEY are set in production", async () => {
      delete process.env.MFA_TOKEN_SECRET;
      process.env.JWT_SECRET = "prod-jwt-secret-that-is-32-chars!";
      process.env.JWT_ENCRYPTION_KEY = "prod-encrypt-key-that-is-32bytes";
      process.env.NODE_ENV = "production";

      jest.resetModules();

      await expect(
        import("@/app/api/auth/verify-mfa/route")
      ).resolves.toBeDefined();
    });

    it("does not throw in development even without secrets", async () => {
      delete process.env.MFA_TOKEN_SECRET;
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = "development";

      jest.resetModules();

      await expect(
        import("@/app/api/auth/verify-mfa/route")
      ).resolves.toBeDefined();
    });
  });

  // ── Gap 2: CRON_SECRET startup validation ───────────────────────

  describe("CRON_SECRET startup validation", () => {
    it("returns error when CRON_SECRET is missing in production", () => {
      delete process.env.CRON_SECRET;

      const cfg = makeProductionConfig();
      const errors = validateConfig(cfg);
      const cronError = errors.find((e) => e.field === "CRON_SECRET");

      expect(cronError).toBeDefined();
      expect(cronError!.severity).toBe("error");
      expect(cronError!.message).toContain(
        "CRON_SECRET is required in production"
      );
    });

    it("returns no CRON_SECRET error when set in production", () => {
      process.env.CRON_SECRET = "my-cron-secret";

      const cfg = makeProductionConfig();
      const errors = validateConfig(cfg);
      const cronError = errors.find((e) => e.field === "CRON_SECRET");

      expect(cronError).toBeUndefined();
    });
  });

  // ── Gap 3: MFA_TOKEN_SECRET startup warning ─────────────────────

  describe("MFA_TOKEN_SECRET startup warning", () => {
    it("returns warning when MFA_TOKEN_SECRET is missing in production", () => {
      delete process.env.MFA_TOKEN_SECRET;
      process.env.CRON_SECRET = "set";

      const cfg = makeProductionConfig();
      const errors = validateConfig(cfg);
      const mfaWarning = errors.find((e) => e.field === "MFA_TOKEN_SECRET");

      expect(mfaWarning).toBeDefined();
      expect(mfaWarning!.severity).toBe("warning");
      expect(mfaWarning!.message).toContain("falling back to JWT_SECRET");
    });

    it("returns no MFA_TOKEN_SECRET warning when set in production", () => {
      process.env.MFA_TOKEN_SECRET = "my-mfa-secret";
      process.env.CRON_SECRET = "set";

      const cfg = makeProductionConfig();
      const errors = validateConfig(cfg);
      const mfaWarning = errors.find((e) => e.field === "MFA_TOKEN_SECRET");

      expect(mfaWarning).toBeUndefined();
    });
  });

  // ── Gap 4: ALLOWED_ORIGINS startup warning ──────────────────────

  describe("ALLOWED_ORIGINS startup warning", () => {
    it("returns warning when ALLOWED_ORIGINS is not set in production", () => {
      delete process.env.ALLOWED_ORIGINS;
      process.env.CRON_SECRET = "set";
      process.env.MFA_TOKEN_SECRET = "set";

      const cfg = makeProductionConfig();
      const errors = validateConfig(cfg);
      const originsWarning = errors.find((e) => e.field === "ALLOWED_ORIGINS");

      expect(originsWarning).toBeDefined();
      expect(originsWarning!.severity).toBe("warning");
      expect(originsWarning!.message).toContain("ALLOWED_ORIGINS not set");
    });

    it("returns warning when ALLOWED_ORIGINS contains localhost in production", () => {
      process.env.ALLOWED_ORIGINS =
        "https://app.example.com,http://localhost:3000";
      process.env.CRON_SECRET = "set";
      process.env.MFA_TOKEN_SECRET = "set";

      const cfg = makeProductionConfig();
      const errors = validateConfig(cfg);
      const originsWarning = errors.find((e) => e.field === "ALLOWED_ORIGINS");

      expect(originsWarning).toBeDefined();
      expect(originsWarning!.severity).toBe("warning");
      expect(originsWarning!.message).toContain("contains localhost");
    });

    it("returns no warning when ALLOWED_ORIGINS is properly configured", () => {
      process.env.ALLOWED_ORIGINS =
        "https://app.example.com,https://admin.example.com";
      process.env.CRON_SECRET = "set";
      process.env.MFA_TOKEN_SECRET = "set";

      const cfg = makeProductionConfig();
      const errors = validateConfig(cfg);
      const originsWarning = errors.find((e) => e.field === "ALLOWED_ORIGINS");

      expect(originsWarning).toBeUndefined();
    });
  });
});
