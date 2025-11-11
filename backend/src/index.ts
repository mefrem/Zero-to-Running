/**
 * Backend API Service Entry Point
 * Express.js application with PostgreSQL and Redis connectivity
 */

import * as dotenv from 'dotenv';
import express, { Application, Request, Response, NextFunction } from 'express';
import { logger } from './utils/logger';
import { requestLoggingMiddleware, errorLoggingMiddleware } from './middleware/logging';
import { testDatabaseConnection, closeDatabaseConnection } from './config/database';
import { connectRedis, closeRedisConnection, testRedisConnection } from './config/redis';
import healthRouter from './routes/health';

// Load environment variables
dotenv.config();

// Application configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express application
const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware - generates requestId and logs all requests/responses
app.use(requestLoggingMiddleware);

// Register routes
app.use(healthRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Error logging middleware
app.use(errorLoggingMiddleware);

/**
 * Initialize application connections and start server
 */
async function startApplication(): Promise<void> {
  try {
    logger.info({
      msg: 'Starting application',
      environment: NODE_ENV,
      port: PORT,
      nodeVersion: process.version,
    });

    // Test database connection
    logger.info({ msg: 'Connecting to database' });
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      logger.warn({ msg: 'Database connection failed, but continuing startup' });
    }

    // Connect to Redis
    logger.info({ msg: 'Connecting to Redis' });
    const redisConnected = await connectRedis();
    if (redisConnected) {
      await testRedisConnection();
    } else {
      logger.warn({ msg: 'Redis connection failed, but continuing startup' });
    }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info({
        msg: 'Application started successfully',
        port: PORT,
        environment: NODE_ENV,
        healthEndpoint: `http://localhost:${PORT}/health`,
      });
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        // Close database connection
        await closeDatabaseConnection();

        // Close Redis connection
        await closeRedisConnection();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, 10000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start application', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: promise,
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Start the application
startApplication();
