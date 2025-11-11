/**
 * Frontend Error Handling Utilities
 *
 * Provides structured error handling for frontend with
 * user-friendly messages and developer-friendly details.
 * Story 4.4: Enhanced Error Messages & Developer Feedback
 */

import { logger } from './logger';

/**
 * API Error information
 */
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: string;
  documentation?: string;
  retryable: boolean;
  userMessage: string;
  developerMessage: string;
  nextSteps: string[];
}

/**
 * Discriminate API error based on status code and network conditions
 */
export function discriminateApiError(error: any, url: string): ApiError {
  // Network errors (no response from server)
  if (!error.status && (error.message?.includes('fetch') || error.message?.includes('network'))) {
    return {
      message: 'Network connection failed',
      code: 'E_NETWORK_FAILED',
      retryable: true,
      userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      developerMessage: `Network request to ${url} failed. Server may be down or unreachable.`,
      nextSteps: [
        'Check your internet connection',
        'Verify the backend server is running',
        'Check if backend is accessible at the configured URL',
        'Look for CORS configuration issues in browser console',
      ],
      documentation: '/docs/TROUBLESHOOTING.md#network-errors',
    };
  }

  // Parse status code
  const status = error.status || 0;

  // 400 Bad Request
  if (status === 400) {
    return {
      message: 'Invalid request',
      status,
      code: 'E_BAD_REQUEST',
      retryable: false,
      userMessage: 'The request was invalid. Please check your input and try again.',
      developerMessage: `Bad request to ${url}. Request validation failed.`,
      nextSteps: [
        'Check request parameters and body',
        'Verify API documentation for correct format',
        'Check browser console for validation errors',
      ],
      documentation: '/docs/TROUBLESHOOTING.md#api-errors',
    };
  }

  // 401 Unauthorized
  if (status === 401) {
    return {
      message: 'Authentication required',
      status,
      code: 'E_UNAUTHORIZED',
      retryable: false,
      userMessage: 'You need to sign in to access this resource.',
      developerMessage: `Authentication failed for ${url}. Invalid or missing credentials.`,
      nextSteps: [
        'Sign in to your account',
        'Check if session has expired',
        'Verify authentication token is being sent',
      ],
      documentation: '/docs/TROUBLESHOOTING.md#authentication-errors',
    };
  }

  // 403 Forbidden
  if (status === 403) {
    return {
      message: 'Access denied',
      status,
      code: 'E_FORBIDDEN',
      retryable: false,
      userMessage: 'You do not have permission to access this resource.',
      developerMessage: `Access denied for ${url}. User lacks necessary permissions.`,
      nextSteps: [
        'Verify you have the required permissions',
        'Contact administrator if you need access',
        'Check user role and permissions in database',
      ],
      documentation: '/docs/TROUBLESHOOTING.md#authorization-errors',
    };
  }

  // 404 Not Found
  if (status === 404) {
    return {
      message: 'Resource not found',
      status,
      code: 'E_NOT_FOUND',
      retryable: false,
      userMessage: 'The requested resource could not be found.',
      developerMessage: `Resource not found at ${url}. Endpoint may not exist or resource was deleted.`,
      nextSteps: [
        'Verify the URL is correct',
        'Check if resource still exists',
        'Review API documentation for correct endpoint',
      ],
      documentation: '/docs/TROUBLESHOOTING.md#api-errors',
    };
  }

  // 408 Request Timeout
  if (status === 408) {
    return {
      message: 'Request timeout',
      status,
      code: 'E_TIMEOUT',
      retryable: true,
      userMessage: 'The request took too long to complete. Please try again.',
      developerMessage: `Request to ${url} timed out. Server may be overloaded or slow query.`,
      nextSteps: [
        'Retry the request',
        'Check server performance and logs',
        'Consider increasing timeout configuration',
        'Look for slow database queries or operations',
      ],
      documentation: '/docs/TROUBLESHOOTING.md#timeout-errors',
    };
  }

  // 429 Too Many Requests
  if (status === 429) {
    return {
      message: 'Rate limit exceeded',
      status,
      code: 'E_RATE_LIMIT',
      retryable: true,
      userMessage: 'Too many requests. Please wait a moment and try again.',
      developerMessage: `Rate limit exceeded for ${url}. Too many requests in short time period.`,
      nextSteps: [
        'Wait a few moments before retrying',
        'Implement request throttling in client',
        'Check rate limit configuration',
        'Consider implementing exponential backoff',
      ],
      documentation: '/docs/TROUBLESHOOTING.md#rate-limiting',
    };
  }

  // 500 Internal Server Error
  if (status >= 500 && status < 600) {
    return {
      message: 'Server error',
      status,
      code: 'E_SERVER_ERROR',
      retryable: true,
      userMessage: 'A server error occurred. Our team has been notified. Please try again later.',
      developerMessage: `Server error at ${url}. Internal server error occurred.`,
      nextSteps: [
        'Check backend logs for error details',
        'Verify database and Redis connections',
        'Check for unhandled exceptions in server code',
        'Review recent code changes',
      ],
      documentation: '/docs/TROUBLESHOOTING.md#server-errors',
    };
  }

  // 503 Service Unavailable
  if (status === 503) {
    return {
      message: 'Service unavailable',
      status,
      code: 'E_SERVICE_UNAVAILABLE',
      retryable: true,
      userMessage: 'The service is temporarily unavailable. Please try again in a few moments.',
      developerMessage: `Service unavailable at ${url}. Server is down or overloaded.`,
      nextSteps: [
        'Wait and retry in a few moments',
        'Check if backend service is running',
        'Verify database and Redis are accessible',
        'Check server health endpoints',
      ],
      documentation: '/docs/TROUBLESHOOTING.md#service-health',
    };
  }

  // Unknown error
  return {
    message: error.message || 'An unexpected error occurred',
    status,
    code: 'E_UNKNOWN',
    retryable: false,
    userMessage: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    developerMessage: `Unknown error occurred for ${url}: ${error.message || 'No details available'}`,
    nextSteps: [
      'Check browser console for error details',
      'Review network tab in browser DevTools',
      'Check backend logs for related errors',
      'See troubleshooting guide for more help',
    ],
    documentation: '/docs/TROUBLESHOOTING.md',
  };
}

/**
 * Handle API error and return structured error information
 */
export function handleApiError(error: any, url: string, requestId?: string): ApiError {
  const apiError = discriminateApiError(error, url);

  // Log error for debugging
  logger.error({
    msg: 'API error occurred',
    url,
    status: apiError.status,
    code: apiError.code,
    message: apiError.message,
    requestId,
  });

  return apiError;
}

/**
 * Format error for display in UI
 */
export function formatErrorForDisplay(error: ApiError): string {
  return error.userMessage;
}

/**
 * Format error for developer console
 */
export function formatErrorForConsole(error: ApiError): string {
  const lines: string[] = [];

  lines.push('━'.repeat(80));
  lines.push(`API Error: ${error.message}`);
  if (error.status) {
    lines.push(`Status: ${error.status}`);
  }
  if (error.code) {
    lines.push(`Code: ${error.code}`);
  }
  lines.push('━'.repeat(80));
  lines.push('');
  lines.push('Developer Message:');
  lines.push(`  ${error.developerMessage}`);
  lines.push('');
  lines.push('Next Steps:');
  error.nextSteps.forEach((step, index) => {
    lines.push(`  ${index + 1}. ${step}`);
  });
  lines.push('');
  if (error.documentation) {
    lines.push(`Documentation: ${error.documentation}`);
    lines.push('');
  }
  lines.push('━'.repeat(80));

  return lines.join('\n');
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: ApiError): boolean {
  return error.retryable;
}

/**
 * Get retry delay based on error type (for exponential backoff)
 */
export function getRetryDelay(error: ApiError, attempt: number): number {
  const baseDelay = error.code === 'E_RATE_LIMIT' ? 2000 : 1000;
  return Math.min(baseDelay * Math.pow(2, attempt), 10000);
}
