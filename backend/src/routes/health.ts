/**
 * Health check endpoint
 * Returns application health status with timestamp
 */

import { Router, Request, Response } from 'express';
import { testDatabaseConnection } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Helper function to wrap a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @returns Promise that rejects if timeout is exceeded
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    ),
  ]);
};

/**
 * GET /health
 * Returns health status of the application
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready
 * Returns readiness status with dependency health checks
 * Checks database and Redis connectivity with 1-second timeout
 */
router.get('/health/ready', async (_req: Request, res: Response): Promise<void> => {
  const timestamp = new Date().toISOString();
  const errors: Record<string, string> = {};

  let databaseStatus: 'ok' | 'error' = 'ok';
  let cacheStatus: 'ok' | 'error' = 'ok';

  try {
    // Run both checks in parallel with 1-second timeout
    const results = await withTimeout(
      Promise.allSettled([
        testDatabaseConnection(),
        testRedisConnection(),
      ]),
      1000
    );

    // Check database result
    const dbResult = results[0];
    if (dbResult.status === 'rejected') {
      databaseStatus = 'error';
      errors.database = dbResult.reason?.message || 'Database check failed';
      logger.error('Database health check failed', { error: dbResult.reason });
    } else if (!dbResult.value) {
      databaseStatus = 'error';
      errors.database = 'Database connection test returned false';
      logger.error('Database health check returned false');
    }

    // Check Redis result
    const redisResult = results[1];
    if (redisResult.status === 'rejected') {
      cacheStatus = 'error';
      errors.cache = redisResult.reason?.message || 'Cache check failed';
      logger.error('Redis health check failed', { error: redisResult.reason });
    } else if (!redisResult.value) {
      cacheStatus = 'error';
      errors.cache = 'Redis connection test returned false';
      logger.error('Redis health check returned false');
    }
  } catch (error) {
    // Timeout occurred
    logger.error('Health check timeout exceeded', { error });
    res.status(503).json({
      status: 'unavailable',
      timestamp,
      errors: {
        timeout: 'Health check exceeded 1 second timeout',
      },
    });
    return;
  }

  // Determine overall status
  const isHealthy = databaseStatus === 'ok' && cacheStatus === 'ok';
  const statusCode = isHealthy ? 200 : 503;
  const status = isHealthy ? 'ready' : 'unavailable';

  interface ReadyResponse {
    status: string;
    timestamp: string;
    database: string;
    cache: string;
    errors?: Record<string, string>;
  }

  const response: ReadyResponse = {
    status,
    timestamp,
    database: databaseStatus,
    cache: cacheStatus,
  };

  // Add errors object if there are any errors
  if (Object.keys(errors).length > 0) {
    response.errors = errors;
  }

  logger.info('Health check completed', {
    status,
    database: databaseStatus,
    cache: cacheStatus,
  });

  res.status(statusCode).json(response);
  return;
});

export default router;
