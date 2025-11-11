/**
 * API Configuration
 *
 * Handles backend API URL configuration and provides HTTP client utilities.
 */

import { logger } from '../utils/logger';

// Get API URL from environment variable or use default
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Health check response interface
 */
export interface HealthResponse {
  status: string;
  timestamp: string;
}

/**
 * Dashboard health check response interface
 */
export interface DashboardHealthResponse {
  status: string;
  services: {
    backend: string;
    database: string;
    cache: string;
  };
  timestamp: string;
  responseTime: number;
  errors?: Record<string, string>;
}

/**
 * Fetch backend health status
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const startTime = Date.now();
  const url = `${API_URL}/health`;

  logger.apiRequest('GET', url, undefined, 'API');

  try {
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.apiResponse('GET', url, response.status, duration, 'API');
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    logger.apiResponse('GET', url, response.status, duration, 'API');
    return response.json();
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.apiError('GET', url, error instanceof Error ? error : String(error), 'API');
    throw error;
  }
}

/**
 * Fetch comprehensive dashboard health status
 */
export async function fetchDashboardHealth(): Promise<DashboardHealthResponse> {
  const startTime = Date.now();
  const url = `${API_URL}/health/dashboard`;

  logger.apiRequest('GET', url, undefined, 'Dashboard');

  try {
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.apiResponse('GET', url, response.status, duration, 'Dashboard');
      throw new Error(`Dashboard health check failed: ${response.status} ${response.statusText}`);
    }

    logger.apiResponse('GET', url, response.status, duration, 'Dashboard');
    return response.json();
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.apiError('GET', url, error instanceof Error ? error : String(error), 'Dashboard');
    throw error;
  }
}
