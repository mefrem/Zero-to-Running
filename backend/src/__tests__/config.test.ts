/**
 * Configuration Tests
 * Tests for environment variable loading, validation, and configuration object creation
 */

import {
  validatePort,
  validateEmail,
  validateUrl,
  validateEnum,
  validateRequired,
  validateRange,
  validateDatabasePassword,
  validateSessionSecret,
  checkDuplicatePorts,
  validateConfig,
  ConfigError,
} from '../utils/config-validator';

describe('Configuration Validator', () => {
  describe('validatePort', () => {
    it('should accept valid ports', () => {
      expect(() => validatePort(3000, 'TEST_PORT')).not.toThrow();
      expect(() => validatePort(8080, 'TEST_PORT')).not.toThrow();
      expect(() => validatePort(65535, 'TEST_PORT')).not.toThrow();
      expect(() => validatePort(1, 'TEST_PORT')).not.toThrow();
    });

    it('should reject ports out of range', () => {
      expect(() => validatePort(0, 'TEST_PORT')).toThrow(ConfigError);
      expect(() => validatePort(65536, 'TEST_PORT')).toThrow(ConfigError);
      expect(() => validatePort(-1, 'TEST_PORT')).toThrow(ConfigError);
      expect(() => validatePort(100000, 'TEST_PORT')).toThrow(ConfigError);
    });

    it('should reject non-integer ports', () => {
      expect(() => validatePort(3000.5, 'TEST_PORT')).toThrow(ConfigError);
      expect(() => validatePort(NaN, 'TEST_PORT')).toThrow(ConfigError);
    });

    it('should warn about privileged ports', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      validatePort(80, 'TEST_PORT');
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(() => validateEmail('test@example.com', 'EMAIL')).not.toThrow();
      expect(() => validateEmail('user.name@domain.co.uk', 'EMAIL')).not.toThrow();
      expect(() => validateEmail('user+tag@example.com', 'EMAIL')).not.toThrow();
    });

    it('should reject invalid email addresses', () => {
      expect(() => validateEmail('invalid', 'EMAIL')).toThrow(ConfigError);
      expect(() => validateEmail('missing@domain', 'EMAIL')).toThrow(ConfigError);
      expect(() => validateEmail('@example.com', 'EMAIL')).toThrow(ConfigError);
      expect(() => validateEmail('user@', 'EMAIL')).toThrow(ConfigError);
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      expect(() => validateUrl('http://localhost:3000', 'URL')).not.toThrow();
      expect(() => validateUrl('https://example.com', 'URL')).not.toThrow();
      expect(() => validateUrl('http://api.example.com:8080/v1', 'URL')).not.toThrow();
    });

    it('should reject invalid URLs', () => {
      expect(() => validateUrl('not-a-url', 'URL')).toThrow(ConfigError);
      expect(() => validateUrl('ftp://invalid', 'URL')).toThrow(ConfigError);
      expect(() => validateUrl('', 'URL')).toThrow(ConfigError);
    });
  });

  describe('validateEnum', () => {
    it('should accept valid enum values', () => {
      expect(() => validateEnum('info', ['error', 'warn', 'info', 'debug'], 'LOG_LEVEL')).not.toThrow();
      expect(() => validateEnum('error', ['error', 'warn', 'info', 'debug'], 'LOG_LEVEL')).not.toThrow();
    });

    it('should reject invalid enum values', () => {
      expect(() => validateEnum('invalid', ['error', 'warn', 'info', 'debug'], 'LOG_LEVEL')).toThrow(ConfigError);
      expect(() => validateEnum('trace', ['error', 'warn', 'info', 'debug'], 'LOG_LEVEL')).toThrow(ConfigError);
    });
  });

  describe('validateRequired', () => {
    it('should accept non-empty values', () => {
      expect(() => validateRequired('some-value', 'FIELD')).not.toThrow();
      expect(() => validateRequired('123', 'FIELD')).not.toThrow();
    });

    it('should reject empty or undefined values', () => {
      expect(() => validateRequired(undefined, 'FIELD')).toThrow(ConfigError);
      expect(() => validateRequired('', 'FIELD')).toThrow(ConfigError);
      expect(() => validateRequired('   ', 'FIELD')).toThrow(ConfigError);
    });
  });

  describe('validateRange', () => {
    it('should accept values within range', () => {
      expect(() => validateRange(5, 1, 10, 'VALUE')).not.toThrow();
      expect(() => validateRange(1, 1, 10, 'VALUE')).not.toThrow();
      expect(() => validateRange(10, 1, 10, 'VALUE')).not.toThrow();
    });

    it('should reject values outside range', () => {
      expect(() => validateRange(0, 1, 10, 'VALUE')).toThrow(ConfigError);
      expect(() => validateRange(11, 1, 10, 'VALUE')).toThrow(ConfigError);
      expect(() => validateRange(-5, 1, 10, 'VALUE')).toThrow(ConfigError);
    });
  });

  describe('validateDatabasePassword', () => {
    it('should accept strong passwords', () => {
      expect(() => validateDatabasePassword('StrongPassword123!')).not.toThrow();
      expect(() => validateDatabasePassword('my-secure-db-pass-2024')).not.toThrow();
    });

    it('should reject weak/default passwords', () => {
      expect(() => validateDatabasePassword('password')).toThrow(ConfigError);
      expect(() => validateDatabasePassword('postgres')).toThrow(ConfigError);
      expect(() => validateDatabasePassword('123456')).toThrow(ConfigError);
      expect(() => validateDatabasePassword('CHANGE_ME_secure_password_123')).toThrow(ConfigError);
    });

    it('should reject short passwords', () => {
      expect(() => validateDatabasePassword('short')).toThrow(ConfigError);
      expect(() => validateDatabasePassword('1234567')).toThrow(ConfigError);
    });

    it('should reject empty passwords', () => {
      expect(() => validateDatabasePassword('')).toThrow(ConfigError);
    });
  });

  describe('validateSessionSecret', () => {
    it('should accept strong secrets', () => {
      const strongSecret = 'a'.repeat(32);
      expect(() => validateSessionSecret(strongSecret)).not.toThrow();
      expect(() => validateSessionSecret('my-very-long-random-secret-key-12345678')).not.toThrow();
    });

    it('should reject weak/default secrets', () => {
      expect(() => validateSessionSecret('secret')).toThrow(ConfigError);
      expect(() => validateSessionSecret('CHANGE_ME_random_session_secret_key_xyz789')).toThrow(ConfigError);
    });

    it('should reject short secrets', () => {
      expect(() => validateSessionSecret('short')).toThrow(ConfigError);
      expect(() => validateSessionSecret('a'.repeat(31))).toThrow(ConfigError);
    });

    it('should reject empty secrets', () => {
      expect(() => validateSessionSecret('')).toThrow(ConfigError);
    });
  });

  describe('checkDuplicatePorts', () => {
    it('should accept unique ports', () => {
      const ports = {
        FRONTEND_PORT: 3000,
        BACKEND_PORT: 3001,
        DATABASE_PORT: 5432,
        REDIS_PORT: 6379,
      };
      expect(() => checkDuplicatePorts(ports)).not.toThrow();
    });

    it('should reject duplicate ports', () => {
      const ports = {
        FRONTEND_PORT: 3000,
        BACKEND_PORT: 3000, // Duplicate
        DATABASE_PORT: 5432,
      };
      expect(() => checkDuplicatePorts(ports)).toThrow(ConfigError);
    });

    it('should detect multiple duplicates', () => {
      const ports = {
        FRONTEND_PORT: 3000,
        BACKEND_PORT: 3000, // Duplicate
        DATABASE_PORT: 3000, // Also duplicate
      };
      expect(() => checkDuplicatePorts(ports)).toThrow(ConfigError);
    });
  });

  describe('validateConfig', () => {
    const createValidConfig = () => ({
      app: {
        name: 'Test App',
        version: '1.0.0',
        env: 'development' as const,
      },
      server: {
        port: 3001,
        host: '0.0.0.0',
      },
      database: {
        host: 'localhost',
        port: 5432,
        name: 'test_db',
        user: 'postgres',
        password: 'StrongPassword123!',
        poolMin: 2,
        poolMax: 10,
      },
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
      },
      logging: {
        level: 'info' as const,
        format: 'json' as const,
      },
      cors: {
        origin: ['http://localhost:3000'],
        credentials: true,
      },
      api: {
        basePath: '/api',
        rateLimitWindowMs: 60000,
        rateLimitMaxRequests: 100,
        requestTimeout: 30000,
      },
      security: {
        sessionSecret: 'a'.repeat(32),
        sessionMaxAge: 86400000,
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
      development: {
        nodeDebugPort: 9229,
      },
    });

    it('should validate a valid configuration', () => {
      const config = createValidConfig();
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid port numbers', () => {
      const config = createValidConfig();
      config.server.port = 70000; // Invalid port
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect duplicate ports', () => {
      const config = createValidConfig();
      config.server.port = 5432; // Same as database port
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate port'))).toBe(true);
    });

    it('should detect weak database password', () => {
      const config = createValidConfig();
      config.database.password = 'password'; // Weak password
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('DATABASE_PASSWORD'))).toBe(true);
    });

    it('should detect weak session secret', () => {
      const config = createValidConfig();
      config.security.sessionSecret = 'secret'; // Weak secret
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('SESSION_SECRET'))).toBe(true);
    });

    it('should detect invalid pool settings', () => {
      const config = createValidConfig();
      config.database.poolMin = 20;
      config.database.poolMax = 10; // Min > Max
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('POOL_MIN'))).toBe(true);
    });

    it('should detect invalid CORS origins', () => {
      const config = createValidConfig();
      config.cors.origin = ['not-a-valid-url']; // Invalid URL
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('CORS origin'))).toBe(true);
    });

    it('should warn about debug log level in production', () => {
      const config = createValidConfig();
      config.app.env = 'production';
      config.logging.level = 'debug';
      const result = validateConfig(config);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('LOG_LEVEL'))).toBe(true);
    });

    it('should warn about verbose errors in production', () => {
      const config = createValidConfig();
      config.app.env = 'production';
      config.features.verboseErrors = true;
      const result = validateConfig(config);
      expect(result.warnings.some(w => w.includes('VERBOSE_ERRORS'))).toBe(true);
    });

    it('should warn about weak JWT secret', () => {
      const config = createValidConfig();
      config.security.jwtSecret = 'short'; // Too short
      const result = validateConfig(config);
      expect(result.warnings.some(w => w.includes('JWT_SECRET'))).toBe(true);
    });

    it('should warn about low bcrypt salt rounds', () => {
      const config = createValidConfig();
      config.security.bcryptSaltRounds = 5; // Below recommended
      const result = validateConfig(config);
      expect(result.warnings.some(w => w.includes('BCRYPT_SALT_ROUNDS'))).toBe(true);
    });
  });

  describe('ConfigError', () => {
    it('should be an instance of Error', () => {
      const error = new ConfigError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConfigError');
    });

    it('should have correct message', () => {
      const error = new ConfigError('Test error message');
      expect(error.message).toBe('Test error message');
    });
  });
});

describe('Environment Variable Loading', () => {
  // Store original environment
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should load configuration with all environment variables set', () => {
    // Set required environment variables
    process.env.DATABASE_PASSWORD = 'StrongTestPassword123!';
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.PORT = '3001';
    process.env.LOG_LEVEL = 'info';
    process.env.NODE_ENV = 'development';

    // Import config module (must be after setting env vars)
    const { loadConfig } = require('../config/env');
    const config = loadConfig();

    expect(config.server.port).toBe(3001);
    expect(config.logging.level).toBe('info');
    expect(config.app.env).toBe('development');
    expect(config.database.password).toBe('StrongTestPassword123!');
  });

  it('should use default values when optional variables not set', () => {
    process.env.DATABASE_PASSWORD = 'StrongTestPassword123!';
    process.env.SESSION_SECRET = 'a'.repeat(32);

    const { loadConfig } = require('../config/env');
    const config = loadConfig();

    expect(config.server.port).toBe(3001); // Default
    expect(config.database.host).toBe('postgres'); // Default
    expect(config.redis.port).toBe(6379); // Default
  });

  it('should throw error when required variables are missing', () => {
    // Don't set DATABASE_PASSWORD
    process.env.SESSION_SECRET = 'a'.repeat(32);

    const { loadConfig } = require('../config/env');
    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it('should parse integer environment variables correctly', () => {
    process.env.DATABASE_PASSWORD = 'StrongTestPassword123!';
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.PORT = '8080';
    process.env.DATABASE_POOL_MAX = '20';

    const { loadConfig } = require('../config/env');
    const config = loadConfig();

    expect(config.server.port).toBe(8080);
    expect(config.database.poolMax).toBe(20);
  });

  it('should parse boolean environment variables correctly', () => {
    process.env.DATABASE_PASSWORD = 'StrongTestPassword123!';
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.ENABLE_HTTPS = 'true';
    process.env.ENABLE_METRICS = 'false';

    const { loadConfig } = require('../config/env');
    const config = loadConfig();

    expect(config.security.enableHttps).toBe(true);
    expect(config.features.enableMetrics).toBe(false);
  });

  it('should parse CORS_ORIGIN as array', () => {
    process.env.DATABASE_PASSWORD = 'StrongTestPassword123!';
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.CORS_ORIGIN = 'http://localhost:3000,http://localhost:3001,https://example.com';

    const { loadConfig } = require('../config/env');
    const config = loadConfig();

    expect(config.cors.origin).toHaveLength(3);
    expect(config.cors.origin).toContain('http://localhost:3000');
    expect(config.cors.origin).toContain('https://example.com');
  });
});
