/**
 * API Configuration
 *
 * Handles backend API URL configuration and provides HTTP client utilities.
 */

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
 * Fetch backend health status
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
