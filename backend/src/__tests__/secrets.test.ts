/**
 * Secret Validation Tests
 *
 * Tests for mock secret detection, validation, and warnings
 */

import {
  isMockSecret,
  detectMockSecrets,
  formatMockSecretValue,
  formatMockSecretWarning,
  validateDatabasePassword,
  validateSessionSecret,
  MockSecret,
} from '../utils/config-validator';
import type { AppConfig } from '../config/env';

describe('Mock Secret Detection', () => {
  describe('isMockSecret', () => {
    it('should detect secrets with CHANGE_ME_ prefix', () => {
      expect(isMockSecret('CHANGE_ME_postgres_123')).toBe(true);
      expect(isMockSecret('CHANGE_ME_redis_123')).toBe(true);
      expect(isMockSecret('CHANGE_ME_session_secret_32_character_minimum')).toBe(true);
    });

    it('should not flag real secrets', () => {
      expect(isMockSecret('my_real_password_123')).toBe(false);
      expect(isMockSecret('AbCd1234!@#$')).toBe(false);
      expect(isMockSecret('verylongsecretkey32characterslong')).toBe(false);
    });

    it('should handle undefined values', () => {
      expect(isMockSecret(undefined)).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(isMockSecret('change_me_postgres_123')).toBe(false);
      expect(isMockSecret('Change_Me_postgres_123')).toBe(false);
    });
  });

  describe('formatMockSecretValue', () => {
    it('should show full value for short secrets', () => {
      expect(formatMockSecretValue('CHANGE_ME_short')).toBe('CHANGE_ME_short');
    });

    it('should truncate long secrets with ellipsis', () => {
      const longSecret = 'CHANGE_ME_this_is_a_very_long_secret_value_for_testing';
      expect(formatMockSecretValue(longSecret)).toBe('CHANGE_ME_this_is_a_...');
    });

    it('should show exactly 20 characters before ellipsis', () => {
      const secret = 'CHANGE_ME_1234567890123456789';
      const formatted = formatMockSecretValue(secret);
      expect(formatted).toHaveLength(23); // 20 chars + '...'
    });
  });

  describe('detectMockSecrets', () => {
    it('should detect all mock secrets in config', () => {
      const config: AppConfig = {
        app: { name: 'Test', version: '1.0.0', env: 'development' },
        server: { port: 3001, host: '0.0.0.0' },
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test',
          user: 'postgres',
          password: 'CHANGE_ME_postgres_123',
          poolMin: 2,
          poolMax: 10,
        },
        redis: {
          host: 'localhost',
          port: 6379,
          password: 'CHANGE_ME_redis_123',
          db: 0,
        },
        logging: { level: 'info', format: 'json' },
        cors: { origin: ['http://localhost:3000'], credentials: true },
        api: {
          basePath: '/api',
          rateLimitWindowMs: 60000,
          rateLimitMaxRequests: 100,
          requestTimeout: 30000,
        },
        security: {
          sessionSecret: 'CHANGE_ME_session_secret_32_character_minimum',
          sessionMaxAge: 86400000,
          jwtSecret: 'CHANGE_ME_jwt_secret_32_character_minimum',
          jwtExpiration: '7d',
          bcryptSaltRounds: 10,
          enableHttps: false,
        },
        features: {
          enableApiDocs: true,
          enableHealthChecks: true,
          enableMetrics: false,
          enableAutoSeed: false,
          enableExperimentalFeatures: false,
          verboseErrors: true,
        },
        development: { nodeDebugPort: 9229 },
      };

      const mockSecrets = detectMockSecrets(config);

      expect(mockSecrets).toHaveLength(4);
      expect(mockSecrets.map(s => s.name)).toEqual([
        'DATABASE_PASSWORD',
        'REDIS_PASSWORD',
        'SESSION_SECRET',
        'JWT_SECRET',
      ]);
    });

    it('should detect only database password if others are real', () => {
      const config: AppConfig = {
        app: { name: 'Test', version: '1.0.0', env: 'development' },
        server: { port: 3001, host: '0.0.0.0' },
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test',
          user: 'postgres',
          password: 'CHANGE_ME_postgres_123',
          poolMin: 2,
          poolMax: 10,
        },
        redis: {
          host: 'localhost',
          port: 6379,
          password: 'real_redis_password',
          db: 0,
        },
        logging: { level: 'info', format: 'json' },
        cors: { origin: ['http://localhost:3000'], credentials: true },
        api: {
          basePath: '/api',
          rateLimitWindowMs: 60000,
          rateLimitMaxRequests: 100,
          requestTimeout: 30000,
        },
        security: {
          sessionSecret: 'real_session_secret_32_characters_long_string',
          sessionMaxAge: 86400000,
          jwtSecret: 'real_jwt_secret_key_32_characters_long',
          jwtExpiration: '7d',
          bcryptSaltRounds: 10,
          enableHttps: false,
        },
        features: {
          enableApiDocs: true,
          enableHealthChecks: true,
          enableMetrics: false,
          enableAutoSeed: false,
          enableExperimentalFeatures: false,
          verboseErrors: true,
        },
        development: { nodeDebugPort: 9229 },
      };

      const mockSecrets = detectMockSecrets(config);

      expect(mockSecrets).toHaveLength(1);
      expect(mockSecrets[0].name).toBe('DATABASE_PASSWORD');
    });

    it('should return empty array if no mock secrets', () => {
      const config: AppConfig = {
        app: { name: 'Test', version: '1.0.0', env: 'production' },
        server: { port: 3001, host: '0.0.0.0' },
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test',
          user: 'postgres',
          password: 'real_password_123',
          poolMin: 2,
          poolMax: 10,
        },
        redis: {
          host: 'localhost',
          port: 6379,
          password: 'real_redis_password',
          db: 0,
        },
        logging: { level: 'info', format: 'json' },
        cors: { origin: ['http://localhost:3000'], credentials: true },
        api: {
          basePath: '/api',
          rateLimitWindowMs: 60000,
          rateLimitMaxRequests: 100,
          requestTimeout: 30000,
        },
        security: {
          sessionSecret: 'real_session_secret_32_characters_long_string',
          sessionMaxAge: 86400000,
          jwtSecret: 'real_jwt_secret_key_32_characters_long',
          jwtExpiration: '7d',
          bcryptSaltRounds: 10,
          enableHttps: false,
        },
        features: {
          enableApiDocs: true,
          enableHealthChecks: true,
          enableMetrics: false,
          enableAutoSeed: false,
          enableExperimentalFeatures: false,
          verboseErrors: true,
        },
        development: { nodeDebugPort: 9229 },
      };

      const mockSecrets = detectMockSecrets(config);

      expect(mockSecrets).toHaveLength(0);
    });

    it('should handle optional secrets (undefined)', () => {
      const config: AppConfig = {
        app: { name: 'Test', version: '1.0.0', env: 'development' },
        server: { port: 3001, host: '0.0.0.0' },
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test',
          user: 'postgres',
          password: 'real_password',
          poolMin: 2,
          poolMax: 10,
        },
        redis: {
          host: 'localhost',
          port: 6379,
          password: undefined, // No password
          db: 0,
        },
        logging: { level: 'info', format: 'json' },
        cors: { origin: ['http://localhost:3000'], credentials: true },
        api: {
          basePath: '/api',
          rateLimitWindowMs: 60000,
          rateLimitMaxRequests: 100,
          requestTimeout: 30000,
        },
        security: {
          sessionSecret: 'real_session_secret_32_characters_long_string',
          sessionMaxAge: 86400000,
          jwtSecret: undefined, // No JWT
          jwtExpiration: undefined,
          bcryptSaltRounds: 10,
          enableHttps: false,
        },
        features: {
          enableApiDocs: true,
          enableHealthChecks: true,
          enableMetrics: false,
          enableAutoSeed: false,
          enableExperimentalFeatures: false,
          verboseErrors: true,
        },
        development: { nodeDebugPort: 9229 },
      };

      const mockSecrets = detectMockSecrets(config);

      expect(mockSecrets).toHaveLength(0);
    });
  });

  describe('formatMockSecretWarning', () => {
    it('should return empty string for no mock secrets', () => {
      const warning = formatMockSecretWarning([]);
      expect(warning).toBe('');
    });

    it('should format single mock secret warning', () => {
      const mockSecrets: MockSecret[] = [
        { name: 'DATABASE_PASSWORD', value: 'CHANGE_ME_postgres_123' },
      ];

      const warning = formatMockSecretWarning(mockSecrets);

      expect(warning).toContain('WARNING: Mock secrets detected');
      expect(warning).toContain('DATABASE_PASSWORD');
      expect(warning).toContain('CHANGE_ME_postgres_123');
      expect(warning).toContain('safe for local development');
      expect(warning).toContain('/docs/SECRET_MANAGEMENT.md');
    });

    it('should format multiple mock secrets warning', () => {
      const mockSecrets: MockSecret[] = [
        { name: 'DATABASE_PASSWORD', value: 'CHANGE_ME_postgres_123' },
        { name: 'REDIS_PASSWORD', value: 'CHANGE_ME_redis_123' },
        { name: 'SESSION_SECRET', value: 'CHANGE_ME_session_secret_32_character_minimum' },
      ];

      const warning = formatMockSecretWarning(mockSecrets);

      expect(warning).toContain('DATABASE_PASSWORD');
      expect(warning).toContain('REDIS_PASSWORD');
      expect(warning).toContain('SESSION_SECRET');
      expect(warning).toContain('CHANGE_ME_postgres_123');
      expect(warning).toContain('CHANGE_ME_redis_123');
      expect(warning).toContain('CHANGE_ME_session_sec...');
    });

    it('should include helpful documentation links', () => {
      const mockSecrets: MockSecret[] = [
        { name: 'DATABASE_PASSWORD', value: 'CHANGE_ME_postgres_123' },
      ];

      const warning = formatMockSecretWarning(mockSecrets);

      expect(warning).toContain('/docs/SECRET_MANAGEMENT.md');
      expect(warning).toContain('openssl rand -base64 32');
    });
  });
});

describe('Password and Secret Validation', () => {
  describe('validateDatabasePassword', () => {
    it('should warn for mock secrets but not throw', () => {
      const warnings = validateDatabasePassword('CHANGE_ME_postgres_123');

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('mock development value');
      expect(warnings[0]).toContain('safe for local development');
    });

    it('should throw for empty password', () => {
      expect(() => validateDatabasePassword('')).toThrow('DATABASE_PASSWORD is required');
    });

    it('should throw for weak passwords', () => {
      expect(() => validateDatabasePassword('password')).toThrow('weak password');
      expect(() => validateDatabasePassword('123456')).toThrow('weak password');
      expect(() => validateDatabasePassword('admin')).toThrow('weak password');
    });

    it('should throw for short passwords', () => {
      expect(() => validateDatabasePassword('short')).toThrow('at least 8 characters');
    });

    it('should return empty warnings for strong real passwords', () => {
      const warnings = validateDatabasePassword('my_strong_password_123');
      expect(warnings).toHaveLength(0);
    });

    it('should not apply other validations to mock secrets', () => {
      // Even though "CHANGE_ME_123" is technically short, mock secrets only warn
      const warnings = validateDatabasePassword('CHANGE_ME_123');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('mock development value');
    });
  });

  describe('validateSessionSecret', () => {
    it('should warn for mock secrets but not throw', () => {
      const warnings = validateSessionSecret('CHANGE_ME_session_secret_32_character_minimum');

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('mock development value');
      expect(warnings[0]).toContain('safe for local development');
    });

    it('should throw for empty secret', () => {
      expect(() => validateSessionSecret('')).toThrow('SESSION_SECRET is required');
    });

    it('should throw for weak secrets', () => {
      expect(() => validateSessionSecret('secret')).toThrow('weak value');
      expect(() => validateSessionSecret('session')).toThrow('weak value');
    });

    it('should throw for short secrets', () => {
      expect(() => validateSessionSecret('short_secret')).toThrow('at least 32 characters');
    });

    it('should return empty warnings for strong real secrets', () => {
      const warnings = validateSessionSecret('my_very_long_session_secret_key_32_characters_long');
      expect(warnings).toHaveLength(0);
    });

    it('should not apply other validations to mock secrets', () => {
      // Even though this is short, mock secrets only warn
      const warnings = validateSessionSecret('CHANGE_ME_short');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('mock development value');
    });
  });
});

describe('Integration Tests', () => {
  it('should allow application to start with mock secrets', () => {
    const config: AppConfig = {
      app: { name: 'Test', version: '1.0.0', env: 'development' },
      server: { port: 3001, host: '0.0.0.0' },
      database: {
        host: 'localhost',
        port: 5432,
        name: 'test',
        user: 'postgres',
        password: 'CHANGE_ME_postgres_123',
        poolMin: 2,
        poolMax: 10,
      },
      redis: {
        host: 'localhost',
        port: 6379,
        password: 'CHANGE_ME_redis_123',
        db: 0,
      },
      logging: { level: 'info', format: 'json' },
      cors: { origin: ['http://localhost:3000'], credentials: true },
      api: {
        basePath: '/api',
        rateLimitWindowMs: 60000,
        rateLimitMaxRequests: 100,
        requestTimeout: 30000,
      },
      security: {
        sessionSecret: 'CHANGE_ME_session_secret_32_character_minimum',
        sessionMaxAge: 86400000,
        jwtSecret: 'CHANGE_ME_jwt_secret_32_character_minimum',
        jwtExpiration: '7d',
        bcryptSaltRounds: 10,
        enableHttps: false,
      },
      features: {
        enableApiDocs: true,
        enableHealthChecks: true,
        enableMetrics: false,
        enableAutoSeed: false,
        enableExperimentalFeatures: false,
        verboseErrors: true,
      },
      development: { nodeDebugPort: 9229 },
    };

    // Mock secrets should be detected
    const mockSecrets = detectMockSecrets(config);
    expect(mockSecrets.length).toBeGreaterThan(0);

    // But validation should succeed with warnings
    const dbPasswordWarnings = validateDatabasePassword(config.database.password);
    expect(dbPasswordWarnings).toHaveLength(1);

    const sessionSecretWarnings = validateSessionSecret(config.security.sessionSecret);
    expect(sessionSecretWarnings).toHaveLength(1);

    // Application should be able to use these values (they're valid, just mock)
    expect(config.database.password).toBeTruthy();
    expect(config.security.sessionSecret).toBeTruthy();
  });

  it('should not warn for real secrets in production config', () => {
    const config: AppConfig = {
      app: { name: 'Test', version: '1.0.0', env: 'production' },
      server: { port: 3001, host: '0.0.0.0' },
      database: {
        host: 'prod-db.example.com',
        port: 5432,
        name: 'production_db',
        user: 'postgres',
        password: 'strong_production_password_123',
        poolMin: 5,
        poolMax: 20,
      },
      redis: {
        host: 'prod-redis.example.com',
        port: 6379,
        password: 'strong_redis_password_123',
        db: 0,
      },
      logging: { level: 'warn', format: 'json' },
      cors: { origin: ['https://example.com'], credentials: true },
      api: {
        basePath: '/api',
        rateLimitWindowMs: 60000,
        rateLimitMaxRequests: 100,
        requestTimeout: 30000,
      },
      security: {
        sessionSecret: 'very_long_production_session_secret_key_32_characters_long',
        sessionMaxAge: 86400000,
        jwtSecret: 'very_long_production_jwt_secret_key_32_characters_long',
        jwtExpiration: '1h',
        bcryptSaltRounds: 12,
        enableHttps: true,
      },
      features: {
        enableApiDocs: false,
        enableHealthChecks: true,
        enableMetrics: true,
        enableAutoSeed: false,
        enableExperimentalFeatures: false,
        verboseErrors: false,
      },
      development: { nodeDebugPort: 9229 },
    };

    // No mock secrets should be detected
    const mockSecrets = detectMockSecrets(config);
    expect(mockSecrets).toHaveLength(0);

    // No warnings should be returned
    const dbPasswordWarnings = validateDatabasePassword(config.database.password);
    expect(dbPasswordWarnings).toHaveLength(0);

    const sessionSecretWarnings = validateSessionSecret(config.security.sessionSecret);
    expect(sessionSecretWarnings).toHaveLength(0);
  });
});
