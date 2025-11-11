/**
 * Tests for Enhanced Error Messages
 * Story 4.4: Enhanced Error Messages & Developer Feedback
 */

import { describe, it, expect } from '@jest/globals';
import {
  discriminateNetworkError,
  createDatabaseConnectionError,
  createDatabaseQueryError,
  createRedisConnectionError,
  createRedisOperationError,
  createConfigValidationError,
  createConfigMissingError,
  createStartupError,
  createHealthCheckError,
} from '../utils/error-messages';

describe('discriminateNetworkError', () => {
  it('should identify SERVICE_DOWN from ECONNREFUSED', () => {
    const result = discriminateNetworkError({ code: 'ECONNREFUSED' });
    expect(result.type).toBe('SERVICE_DOWN');
    expect(result.description).toContain('Connection refused');
  });

  it('should identify TIMEOUT from ETIMEDOUT', () => {
    const result = discriminateNetworkError({ code: 'ETIMEDOUT' });
    expect(result.type).toBe('TIMEOUT');
    expect(result.description).toContain('timeout');
  });

  it('should identify DNS_FAILURE from ENOTFOUND', () => {
    const result = discriminateNetworkError({ code: 'ENOTFOUND' });
    expect(result.type).toBe('DNS_FAILURE');
    expect(result.description).toContain('DNS resolution');
  });

  it('should identify NETWORK_MISCONFIGURED from ENETUNREACH', () => {
    const result = discriminateNetworkError({ code: 'ENETUNREACH' });
    expect(result.type).toBe('NETWORK_MISCONFIGURED');
    expect(result.description).toContain('Network unreachable');
  });

  it('should identify CONNECTION_RESET from ECONNRESET', () => {
    const result = discriminateNetworkError({ code: 'ECONNRESET' });
    expect(result.type).toBe('CONNECTION_RESET');
    expect(result.description).toContain('Connection reset');
  });

  it('should return UNKNOWN for unrecognized errors', () => {
    const result = discriminateNetworkError({ code: 'UNKNOWN_CODE' });
    expect(result.type).toBe('UNKNOWN');
  });
});

describe('createDatabaseConnectionError', () => {
  const context = {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'postgres',
  };

  it('should create error with correct structure', () => {
    const error = createDatabaseConnectionError(
      new Error('Connection failed'),
      context
    );

    expect(error.info.code).toBe('E_DB_CONNECTION_FAILED');
    expect(error.info.what).toContain('PostgreSQL');
    expect(error.info.service).toBe('PostgreSQL');
    expect(error.info.category).toBeDefined();
    expect(error.info.severity).toBeDefined();
  });

  it('should include context information', () => {
    const error = createDatabaseConnectionError(
      new Error('Connection failed'),
      context
    );

    expect(error.info.context?.host).toBe('localhost');
    expect(error.info.context?.port).toBe(5432);
    expect(error.info.context?.database).toBe('test_db');
  });

  it('should include why and next steps', () => {
    const error = createDatabaseConnectionError(
      { code: 'ECONNREFUSED' },
      context
    );

    expect(error.info.why.length).toBeGreaterThan(0);
    expect(error.info.nextSteps.length).toBeGreaterThan(0);
  });

  it('should include documentation reference', () => {
    const error = createDatabaseConnectionError(
      new Error('Connection failed'),
      context
    );

    expect(error.info.documentation).toBeDefined();
    expect(error.info.documentation?.section).toContain('TROUBLESHOOTING');
  });

  it('should discriminate SERVICE_DOWN errors correctly', () => {
    const error = createDatabaseConnectionError(
      { code: 'ECONNREFUSED' },
      context
    );

    expect(error.info.context?.errorType).toBe('SERVICE_DOWN');
    expect(error.info.why.some(w => w.includes('not running'))).toBe(true);
    expect(error.info.nextSteps.some(s => s.includes('docker-compose ps'))).toBe(true);
  });

  it('should discriminate TIMEOUT errors correctly', () => {
    const error = createDatabaseConnectionError(
      { code: 'ETIMEDOUT' },
      context
    );

    expect(error.info.context?.errorType).toBe('TIMEOUT');
    expect(error.info.why.some(w => w.includes('timeout'))).toBe(true);
  });

  it('should discriminate DNS_FAILURE errors correctly', () => {
    const error = createDatabaseConnectionError(
      { code: 'ENOTFOUND' },
      context
    );

    expect(error.info.context?.errorType).toBe('DNS_FAILURE');
    expect(error.info.why.some(w => w.includes('DNS'))).toBe(true);
  });

  it('should format error message properly', () => {
    const error = createDatabaseConnectionError(
      { code: 'ECONNREFUSED' },
      context
    );

    const formatted = error.format();

    expect(formatted).toContain('ERROR:');
    expect(formatted).toContain('PostgreSQL');
    expect(formatted).toContain('Why this happened:');
    expect(formatted).toContain('Next Steps:');
  });

  it('should include request ID if provided', () => {
    const error = createDatabaseConnectionError(
      new Error('Connection failed'),
      context,
      'req_123'
    );

    expect(error.info.requestId).toBe('req_123');
  });
});

describe('createDatabaseQueryError', () => {
  const query = 'SELECT * FROM users WHERE id = $1';

  it('should create error with correct structure', () => {
    const error = createDatabaseQueryError(
      { code: '42P01', message: 'Table does not exist' },
      query
    );

    expect(error.info.code).toContain('E_DB_QUERY');
    expect(error.info.what).toContain('query');
    expect(error.info.service).toBe('PostgreSQL');
  });

  it('should handle undefined table error (42P01)', () => {
    const error = createDatabaseQueryError(
      { code: '42P01' },
      query
    );

    expect(error.info.code).toBe('E_DB_QUERY_42P01');
    expect(error.info.why.some(w => w.includes('Table'))).toBe(true);
    expect(error.info.nextSteps.some(s => s.includes('schema'))).toBe(true);
  });

  it('should handle unique violation error (23505)', () => {
    const error = createDatabaseQueryError(
      { code: '23505' },
      query
    );

    expect(error.info.code).toBe('E_DB_QUERY_23505');
    expect(error.info.why.some(w => w.includes('duplicate'))).toBe(true);
  });

  it('should handle connection pool exhaustion (53300)', () => {
    const error = createDatabaseQueryError(
      { code: '53300' },
      query
    );

    expect(error.info.code).toBe('E_DB_QUERY_53300');
    expect(error.info.why.some(w => w.includes('pool'))).toBe(true);
  });

  it('should truncate long queries in context', () => {
    const longQuery = 'SELECT * FROM users WHERE ' + 'x'.repeat(300);
    const error = createDatabaseQueryError(
      { code: '42P01' },
      longQuery
    );

    expect(error.info.context?.query.length).toBeLessThanOrEqual(200);
  });

  it('should include PostgreSQL error code in context', () => {
    const error = createDatabaseQueryError(
      { code: '42P01', message: 'Table not found' },
      query
    );

    expect(error.info.context?.pgErrorCode).toBe('42P01');
    expect(error.info.context?.pgErrorMessage).toBe('Table not found');
  });
});

describe('createRedisConnectionError', () => {
  const context = {
    host: 'localhost',
    port: 6379,
  };

  it('should create error with correct structure', () => {
    const error = createRedisConnectionError(
      new Error('Connection failed'),
      context
    );

    expect(error.info.code).toBe('E_REDIS_CONNECTION_FAILED');
    expect(error.info.what).toContain('Redis');
    expect(error.info.service).toBe('Redis');
  });

  it('should include context information', () => {
    const error = createRedisConnectionError(
      new Error('Connection failed'),
      context
    );

    expect(error.info.context?.host).toBe('localhost');
    expect(error.info.context?.port).toBe(6379);
  });

  it('should discriminate SERVICE_DOWN errors', () => {
    const error = createRedisConnectionError(
      { code: 'ECONNREFUSED' },
      context
    );

    expect(error.info.context?.errorType).toBe('SERVICE_DOWN');
    expect(error.info.nextSteps.some(s => s.includes('docker-compose ps'))).toBe(true);
  });

  it('should include documentation reference', () => {
    const error = createRedisConnectionError(
      new Error('Connection failed'),
      context
    );

    expect(error.info.documentation?.section).toContain('redis-connection-errors');
  });
});

describe('createRedisOperationError', () => {
  it('should create error with correct structure', () => {
    const error = createRedisOperationError(
      'SET key value',
      new Error('Operation failed')
    );

    expect(error.info.code).toBe('E_REDIS_OPERATION_FAILED');
    expect(error.info.what).toContain('Redis operation');
    expect(error.info.context?.operation).toBe('SET key value');
  });

  it('should handle READONLY errors', () => {
    const error = createRedisOperationError(
      'SET key value',
      { message: 'READONLY You can\'t write against a read only replica' }
    );

    expect(error.info.why.some(w => w.includes('read-only'))).toBe(true);
  });

  it('should handle OOM errors', () => {
    const error = createRedisOperationError(
      'SET key value',
      { message: 'OOM command not allowed when used memory' }
    );

    expect(error.info.why.some(w => w.includes('memory'))).toBe(true);
  });
});

describe('createConfigValidationError', () => {
  it('should create error with correct structure', () => {
    const error = createConfigValidationError(
      'LOG_LEVEL',
      'invalid',
      ['trace', 'debug', 'info', 'warn', 'error']
    );

    expect(error.info.code).toBe('E_CONFIG_INVALID_VALUE');
    expect(error.info.what).toContain('LOG_LEVEL');
    expect(error.info.category).toBe('CONFIGURATION');
  });

  it('should include current value in why', () => {
    const error = createConfigValidationError(
      'LOG_LEVEL',
      'invalid',
      ['trace', 'debug', 'info', 'warn', 'error']
    );

    expect(error.info.why.some(w => w.includes('invalid'))).toBe(true);
  });

  it('should include acceptable values in next steps', () => {
    const error = createConfigValidationError(
      'LOG_LEVEL',
      'invalid',
      ['trace', 'debug', 'info', 'warn', 'error']
    );

    expect(error.info.nextSteps.some(s => s.includes('trace, debug, info, warn, error'))).toBe(true);
  });

  it('should include all acceptable values in context', () => {
    const acceptableValues = ['trace', 'debug', 'info'];
    const error = createConfigValidationError(
      'LOG_LEVEL',
      'invalid',
      acceptableValues
    );

    expect(error.info.context?.acceptableValues).toEqual(acceptableValues);
  });

  it('should reference configuration documentation', () => {
    const error = createConfigValidationError(
      'LOG_LEVEL',
      'invalid',
      ['info', 'warn', 'error']
    );

    expect(error.info.documentation?.section).toContain('CONFIGURATION');
  });
});

describe('createConfigMissingError', () => {
  it('should create error with correct structure', () => {
    const error = createConfigMissingError(
      'DATABASE_PASSWORD',
      'PostgreSQL database password'
    );

    expect(error.info.code).toBe('E_CONFIG_MISSING');
    expect(error.info.what).toContain('DATABASE_PASSWORD');
  });

  it('should include variable name in why', () => {
    const error = createConfigMissingError(
      'SESSION_SECRET',
      'Session secret key'
    );

    expect(error.info.why.some(w => w.includes('SESSION_SECRET'))).toBe(true);
  });

  it('should suggest checking .env.example', () => {
    const error = createConfigMissingError(
      'API_KEY',
      'API authentication key'
    );

    expect(error.info.nextSteps.some(s => s.includes('.env.example'))).toBe(true);
  });

  it('should include description in context', () => {
    const description = 'PostgreSQL database password';
    const error = createConfigMissingError('DATABASE_PASSWORD', description);

    expect(error.info.context?.description).toBe(description);
  });
});

describe('createStartupError', () => {
  it('should create error with correct structure', () => {
    const error = createStartupError(
      'Backend',
      'initialization',
      new Error('Failed to connect to database')
    );

    expect(error.info.code).toBe('E_STARTUP_FAILED');
    expect(error.info.what).toContain('Backend');
    expect(error.info.what).toContain('initialization');
    expect(error.info.service).toBe('Backend');
  });

  it('should include phase in context', () => {
    const error = createStartupError(
      'Backend',
      'database connection',
      new Error('Connection refused')
    );

    expect(error.info.context?.phase).toBe('database connection');
  });

  it('should include original error message in why', () => {
    const error = createStartupError(
      'Redis',
      'connection',
      new Error('Port already in use')
    );

    expect(error.info.why.some(w => w.includes('Port already in use'))).toBe(true);
  });

  it('should suggest viewing logs', () => {
    const error = createStartupError(
      'Frontend',
      'build',
      new Error('Build failed')
    );

    expect(error.info.nextSteps.some(s => s.includes('logs'))).toBe(true);
  });
});

describe('createHealthCheckError', () => {
  it('should create error with correct structure', () => {
    const error = createHealthCheckError(
      'Backend',
      'http://localhost:3001/health/ready',
      503
    );

    expect(error.info.code).toBe('E_HEALTH_CHECK_FAILED');
    expect(error.info.what).toContain('Backend');
    expect(error.info.what).toContain('health check');
    expect(error.info.service).toBe('Backend');
  });

  it('should include status code in context when provided', () => {
    const error = createHealthCheckError(
      'Backend',
      'http://localhost:3001/health',
      500
    );

    expect(error.info.context?.statusCode).toBe(500);
  });

  it('should handle health check with no response', () => {
    const error = createHealthCheckError(
      'Backend',
      'http://localhost:3001/health'
    );

    expect(error.info.why.some(w => w.includes('not responding'))).toBe(true);
    expect(error.info.context?.statusCode).toBeUndefined();
  });

  it('should include endpoint in context', () => {
    const endpoint = 'http://localhost:3001/health/ready';
    const error = createHealthCheckError('Backend', endpoint, 503);

    expect(error.info.context?.endpoint).toBe(endpoint);
  });

  it('should suggest checking logs and dependencies', () => {
    const error = createHealthCheckError('Backend', '/health', 503);

    expect(error.info.nextSteps.some(s => s.includes('logs'))).toBe(true);
    expect(error.info.nextSteps.some(s => s.includes('dependencies'))).toBe(true);
  });
});

describe('Enhanced Error formatting', () => {
  it('should format error message with all sections', () => {
    const error = createDatabaseConnectionError(
      { code: 'ECONNREFUSED' },
      {
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'postgres',
      },
      'req_123'
    );

    const formatted = error.format();

    expect(formatted).toContain('ERROR:');
    expect(formatted).toContain('Service: PostgreSQL');
    expect(formatted).toContain('Error Code:');
    expect(formatted).toContain('Why this happened:');
    expect(formatted).toContain('Next Steps:');
    expect(formatted).toContain('Additional Context:');
    expect(formatted).toContain('Documentation:');
    expect(formatted).toContain('Request ID:');
  });

  it('should convert error to JSON format', () => {
    const error = createConfigValidationError(
      'LOG_LEVEL',
      'invalid',
      ['info', 'warn', 'error']
    );

    const json = error.toJSON();

    expect(json).toHaveProperty('error');
    expect(json.error).toHaveProperty('message');
    expect(json.error).toHaveProperty('code');
    expect(json.error).toHaveProperty('category');
    expect(json.error).toHaveProperty('severity');
    expect(json.error).toHaveProperty('why');
    expect(json.error).toHaveProperty('nextSteps');
  });
});
