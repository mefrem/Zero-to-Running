/**
 * Redis configuration and client management
 * Handles Redis connection using environment variables
 */

import { createClient, RedisClientType } from 'redis';
import { logger, sanitizeConnectionString } from '../utils/logger';
import { logRedisOperation } from '../middleware/logging';

// Redis configuration from environment variables
const redisHost = process.env.REDIS_HOST || 'redis';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisDb = parseInt(process.env.REDIS_DB || '0', 10);

// Build Redis connection URL
const redisUrl = redisPassword
  ? `redis://:${redisPassword}@${redisHost}:${redisPort}/${redisDb}`
  : `redis://${redisHost}:${redisPort}/${redisDb}`;

// Create Redis client
export const redisClient: RedisClientType = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error({ msg: 'Redis reconnection limit exceeded' });
        return new Error('Redis reconnection limit exceeded');
      }
      const delay = Math.min(retries * 100, 3000);
      logger.warn({
        msg: 'Redis reconnecting',
        delay,
        attempt: retries,
      });
      return delay;
    },
  },
});

// Handle Redis events
redisClient.on('error', (err) => {
  logger.error({
    msg: 'Redis client error',
    error: err.message,
  });
});

redisClient.on('connect', () => {
  const sanitizedUrl = sanitizeConnectionString(redisUrl);
  logger.info({
    msg: 'Redis client connecting',
    connection: sanitizedUrl,
  });
});

redisClient.on('ready', () => {
  logger.info({
    msg: 'Redis client ready',
    host: redisHost,
    port: redisPort,
    db: redisDb,
  });
});

redisClient.on('reconnecting', () => {
  logger.warn({ msg: 'Redis client reconnecting' });
});

redisClient.on('end', () => {
  logger.info({ msg: 'Redis client connection closed' });
});

/**
 * Connect to Redis server
 * @returns Promise that resolves to true if connection is successful
 */
export async function connectRedis(): Promise<boolean> {
  try {
    await redisClient.connect();
    logger.info({ msg: 'Redis connection established' });
    return true;
  } catch (error) {
    logger.error({
      msg: 'Redis connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      host: redisHost,
      port: redisPort,
    });
    return false;
  }
}

/**
 * Test Redis connectivity with PING command
 * @returns Promise that resolves to true if ping is successful
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    const pong = await redisClient.ping();
    logger.info({
      msg: 'Redis ping successful',
      response: pong,
    });
    return pong === 'PONG';
  } catch (error) {
    logger.error({
      msg: 'Redis ping failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
      logger.info({ msg: 'Redis connection closed gracefully' });
    }
  } catch (error) {
    logger.error({
      msg: 'Error closing Redis connection',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
