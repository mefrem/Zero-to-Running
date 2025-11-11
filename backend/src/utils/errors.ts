/**
 * Enhanced Error Classes and Error Factory
 *
 * Provides structured error handling with "what", "why", and "next steps" format.
 * Story 4.4: Enhanced Error Messages & Developer Feedback
 */

import { logger } from './logger';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  INITIALIZATION = 'INITIALIZATION',
  CONNECTION = 'CONNECTION',
  VALIDATION = 'VALIDATION',
  RUNTIME = 'RUNTIME',
  RESOURCE = 'RESOURCE',
  INTEGRATION = 'INTEGRATION',
  CONFIGURATION = 'CONFIGURATION',
}

/**
 * Documentation reference for error
 */
export interface ErrorDocReference {
  section: string;
  url?: string;
}

/**
 * Enhanced error information structure
 */
export interface EnhancedErrorInfo {
  // What went wrong
  what: string;

  // Why it might have happened
  why: string[];

  // Suggested next steps
  nextSteps: string[];

  // Error metadata
  code?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  service?: string;
  context?: Record<string, any>;

  // Documentation reference
  documentation?: ErrorDocReference;

  // Timestamp
  timestamp: string;

  // Request ID for tracing
  requestId?: string;
}

/**
 * Base enhanced error class with structured information
 */
export class EnhancedError extends Error {
  public readonly info: EnhancedErrorInfo;
  public readonly originalError?: Error;

  constructor(message: string, info: EnhancedErrorInfo, originalError?: Error) {
    super(message);
    this.name = 'EnhancedError';
    this.info = info;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Format error as human-readable string
   */
  public format(): string {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push('━'.repeat(80));
    lines.push(`${this.info.severity}: ${this.info.what}`);

    // Service name if provided
    if (this.info.service) {
      lines.push(`Service: ${this.info.service}`);
    }

    // Error code if provided
    if (this.info.code) {
      lines.push(`Error Code: ${this.info.code}`);
    }

    lines.push('━'.repeat(80));
    lines.push('');

    // Why section
    if (this.info.why.length > 0) {
      lines.push('Why this happened:');
      this.info.why.forEach(reason => {
        lines.push(`  • ${reason}`);
      });
      lines.push('');
    }

    // Next steps section
    if (this.info.nextSteps.length > 0) {
      lines.push('Next Steps:');
      this.info.nextSteps.forEach((step, index) => {
        lines.push(`  ${index + 1}. ${step}`);
      });
      lines.push('');
    }

    // Context information
    if (this.info.context && Object.keys(this.info.context).length > 0) {
      lines.push('Additional Context:');
      Object.entries(this.info.context).forEach(([key, value]) => {
        lines.push(`  ${key}: ${JSON.stringify(value)}`);
      });
      lines.push('');
    }

    // Documentation reference
    if (this.info.documentation) {
      lines.push('Documentation:');
      if (this.info.documentation.url) {
        lines.push(`  ${this.info.documentation.url}`);
      } else {
        lines.push(`  See ${this.info.documentation.section}`);
      }
      lines.push('');
    }

    // Timestamp and request ID
    lines.push(`Timestamp: ${this.info.timestamp}`);
    if (this.info.requestId) {
      lines.push(`Request ID: ${this.info.requestId}`);
    }

    lines.push('━'.repeat(80));
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Convert error to JSON for API responses
   */
  public toJSON(): object {
    return {
      error: {
        message: this.info.what,
        code: this.info.code,
        category: this.info.category,
        severity: this.info.severity,
        why: this.info.why,
        nextSteps: this.info.nextSteps,
        context: this.info.context,
        documentation: this.info.documentation,
        timestamp: this.info.timestamp,
        requestId: this.info.requestId,
      },
    };
  }

  /**
   * Log error using structured logging
   */
  public log(): void {
    const logData: any = {
      msg: this.info.what,
      code: this.info.code,
      category: this.info.category,
      severity: this.info.severity,
      service: this.info.service,
      context: this.info.context,
      requestId: this.info.requestId,
    };

    if (this.originalError) {
      logData.originalError = this.originalError.message;
      logData.stack = this.originalError.stack;
    }

    switch (this.info.severity) {
      case ErrorSeverity.ERROR:
        logger.error(logData);
        break;
      case ErrorSeverity.WARNING:
        logger.warn(logData);
        break;
      case ErrorSeverity.INFO:
        logger.info(logData);
        break;
    }
  }
}

/**
 * Database-specific error
 */
export class DatabaseError extends EnhancedError {
  constructor(message: string, info: Partial<EnhancedErrorInfo>, originalError?: Error) {
    super(message, {
      what: message,
      why: [],
      nextSteps: [],
      category: ErrorCategory.CONNECTION,
      severity: ErrorSeverity.ERROR,
      service: 'PostgreSQL',
      timestamp: new Date().toISOString(),
      ...info,
    }, originalError);
    this.name = 'DatabaseError';
  }
}

/**
 * Redis-specific error
 */
export class RedisError extends EnhancedError {
  constructor(message: string, info: Partial<EnhancedErrorInfo>, originalError?: Error) {
    super(message, {
      what: message,
      why: [],
      nextSteps: [],
      category: ErrorCategory.CONNECTION,
      severity: ErrorSeverity.ERROR,
      service: 'Redis',
      timestamp: new Date().toISOString(),
      ...info,
    }, originalError);
    this.name = 'RedisError';
  }
}

/**
 * Configuration-specific error
 */
export class ConfigurationError extends EnhancedError {
  constructor(message: string, info: Partial<EnhancedErrorInfo>, originalError?: Error) {
    super(message, {
      what: message,
      why: [],
      nextSteps: [],
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.ERROR,
      timestamp: new Date().toISOString(),
      ...info,
    }, originalError);
    this.name = 'ConfigurationError';
  }
}

/**
 * Network/connectivity error
 */
export class NetworkError extends EnhancedError {
  constructor(message: string, info: Partial<EnhancedErrorInfo>, originalError?: Error) {
    super(message, {
      what: message,
      why: [],
      nextSteps: [],
      category: ErrorCategory.CONNECTION,
      severity: ErrorSeverity.ERROR,
      timestamp: new Date().toISOString(),
      ...info,
    }, originalError);
    this.name = 'NetworkError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends EnhancedError {
  constructor(message: string, info: Partial<EnhancedErrorInfo>, originalError?: Error) {
    super(message, {
      what: message,
      why: [],
      nextSteps: [],
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.ERROR,
      timestamp: new Date().toISOString(),
      ...info,
    }, originalError);
    this.name = 'ValidationError';
  }
}

/**
 * Startup/initialization error
 */
export class InitializationError extends EnhancedError {
  constructor(message: string, info: Partial<EnhancedErrorInfo>, originalError?: Error) {
    super(message, {
      what: message,
      why: [],
      nextSteps: [],
      category: ErrorCategory.INITIALIZATION,
      severity: ErrorSeverity.ERROR,
      timestamp: new Date().toISOString(),
      ...info,
    }, originalError);
    this.name = 'InitializationError';
  }
}
