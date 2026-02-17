"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { setCSRFToken } from "@/lib/csrfFetch";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const [mfaOtp, setMfaOtp] = useState("");
  const [phoneLastFour, setPhoneLastFour] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Check if MFA is required
      if (data.mfaRequired) {
        setMfaRequired(true);
        setMfaToken(data.mfaToken);
        setPhoneLastFour(data.phoneLastFour || "****");
        toast.success("Verification code sent to your phone");
        return;
      }

      // Cache CSRF token from login response for subsequent requests
      if (data.csrfToken) {
        setCSRFToken(data.csrfToken);
      }

      toast.success("Login successful! Redirecting...");
      router.push(redirect);
      router.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFAVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-mfa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mfaToken,
          otp: useRecoveryCode ? undefined : mfaOtp,
          recoveryCode: useRecoveryCode ? recoveryCode : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      // Cache CSRF token
      if (data.csrfToken) {
        setCSRFToken(data.csrfToken);
      }

      // Show warning if recovery code was used
      if (data.warning) {
        toast.success(data.warning);
      } else {
        toast.success("Login successful! Redirecting...");
      }

      router.push(redirect);
      router.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Brand */}
      <div className="via-primary-900 relative hidden overflow-hidden bg-gradient-to-br from-slate-900 to-slate-900 lg:flex lg:w-1/2">
        {/* Decorative Elements */}
        <div className="absolute inset-0">
          <div className="bg-primary-600/20 absolute top-0 left-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"></div>
          <div className="bg-accent-600/20 absolute right-0 bottom-0 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16">
          {/* Logo */}
          <div className="mb-12 flex items-center gap-4">
            <div className="from-primary-500 to-primary-600 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-xl">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">FreightET</span>
          </div>

          <h1 className="mb-6 text-4xl leading-tight font-bold text-white">
            Ethiopia&apos;s Leading
            <br />
            <span className="text-primary-400">Freight Platform</span>
          </h1>

          <p className="mb-10 max-w-md text-lg text-slate-300">
            Connect shippers with carriers, manage your fleet, and streamline
            logistics operations across Ethiopia.
          </p>

          {/* Features */}
          <div className="space-y-4">
            {[
              "Real-time GPS tracking",
              "Smart load matching",
              "Secure digital payments",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-200">
                <div className="bg-primary-500/30 flex h-6 w-6 items-center justify-center rounded-full">
                  <svg
                    className="text-primary-400 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex w-full items-center justify-center bg-slate-50 px-6 py-12 lg:w-1/2 dark:bg-slate-950">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="mb-10 flex items-center justify-center gap-3 lg:hidden">
            <div className="from-primary-500 to-primary-600 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg">
              <svg
                className="h-7 w-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              FreightET
            </span>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {mfaRequired ? "Verify your identity" : "Welcome back"}
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              {mfaRequired
                ? "Enter the verification code sent to your phone"
                : "Sign in to your account to continue"}
            </p>
          </div>

          {/* MFA Verification Form */}
          {mfaRequired ? (
            <form className="space-y-5" onSubmit={handleMFAVerify}>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
              )}

              <div className="bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary-100 dark:bg-primary-800 rounded-lg p-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="text-primary-600 dark:text-primary-400 h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-primary-800 dark:text-primary-300 text-sm font-medium">
                      Two-factor authentication
                    </p>
                    <p className="text-primary-600 dark:text-primary-400 text-xs">
                      Code sent to ****{phoneLastFour}
                    </p>
                  </div>
                </div>
              </div>

              {!useRecoveryCode ? (
                <div>
                  <label
                    htmlFor="otp"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Verification code
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={mfaOtp}
                    onChange={(e) =>
                      setMfaOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    maxLength={6}
                    className="focus:ring-primary-600 dark:focus:ring-primary-500 block w-full rounded-xl border-0 bg-white px-4 py-3 text-center font-mono text-2xl tracking-widest text-slate-900 ring-1 ring-slate-300 transition-all ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                    placeholder="000000"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="recovery"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Recovery code
                  </label>
                  <input
                    id="recovery"
                    name="recovery"
                    type="text"
                    required
                    value={recoveryCode}
                    onChange={(e) =>
                      setRecoveryCode(e.target.value.toUpperCase())
                    }
                    className="focus:ring-primary-600 dark:focus:ring-primary-500 block w-full rounded-xl border-0 bg-white px-4 py-3 text-center font-mono text-lg tracking-widest text-slate-900 ring-1 ring-slate-300 transition-all ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                    placeholder="XXXX-XXXX"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isLoading ||
                  (!useRecoveryCode && mfaOtp.length !== 6) ||
                  (useRecoveryCode && !recoveryCode)
                }
                className="from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-700 shadow-primary-500/25 hover:shadow-primary-500/30 flex w-full justify-center rounded-xl bg-gradient-to-r px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  "Verify"
                )}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode(!useRecoveryCode);
                    setMfaOtp("");
                    setRecoveryCode("");
                  }}
                  className="text-primary-600 hover:text-primary-500 dark:text-primary-400 font-medium"
                >
                  {useRecoveryCode
                    ? "Use verification code"
                    : "Use recovery code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaRequired(false);
                    setMfaToken("");
                    setMfaOtp("");
                    setRecoveryCode("");
                    setError("");
                  }}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                >
                  Back to login
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-primary-600 dark:focus:ring-primary-500 block w-full rounded-xl border-0 bg-white px-4 py-3 text-slate-900 ring-1 ring-slate-300 transition-all ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-primary-600 hover:text-primary-500 dark:text-primary-400 text-sm font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-primary-600 dark:focus:ring-primary-500 block w-full rounded-xl border-0 bg-white px-4 py-3 text-slate-900 ring-1 ring-slate-300 transition-all ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-700 shadow-primary-500/25 hover:shadow-primary-500/30 flex w-full justify-center rounded-xl bg-gradient-to-r px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-slate-50 px-4 text-slate-500 dark:bg-slate-950">
                    New to FreightET?
                  </span>
                </div>
              </div>

              <Link
                href="/register"
                className="text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 ring-primary-200 dark:ring-primary-800 flex w-full justify-center rounded-xl px-6 py-3 text-sm font-semibold ring-1 transition-all duration-200"
              >
                Create an account
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="border-primary-600 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"></div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
