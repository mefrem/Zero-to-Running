/**
 * Error Message Builders and Templates
 *
 * Provides reusable templates for common error scenarios with
 * comprehensive "what", "why", and "next steps" information.
 * Story 4.4: Enhanced Error Messages & Developer Feedback
 */

import {
  DatabaseError,
  RedisError,
  ConfigurationError,
  // NetworkError,  // Unused for now
  InitializationError,
  ErrorSeverity,
} from './errors';

/**
 * Discriminate network error type from error code
 */
export function discriminateNetworkError(error: any): {
  type: 'SERVICE_DOWN' | 'NETWORK_MISCONFIGURED' | 'DNS_FAILURE' | 'TIMEOUT' | 'CONNECTION_RESET' | 'UNKNOWN';
  description: string;
} {
  const code = error.code || error.errno || '';
  const message = error.message || '';

  // Connection refused - service is down
  if (code === 'ECONNREFUSED') {
    return {
      type: 'SERVICE_DOWN',
      description: 'Connection refused - service is not accepting connections',
    };
  }

  // Connection timeout
  if (code === 'ETIMEDOUT' || message.includes('timeout')) {
    return {
      type: 'TIMEOUT',
      description: 'Connection timeout - service did not respond in time',
    };
  }

  // DNS resolution failure
  if (code === 'ENOTFOUND') {
    return {
      type: 'DNS_FAILURE',
      description: 'DNS resolution failed - hostname could not be resolved',
    };
  }

  // Network unreachable
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') {
    return {
      type: 'NETWORK_MISCONFIGURED',
      description: 'Network unreachable - routing or network configuration issue',
    };
  }

  // Connection reset
  if (code === 'ECONNRESET') {
    return {
      type: 'CONNECTION_RESET',
      description: 'Connection reset - service closed the connection unexpectedly',
    };
  }

  return {
    type: 'UNKNOWN',
    description: 'Unknown connection error',
  };
}

/**
 * Create database connection error with discrimination
 */
export function createDatabaseConnectionError(
  error: any,
  context: { host: string; port: number; database: string; user: string },
  requestId?: string
): DatabaseError {
  const networkType = discriminateNetworkError(error);
  const why: string[] = [];
  const nextSteps: string[] = [];

  // Customize based on error type
  switch (networkType.type) {
    case 'SERVICE_DOWN':
      why.push('PostgreSQL service is not running or not accepting connections');
      why.push(`Port ${context.port} on ${context.host} is not reachable`);
      nextSteps.push(`Verify PostgreSQL is running: docker-compose ps postgres`);
      nextSteps.push(`Check PostgreSQL logs: docker-compose logs postgres`);
      nextSteps.push(`Verify port ${context.port} is not in use by another process: lsof -i :${context.port}`);
      nextSteps.push(`Try restarting PostgreSQL: docker-compose restart postgres`);
      break;

    case 'TIMEOUT':
      why.push('Database server did not respond within the timeout period');
      why.push('Database might be overloaded or network is slow');
      nextSteps.push('Check database server status and load');
      nextSteps.push(`Verify network connectivity to ${context.host}:${context.port}`);
      nextSteps.push('Consider increasing connection timeout in configuration');
      nextSteps.push('Check for slow queries or locks: SELECT * FROM pg_stat_activity;');
      break;

    case 'DNS_FAILURE':
      why.push(`Hostname "${context.host}" could not be resolved to an IP address`);
      why.push('DNS configuration or hostname in DATABASE_HOST may be incorrect');
      nextSteps.push(`Verify DATABASE_HOST value in .env: ${context.host}`);
      nextSteps.push('Check if hostname exists: ping ${context.host}');
      nextSteps.push('For Docker, ensure service name matches docker-compose.yml');
      nextSteps.push('Try using IP address instead of hostname');
      break;

    case 'NETWORK_MISCONFIGURED':
      why.push('Network routing or configuration issue preventing connection');
      why.push('Database server may be on unreachable network');
      nextSteps.push('Verify network configuration and routing');
      nextSteps.push('Check firewall rules allow connection to port ${context.port}');
      nextSteps.push('Verify database and application are on same Docker network');
      nextSteps.push('Check docker-compose.yml network configuration');
      break;

    case 'CONNECTION_RESET':
      why.push('Database server closed connection unexpectedly');
      why.push('Authentication may have failed or server encountered an error');
      nextSteps.push('Check database credentials in .env (DATABASE_USER, DATABASE_PASSWORD)');
      nextSteps.push('Verify database user has necessary permissions');
      nextSteps.push('Check PostgreSQL logs for authentication errors');
      nextSteps.push('Ensure DATABASE_NAME exists: psql -U postgres -l');
      break;

    default:
      why.push('Unexpected database connection error');
      why.push(`Error code: ${error.code || 'unknown'}`);
      nextSteps.push('Check database configuration in .env file');
      nextSteps.push('Verify all database credentials are correct');
      nextSteps.push('Check PostgreSQL logs for more details');
      nextSteps.push('See troubleshooting guide in docs/TROUBLESHOOTING.md');
  }

  return new DatabaseError(
    `Failed to connect to PostgreSQL database`,
    {
      code: 'E_DB_CONNECTION_FAILED',
      why,
      nextSteps,
      context: {
        host: context.host,
        port: context.port,
        database: context.database,
        user: context.user,
        errorType: networkType.type,
        errorCode: error.code,
        errorMessage: error.message,
      },
      documentation: {
        section: 'docs/TROUBLESHOOTING.md#database-connection-errors',
      },
      requestId,
    },
    error
  );
}

/**
 * Create database query error
 */
export function createDatabaseQueryError(
  error: any,
  query: string,
  requestId?: string
): DatabaseError {
  const why: string[] = [];
  const nextSteps: string[] = [];

  // Parse PostgreSQL error code if available
  const pgCode = error.code;

  switch (pgCode) {
    case '42P01': // Undefined table
      why.push('Table referenced in query does not exist');
      why.push('Database schema may not be initialized');
      nextSteps.push('Verify database schema is initialized');
      nextSteps.push('Run database migrations: npm run migrate');
      nextSteps.push('Check if schema initialization script ran: docker-compose logs postgres');
      break;

    case '42703': // Undefined column
      why.push('Column referenced in query does not exist');
      why.push('Database schema may be out of date');
      nextSteps.push('Verify database schema matches application code');
      nextSteps.push('Run database migrations to update schema');
      break;

    case '23505': // Unique violation
      why.push('Attempting to insert duplicate value for unique constraint');
      nextSteps.push('Check if record already exists before inserting');
      nextSteps.push('Use UPSERT (INSERT ... ON CONFLICT) for idempotent inserts');
      break;

    case '23503': // Foreign key violation
      why.push('Referenced foreign key does not exist');
      nextSteps.push('Ensure referenced record exists before creating relationship');
      nextSteps.push('Check foreign key constraints in database schema');
      break;

    case '53300': // Too many connections
      why.push('Connection pool exhausted');
      why.push('Too many concurrent database connections');
      nextSteps.push('Increase DATABASE_POOL_MAX in .env configuration');
      nextSteps.push('Check for connection leaks (ensure connections are released)');
      nextSteps.push('Monitor active connections: SELECT count(*) FROM pg_stat_activity;');
      break;

    default:
      why.push('SQL query execution failed');
      why.push(`PostgreSQL error code: ${pgCode || 'unknown'}`);
      nextSteps.push('Check query syntax and parameters');
      nextSteps.push('Verify database schema matches query expectations');
      nextSteps.push('Check PostgreSQL logs for more details');
  }

  return new DatabaseError(
    `Database query execution failed`,
    {
      code: `E_DB_QUERY_${pgCode || 'UNKNOWN'}`,
      why,
      nextSteps,
      context: {
        query: query.substring(0, 200), // Truncate long queries
        pgErrorCode: pgCode,
        pgErrorMessage: error.message,
      },
      documentation: {
        section: 'docs/TROUBLESHOOTING.md#database-query-errors',
      },
      requestId,
    },
    error
  );
}

/**
 * Create Redis connection error with discrimination
 */
export function createRedisConnectionError(
  error: any,
  context: { host: string; port: number },
  requestId?: string
): RedisError {
  const networkType = discriminateNetworkError(error);
  const why: string[] = [];
  const nextSteps: string[] = [];

  switch (networkType.type) {
    case 'SERVICE_DOWN':
      why.push('Redis service is not running or not accepting connections');
      why.push(`Port ${context.port} on ${context.host} is not reachable`);
      nextSteps.push(`Verify Redis is running: docker-compose ps redis`);
      nextSteps.push(`Check Redis logs: docker-compose logs redis`);
      nextSteps.push(`Verify port ${context.port} is not in use: lsof -i :${context.port}`);
      nextSteps.push(`Try restarting Redis: docker-compose restart redis`);
      break;

    case 'TIMEOUT':
      why.push('Redis server did not respond within the timeout period');
      why.push('Redis might be overloaded or network is slow');
      nextSteps.push('Check Redis server status and memory usage');
      nextSteps.push(`Verify network connectivity to ${context.host}:${context.port}`);
      nextSteps.push('Check Redis performance: redis-cli --latency');
      nextSteps.push('Consider increasing connection timeout');
      break;

    case 'DNS_FAILURE':
      why.push(`Hostname "${context.host}" could not be resolved`);
      why.push('DNS configuration or REDIS_HOST may be incorrect');
      nextSteps.push(`Verify REDIS_HOST value in .env: ${context.host}`);
      nextSteps.push('For Docker, ensure service name matches docker-compose.yml');
      nextSteps.push('Try using IP address instead of hostname');
      break;

    case 'NETWORK_MISCONFIGURED':
      why.push('Network routing or configuration issue');
      nextSteps.push('Verify network configuration and firewall rules');
      nextSteps.push('Ensure Redis and application are on same Docker network');
      nextSteps.push('Check docker-compose.yml network configuration');
      break;

    default:
      why.push('Unexpected Redis connection error');
      why.push(`Error code: ${error.code || 'unknown'}`);
      nextSteps.push('Check Redis configuration in .env file');
      nextSteps.push('Verify REDIS_HOST and REDIS_PORT are correct');
      nextSteps.push('Check Redis logs for more details');
  }

  return new RedisError(
    `Failed to connect to Redis cache`,
    {
      code: 'E_REDIS_CONNECTION_FAILED',
      why,
      nextSteps,
      context: {
        host: context.host,
        port: context.port,
        errorType: networkType.type,
        errorCode: error.code,
        errorMessage: error.message,
      },
      documentation: {
        section: 'docs/TROUBLESHOOTING.md#redis-connection-errors',
      },
      requestId,
    },
    error
  );
}

/**
 * Create Redis operation error
 */
export function createRedisOperationError(
  operation: string,
  error: any,
  requestId?: string
): RedisError {
  const why: string[] = [];
  const nextSteps: string[] = [];

  if (error.message?.includes('READONLY')) {
    why.push('Redis is in read-only mode');
    why.push('May be a replica or in protected mode');
    nextSteps.push('Check Redis configuration for read-only mode');
    nextSteps.push('Verify connecting to master instance, not replica');
  } else if (error.message?.includes('OOM')) {
    why.push('Redis is out of memory');
    why.push('Memory limit exceeded or eviction policy preventing operation');
    nextSteps.push('Check Redis memory usage: redis-cli INFO memory');
    nextSteps.push('Consider increasing maxmemory limit');
    nextSteps.push('Review eviction policy in redis.conf');
    nextSteps.push('Clear unnecessary keys or enable key eviction');
  } else {
    why.push(`Redis operation "${operation}" failed`);
    nextSteps.push('Check Redis server status and logs');
    nextSteps.push('Verify operation syntax and parameters');
    nextSteps.push('Check Redis connection is still active');
  }

  return new RedisError(
    `Redis operation failed: ${operation}`,
    {
      code: 'E_REDIS_OPERATION_FAILED',
      why,
      nextSteps,
      context: {
        operation,
        errorMessage: error.message,
      },
      documentation: {
        section: 'docs/TROUBLESHOOTING.md#redis-operation-errors',
      },
      requestId,
    },
    error
  );
}

/**
 * Create configuration validation error
 */
export function createConfigValidationError(
  variable: string,
  currentValue: any,
  acceptableValues: string[],
  reason?: string
): ConfigurationError {
  const why: string[] = [];
  const nextSteps: string[] = [];

  why.push(`Environment variable ${variable} has invalid value: "${currentValue}"`);
  if (reason) {
    why.push(reason);
  }

  nextSteps.push(`Update ${variable} in .env file to one of: ${acceptableValues.join(', ')}`);
  nextSteps.push('Copy from .env.example if unsure: cp .env.example .env');
  nextSteps.push('Restart services after updating: make dev');

  return new ConfigurationError(
    `Invalid configuration: ${variable}`,
    {
      code: 'E_CONFIG_INVALID_VALUE',
      why,
      nextSteps,
      context: {
        variable,
        currentValue,
        acceptableValues,
      },
      documentation: {
        section: 'docs/CONFIGURATION.md',
      },
    }
  );
}

/**
 * Create missing configuration error
 */
export function createConfigMissingError(
  variable: string,
  description: string
): ConfigurationError {
  const why: string[] = [];
  const nextSteps: string[] = [];

  why.push(`Required environment variable ${variable} is not set`);
  why.push('Application cannot start without this configuration');

  nextSteps.push(`Add ${variable} to your .env file`);
  nextSteps.push(`See .env.example for template and description`);
  nextSteps.push(`Generate secrets if needed: openssl rand -base64 32`);

  return new ConfigurationError(
    `Missing required configuration: ${variable}`,
    {
      code: 'E_CONFIG_MISSING',
      why,
      nextSteps,
      context: {
        variable,
        description,
      },
      documentation: {
        section: 'docs/CONFIGURATION.md',
      },
    }
  );
}

/**
 * Create startup/initialization error
 */
export function createStartupError(
  service: string,
  phase: string,
  error: any,
  requestId?: string
): InitializationError {
  const why: string[] = [];
  const nextSteps: string[] = [];

  why.push(`${service} failed during ${phase} phase`);
  why.push(`Error: ${error.message || 'Unknown error'}`);

  nextSteps.push(`Check ${service} configuration in .env file`);
  nextSteps.push(`View ${service} logs: docker-compose logs ${service.toLowerCase()}`);
  nextSteps.push('Verify all required services are running: docker-compose ps');
  nextSteps.push('Try restarting: make down && make dev');

  return new InitializationError(
    `${service} startup failed during ${phase}`,
    {
      code: 'E_STARTUP_FAILED',
      service,
      why,
      nextSteps,
      context: {
        phase,
        errorMessage: error.message,
        errorCode: error.code,
      },
      documentation: {
        section: 'docs/TROUBLESHOOTING.md#startup-failures',
      },
      requestId,
    },
    error
  );
}

/**
 * Create health check failure error
 */
export function createHealthCheckError(
  service: string,
  endpoint: string,
  statusCode?: number
): InitializationError {
  const why: string[] = [];
  const nextSteps: string[] = [];

  if (statusCode) {
    why.push(`${service} health check returned status ${statusCode}`);
  } else {
    why.push(`${service} health check endpoint ${endpoint} is not responding`);
  }

  why.push('Service may not have started correctly or dependencies failed');

  nextSteps.push(`Check ${service} logs: docker-compose logs ${service.toLowerCase()}`);
  nextSteps.push(`Verify ${service} container is running: docker ps`);
  nextSteps.push(`Try health check manually: curl ${endpoint}`);
  nextSteps.push('Check service dependencies (database, Redis, etc.)');

  return new InitializationError(
    `${service} health check failed`,
    {
      code: 'E_HEALTH_CHECK_FAILED',
      service,
      severity: ErrorSeverity.ERROR,
      why,
      nextSteps,
      context: {
        endpoint,
        statusCode,
      },
      documentation: {
        section: 'docs/TROUBLESHOOTING.md#health-check-failures',
      },
    }
  );
}
