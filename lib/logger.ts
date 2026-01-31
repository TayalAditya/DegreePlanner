// Logging utilities for production monitoring

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  stack?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, stack } = entry;
    const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
    const stackStr = stack ? `\n${stack}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}${stackStr}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack: error?.stack,
    };

    // Console output in development
    if (this.isDevelopment) {
      const formatted = this.formatLog(entry);
      switch (level) {
        case "debug":
          console.debug(formatted);
          break;
        case "info":
          console.info(formatted);
          break;
        case "warn":
          console.warn(formatted);
          break;
        case "error":
          console.error(formatted);
          break;
      }
    }

    // In production, send to logging service
    if (!this.isDevelopment && level !== "debug") {
      this.sendToLoggingService(entry);
    }
  }

  private sendToLoggingService(entry: LogEntry) {
    // Example: Send to external logging service
    // - Sentry for error tracking
    // - LogRocket for session replay
    // - DataDog for monitoring
    // - CloudWatch for AWS deployments
    
    // For now, we'll just keep it in memory for demo
    // In production, implement actual service integration
    if (typeof window !== "undefined") {
      // Client-side logging
      // Example: Sentry.captureMessage(entry.message, { level: entry.level, extra: entry.context });
    } else {
      // Server-side logging
      // Example: Use winston, pino, or built-in console with structured logging
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log("warn", message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log("error", message, context, error);
  }

  // API request logging
  logAPIRequest(method: string, path: string, duration: number, status: number) {
    this.info(`API Request: ${method} ${path}`, {
      method,
      path,
      duration,
      status,
    });
  }

  // Database query logging
  logDBQuery(query: string, duration: number) {
    this.debug(`DB Query: ${query}`, { duration });
  }

  // User action logging
  logUserAction(userId: string, action: string, metadata?: Record<string, any>) {
    this.info(`User Action: ${action}`, {
      userId,
      action,
      ...metadata,
    });
  }

  // Performance logging
  logPerformance(metric: string, value: number, unit: string = "ms") {
    this.info(`Performance: ${metric}`, { metric, value, unit });
  }
}

export const logger = new Logger();

// Performance measurement utility
export function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const start = performance.now();
  const result = fn();

  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = performance.now() - start;
      logger.logPerformance(name, duration);
    }) as Promise<T>;
  } else {
    const duration = performance.now() - start;
    logger.logPerformance(name, duration);
    return result;
  }
}

// API route wrapper with logging
export function withLogging(handler: Function, routeName: string) {
  return async function (req: any, ...args: any[]) {
    const start = performance.now();
    const method = req.method;
    const path = req.url || routeName;

    try {
      logger.info(`API Request Started: ${method} ${path}`);
      const response = await handler(req, ...args);
      const duration = performance.now() - start;
      
      const status = response?.status || 200;
      logger.logAPIRequest(method, path, duration, status);
      
      return response;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error(`API Request Failed: ${method} ${path}`, error as Error, {
        duration,
      });
      throw error;
    }
  };
}
