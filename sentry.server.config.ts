// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Request paths that only ever come from vulnerability scanners. Rendering
// them is already a 404; reporting them is pure noise.
const SCAN_PATH_PATTERNS = [
  /\.env/i,
  /\.git/i,
  /\/wp-(admin|content|includes|login)/i,
  /\.php$/i,
  /\/RSC\//i,
];

// User agents that generate traffic we do not want error-tracked. The Sentry
// uptime monitor in particular hits the homepage constantly and turned every
// transient DB blip into a fresh event.
const IGNORED_USER_AGENTS = [/SentryUptimeBot/i];

// Only initialize Sentry in production
if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: "https://ec274f6c76f33524ceccd9436378c9c6@o4510566655524864.ingest.de.sentry.io/4510566658408528",

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 0.1,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Enable sending user PII (Personally Identifiable Information)
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: true,

    ignoreErrors: [
      // Client hung up before the response finished - not a server fault.
      "aborted",
      // Scanner POSTing a non-form body to a page route.
      "Failed to parse body as FormData",
      // Stale page submitting into a new deployment. Surfaced to the visitor
      // as a reload prompt in (frontend)/error.tsx.
      "Failed to find Server Action",
    ],

    // Keep this narrow. The failure mode here is silently swallowing a real
    // regression, so every rule below must be justified by a known-noise
    // source rather than by error text alone.
    beforeSend(event) {
      const url = event.request?.url;
      if (url && SCAN_PATH_PATTERNS.some((pattern) => pattern.test(url))) {
        return null;
      }

      const headers = event.request?.headers;
      const userAgent = headers?.["User-Agent"] ?? headers?.["user-agent"];
      if (
        userAgent &&
        IGNORED_USER_AGENTS.some((pattern) => pattern.test(userAgent))
      ) {
        return null;
      }

      return event;
    },
  });
}
