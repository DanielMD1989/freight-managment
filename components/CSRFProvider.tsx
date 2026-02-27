/**
 * CSRF Provider Component
 *
 * Initializes CSRF token when app loads for authenticated users
 * Sprint 9 - Story 9.6: CSRF Protection Enhancement
 */

"use client";

import { useEffect } from "react";
import { initializeCSRFToken } from "@/lib/csrfFetch";

export default function CSRFProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Initialize CSRF token on mount
    initializeCSRFToken().catch((error) => {
      // Silently fail - user might not be logged in yet
      console.debug("CSRF token initialization skipped:", error);
    });
  }, []);

  return <>{children}</>;
}
