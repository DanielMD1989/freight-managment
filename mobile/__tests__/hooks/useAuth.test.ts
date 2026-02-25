/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for auth hooks — Zustand selector hooks verify correct store field selection
 */

// Mock the auth store with controllable state
let mockStoreState: any = {
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,
  mfaPending: false,
  mfaToken: null,
};

jest.mock("../../src/stores/auth", () => ({
  useAuthStore: (selector: (s: any) => any) => selector(mockStoreState),
}));

import {
  useCurrentUser,
  useIsAuthenticated,
  useUserRole,
  useIsAuthInitialized,
  useIsAuthLoading,
} from "../../src/hooks/useAuth";

describe("Auth Hooks", () => {
  beforeEach(() => {
    // Reset to default logged-out state
    mockStoreState = {
      user: null,
      isLoading: false,
      isInitialized: false,
      error: null,
      mfaPending: false,
      mfaToken: null,
    };
  });

  // ---- useCurrentUser ----

  describe("useCurrentUser", () => {
    it("should return null when logged out", () => {
      expect(useCurrentUser()).toBeNull();
    });

    it("should return user object when logged in", () => {
      mockStoreState.user = {
        id: "u1",
        email: "test@test.com",
        role: "SHIPPER",
        status: "ACTIVE",
        firstName: "John",
        lastName: "Doe",
        organizationId: "org-1",
      };

      const user = useCurrentUser();
      expect(user).toBeDefined();
      expect(user!.id).toBe("u1");
      expect(user!.email).toBe("test@test.com");
    });
  });

  // ---- useIsAuthenticated ----

  describe("useIsAuthenticated", () => {
    it("should return false when user is null", () => {
      expect(useIsAuthenticated()).toBe(false);
    });

    it("should return true when user is set", () => {
      mockStoreState.user = {
        id: "u1",
        email: "test@test.com",
        role: "CARRIER",
        status: "ACTIVE",
        firstName: "A",
        lastName: "B",
        organizationId: null,
      };

      expect(useIsAuthenticated()).toBe(true);
    });
  });

  // ---- useUserRole ----

  describe("useUserRole", () => {
    it("should return null when user is null", () => {
      expect(useUserRole()).toBeNull();
    });

    it("should return user.role when user is set", () => {
      mockStoreState.user = {
        id: "u1",
        email: "test@test.com",
        role: "SHIPPER",
        status: "ACTIVE",
        firstName: "A",
        lastName: "B",
        organizationId: null,
      };

      expect(useUserRole()).toBe("SHIPPER");
    });

    it("should return CARRIER role correctly", () => {
      mockStoreState.user = {
        id: "u2",
        email: "carrier@test.com",
        role: "CARRIER",
        status: "ACTIVE",
        firstName: "C",
        lastName: "D",
        organizationId: "org-1",
      };

      expect(useUserRole()).toBe("CARRIER");
    });
  });

  // ---- useIsAuthInitialized ----

  describe("useIsAuthInitialized", () => {
    it("should return false initially", () => {
      expect(useIsAuthInitialized()).toBe(false);
    });

    it("should return true after initialization", () => {
      mockStoreState.isInitialized = true;
      expect(useIsAuthInitialized()).toBe(true);
    });
  });

  // ---- useIsAuthLoading ----

  describe("useIsAuthLoading", () => {
    it("should return false when not loading", () => {
      expect(useIsAuthLoading()).toBe(false);
    });

    it("should return true when loading", () => {
      mockStoreState.isLoading = true;
      expect(useIsAuthLoading()).toBe(true);
    });
  });
});
