/**
 * API Configuration
 *
 * Handles backend API URL configuration and provides HTTP client utilities.
 */

import { logger } from '../utils/logger';
import { handleApiError, formatErrorForConsole } from '../utils/error-handler';

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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  logger.apiRequest('GET', url, undefined, 'API');

  try {
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.apiResponse('GET', url, response.status, duration, 'API');

      // Create enhanced error with status
      const enhancedError = handleApiError(
        { status: response.status, message: response.statusText },
        url,
        requestId
      );

      // Log detailed error to console for developers
      console.error(formatErrorForConsole(enhancedError));

      // Throw with enhanced error information
      throw new Error(enhancedError.userMessage);
    }

    logger.apiResponse('GET', url, response.status, duration, 'API');
    return response.json();
  } catch (error) {
    const duration = Date.now() - startTime;

    // If not already an enhanced error, create one
    if (!(error instanceof Error) || !error.message.includes('permission')) {
      const enhancedError = handleApiError(error, url, requestId);
      console.error(formatErrorForConsole(enhancedError));

      logger.apiError('GET', url, error instanceof Error ? error : String(error), 'API');
      throw new Error(enhancedError.userMessage);
    }

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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  logger.apiRequest('GET', url, undefined, 'Dashboard');

  try {
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.apiResponse('GET', url, response.status, duration, 'Dashboard');

      // Create enhanced error with status
      const enhancedError = handleApiError(
        { status: response.status, message: response.statusText },
        url,
        requestId
      );

      // Log detailed error to console for developers
      console.error(formatErrorForConsole(enhancedError));

      // Throw with enhanced error information
      throw new Error(enhancedError.userMessage);
    }

    logger.apiResponse('GET', url, response.status, duration, 'Dashboard');
    return response.json();
  } catch (error) {
    const duration = Date.now() - startTime;

    // If not already an enhanced error, create one
    if (!(error instanceof Error) || !error.message.includes('permission')) {
      const enhancedError = handleApiError(error, url, requestId);
      console.error(formatErrorForConsole(enhancedError));

      logger.apiError('GET', url, error instanceof Error ? error : String(error), 'Dashboard');
      throw new Error(enhancedError.userMessage);
    }

    logger.apiError('GET', url, error instanceof Error ? error : String(error), 'Dashboard');
    throw error;
  }
}
