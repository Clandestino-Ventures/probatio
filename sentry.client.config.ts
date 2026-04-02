import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",

  ignoreErrors: [
    "ResizeObserver loop",
    "Network request failed",
    "Load failed",
    "ChunkLoadError",
    /^Non-Error promise rejection/,
  ],

  initialScope: {
    tags: { app: "probatio" },
  },
});
