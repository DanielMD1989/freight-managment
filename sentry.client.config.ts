/**
 * Sentry Client Configuration
 *
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a users loads a page in their browser.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment (development, staging, production)
  environment: process.env.NODE_ENV,

  // Adjust this value in production, or use tracesSampler for greater control
  // In production, sample 10% of transactions. In development, sample all.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Session Replay
  // This sets the sample rate to be 10% in production.
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

  // If you're not already sampling the entire session, change the sample rate to 100% when
  // sampling sessions where errors occur.
  replaysOnErrorSampleRate: 1.0,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out known non-critical errors
  beforeSend(event) {
    // Filter out ResizeObserver errors (browser noise)
    if (event.exception?.values?.[0]?.value?.includes("ResizeObserver")) {
      return null;
    }

    // Filter out network errors that are likely user connectivity issues
    if (
      event.exception?.values?.[0]?.type === "TypeError" &&
      event.exception?.values?.[0]?.value?.includes("Failed to fetch")
    ) {
      return null;
    }

    return event;
  },
});
