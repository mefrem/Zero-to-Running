/**
 * Database configuration and connection management
 * Handles PostgreSQL connection pooling using environment variables
 */

import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

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
  logger.error('Unexpected database pool error', { error: err.message });
});

/**
 * Test database connectivity
 * @returns Promise that resolves to true if connection is successful
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();

    logger.info('Database connection successful', {
      currentTime: result.rows[0]?.current_time,
      version: result.rows[0]?.pg_version?.split(' ')[1],
    });

    return true;
  } catch (error) {
    logger.error('Database connection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
    });
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
    logger.error('Error closing database connection pool', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
