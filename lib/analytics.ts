// Analytics and monitoring utilities

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  userId?: string;
}

class Analytics {
  private isProduction = process.env.NODE_ENV === "production";

  // Track page view
  trackPageView(page: string, properties?: Record<string, any>) {
    if (typeof window === "undefined") return;

    const event: AnalyticsEvent = {
      event: "page_view",
      properties: {
        page,
        ...properties,
        timestamp: new Date().toISOString(),
      },
    };

    this.send(event);
  }

  // Track custom event
  track(event: string, properties?: Record<string, any>) {
    if (typeof window === "undefined") return;

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
      },
    };

    this.send(analyticsEvent);
  }

  // Track user action
  trackAction(action: string, metadata?: Record<string, any>) {
    this.track("user_action", {
      action,
      ...metadata,
    });
  }

  // Track error
  trackError(error: Error, context?: Record<string, any>) {
    this.track("error", {
      message: error.message,
      stack: error.stack,
      ...context,
    });
  }

  // Track performance metric
  trackPerformance(metric: string, value: number, unit: string = "ms") {
    this.track("performance", {
      metric,
      value,
      unit,
    });
  }

  // Track API call
  trackAPICall(method: string, endpoint: string, status: number, duration: number) {
    this.track("api_call", {
      method,
      endpoint,
      status,
      duration,
    });
  }

  private send(event: AnalyticsEvent) {
    if (!this.isProduction) {
      console.log("[Analytics]", event);
      return;
    }

    // In production, send to analytics service
    // Examples:
    // - Google Analytics 4
    // - Mixpanel
    // - Amplitude
    // - PostHog
    // - Vercel Analytics

    // Example for Google Analytics 4:
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event.event, event.properties);
    }

    // Example for custom analytics endpoint:
    // fetch("/api/analytics", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(event),
    // }).catch(console.error);
  }

  // Identify user (for user-specific analytics)
  identify(userId: string, traits?: Record<string, any>) {
    if (typeof window === "undefined") return;

    this.send({
      event: "identify",
      userId,
      properties: traits,
    });
  }

  // Track conversion/goal
  trackConversion(goal: string, value?: number) {
    this.track("conversion", {
      goal,
      value,
    });
  }
}

export const analytics = new Analytics();

// React hook for tracking page views
export function usePageTracking(pageName: string) {
  if (typeof window !== "undefined") {
    analytics.trackPageView(pageName);
  }
}

// Web Vitals tracking
export function trackWebVitals(metric: any) {
  analytics.trackPerformance(metric.name, metric.value, "score");
}

// Session recording utilities
export class SessionRecorder {
  private static instance: SessionRecorder;
  private isInitialized = false;

  static getInstance() {
    if (!SessionRecorder.instance) {
      SessionRecorder.instance = new SessionRecorder();
    }
    return SessionRecorder.instance;
  }

  initialize() {
    if (this.isInitialized || typeof window === "undefined") return;

    // Initialize session recording (e.g., LogRocket, FullStory, Hotjar)
    // Example for LogRocket:
    // if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_LOGROCKET_ID) {
    //   LogRocket.init(process.env.NEXT_PUBLIC_LOGROCKET_ID);
    // }

    this.isInitialized = true;
  }

  identify(userId: string, userData?: Record<string, any>) {
    if (!this.isInitialized) return;

    // Example: LogRocket.identify(userId, userData);
  }
}
