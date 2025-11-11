/**
 * Structured JSON Logger Configuration using Pino
 * Provides consistent, structured logging across the application
 */

import pino from 'pino';

// Determine log level from environment variable
const LOG_LEVEL = (process.env.LOG_LEVEL || 'INFO').toLowerCase();

// Map common log level formats to pino levels
const logLevelMap: Record<string, string> = {
  'error': 'error',
  'warn': 'warn',
  'warning': 'warn',
  'info': 'info',
  'debug': 'debug',
  'trace': 'trace',
};

const pinoLevel = logLevelMap[LOG_LEVEL] || 'info';

// Pino configuration
const logger = pino({
  level: pinoLevel,

  // Base fields added to every log
  base: {
    service: 'backend',
    environment: process.env.NODE_ENV || 'development',
  },

  // Timestamp configuration
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

  // Format configuration based on environment
  transport: process.env.LOG_FORMAT === 'pretty' && process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Custom serializers for common objects
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      remoteAddress: req.ip || req.connection?.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

/**
 * Sanitize sensitive data from log objects
 * Removes passwords, tokens, and other sensitive fields
 */
export function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'passwordconfirm',
    'newpassword',
    'oldpassword',
    'token',
    'accesstoken',
    'refreshtoken',
    'apikey',
    'secret',
    'authorization',
    'cookie',
    'cookies',
  ];

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();

    // Check if field name contains sensitive keywords
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Sanitize database connection strings
 * Masks passwords in connection URLs
 */
export function sanitizeConnectionString(connectionString: string): string {
  if (!connectionString) return connectionString;

  // Match password in connection strings (postgresql://user:password@host/db or redis://:password@host)
  return connectionString.replace(
    /(postgresql|postgres|redis|mysql):\/\/(([^:]+):)?([^@]+)@/gi,
    '$1://$2[REDACTED]@'
  );
}

/**
 * Create a child logger with additional context
 * Useful for adding requestId or other contextual information
 */
export function createChildLogger(bindings: Record<string, any>) {
  return logger.child(sanitizeLogData(bindings));
}

export default logger;
