/**
 * Health check endpoint
 * Returns application health status with timestamp
 */

import { Router, Request, Response } from 'express';

const router = Router();

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

export default router;
