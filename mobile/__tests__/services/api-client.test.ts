/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for API client — auth management, error messages, storage keys
 */

// Mock expo-secure-store before any imports
const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock("expo-secure-store", () => ({
  getItemAsync: (...args: any[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: any[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: any[]) => mockDeleteItemAsync(...args),
}));

jest.mock("expo-constants", () => ({
  expoConfig: { extra: { apiBaseUrl: "http://localhost:3000" } },
}));

// Mock Platform as native (not web) by default
let mockPlatformOS = "ios";
jest.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
    select: jest.fn(),
  },
}));

// Mock axios — we need isAxiosError to work correctly
jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return {
    ...actual,
    create: () => ({
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    }),
    isAxiosError: (err: any) => err?.isAxiosError === true,
  };
});

import {
  STORAGE_KEYS,
  saveAuth,
  clearAuth,
  isAuthenticated,
  getCurrentUserId,
  getCurrentUserRole,
  getErrorMessage,
} from "../../src/api/client";

describe("API Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformOS = "ios";
  });

  // ---- STORAGE_KEYS ----

  describe("STORAGE_KEYS", () => {
    it("should have correct key names", () => {
      expect(STORAGE_KEYS.SESSION_TOKEN).toBe("session_token");
      expect(STORAGE_KEYS.CSRF_TOKEN).toBe("csrf_token");
      expect(STORAGE_KEYS.USER_ID).toBe("user_id");
      expect(STORAGE_KEYS.USER_ROLE).toBe("user_role");
    });

    it("should have exactly 4 keys", () => {
      expect(Object.keys(STORAGE_KEYS)).toHaveLength(4);
    });
  });

  // ---- saveAuth ----

  describe("saveAuth", () => {
    it("should write sessionToken, csrfToken, userId, userRole to storage", async () => {
      mockSetItemAsync.mockResolvedValue(undefined);

      await saveAuth({
        sessionToken: "tok-123",
        csrfToken: "csrf-456",
        userId: "u1",
        userRole: "CARRIER",
      });

      expect(mockSetItemAsync).toHaveBeenCalledWith("session_token", "tok-123");
      expect(mockSetItemAsync).toHaveBeenCalledWith("csrf_token", "csrf-456");
      expect(mockSetItemAsync).toHaveBeenCalledWith("user_id", "u1");
      expect(mockSetItemAsync).toHaveBeenCalledWith("user_role", "CARRIER");
      expect(mockSetItemAsync).toHaveBeenCalledTimes(4);
    });

    it("should skip csrfToken when not provided", async () => {
      mockSetItemAsync.mockResolvedValue(undefined);

      await saveAuth({
        sessionToken: "tok-123",
        userId: "u1",
        userRole: "SHIPPER",
      });

      expect(mockSetItemAsync).toHaveBeenCalledWith("session_token", "tok-123");
      expect(mockSetItemAsync).toHaveBeenCalledWith("user_id", "u1");
      expect(mockSetItemAsync).toHaveBeenCalledWith("user_role", "SHIPPER");
      // No csrf_token call
      expect(mockSetItemAsync).not.toHaveBeenCalledWith(
        "csrf_token",
        expect.anything()
      );
      expect(mockSetItemAsync).toHaveBeenCalledTimes(3);
    });
  });

  // ---- clearAuth ----

  describe("clearAuth", () => {
    it("should delete all 4 storage keys", async () => {
      mockDeleteItemAsync.mockResolvedValue(undefined);

      await clearAuth();

      expect(mockDeleteItemAsync).toHaveBeenCalledWith("session_token");
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("csrf_token");
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("user_id");
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("user_role");
      expect(mockDeleteItemAsync).toHaveBeenCalledTimes(4);
    });
  });

  // ---- isAuthenticated ----

  describe("isAuthenticated", () => {
    it("should return true when token exists (native)", async () => {
      mockPlatformOS = "ios";
      mockGetItemAsync.mockResolvedValue("tok-123");

      const result = await isAuthenticated();
      expect(result).toBe(true);
      expect(mockGetItemAsync).toHaveBeenCalledWith("session_token");
    });

    it("should return false when token is null (native)", async () => {
      mockPlatformOS = "ios";
      mockGetItemAsync.mockResolvedValue(null);

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });
  });

  // ---- getCurrentUserId ----

  describe("getCurrentUserId", () => {
    it("should read user_id from storage", async () => {
      mockGetItemAsync.mockResolvedValue("user-42");

      const result = await getCurrentUserId();
      expect(result).toBe("user-42");
      expect(mockGetItemAsync).toHaveBeenCalledWith("user_id");
    });

    it("should return null when not set", async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const result = await getCurrentUserId();
      expect(result).toBeNull();
    });
  });

  // ---- getCurrentUserRole ----

  describe("getCurrentUserRole", () => {
    it("should read user_role from storage", async () => {
      mockGetItemAsync.mockResolvedValue("CARRIER");

      const result = await getCurrentUserRole();
      expect(result).toBe("CARRIER");
      expect(mockGetItemAsync).toHaveBeenCalledWith("user_role");
    });

    it("should return null when not set", async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const result = await getCurrentUserRole();
      expect(result).toBeNull();
    });
  });

  // ---- getErrorMessage ----

  describe("getErrorMessage", () => {
    it("should extract response.data.error string from Axios error", () => {
      const err = {
        isAxiosError: true,
        response: { data: { error: "Invalid email format" } },
      };

      expect(getErrorMessage(err)).toBe("Invalid email format");
    });

    it('should return "Connection timed out..." for ECONNABORTED', () => {
      const err = {
        isAxiosError: true,
        code: "ECONNABORTED",
      };

      expect(getErrorMessage(err)).toBe(
        "Connection timed out. Please check your internet."
      );
    });

    it("should return platform-aware message for ERR_NETWORK (ios)", () => {
      mockPlatformOS = "ios";
      const err = {
        isAxiosError: true,
        code: "ERR_NETWORK",
      };

      expect(getErrorMessage(err)).toBe("No internet connection.");
    });

    it("should return CORS message for ERR_NETWORK (web)", () => {
      mockPlatformOS = "web";
      const err = {
        isAxiosError: true,
        code: "ERR_NETWORK",
      };

      expect(getErrorMessage(err)).toBe(
        "Connection failed. This may be a CORS issue."
      );
    });

    it('should return "Request cancelled." for ERR_CANCELED', () => {
      const err = {
        isAxiosError: true,
        code: "ERR_CANCELED",
      };

      expect(getErrorMessage(err)).toBe("Request cancelled.");
    });

    it('should return "Something went wrong..." for unknown Axios error code', () => {
      const err = {
        isAxiosError: true,
        code: "UNKNOWN_CODE",
      };

      expect(getErrorMessage(err)).toBe(
        "Something went wrong. Please try again."
      );
    });

    it("should return .message for standard Error", () => {
      const err = new Error("Custom error message");

      expect(getErrorMessage(err)).toBe("Custom error message");
    });

    it('should return "An unexpected error occurred." for non-Error value', () => {
      expect(getErrorMessage("string error")).toBe(
        "An unexpected error occurred."
      );
      expect(getErrorMessage(42)).toBe("An unexpected error occurred.");
      expect(getErrorMessage(null)).toBe("An unexpected error occurred.");
    });
  });
});
