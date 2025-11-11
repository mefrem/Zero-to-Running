/**
 * Centralized Environment Configuration
 *
 * This module provides type-safe access to all environment variables
 * with validation and sensible defaults.
 */

import * as dotenv from 'dotenv';
import { validateConfig, ConfigError } from '../utils/config-validator';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration interface
 * All configuration values are typed and validated
 */
export interface AppConfig {
  // Application settings
  app: {
    name: string;
    version: string;
    env: 'development' | 'production' | 'test';
  };

  // Server configuration
  server: {
    port: number;
    host: string;
  };

  // Database configuration
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    poolMin: number;
    poolMax: number;
  };

  // Redis configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };

  // Logging configuration
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    format: 'json' | 'pretty';
  };

  // CORS configuration
  cors: {
    origin: string[];
    credentials: boolean;
  };

  // API configuration
  api: {
    basePath: string;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    requestTimeout: number;
  };

  // Security configuration
  security: {
    sessionSecret: string;
    sessionMaxAge: number;
    jwtSecret?: string;
    jwtExpiration?: string;
    bcryptSaltRounds: number;
    enableHttps: boolean;
  };

  // Feature flags
  features: {
    enableApiDocs: boolean;
    enableHealthChecks: boolean;
    enableMetrics: boolean;
    enableAutoSeed: boolean;
    enableExperimentalFeatures: boolean;
    verboseErrors: boolean;
  };

  // Development settings
  development: {
    nodeDebugPort: number;
  };
}

/**
 * Parse environment variable as integer with default value
 */
function getIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new ConfigError(`Invalid integer value for ${key}: ${value}`);
  }
  return parsed;
}

/**
 * Parse environment variable as boolean with default value
 */
function getBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Get required environment variable or throw error
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new ConfigError(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Parse LOG_LEVEL environment variable
 */
function getLogLevel(): AppConfig['logging']['level'] {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  const validLevels: AppConfig['logging']['level'][] = ['error', 'warn', 'info', 'debug', 'trace'];

  if (!validLevels.includes(level as any)) {
    throw new ConfigError(
      `Invalid LOG_LEVEL: ${level}. Must be one of: ${validLevels.join(', ')}`
    );
  }

  return level as AppConfig['logging']['level'];
}

/**
 * Parse LOG_FORMAT environment variable
 */
function getLogFormat(): AppConfig['logging']['format'] {
  const format = (process.env.LOG_FORMAT || 'pretty').toLowerCase();
  const validFormats: AppConfig['logging']['format'][] = ['json', 'pretty'];

  if (!validFormats.includes(format as any)) {
    throw new ConfigError(
      `Invalid LOG_FORMAT: ${format}. Must be one of: ${validFormats.join(', ')}`
    );
  }

  return format as AppConfig['logging']['format'];
}

/**
 * Parse NODE_ENV environment variable
 */
function getNodeEnv(): AppConfig['app']['env'] {
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  const validEnvs: AppConfig['app']['env'][] = ['development', 'production', 'test'];

  if (!validEnvs.includes(env as any)) {
    throw new ConfigError(
      `Invalid NODE_ENV: ${env}. Must be one of: ${validEnvs.join(', ')}`
    );
  }

  return env as AppConfig['app']['env'];
}

/**
 * Parse CORS_ORIGIN environment variable into array
 */
function getCorsOrigins(): string[] {
  const origins = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001';
  return origins.split(',').map(origin => origin.trim());
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): AppConfig {
  try {
    const config: AppConfig = {
      app: {
        name: getOptionalEnv('APP_NAME', 'Zero-to-Running'),
        version: getOptionalEnv('APP_VERSION', '1.0.0'),
        env: getNodeEnv(),
      },

      server: {
        port: getIntEnv('PORT', 3001),
        host: getOptionalEnv('HOST', '0.0.0.0'),
      },

      database: {
        host: getOptionalEnv('DATABASE_HOST', 'postgres'),
        port: getIntEnv('DATABASE_PORT', 5432),
        name: getOptionalEnv('DATABASE_NAME', 'zero_to_running_dev'),
        user: getOptionalEnv('DATABASE_USER', 'postgres'),
        password: getRequiredEnv('DATABASE_PASSWORD'),
        poolMin: getIntEnv('DATABASE_POOL_MIN', 2),
        poolMax: getIntEnv('DATABASE_POOL_MAX', 10),
      },

      redis: {
        host: getOptionalEnv('REDIS_HOST', 'redis'),
        port: getIntEnv('REDIS_PORT', 6379),
        password: process.env.REDIS_PASSWORD,
        db: getIntEnv('REDIS_DB', 0),
      },

      logging: {
        level: getLogLevel(),
        format: getLogFormat(),
      },

      cors: {
        origin: getCorsOrigins(),
        credentials: getBoolEnv('CORS_CREDENTIALS', true),
      },

      api: {
        basePath: getOptionalEnv('API_BASE_PATH', '/api'),
        rateLimitWindowMs: getIntEnv('RATE_LIMIT_WINDOW_MS', 60000),
        rateLimitMaxRequests: getIntEnv('RATE_LIMIT_MAX_REQUESTS', 100),
        requestTimeout: getIntEnv('REQUEST_TIMEOUT', 30000),
      },

      security: {
        sessionSecret: getRequiredEnv('SESSION_SECRET'),
        sessionMaxAge: getIntEnv('SESSION_MAX_AGE', 86400000),
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiration: process.env.JWT_EXPIRATION,
        bcryptSaltRounds: getIntEnv('BCRYPT_SALT_ROUNDS', 10),
        enableHttps: getBoolEnv('ENABLE_HTTPS', false),
      },

      features: {
        enableApiDocs: getBoolEnv('ENABLE_API_DOCS', true),
        enableHealthChecks: getBoolEnv('ENABLE_HEALTH_CHECKS', true),
        enableMetrics: getBoolEnv('ENABLE_METRICS', false),
        enableAutoSeed: getBoolEnv('ENABLE_AUTO_SEED', false),
        enableExperimentalFeatures: getBoolEnv('ENABLE_EXPERIMENTAL_FEATURES', false),
        verboseErrors: getBoolEnv('VERBOSE_ERRORS', true),
      },

      development: {
        nodeDebugPort: getIntEnv('NODE_DEBUG_PORT', 9229),
      },
    };

    // Validate the loaded configuration
    validateConfig(config);

    return config;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Export singleton configuration instance
export const config: AppConfig = loadConfig();

/**
 * Get configuration summary for logging (with sensitive values masked)
 */
export function getConfigSummary(): Record<string, any> {
  return {
    app: config.app,
    server: config.server,
    database: {
      host: config.database.host,
      port: config.database.port,
      name: config.database.name,
      user: config.database.user,
      password: '[REDACTED]',
      poolMin: config.database.poolMin,
      poolMax: config.database.poolMax,
    },
    redis: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password ? '[REDACTED]' : undefined,
      db: config.redis.db,
    },
    logging: config.logging,
    cors: config.cors,
    api: config.api,
    security: {
      sessionSecret: '[REDACTED]',
      sessionMaxAge: config.security.sessionMaxAge,
      jwtSecret: config.security.jwtSecret ? '[REDACTED]' : undefined,
      jwtExpiration: config.security.jwtExpiration,
      bcryptSaltRounds: config.security.bcryptSaltRounds,
      enableHttps: config.security.enableHttps,
    },
    features: config.features,
    development: config.development,
  };
}
