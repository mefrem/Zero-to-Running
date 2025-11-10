/**
 * Logging Middleware for Express
 * Automatically logs all incoming requests and outgoing responses
 * Generates and propagates requestId for distributed tracing
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { createChildLogger, sanitizeLogData } from '../config/logger';

// Extend Express Request type to include requestId and logger
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      logger: typeof logger;
      startTime: number;
    }
  }
}

/**
 * Request logging middleware
 * Generates requestId, logs request details, and logs response when finished
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate unique requestId for this request
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.requestId = requestId;

  // Record request start time for response time calculation
  req.startTime = Date.now();

  // Create child logger with requestId context
  req.logger = createChildLogger({ requestId });

  // Sanitize request body for logging
  const sanitizedBody = req.body ? sanitizeLogData(req.body) : undefined;

  // Log incoming request
  req.logger.info({
    msg: 'Incoming request',
    method: req.method,
    path: req.path,
    url: req.url,
    query: req.query,
    body: sanitizedBody,
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Capture original res.json and res.send to log response
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  // Override res.json to log response data
  res.json = function (body: any): Response {
    logResponse(req, res, body);
    return originalJson(body);
  };

  // Override res.send to log response data
  res.send = function (body: any): Response {
    logResponse(req, res, body);
    return originalSend(body);
  };

  // Log response when finished (backup for cases where json/send not called)
  res.on('finish', () => {
    if (!res.headersSent) {
      return;
    }

    // Check if we already logged (via json/send override)
    if (!(res as any)._responseLogged) {
      const responseTime = Date.now() - req.startTime;
      req.logger.info({
        msg: 'Response sent',
        statusCode: res.statusCode,
        responseTime,
      });
    }
  });

  // Add requestId to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
}

/**
 * Log response details
 * Called when response is sent
 */
function logResponse(req: Request, res: Response, body: any): void {
  // Mark that we've logged this response
  (res as any)._responseLogged = true;

  const responseTime = Date.now() - req.startTime;
  const responseSize = body ? JSON.stringify(body).length : 0;

  const logData: any = {
    msg: 'Response sent',
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    responseTime,
    responseSize,
  };

  // Log level based on status code
  if (res.statusCode >= 500) {
    req.logger.error(logData);
  } else if (res.statusCode >= 400) {
    req.logger.warn(logData);
  } else {
    req.logger.info(logData);
  }
}

/**
 * Error logging middleware
 * Should be placed after all other middleware and routes
 */
export function errorLoggingMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Use request logger if available, otherwise use default logger
  const log = req.logger || logger;

  log.error({
    msg: 'Unhandled error',
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    requestId: req.requestId,
  });

  // If response not already sent, send error response
  if (!res.headersSent) {
    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
      requestId: req.requestId,
    });
  }

  next(err);
}

/**
 * Database query logging wrapper
 * Logs database queries in DEBUG mode
 */
export function logDatabaseQuery(
  query: string,
  params?: any[],
  requestId?: string
): void {
  const log = requestId ? createChildLogger({ requestId }) : logger;

  log.debug({
    msg: 'Database query',
    query,
    params: params ? sanitizeLogData(params) : undefined,
    type: 'database',
  });
}

/**
 * Redis operation logging wrapper
 * Logs Redis operations in DEBUG mode
 */
export function logRedisOperation(
  operation: string,
  key: string,
  requestId?: string
): void {
  const log = requestId ? createChildLogger({ requestId }) : logger;

  log.debug({
    msg: 'Redis operation',
    operation,
    key,
    type: 'cache',
  });
}
