/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for auth Zustand store
 */
import { useAuthStore } from "../../src/stores/auth";

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock the API client
jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    defaults: { headers: { common: {} } },
  },
  saveAuth: jest.fn().mockResolvedValue(undefined),
  clearAuth: jest.fn().mockResolvedValue(undefined),
  isAuthenticated: jest.fn().mockResolvedValue(false),
  setOnUnauthorized: jest.fn(),
}));

// Mock auth service
const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockVerifyMfa = jest.fn();

jest.mock("../../src/services/auth", () => ({
  authService: {
    login: (...args: any[]) => mockLogin(...args),
    register: (...args: any[]) => mockRegister(...args),
    getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
    logout: (...args: any[]) => mockLogout(...args),
    verifyMfa: (...args: any[]) => mockVerifyMfa(...args),
  },
}));

describe("Auth Store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isInitialized: false,
      error: null,
      mfaPending: false,
      mfaToken: null,
    });
  });

  it("should have correct initial state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.isInitialized).toBe(false);
    expect(state.error).toBeNull();
    expect(state.mfaPending).toBe(false);
    expect(state.mfaToken).toBeNull();
  });

  it("should clear error", () => {
    useAuthStore.setState({ error: "Some error" });
    expect(useAuthStore.getState().error).toBe("Some error");

    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("should set loading state during login", async () => {
    mockLogin.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                user: {
                  id: "1",
                  email: "test@test.com",
                  role: "CARRIER",
                  status: "ACTIVE",
                  firstName: "John",
                  lastName: "Doe",
                  organizationId: null,
                },
                sessionToken: "token123",
              }),
            50
          )
        )
    );

    const loginPromise = useAuthStore
      .getState()
      .login("test@test.com", "password");
    expect(useAuthStore.getState().isLoading).toBe(true);

    await loginPromise;
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("should set user on successful login", async () => {
    const mockUser = {
      id: "1",
      email: "carrier@test.com",
      firstName: "John",
      lastName: "Doe",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: null,
    };
    mockLogin.mockResolvedValue({
      user: mockUser,
      sessionToken: "token123",
      csrfToken: "csrf123",
    });

    await useAuthStore.getState().login("carrier@test.com", "password");

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("should pass LoginPayload to authService.login", async () => {
    mockLogin.mockResolvedValue({
      user: {
        id: "1",
        email: "a@b.com",
        firstName: null,
        lastName: null,
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: null,
      },
      sessionToken: "tok",
    });

    await useAuthStore.getState().login("a@b.com", "pass123");

    expect(mockLogin).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pass123",
    });
  });

  it("should handle MFA requirement", async () => {
    mockLogin.mockResolvedValue({
      user: {
        id: "",
        email: "user@test.com",
        firstName: null,
        lastName: null,
        role: "",
        status: "",
        organizationId: null,
      },
      requiresMfa: true,
      mfaToken: "mfa-token-123",
    });

    await useAuthStore.getState().login("user@test.com", "password");

    const state = useAuthStore.getState();
    expect(state.mfaPending).toBe(true);
    expect(state.mfaToken).toBe("mfa-token-123");
    // User should not be set during MFA
    expect(state.user).toBeNull();
  });

  it("should handle login error", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));

    await expect(
      useAuthStore.getState().login("wrong@test.com", "wrong")
    ).rejects.toThrow("Invalid credentials");

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.error).toBe("Invalid credentials");
    expect(state.isLoading).toBe(false);
  });

  it("should clear user on logout", async () => {
    useAuthStore.setState({
      user: {
        id: "1",
        email: "test@test.com",
        firstName: "T",
        lastName: "U",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: null,
      },
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.mfaPending).toBe(false);
    expect(state.mfaToken).toBeNull();
    expect(state.error).toBeNull();
  });

  it("should verify MFA and set user", async () => {
    // Set up MFA pending state
    useAuthStore.setState({
      mfaPending: true,
      mfaToken: "mfa-tok",
    });

    const mockUser = {
      id: "1",
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: null,
    };
    mockVerifyMfa.mockResolvedValue({
      user: mockUser,
      sessionToken: "session-tok",
      csrfToken: "csrf-tok",
    });

    await useAuthStore.getState().verifyMfa("123456");

    expect(mockVerifyMfa).toHaveBeenCalledWith({
      mfaToken: "mfa-tok",
      code: "123456",
    });
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.mfaPending).toBe(false);
    expect(state.mfaToken).toBeNull();
  });
});
