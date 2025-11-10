/**
 * Health check endpoint tests
 * Tests for /health and /health/ready endpoints
 */

import request from 'supertest';
import express, { Express } from 'express';
import healthRouter from '../health';
import { testDatabaseConnection } from '../../config/database';
import { testRedisConnection } from '../../config/redis';

// Mock the database and Redis modules
jest.mock('../../config/database');
jest.mock('../../config/redis');
jest.mock('../../utils/logger');

const mockTestDatabaseConnection = testDatabaseConnection as jest.MockedFunction<
  typeof testDatabaseConnection
>;
const mockTestRedisConnection = testRedisConnection as jest.MockedFunction<
  typeof testRedisConnection
>;

describe('Health Check Endpoints', () => {
  let app: Express;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(healthRouter);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 status with correct JSON structure', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return ISO 8601 formatted timestamp', async () => {
      const response = await request(app).get('/health');

      const timestamp = response.body.timestamp;
      expect(timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );

      // Verify it's a valid date
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    });

    it('should respond quickly (under 100ms)', async () => {
      const startTime = Date.now();
      await request(app).get('/health');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 with status "ready" when both dependencies are healthy', async () => {
      mockTestDatabaseConnection.mockResolvedValue(true);
      mockTestRedisConnection.mockResolvedValue(true);

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ready',
        timestamp: expect.any(String),
        database: 'ok',
        cache: 'ok',
      });
    });

    it('should return 503 with database error when database is down', async () => {
      mockTestDatabaseConnection.mockResolvedValue(false);
      mockTestRedisConnection.mockResolvedValue(true);

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'unavailable',
        timestamp: expect.any(String),
        database: 'error',
        cache: 'ok',
        errors: {
          database: 'Database connection test returned false',
        },
      });
    });

    it('should return 503 with cache error when Redis is down', async () => {
      mockTestDatabaseConnection.mockResolvedValue(true);
      mockTestRedisConnection.mockResolvedValue(false);

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'unavailable',
        timestamp: expect.any(String),
        database: 'ok',
        cache: 'error',
        errors: {
          cache: 'Redis connection test returned false',
        },
      });
    });

    it('should return 503 with both errors when both dependencies are down', async () => {
      mockTestDatabaseConnection.mockResolvedValue(false);
      mockTestRedisConnection.mockResolvedValue(false);

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unavailable');
      expect(response.body.database).toBe('error');
      expect(response.body.cache).toBe('error');
      expect(response.body.errors).toHaveProperty('database');
      expect(response.body.errors).toHaveProperty('cache');
    });

    it('should handle database connection rejection with error message', async () => {
      mockTestDatabaseConnection.mockRejectedValue(
        new Error('Connection timeout after 5000ms')
      );
      mockTestRedisConnection.mockResolvedValue(true);

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.database).toBe('error');
      expect(response.body.errors.database).toContain('Connection timeout');
    });

    it('should handle Redis connection rejection with error message', async () => {
      mockTestDatabaseConnection.mockResolvedValue(true);
      mockTestRedisConnection.mockRejectedValue(
        new Error('Redis connection refused')
      );

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.cache).toBe('error');
      expect(response.body.errors.cache).toContain('connection refused');
    });

    it('should return 503 with timeout error when checks exceed 1 second', async () => {
      // Mock both checks to take longer than 1 second
      mockTestDatabaseConnection.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(true), 1500);
          })
      );
      mockTestRedisConnection.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(true), 1500);
          })
      );

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unavailable');
      expect(response.body.errors).toHaveProperty('timeout');
      expect(response.body.errors.timeout).toContain('1 second timeout');
    });

    it('should complete within 1.1 seconds even with slow dependencies', async () => {
      // Mock slow dependencies (would normally take 2 seconds each)
      mockTestDatabaseConnection.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(true), 2000);
          })
      );
      mockTestRedisConnection.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(true), 2000);
          })
      );

      const startTime = Date.now();
      await request(app).get('/health/ready');
      const duration = Date.now() - startTime;

      // Should timeout around 1 second, give 100ms buffer for processing
      expect(duration).toBeLessThan(1100);
    });

    it('should include timestamp in all responses', async () => {
      mockTestDatabaseConnection.mockResolvedValue(true);
      mockTestRedisConnection.mockResolvedValue(true);

      const response = await request(app).get('/health/ready');

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should not include errors object when all dependencies are healthy', async () => {
      mockTestDatabaseConnection.mockResolvedValue(true);
      mockTestRedisConnection.mockResolvedValue(true);

      const response = await request(app).get('/health/ready');

      expect(response.body).not.toHaveProperty('errors');
    });
  });
});
