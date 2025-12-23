/**
 * Base API Client
 *
 * Provides authenticated axios instance with:
 * - Automatic JWT token injection
 * - Standard error handling
 * - Type-safe request/response
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// API Response wrapper types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface ListResponse<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
}

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Create authenticated axios instance
 */
function createApiClient(): AxiosInstance {
  const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds
  });

  // Request interceptor - Add JWT token to all requests
  apiClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      try {
        // Fetch the current auth session
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        if (idToken) {
          config.headers.Authorization = `Bearer ${idToken}`;
        }
      } catch (error) {
        console.error('Failed to fetch auth token:', error);
        // Continue without token - let the API return 401
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - Handle errors consistently
  apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response) {
        // Server responded with error status
        const statusCode = error.response.status;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const message = (error.response.data as any)?.error || error.message;

        // Handle specific status codes
        switch (statusCode) {
          case 401:
            // Unauthorized - token expired or invalid
            console.error('Unauthorized - please log in again');
            // Could trigger logout here if nxweeded
            break;
          case 404:
            // Not found
            console.error('Resource not found:', message);
            break;
          case 400:
            // Bad request - validation error
            console.error('Validation error:', message);
            break;
          case 500:
            // Server error
            console.error('Server error:', message);
            break;
        }

        throw new ApiError(statusCode, message, error);
      } else if (error.request) {
        // Request made but no response
        console.error('Network error - no response from server');
        throw new ApiError(0, 'Network error - please check your connection', error);
      } else {
        // Error in request configuration
        console.error('Request error:', error.message);
        throw new ApiError(0, error.message, error);
      }
    }
  );

  return apiClient;
}

// Export singleton instance
export const apiClient = createApiClient();
