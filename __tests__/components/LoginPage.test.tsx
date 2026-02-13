/**
 * @jest-environment jsdom
 */

/**
 * LoginPage Component Tests
 *
 * Tests for the login page including:
 * - Form rendering
 * - Form validation
 * - Login submission
 * - MFA flow
 * - Error handling
 * - Loading states
 * - Navigation
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";

// Mock next/navigation
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: jest.fn().mockReturnValue(null),
  }),
}));

// Mock next/link
jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: function MockLink({
      children,
      href,
    }: {
      children: React.ReactNode;
      href: string;
    }) {
      return <a href={href}>{children}</a>;
    },
  };
});

// Mock useToast
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
};
jest.mock("@/components/Toast", () => ({
  useToast: () => mockToast,
}));

// Mock setCSRFToken
jest.mock("@/lib/csrfFetch", () => ({
  setCSRFToken: jest.fn(),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  // ============================================================================
  // BASIC RENDERING
  // ============================================================================
  describe("Basic Rendering", () => {
    it("renders the login form", async () => {
      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByText("Welcome back")).toBeInTheDocument();
      });
    });

    it("renders email and password fields", async () => {
      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
        expect(screen.getByLabelText("Password")).toBeInTheDocument();
      });
    });

    it("renders sign in button", async () => {
      render(<LoginPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Sign in" })
        ).toBeInTheDocument();
      });
    });

    it("renders forgot password link", async () => {
      render(<LoginPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("link", { name: "Forgot password?" })
        ).toHaveAttribute("href", "/forgot-password");
      });
    });

    it("renders create account link", async () => {
      render(<LoginPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("link", { name: "Create an account" })
        ).toHaveAttribute("href", "/register");
      });
    });

    it("renders the brand name", async () => {
      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getAllByText("FreightET").length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // FORM INTERACTION
  // ============================================================================
  describe("Form Interaction", () => {
    it("allows typing in email field", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText("Email address");
      await user.type(emailInput, "test@example.com");

      expect(emailInput).toHaveValue("test@example.com");
    });

    it("allows typing in password field", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Password")).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText("Password");
      await user.type(passwordInput, "mypassword123");

      expect(passwordInput).toHaveValue("mypassword123");
    });
  });

  // ============================================================================
  // LOGIN SUBMISSION
  // ============================================================================
  describe("Login Submission", () => {
    it("submits login form with correct credentials", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, csrfToken: "token123" }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "password123",
          }),
        });
      });
    });

    it("redirects on successful login", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/");
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("shows success toast on successful login", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          "Login successful! Redirecting..."
        );
      });
    });
  });

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  describe("Loading State", () => {
    it("shows loading state while submitting", async () => {
      const user = userEvent.setup();

      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");

      // Click submit (don't await)
      user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(screen.getByText("Signing in...")).toBeInTheDocument();
      });

      // Cleanup
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it("disables submit button while loading", async () => {
      const user = userEvent.setup();

      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");

      user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        const submitButton = screen.getByRole("button", {
          name: /signing in/i,
        });
        expect(submitButton).toBeDisabled();
      });

      // Cleanup
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================
  describe("Error Handling", () => {
    it("displays error message on login failure", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Invalid credentials" }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "wrongpassword");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
    });

    it("shows error toast on login failure", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Invalid credentials" }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "wrongpassword");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Invalid credentials");
      });
    });

    it("handles network errors", async () => {
      const user = userEvent.setup();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // MFA FLOW
  // ============================================================================
  describe("MFA Flow", () => {
    it("shows MFA screen when MFA is required", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mfaRequired: true,
            mfaToken: "mfa-token-123",
            phoneLastFour: "1234",
          }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(screen.getByText("Verify your identity")).toBeInTheDocument();
        expect(
          screen.getByText("Two-factor authentication")
        ).toBeInTheDocument();
      });
    });

    it("shows phone number hint on MFA screen", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mfaRequired: true,
            mfaToken: "mfa-token-123",
            phoneLastFour: "5678",
          }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(screen.getByText("Code sent to ****5678")).toBeInTheDocument();
      });
    });

    it("shows success toast when MFA code is sent", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mfaRequired: true,
            mfaToken: "mfa-token-123",
            phoneLastFour: "1234",
          }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          "Verification code sent to your phone"
        );
      });
    });

    it("allows entering OTP code", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mfaRequired: true,
            mfaToken: "mfa-token-123",
            phoneLastFour: "1234",
          }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
      });

      const otpInput = screen.getByLabelText("Verification code");
      await user.type(otpInput, "123456");

      expect(otpInput).toHaveValue("123456");
    });

    it("verifies MFA code successfully", async () => {
      const user = userEvent.setup();
      // First call: login returns MFA required
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mfaRequired: true,
            mfaToken: "mfa-token-123",
            phoneLastFour: "1234",
          }),
      });

      // Second call: MFA verification succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      // Login
      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
      });

      // Enter OTP and verify
      await user.type(screen.getByLabelText("Verification code"), "123456");
      await user.click(screen.getByRole("button", { name: "Verify" }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/auth/verify-mfa",
          expect.any(Object)
        );
        expect(mockPush).toHaveBeenCalledWith("/");
      });
    });

    it("allows switching to recovery code input", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mfaRequired: true,
            mfaToken: "mfa-token-123",
            phoneLastFour: "1234",
          }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(screen.getByText("Use recovery code")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Use recovery code"));

      await waitFor(() => {
        expect(screen.getByLabelText("Recovery code")).toBeInTheDocument();
      });
    });

    it("allows going back to login from MFA screen", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mfaRequired: true,
            mfaToken: "mfa-token-123",
            phoneLastFour: "1234",
          }),
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText("Email address"),
        "test@example.com"
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(screen.getByText("Back to login")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Back to login"));

      await waitFor(() => {
        expect(screen.getByText("Welcome back")).toBeInTheDocument();
      });
    });
  });
});
