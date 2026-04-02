/**
 * PROBATIO — Product Analytics (PostHog)
 *
 * Tracks key user events for product decisions.
 * Only active in production when NEXT_PUBLIC_POSTHOG_KEY is set.
 */

let posthogInstance: any = null;

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if (posthogInstance) return;

  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false,
      persistence: "localStorage",
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.opt_out_capturing();
        }
      },
    });
    posthogInstance = posthog;
  });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!posthogInstance) return;
  posthogInstance.capture(event, properties);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!posthogInstance) return;
  posthogInstance.identify(userId, traits);
}

// Key events to track:
// trackEvent("signup_completed", { method: "email" | "google" })
// trackEvent("analysis_started", { mode: "screening" | "forensic" })
// trackEvent("analysis_completed", { risk_level, match_count, processing_time_ms })
// trackEvent("pdf_downloaded", { analysis_id })
// trackEvent("evidence_package_exported", { case_id })
// trackEvent("forensic_case_created")
// trackEvent("plan_upgraded", { from_plan, to_plan })
// trackEvent("language_changed", { from: "en", to: "es" })
