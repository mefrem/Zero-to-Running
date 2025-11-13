/**
 * Backend API Service Entry Point
 * Express.js application with PostgreSQL and Redis connectivity
 */

import * as dotenv from "dotenv";
import express, { Application, Request, Response } from "express";
import cors, { CorsOptions } from "cors";
import { logger } from "./utils/logger";
import {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
} from "./middleware/logging";
import {
  testDatabaseConnection,
  closeDatabaseConnection,
} from "./config/database";
import {
  connectRedis,
  closeRedisConnection,
  testRedisConnection,
} from "./config/redis";
import healthRouter from "./routes/health";
import { config, getConfigSummary } from "./config/env";
import {
  validateConfig,
  formatValidationResult,
  detectMockSecrets,
  formatMockSecretWarning,
} from "./utils/config-validator";

// Load environment variables
dotenv.config();

// Create Express application
const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const corsOptions: CorsOptions = {
  origin: config.cors.origin,
  credentials: config.cors.credentials,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Request logging middleware - generates requestId and logs all requests/responses
app.use(requestLoggingMiddleware);

// Register routes
app.use(healthRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested resource was not found",
  });
});

// Error logging middleware
app.use(errorLoggingMiddleware);

/**
 * Initialize application connections and start server
 */
async function startApplication(): Promise<void> {
  try {
    // Validate configuration before starting
    logger.info({ msg: "Validating configuration" });
    const validationResult = validateConfig(config);

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      validationResult.warnings.forEach((warning) => {
        logger.warn({ msg: "Configuration warning", warning });
      });
    }

    // Exit if validation failed
    if (!validationResult.valid) {
      logger.error({ msg: "Configuration validation failed" });
      validationResult.errors.forEach((error) => {
        logger.error({ msg: "Configuration error", error });
      });
      console.error("\n" + formatValidationResult(validationResult));
      process.exit(1);
    }

    logger.info({ msg: "Configuration validated successfully" });

    // Check for mock secrets and display warning
    const mockSecrets = detectMockSecrets(config);
    if (mockSecrets.length > 0) {
      // Display prominent warning to console
      console.warn(formatMockSecretWarning(mockSecrets));

      // Log to structured logging
      logger.warn({
        msg: "Mock secrets detected in configuration",
        mockSecrets: mockSecrets.map((s) => s.name),
        count: mockSecrets.length,
        environment: config.app.env,
        documentation: "/docs/SECRET_MANAGEMENT.md",
      });
    }

    // Log configuration summary
    logger.info({
      msg: "Starting application",
      environment: config.app.env,
      port: config.server.port,
      nodeVersion: process.version,
    });

    // Log detailed configuration in debug mode
    if (config.logging.level === "debug") {
      logger.debug({
        msg: "Loaded configuration",
        config: getConfigSummary(),
      });
    }

    // Test database connection
    logger.info({ msg: "Connecting to database" });
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      logger.warn({
        msg: "Database connection failed, but continuing startup",
      });
    }

    // Connect to Redis
    logger.info({ msg: "Connecting to Redis" });
    const redisConnected = await connectRedis();
    if (redisConnected) {
      await testRedisConnection();
    } else {
      logger.warn({ msg: "Redis connection failed, but continuing startup" });
    }

    // Start HTTP server
    const server = app.listen(config.server.port, () => {
      logger.info({
        msg: "Application started successfully",
        port: config.server.port,
        environment: config.app.env,
        healthEndpoint: `http://localhost:${config.server.port}/health`,
      });
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info("HTTP server closed");

        // Close database connection
        await closeDatabaseConnection();

        // Close Redis connection
        await closeRedisConnection();

        logger.info("Graceful shutdown completed");
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error("Graceful shutdown timeout, forcing exit");
        process.exit(1);
      }, 10000);
    };

    // Register shutdown handlers
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.fatal(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to start application"
    );
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.fatal(
    {
      reason: reason instanceof Error ? reason.message : String(reason),
      promise: promise,
    },
    "Unhandled Promise Rejection"
  );
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.fatal(
    {
      error: error.message,
      stack: error.stack,
    },
    "Uncaught Exception"
  );
  process.exit(1);
});

// Start the application
startApplication();
