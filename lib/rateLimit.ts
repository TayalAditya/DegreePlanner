// Rate limiting utilities for API routes

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (use Redis in production for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>();

export function rateLimit(config: RateLimitConfig = { windowMs: 60000, maxRequests: 60 }) {
  return function checkRateLimit(identifier: string): {
    success: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = rateLimitStore.get(identifier);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      for (const [key, value] of rateLimitStore.entries()) {
        if (value.resetTime < now) {
          rateLimitStore.delete(key);
        }
      }
    }

    if (!entry || entry.resetTime < now) {
      // Create new window
      const resetTime = now + config.windowMs;
      rateLimitStore.set(identifier, { count: 1, resetTime });
      return {
        success: true,
        remaining: config.maxRequests - 1,
        resetTime,
      };
    }

    // Increment counter
    entry.count++;
    rateLimitStore.set(identifier, entry);

    if (entry.count > config.maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    return {
      success: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  };
}

// Middleware wrapper for Next.js API routes
export function withRateLimit(
  handler: Function,
  config?: RateLimitConfig
) {
  const limiter = rateLimit(config);

  return async function (req: any, ...args: any[]) {
    // Use IP address or user ID as identifier
    const identifier =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const result = limiter(identifier);

    if (!result.success) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": config?.maxRequests.toString() || "60",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": result.resetTime.toString(),
          },
        }
      );
    }

    // Add rate limit headers to response
    const response = await handler(req, ...args);
    
    if (response instanceof Response) {
      response.headers.set("X-RateLimit-Limit", config?.maxRequests.toString() || "60");
      response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
      response.headers.set("X-RateLimit-Reset", result.resetTime.toString());
    }

    return response;
  };
}
