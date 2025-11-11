/**
 * Logger utility - Re-exports structured logger from config
 * Maintains backward compatibility with existing code
 */

// Re-export everything from the new structured logger configuration
export { default as logger, createChildLogger, sanitizeLogData, sanitizeConnectionString } from '../config/logger';

// Legacy LogLevel enum for backward compatibility
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}
