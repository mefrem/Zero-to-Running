/**
 * Frontend Environment Configuration
 *
 * Provides type-safe access to frontend environment variables.
 * Uses Vite's import.meta.env for environment variable access.
 */

import { logger } from '../utils/logger';

/**
 * Frontend configuration interface
 */
export interface FrontendConfig {
  // Application settings
  app: {
    name: string;
    env: 'development' | 'production' | 'test';
  };

  // Server configuration
  server: {
    port: number;
  };

  // API configuration
  api: {
    url: string;
  };

  // Logging configuration
  logging: {
    level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
    logInteractions: boolean;
  };

  // Feature flags
  features: {
    enableHotReload: boolean;
    enableSourceMaps: boolean;
  };
}

/**
 * Validate frontend configuration
 */
function validateFrontendConfig(config: FrontendConfig): void {
  const errors: string[] = [];

  // Validate API URL
  if (!config.api.url) {
    errors.push('VITE_API_URL is required');
  } else {
    try {
      new URL(config.api.url);
    } catch {
      errors.push(`VITE_API_URL must be a valid URL, got: ${config.api.url}`);
    }
  }

  // Validate port
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push(`Port must be between 1 and 65535, got: ${config.server.port}`);
  }

  // Log validation errors
  if (errors.length > 0) {
    errors.forEach(error => {
      logger.error('Configuration validation error', { error }, 'Config');
    });
    throw new Error(`Frontend configuration validation failed: ${errors.join(', ')}`);
  }
}

/**
 * Parse environment mode
 */
function getEnvMode(): FrontendConfig['app']['env'] {
  const mode = import.meta.env.MODE || 'development';

  // Vite uses 'development' and 'production' modes
  if (mode === 'development' || mode === 'test') return mode;
  if (mode === 'production') return 'production';

  // Default to development for unknown modes
  logger.warn('Unknown environment mode, defaulting to development', { mode }, 'Config');
  return 'development';
}

/**
 * Parse log level
 */
function getLogLevel(): FrontendConfig['logging']['level'] {
  const level = (import.meta.env.VITE_LOG_LEVEL || 'INFO').toUpperCase();
  const validLevels: FrontendConfig['logging']['level'][] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

  if (!validLevels.includes(level as any)) {
    logger.warn(
      `Invalid VITE_LOG_LEVEL: ${level}. Using INFO. Valid levels: ${validLevels.join(', ')}`,
      undefined,
      'Config'
    );
    return 'INFO';
  }

  return level as FrontendConfig['logging']['level'];
}

/**
 * Parse integer from environment variable
 */
function getIntEnv(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse boolean from environment variable
 */
function getBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Load frontend configuration from environment variables
 */
export function loadFrontendConfig(): FrontendConfig {
  const config: FrontendConfig = {
    app: {
      name: import.meta.env.VITE_APP_NAME || 'Zero-to-Running',
      env: getEnvMode(),
    },

    server: {
      port: getIntEnv(import.meta.env.VITE_PORT, 3000),
    },

    api: {
      url: import.meta.env.VITE_API_URL || 'http://localhost:3001',
    },

    logging: {
      level: getLogLevel(),
      logInteractions: getBoolEnv(import.meta.env.VITE_LOG_INTERACTIONS, false),
    },

    features: {
      enableHotReload: import.meta.env.DEV || false,
      enableSourceMaps: getBoolEnv(import.meta.env.VITE_ENABLE_SOURCE_MAPS, false),
    },
  };

  // Validate configuration
  try {
    validateFrontendConfig(config);
  } catch (error) {
    logger.error(
      'Failed to validate frontend configuration',
      { error: error instanceof Error ? error.message : String(error) },
      'Config'
    );
    throw error;
  }

  return config;
}

// Export singleton configuration instance
export const config: FrontendConfig = loadFrontendConfig();

/**
 * Get configuration summary for logging
 */
export function getConfigSummary(): Record<string, any> {
  return {
    app: config.app,
    server: config.server,
    api: config.api,
    logging: config.logging,
    features: config.features,
  };
}

/**
 * Log configuration on startup (only in development)
 */
if (import.meta.env.DEV) {
  logger.info('Frontend configuration loaded', getConfigSummary(), 'Config');
}
