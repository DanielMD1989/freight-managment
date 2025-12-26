'use client';

/**
 * Error Boundary Component
 *
 * Catches React errors and displays fallback UI
 * Sprint 14 - Phase 6: Polish & Optimization
 */

import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
            <div className="flex items-center mb-6">
              <div className="bg-red-100 rounded-full p-3 mr-4">
                <svg
                  className="w-8 h-8 text-red-600"
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
              <h2 className="text-2xl font-bold text-gray-900">
                Something went wrong
              </h2>
            </div>

            <p className="text-gray-600 mb-6">
              We apologize for the inconvenience. An unexpected error occurred while loading this page.
            </p>

            {/* Error details (only in development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-gray-100 rounded-lg p-4 mb-6 overflow-auto">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Error Details:</h3>
                <pre className="text-xs text-red-600 whitespace-pre-wrap">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                      Component Stack
                    </summary>
                    <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={this.handleReset}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                Go to Dashboard
              </button>
            </div>

            {/* Help text */}
            <p className="mt-6 text-sm text-gray-500">
              If this problem persists, please contact support or try refreshing the page.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
