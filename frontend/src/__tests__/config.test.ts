/**
 * Frontend Configuration Tests
 * Tests for frontend environment variable loading and validation
 */

// Mock import.meta.env before importing config module
const mockEnv = {
  MODE: 'development',
  DEV: true,
  VITE_API_URL: 'http://localhost:3001',
  VITE_LOG_LEVEL: 'INFO',
  VITE_PORT: '3000',
  VITE_LOG_INTERACTIONS: 'false',
};

// Mock import.meta
Object.defineProperty(import.meta, 'env', {
  get: () => mockEnv,
  configurable: true,
});

import { loadFrontendConfig, getConfigSummary } from '../config/env';

describe('Frontend Configuration', () => {
  beforeEach(() => {
    // Reset mock environment to defaults
    mockEnv.MODE = 'development';
    mockEnv.DEV = true;
    mockEnv.VITE_API_URL = 'http://localhost:3001';
    mockEnv.VITE_LOG_LEVEL = 'INFO';
    mockEnv.VITE_PORT = '3000';
    mockEnv.VITE_LOG_INTERACTIONS = 'false';
  });

  describe('loadFrontendConfig', () => {
    it('should load configuration with all variables set', () => {
      mockEnv.VITE_API_URL = 'http://localhost:8080';
      mockEnv.VITE_LOG_LEVEL = 'DEBUG';
      mockEnv.VITE_PORT = '4000';

      const config = loadFrontendConfig();

      expect(config.api.url).toBe('http://localhost:8080');
      expect(config.logging.level).toBe('DEBUG');
      expect(config.server.port).toBe(4000);
    });

    it('should use default values when optional variables not set', () => {
      // Remove optional env vars
      delete mockEnv.VITE_PORT;
      delete mockEnv.VITE_LOG_LEVEL;

      const config = loadFrontendConfig();

      expect(config.server.port).toBe(3000); // Default
      expect(config.logging.level).toBe('INFO'); // Default
    });

    it('should parse development environment correctly', () => {
      mockEnv.MODE = 'development';
      mockEnv.DEV = true;

      const config = loadFrontendConfig();

      expect(config.app.env).toBe('development');
      expect(config.features.enableHotReload).toBe(true);
    });

    it('should parse production environment correctly', () => {
      mockEnv.MODE = 'production';
      mockEnv.DEV = false;

      const config = loadFrontendConfig();

      expect(config.app.env).toBe('production');
      expect(config.features.enableHotReload).toBe(false);
    });

    it('should parse test environment correctly', () => {
      mockEnv.MODE = 'test';
      mockEnv.DEV = false;

      const config = loadFrontendConfig();

      expect(config.app.env).toBe('test');
    });
  });

  describe('Log Level Validation', () => {
    it('should accept valid log levels', () => {
      const validLevels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

      validLevels.forEach(level => {
        mockEnv.VITE_LOG_LEVEL = level;
        const config = loadFrontendConfig();
        expect(config.logging.level).toBe(level);
      });
    });

    it('should default to INFO for invalid log levels', () => {
      // Mock console.warn to avoid cluttering test output
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockEnv.VITE_LOG_LEVEL = 'INVALID';
      const config = loadFrontendConfig();

      expect(config.logging.level).toBe('INFO');
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should be case-insensitive for log levels', () => {
      mockEnv.VITE_LOG_LEVEL = 'debug';
      const config = loadFrontendConfig();
      expect(config.logging.level).toBe('DEBUG');

      mockEnv.VITE_LOG_LEVEL = 'Info';
      const config2 = loadFrontendConfig();
      expect(config2.logging.level).toBe('INFO');
    });
  });

  describe('API URL Validation', () => {
    it('should accept valid HTTP URLs', () => {
      mockEnv.VITE_API_URL = 'http://localhost:3001';
      const config = loadFrontendConfig();
      expect(config.api.url).toBe('http://localhost:3001');
    });

    it('should accept valid HTTPS URLs', () => {
      mockEnv.VITE_API_URL = 'https://api.example.com';
      const config = loadFrontendConfig();
      expect(config.api.url).toBe('https://api.example.com');
    });

    it('should accept URLs with ports', () => {
      mockEnv.VITE_API_URL = 'http://api.example.com:8080';
      const config = loadFrontendConfig();
      expect(config.api.url).toBe('http://api.example.com:8080');
    });

    it('should accept URLs with paths', () => {
      mockEnv.VITE_API_URL = 'http://localhost:3001/api/v1';
      const config = loadFrontendConfig();
      expect(config.api.url).toBe('http://localhost:3001/api/v1');
    });

    it('should throw error for invalid URLs', () => {
      mockEnv.VITE_API_URL = 'not-a-valid-url';
      expect(() => loadFrontendConfig()).toThrow();
    });

    it('should use default if API URL not set', () => {
      delete mockEnv.VITE_API_URL;
      const config = loadFrontendConfig();
      expect(config.api.url).toBe('http://localhost:3001');
    });
  });

  describe('Port Validation', () => {
    it('should accept valid port numbers', () => {
      mockEnv.VITE_PORT = '8080';
      const config = loadFrontendConfig();
      expect(config.server.port).toBe(8080);
    });

    it('should reject invalid port numbers', () => {
      mockEnv.VITE_PORT = '70000'; // Out of range
      expect(() => loadFrontendConfig()).toThrow();
    });

    it('should reject negative port numbers', () => {
      mockEnv.VITE_PORT = '-1';
      expect(() => loadFrontendConfig()).toThrow();
    });

    it('should use default port if not set', () => {
      delete mockEnv.VITE_PORT;
      const config = loadFrontendConfig();
      expect(config.server.port).toBe(3000);
    });

    it('should handle non-numeric port values gracefully', () => {
      mockEnv.VITE_PORT = 'invalid';
      const config = loadFrontendConfig();
      expect(config.server.port).toBe(3000); // Falls back to default
    });
  });

  describe('Boolean Environment Variables', () => {
    it('should parse "true" as boolean true', () => {
      mockEnv.VITE_LOG_INTERACTIONS = 'true';
      const config = loadFrontendConfig();
      expect(config.logging.logInteractions).toBe(true);
    });

    it('should parse "false" as boolean false', () => {
      mockEnv.VITE_LOG_INTERACTIONS = 'false';
      const config = loadFrontendConfig();
      expect(config.logging.logInteractions).toBe(false);
    });

    it('should be case-insensitive for booleans', () => {
      mockEnv.VITE_LOG_INTERACTIONS = 'TRUE';
      const config = loadFrontendConfig();
      expect(config.logging.logInteractions).toBe(true);

      mockEnv.VITE_LOG_INTERACTIONS = 'FALSE';
      const config2 = loadFrontendConfig();
      expect(config2.logging.logInteractions).toBe(false);
    });

    it('should default to false for non-boolean values', () => {
      mockEnv.VITE_LOG_INTERACTIONS = 'invalid';
      const config = loadFrontendConfig();
      expect(config.logging.logInteractions).toBe(false);
    });
  });

  describe('Feature Flags', () => {
    it('should enable hot reload in development mode', () => {
      mockEnv.DEV = true;
      const config = loadFrontendConfig();
      expect(config.features.enableHotReload).toBe(true);
    });

    it('should disable hot reload in production mode', () => {
      mockEnv.DEV = false;
      const config = loadFrontendConfig();
      expect(config.features.enableHotReload).toBe(false);
    });

    it('should respect VITE_ENABLE_SOURCE_MAPS setting', () => {
      mockEnv.VITE_ENABLE_SOURCE_MAPS = 'true';
      const config = loadFrontendConfig();
      expect(config.features.enableSourceMaps).toBe(true);

      mockEnv.VITE_ENABLE_SOURCE_MAPS = 'false';
      const config2 = loadFrontendConfig();
      expect(config2.features.enableSourceMaps).toBe(false);
    });
  });

  describe('Application Settings', () => {
    it('should use default app name if not set', () => {
      delete mockEnv.VITE_APP_NAME;
      const config = loadFrontendConfig();
      expect(config.app.name).toBe('Zero-to-Running');
    });

    it('should use custom app name if set', () => {
      mockEnv.VITE_APP_NAME = 'Custom App';
      const config = loadFrontendConfig();
      expect(config.app.name).toBe('Custom App');
    });
  });

  describe('getConfigSummary', () => {
    it('should return configuration summary', () => {
      const config = loadFrontendConfig();
      const summary = getConfigSummary();

      expect(summary).toHaveProperty('app');
      expect(summary).toHaveProperty('server');
      expect(summary).toHaveProperty('api');
      expect(summary).toHaveProperty('logging');
      expect(summary).toHaveProperty('features');
    });

    it('should not include sensitive data in summary', () => {
      const summary = getConfigSummary();
      const summaryString = JSON.stringify(summary);

      // Should not contain common sensitive field names
      expect(summaryString).not.toContain('password');
      expect(summaryString).not.toContain('secret');
      expect(summaryString).not.toContain('token');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration on load', () => {
      // Valid configuration should not throw
      expect(() => loadFrontendConfig()).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      mockEnv.VITE_API_URL = ''; // Empty required field
      expect(() => loadFrontendConfig()).toThrow();
    });

    it('should handle gracefully when environment is undefined', () => {
      delete mockEnv.MODE;
      delete mockEnv.DEV;

      const config = loadFrontendConfig();
      expect(config.app.env).toBe('development'); // Should default to development
    });
  });

  describe('Different Environment Scenarios', () => {
    it('should configure for local development', () => {
      mockEnv.MODE = 'development';
      mockEnv.DEV = true;
      mockEnv.VITE_API_URL = 'http://localhost:3001';

      const config = loadFrontendConfig();

      expect(config.app.env).toBe('development');
      expect(config.api.url).toBe('http://localhost:3001');
      expect(config.features.enableHotReload).toBe(true);
    });

    it('should configure for staging environment', () => {
      mockEnv.MODE = 'production';
      mockEnv.DEV = false;
      mockEnv.VITE_API_URL = 'https://api.staging.example.com';
      mockEnv.VITE_LOG_LEVEL = 'WARN';

      const config = loadFrontendConfig();

      expect(config.app.env).toBe('production');
      expect(config.api.url).toBe('https://api.staging.example.com');
      expect(config.logging.level).toBe('WARN');
      expect(config.features.enableHotReload).toBe(false);
    });

    it('should configure for production environment', () => {
      mockEnv.MODE = 'production';
      mockEnv.DEV = false;
      mockEnv.VITE_API_URL = 'https://api.example.com';
      mockEnv.VITE_LOG_LEVEL = 'ERROR';
      mockEnv.VITE_ENABLE_SOURCE_MAPS = 'false';

      const config = loadFrontendConfig();

      expect(config.app.env).toBe('production');
      expect(config.api.url).toBe('https://api.example.com');
      expect(config.logging.level).toBe('ERROR');
      expect(config.features.enableSourceMaps).toBe(false);
    });
  });
});
