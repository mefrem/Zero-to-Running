/**
 * Configuration Validation Utilities
 *
 * Provides reusable validation functions for configuration values
 * with comprehensive error reporting.
 */

import type { AppConfig } from '../config/env';

/**
 * Custom error class for configuration validation errors
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
    Error.captureStackTrace(this, ConfigError);
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Mock secret detection result
 */
export interface MockSecret {
  name: string;
  value: string;
}

/**
 * Detect if a value is a mock secret (starts with CHANGE_ME_)
 */
export function isMockSecret(value: string | undefined): boolean {
  return value?.startsWith('CHANGE_ME_') ?? false;
}

/**
 * Detect all mock secrets in configuration
 */
export function detectMockSecrets(config: AppConfig): MockSecret[] {
  const mockSecrets: MockSecret[] = [];

  if (isMockSecret(config.database.password)) {
    mockSecrets.push({
      name: 'DATABASE_PASSWORD',
      value: config.database.password,
    });
  }

  if (config.redis.password && isMockSecret(config.redis.password)) {
    mockSecrets.push({
      name: 'REDIS_PASSWORD',
      value: config.redis.password,
    });
  }

  if (isMockSecret(config.security.sessionSecret)) {
    mockSecrets.push({
      name: 'SESSION_SECRET',
      value: config.security.sessionSecret,
    });
  }

  if (config.security.jwtSecret && isMockSecret(config.security.jwtSecret)) {
    mockSecrets.push({
      name: 'JWT_SECRET',
      value: config.security.jwtSecret,
    });
  }

  return mockSecrets;
}

/**
 * Format mock secret value for display (show prefix and redact rest)
 */
export function formatMockSecretValue(value: string): string {
  if (value.length <= 20) {
    return value;
  }
  return value.substring(0, 20) + '...';
}

/**
 * Validate port number is in valid range
 */
export function validatePort(port: number, name: string = 'port'): void {
  if (!Number.isInteger(port)) {
    throw new ConfigError(`${name} must be an integer, got: ${port}`);
  }

  if (port < 1 || port > 65535) {
    throw new ConfigError(
      `${name} must be between 1 and 65535, got: ${port}. ` +
      `Common ports: 3000-3010 (development), 5000-5010 (API), 8000-8080 (web)`
    );
  }

  // Warn about privileged ports (< 1024)
  if (port < 1024) {
    console.warn(
      `Warning: ${name} ${port} is a privileged port (< 1024). ` +
      `This may require elevated permissions. Consider using a port >= 1024.`
    );
  }
}

/**
 * Validate email address format
 */
export function validateEmail(email: string, name: string = 'email'): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new ConfigError(
      `${name} must be a valid email address, got: ${email}`
    );
  }
}

/**
 * Validate URL format
 */
export function validateUrl(url: string, name: string = 'URL'): void {
  try {
    new URL(url);
  } catch {
    throw new ConfigError(
      `${name} must be a valid URL, got: ${url}. ` +
      `Example: http://localhost:3000 or https://api.example.com`
    );
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: string,
  allowedValues: readonly T[],
  name: string = 'value'
): void {
  if (!allowedValues.includes(value as T)) {
    throw new ConfigError(
      `${name} must be one of: ${allowedValues.join(', ')}. Got: ${value}`
    );
  }
}

/**
 * Validate required string is not empty
 */
export function validateRequired(value: string | undefined, name: string): void {
  if (!value || value.trim().length === 0) {
    throw new ConfigError(
      `${name} is required and cannot be empty. ` +
      `Please set the ${name} environment variable.`
    );
  }
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  min: number,
  max: number,
  name: string = 'value'
): void {
  if (value.length < min || value.length > max) {
    throw new ConfigError(
      `${name} length must be between ${min} and ${max} characters, got: ${value.length}`
    );
  }
}

/**
 * Validate number is in range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  name: string = 'value'
): void {
  if (value < min || value > max) {
    throw new ConfigError(
      `${name} must be between ${min} and ${max}, got: ${value}`
    );
  }
}

/**
 * Validate database password is not using default/weak values
 * Returns array of warnings (non-blocking for mock secrets)
 */
export function validateDatabasePassword(password: string): string[] {
  const warnings: string[] = [];

  validateRequired(password, 'DATABASE_PASSWORD');

  // Check for mock secret (CHANGE_ME_ prefix) - warn but don't fail
  if (isMockSecret(password)) {
    warnings.push(
      `DATABASE_PASSWORD is using a mock development value (${formatMockSecretValue(password)}). ` +
      `This is safe for local development but must be replaced in production.`
    );
    return warnings; // Don't apply other validations to mock secrets
  }

  // Check for truly weak passwords (not mock secrets)
  const weakPasswords = [
    'password',
    'postgres',
    '123456',
    'admin',
    'root',
    'test',
  ];

  if (weakPasswords.includes(password)) {
    throw new ConfigError(
      `DATABASE_PASSWORD is using a weak password: ${password}. ` +
      `Please set a strong, unique password for security.`
    );
  }

  if (password.length < 8) {
    throw new ConfigError(
      `DATABASE_PASSWORD must be at least 8 characters long for security. ` +
      `Current length: ${password.length}`
    );
  }

  return warnings;
}

/**
 * Validate session secret is not using default/weak values
 * Returns array of warnings (non-blocking for mock secrets)
 */
export function validateSessionSecret(secret: string): string[] {
  const warnings: string[] = [];

  validateRequired(secret, 'SESSION_SECRET');

  // Check for mock secret (CHANGE_ME_ prefix) - warn but don't fail
  if (isMockSecret(secret)) {
    warnings.push(
      `SESSION_SECRET is using a mock development value (${formatMockSecretValue(secret)}). ` +
      `This is safe for local development but must be replaced in production.`
    );
    return warnings; // Don't apply other validations to mock secrets
  }

  // Check for truly weak secrets (not mock secrets)
  const weakSecrets = [
    'secret',
    'session',
  ];

  if (weakSecrets.includes(secret)) {
    throw new ConfigError(
      `SESSION_SECRET is using a weak value. ` +
      `Please generate a strong random secret for security.`
    );
  }

  if (secret.length < 32) {
    throw new ConfigError(
      `SESSION_SECRET should be at least 32 characters long for security. ` +
      `Current length: ${secret.length}. ` +
      `Generate one with: openssl rand -base64 32`
    );
  }

  return warnings;
}

/**
 * Check for duplicate port assignments
 */
export function checkDuplicatePorts(ports: Record<string, number>): void {
  const portValues = Object.values(ports);
  const duplicates = portValues.filter(
    (port, index) => portValues.indexOf(port) !== index
  );

  if (duplicates.length > 0) {
    const duplicateEntries = Object.entries(ports)
      .filter(([, port]) => duplicates.includes(port))
      .map(([name, port]) => `${name}: ${port}`)
      .join(', ');

    throw new ConfigError(
      `Duplicate port assignments detected: ${duplicateEntries}. ` +
      `Each service must use a unique port.`
    );
  }
}

/**
 * Validate complete application configuration
 */
export function validateConfig(config: AppConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Validate ports
    validatePort(config.server.port, 'BACKEND_PORT');
    validatePort(config.database.port, 'DATABASE_PORT');
    validatePort(config.redis.port, 'REDIS_PORT');
    validatePort(config.development.nodeDebugPort, 'NODE_DEBUG_PORT');

    // Check for duplicate ports
    checkDuplicatePorts({
      'Backend': config.server.port,
      'Database': config.database.port,
      'Redis': config.redis.port,
      'Debug': config.development.nodeDebugPort,
    });

    // Validate database configuration
    validateRequired(config.database.host, 'DATABASE_HOST');
    validateRequired(config.database.name, 'DATABASE_NAME');
    validateRequired(config.database.user, 'DATABASE_USER');

    // Validate database password (returns warnings for mock secrets)
    const dbPasswordWarnings = validateDatabasePassword(config.database.password);
    warnings.push(...dbPasswordWarnings);

    // Validate pool settings
    validateRange(config.database.poolMin, 1, 100, 'DATABASE_POOL_MIN');
    validateRange(config.database.poolMax, 1, 100, 'DATABASE_POOL_MAX');

    if (config.database.poolMin > config.database.poolMax) {
      errors.push(
        `DATABASE_POOL_MIN (${config.database.poolMin}) cannot be greater than ` +
        `DATABASE_POOL_MAX (${config.database.poolMax})`
      );
    }

    // Validate Redis configuration
    validateRequired(config.redis.host, 'REDIS_HOST');

    // Validate security settings
    const sessionSecretWarnings = validateSessionSecret(config.security.sessionSecret);
    warnings.push(...sessionSecretWarnings);

    // Validate JWT secret if provided
    if (config.security.jwtSecret) {
      // Check for mock secret - warn but don't fail
      if (isMockSecret(config.security.jwtSecret)) {
        warnings.push(
          `JWT_SECRET is using a mock development value (${formatMockSecretValue(config.security.jwtSecret)}). ` +
          `This is safe for local development but must be replaced in production.`
        );
      } else {
        // Apply strict validation for non-mock secrets
        if (config.security.jwtSecret.length < 32) {
          warnings.push(
            `JWT_SECRET should be at least 32 characters long for security. ` +
            `Current length: ${config.security.jwtSecret.length}`
          );
        }
      }
    }

    // Validate bcrypt salt rounds
    validateRange(config.security.bcryptSaltRounds, 4, 20, 'BCRYPT_SALT_ROUNDS');

    if (config.security.bcryptSaltRounds < 10) {
      warnings.push(
        `BCRYPT_SALT_ROUNDS (${config.security.bcryptSaltRounds}) is below recommended value of 10 for production use.`
      );
    }

    // Validate API configuration
    validateRange(config.api.rateLimitMaxRequests, 1, 10000, 'RATE_LIMIT_MAX_REQUESTS');
    validateRange(config.api.requestTimeout, 1000, 300000, 'REQUEST_TIMEOUT');

    // Validate CORS origins
    config.cors.origin.forEach(origin => {
      try {
        validateUrl(origin, 'CORS_ORIGIN');
      } catch (error) {
        errors.push(`Invalid CORS origin: ${origin}. ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Environment-specific warnings
    if (config.app.env === 'production') {
      if (config.logging.level === 'debug' || config.logging.level === 'trace') {
        warnings.push(
          `LOG_LEVEL is set to '${config.logging.level}' in production. ` +
          `Consider using 'info' or 'warn' for better performance.`
        );
      }

      if (config.features.verboseErrors) {
        warnings.push(
          `VERBOSE_ERRORS is enabled in production. ` +
          `This may expose sensitive information in error messages.`
        );
      }

      if (!config.security.enableHttps) {
        warnings.push(
          `HTTPS is not enabled in production. ` +
          `Consider enabling HTTPS for secure communication.`
        );
      }
    }

  } catch (error) {
    if (error instanceof ConfigError) {
      errors.push(error.message);
    } else {
      errors.push(`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✓ Configuration is valid');
  } else {
    lines.push('✗ Configuration validation failed');
    lines.push('');
    lines.push('Errors:');
    result.errors.forEach((error, index) => {
      lines.push(`  ${index + 1}. ${error}`);
    });
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    result.warnings.forEach((warning, index) => {
      lines.push(`  ${index + 1}. ${warning}`);
    });
  }

  return lines.join('\n');
}

/**
 * Format mock secret warning message for console output
 */
export function formatMockSecretWarning(mockSecrets: MockSecret[]): string {
  if (mockSecrets.length === 0) {
    return '';
  }

  const lines: string[] = [
    '',
    '================================================================================',
    '⚠️  WARNING: Mock secrets detected in use (development only!)',
    '================================================================================',
    '',
    'The following mock secrets are currently configured:',
  ];

  mockSecrets.forEach(secret => {
    lines.push(`  • ${secret.name} (set to: ${formatMockSecretValue(secret.value)})`);
  });

  lines.push('');
  lines.push('These are safe for local development, but should NEVER be used in production.');
  lines.push('');
  lines.push('For production deployment, see: /docs/SECRET_MANAGEMENT.md');
  lines.push('Generate strong secrets with: openssl rand -base64 32');
  lines.push('================================================================================');
  lines.push('');

  return lines.join('\n');
}
