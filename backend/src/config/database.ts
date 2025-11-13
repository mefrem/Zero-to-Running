/**
 * Database configuration and connection management
 * Handles PostgreSQL connection pooling using environment variables
 */

import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { logger, sanitizeConnectionString } from '../utils/logger';
import { logDatabaseQuery } from '../middleware/logging';
import { createDatabaseConnectionError, createDatabaseQueryError } from '../utils/error-messages';

// Database configuration from environment variables
const dbConfig: PoolConfig = {
  host: process.env.DATABASE_HOST || 'postgres',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME || 'zero_to_running_dev',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD,
  max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Create connection pool
export const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  logger.error({ error: err.message }, 'Unexpected database pool error');
});

// Log database connection on connect
pool.on('connect', () => {
  const sanitizedUrl = sanitizeConnectionString(
    `postgresql://${dbConfig.user}:****@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  );
  logger.debug({
    msg: 'Database connection established',
    connection: sanitizedUrl,
  });
});

/**
 * Execute a database query with optional logging in DEBUG mode
 * @param query SQL query string
 * @param params Query parameters
 * @param requestId Optional requestId for tracing
 * @returns Query result
 */
export async function executeQuery<T extends QueryResultRow = any>(
  query: string,
  params?: any[],
  requestId?: string
): Promise<QueryResult<T>> {
  const startTime = Date.now();

  try {
    // Log query in DEBUG mode
    if (process.env.LOG_LEVEL?.toLowerCase() === 'debug') {
      logDatabaseQuery(query, params, requestId);
    }

    const result = await pool.query<T>(query, params);
    const duration = Date.now() - startTime;

    // Log query execution time in DEBUG mode
    if (process.env.LOG_LEVEL?.toLowerCase() === 'debug') {
      logger.debug({
        msg: 'Query executed',
        duration,
        rowCount: result.rowCount,
        requestId,
      });
    }

    return result;
  } catch (error) {
    // const duration = Date.now() - startTime;

    // Create enhanced error with query context
    const enhancedError = createDatabaseQueryError(error, query, requestId);

    // Log structured error
    enhancedError.log();

    // Throw enhanced error for upstream handling
    throw enhancedError;
  }
}

/**
 * Test database connectivity
 * @returns Promise that resolves to true if connection is successful
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();

    logger.info({
      msg: 'Database connection successful',
      currentTime: result.rows[0]?.current_time,
      version: result.rows[0]?.pg_version?.split(' ')[1],
    });

    return true;
  } catch (error) {
    // Create enhanced error with discrimination and actionable guidance
    const enhancedError = createDatabaseConnectionError(
      error,
      {
        host: dbConfig.host as string,
        port: dbConfig.port as number,
        database: dbConfig.database as string,
        user: dbConfig.user as string,
      }
    );

    // Log structured error
    enhancedError.log();

    // Display formatted error message
    console.error(enhancedError.format());

    return false;
  }
}

/**
 * Gracefully close database connection pool
 */
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database connection pool closed');
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Error closing database connection pool'
    );
  }
}
