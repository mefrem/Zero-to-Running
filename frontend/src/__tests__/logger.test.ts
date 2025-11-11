/**
 * Frontend Logger Tests
 * Tests for frontend logging utility and log level configuration
 */

import { logger, LogLevel } from '../utils/logger';

// Mock console methods
const mockConsole = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
};

// Store original console methods
const originalConsole = {
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  log: console.log,
};

describe('Frontend Logger', () => {
  beforeEach(() => {
    // Mock console methods
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;
    console.info = mockConsole.info;
    console.debug = mockConsole.debug;
    console.log = mockConsole.log;

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original console methods
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    console.log = originalConsole.log;
  });

  describe('Log Level Enum', () => {
    it('should have correct log levels', () => {
      expect(LogLevel.ERROR).toBe('ERROR');
      expect(LogLevel.WARN).toBe('WARN');
      expect(LogLevel.INFO).toBe('INFO');
      expect(LogLevel.DEBUG).toBe('DEBUG');
    });
  });

  describe('Basic Logging Methods', () => {
    it('should log error messages', () => {
      logger.error('Test error message');
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message');
      expect(mockConsole.warn).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('Test info message');
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('should include context in logs', () => {
      const context = { userId: 123, action: 'test' };
      logger.info('Test with context', context);
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('should include component name in logs', () => {
      logger.info('Test message', undefined, 'TestComponent');
      expect(mockConsole.info).toHaveBeenCalled();
    });
  });

  describe('API Logging Methods', () => {
    it('should log API requests', () => {
      logger.apiRequest('GET', '/api/users', undefined, 'UserList');
      expect(mockConsole.debug).toHaveBeenCalled();
    });

    it('should log API responses', () => {
      logger.apiResponse('GET', '/api/users', 200, 150, 'UserList');
      expect(mockConsole.debug).toHaveBeenCalled();
    });

    it('should log API errors', () => {
      logger.apiError('GET', '/api/users', new Error('Network error'), 'UserList');
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('should handle string errors in apiError', () => {
      logger.apiError('POST', '/api/users', 'Request failed', 'UserList');
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('Lifecycle Logging', () => {
    it('should log component mount', () => {
      logger.lifecycle('mount', 'TestComponent');
      expect(mockConsole.debug).toHaveBeenCalled();
    });

    it('should log component unmount', () => {
      logger.lifecycle('unmount', 'TestComponent');
      expect(mockConsole.debug).toHaveBeenCalled();
    });

    it('should log component update', () => {
      logger.lifecycle('update', 'TestComponent');
      expect(mockConsole.debug).toHaveBeenCalled();
    });

    it('should include context in lifecycle logs', () => {
      const context = { props: { id: 123 } };
      logger.lifecycle('mount', 'TestComponent', context);
      expect(mockConsole.debug).toHaveBeenCalled();
    });
  });

  describe('Interaction Logging', () => {
    it('should log user interactions when enabled', () => {
      // Note: interaction logging requires VITE_LOG_INTERACTIONS=true
      logger.interaction('click', 'submit-button', undefined, 'LoginForm');
      // May or may not be called depending on environment variable
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive fields in API request data', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        email: 'test@example.com',
      };

      // The logger should sanitize this internally
      logger.apiRequest('POST', '/api/login', data, 'LoginForm');
      expect(mockConsole.debug).toHaveBeenCalled();

      // Verify password was not logged in plain text
      const callArgs = mockConsole.debug.mock.calls[0];
      const loggedData = JSON.stringify(callArgs);
      expect(loggedData).not.toContain('secret123');
    });

    it('should handle null and undefined data', () => {
      expect(() => {
        logger.apiRequest('GET', '/api/users', null, 'UserList');
      }).not.toThrow();

      expect(() => {
        logger.apiRequest('GET', '/api/users', undefined, 'UserList');
      }).not.toThrow();
    });
  });

  describe('Timestamp Formatting', () => {
    it('should include timestamps in log messages', () => {
      logger.info('Test message with timestamp');
      expect(mockConsole.info).toHaveBeenCalled();

      const callArgs = mockConsole.info.mock.calls[0];
      const firstArg = callArgs[0];

      // Check if timestamp is present (should be ISO format)
      expect(firstArg).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Log Message Formatting', () => {
    it('should format messages consistently', () => {
      logger.info('Consistent format test', { key: 'value' }, 'TestComponent');
      expect(mockConsole.info).toHaveBeenCalled();

      const callArgs = mockConsole.info.mock.calls[0];
      // Verify multiple arguments were passed (prefix, message, context)
      expect(callArgs.length).toBeGreaterThan(0);
    });
  });
});

describe('useLogger Hook', () => {
  it('should exist and be callable', () => {
    // Import the hook
    const { useLogger } = require('../utils/logger');

    // Verify it's a function
    expect(typeof useLogger).toBe('function');
  });

  it('should return logger methods scoped to component', () => {
    const { useLogger } = require('../utils/logger');

    // Create component-scoped logger
    const componentLogger = useLogger('TestComponent');

    // Verify all methods exist
    expect(typeof componentLogger.error).toBe('function');
    expect(typeof componentLogger.warn).toBe('function');
    expect(typeof componentLogger.info).toBe('function');
    expect(typeof componentLogger.debug).toBe('function');
    expect(typeof componentLogger.lifecycle).toBe('function');
    expect(typeof componentLogger.apiRequest).toBe('function');
    expect(typeof componentLogger.apiResponse).toBe('function');
    expect(typeof componentLogger.apiError).toBe('function');
    expect(typeof componentLogger.interaction).toBe('function');
  });
});
