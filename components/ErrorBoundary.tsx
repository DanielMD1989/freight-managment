"use client";

/**
 * Error Boundary Component
 *
 * Catches React errors and displays fallback UI
 * Sprint 14 - Phase 6: Polish & Optimization
 */

import React, { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send to error reporting service (e.g., Sentry)
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#f0fdfa] p-6">
          <div className="w-full max-w-2xl rounded-lg border border-[#064d51]/15 bg-white p-8 shadow-lg">
            <div className="mb-6 flex items-center">
              <div className="mr-4 rounded-full bg-red-100 p-3">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#064d51]">
                Something went wrong
              </h2>
            </div>

            <p className="mb-6 text-[#064d51]/70">
              We apologize for the inconvenience. An unexpected error occurred
              while loading this page.
            </p>

            {/* Error details (only in development) */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-6 overflow-auto rounded-lg border border-[#064d51]/10 bg-[#f0fdfa] p-4">
                <h3 className="mb-2 text-sm font-semibold text-[#064d51]">
                  Error Details:
                </h3>
                <pre className="text-xs whitespace-pre-wrap text-red-600">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-[#064d51]/80 hover:text-[#064d51]">
                      Component Stack
                    </summary>
                    <pre className="mt-2 text-xs whitespace-pre-wrap text-[#064d51]/70">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={this.handleReset}
                className="rounded-md bg-[#1e9c99] px-6 py-2 font-medium text-white transition-colors hover:bg-[#064d51]"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="rounded-md bg-[#064d51]/10 px-6 py-2 font-medium text-[#064d51]/80 transition-colors hover:bg-[#064d51]/20"
              >
                Go to Home
              </button>
            </div>

            {/* Help text */}
            <p className="mt-6 text-sm text-[#064d51]/60">
              If this problem persists, please contact support or try refreshing
              the page.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
