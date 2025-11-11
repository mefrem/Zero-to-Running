/**
 * Frontend Logger Utility
 * Provides structured console logging for React components and API calls
 */

// Log levels enum
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

// Map log level strings to priority
const LOG_LEVEL_PRIORITY: Record<string, number> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Get configured log level from environment variable (defaults to INFO)
const CONFIGURED_LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || 'INFO';
const CONFIGURED_PRIORITY = LOG_LEVEL_PRIORITY[CONFIGURED_LOG_LEVEL.toUpperCase()] || 2;

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

/**
 * Logger class for structured frontend logging
 */
class Logger {
  /**
   * Get current timestamp in ISO format
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Check if log should be output based on configured level
   */
  private shouldLog(level: LogLevel): boolean {
    const levelPriority = LOG_LEVEL_PRIORITY[level];
    return levelPriority <= CONFIGURED_PRIORITY;
  }

  /**
   * Format log message with timestamp and context
   */
  private formatMessage(
    level: LogLevel,
    component: string | undefined,
    message: string,
    context?: Record<string, unknown>
  ): any[] {
    const timestamp = this.getTimestamp();
    const logObject = {
      timestamp,
      level,
      component: component || 'App',
      message,
      ...context,
    };

    // In development, use pretty format with colors
    if (isDevelopment) {
      const componentStr = component ? `[${component}]` : '';
      const prefix = `[${timestamp}] [${level}] ${componentStr}`;
      return context ? [prefix, message, context] : [prefix, message];
    }

    // In production, use JSON format
    return [JSON.stringify(logObject)];
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, unknown>, component?: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(...this.formatMessage(LogLevel.ERROR, component, message, context));
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>, component?: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...this.formatMessage(LogLevel.WARN, component, message, context));
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>, component?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(...this.formatMessage(LogLevel.INFO, component, message, context));
    }
  }

  /**
   * Log debug message (only in development or when LOG_LEVEL=DEBUG)
   */
  debug(message: string, context?: Record<string, unknown>, component?: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(...this.formatMessage(LogLevel.DEBUG, component, message, context));
    }
  }

  /**
   * Log component lifecycle event
   */
  lifecycle(event: 'mount' | 'unmount' | 'update', component: string, context?: Record<string, unknown>): void {
    if (isDevelopment) {
      this.debug(`Component ${event}`, context, component);
    }
  }

  /**
   * Log API request
   */
  apiRequest(method: string, url: string, data?: any, component?: string): void {
    this.debug('API Request', {
      method,
      url,
      data: data ? this.sanitizeData(data) : undefined,
    }, component);
  }

  /**
   * Log API response
   */
  apiResponse(method: string, url: string, status: number, duration: number, component?: string): void {
    const level = status >= 400 ? LogLevel.WARN : LogLevel.DEBUG;

    if (this.shouldLog(level)) {
      const message = `API Response: ${method} ${url}`;
      const context = {
        method,
        url,
        status,
        duration,
      };

      if (level === LogLevel.WARN) {
        this.warn(message, context, component);
      } else {
        this.debug(message, context, component);
      }
    }
  }

  /**
   * Log API error
   */
  apiError(method: string, url: string, error: Error | string, component?: string): void {
    this.error('API Error', {
      method,
      url,
      error: error instanceof Error ? error.message : error,
    }, component);
  }

  /**
   * Log user interaction (opt-in via environment variable)
   */
  interaction(action: string, target: string, context?: Record<string, unknown>, component?: string): void {
    // Only log interactions if explicitly enabled
    if (import.meta.env.VITE_LOG_INTERACTIONS === 'true') {
      this.debug('User Interaction', {
        action,
        target,
        ...context,
      }, component);
    }
  }

  /**
   * Sanitize sensitive data from log objects
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'passwordConfirm',
      'newPassword',
      'oldPassword',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'authorization',
    ];

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();

      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * React hook for component-scoped logging
 */
export function useLogger(componentName: string) {
  return {
    error: (message: string, context?: Record<string, unknown>) =>
      logger.error(message, context, componentName),
    warn: (message: string, context?: Record<string, unknown>) =>
      logger.warn(message, context, componentName),
    info: (message: string, context?: Record<string, unknown>) =>
      logger.info(message, context, componentName),
    debug: (message: string, context?: Record<string, unknown>) =>
      logger.debug(message, context, componentName),
    lifecycle: (event: 'mount' | 'unmount' | 'update', context?: Record<string, unknown>) =>
      logger.lifecycle(event, componentName, context),
    apiRequest: (method: string, url: string, data?: any) =>
      logger.apiRequest(method, url, data, componentName),
    apiResponse: (method: string, url: string, status: number, duration: number) =>
      logger.apiResponse(method, url, status, duration, componentName),
    apiError: (method: string, url: string, error: Error | string) =>
      logger.apiError(method, url, error, componentName),
    interaction: (action: string, target: string, context?: Record<string, unknown>) =>
      logger.interaction(action, target, context, componentName),
  };
}
