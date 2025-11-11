# Zero-to-Running Logging Guide

## Overview

Zero-to-Running implements structured logging across all services to provide visibility into system behavior and enable effective troubleshooting. This guide explains how to view, configure, and work with logs in the development environment.

## Table of Contents

- [Quick Start](#quick-start)
- [Viewing Logs](#viewing-logs)
- [Log Configuration](#log-configuration)
- [Log Format](#log-format)
- [Request Tracing](#request-tracing)
- [Backend Logging](#backend-logging)
- [Frontend Logging](#frontend-logging)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Quick Start

### View All Service Logs

```bash
make logs
```

### View Logs for Specific Service

```bash
make logs service=backend
make logs service=frontend
make logs service=postgres
make logs service=redis
```

### Follow Logs in Real-Time

```bash
make logs follow=true
make logs service=backend follow=true
```

### Customize Number of Lines

```bash
make logs lines=200
make logs service=backend lines=50
```

## Viewing Logs

### Available Commands

| Command | Description |
|---------|-------------|
| `make logs` | Display last 100 lines from all services |
| `make logs service=<name>` | Display logs for specific service |
| `make logs follow=true` | Stream logs in real-time |
| `make logs lines=N` | Display last N lines |
| `make logs service=backend follow=true lines=50` | Combine options |

### Service Names

- `backend` - Node.js API server
- `frontend` - React application
- `postgres` - PostgreSQL database
- `redis` - Redis cache

### Log Output Format

Logs are displayed with:
- **Color coding** by service for easy identification
- **Timestamps** for all log entries
- **Service name prefix** showing which service generated each log

Example output:
```
[backend] {"timestamp":"2025-11-10T14:30:45.123Z","level":"info","service":"backend","msg":"Application started successfully","port":3001}
[frontend] [2025-11-10T14:30:46.234Z] [INFO] [App] Health check successful
[postgres] 2025-11-10 14:30:47.345 UTC [1] LOG: database system is ready to accept connections
```

## Log Configuration

### Environment Variables

Configure logging behavior using environment variables in your `.env` file:

#### Backend Log Configuration

```bash
# Log level: ERROR, WARN, INFO, DEBUG
# DEBUG includes database queries and detailed request information
LOG_LEVEL=INFO

# Log format: json (structured), pretty (human-readable with colors)
# Recommended: pretty for development, json for production
LOG_FORMAT=pretty

# Number of log lines displayed by 'make logs' command
LOG_LINES=100
```

#### Frontend Log Configuration

```bash
# Frontend log level: ERROR, WARN, INFO, DEBUG
# Set to ERROR in production to minimize console output
VITE_LOG_LEVEL=INFO

# Enable logging of user interactions (clicks, navigation, forms)
# Recommended: false (only enable for debugging UI issues)
VITE_LOG_INTERACTIONS=false
```

### Log Levels

| Level | Description | Backend Includes | Frontend Includes |
|-------|-------------|------------------|-------------------|
| **ERROR** | Critical errors only | Application errors, unhandled exceptions | API errors, critical failures |
| **WARN** | Warnings and errors | Failed connections, degraded performance | 4xx API responses, warnings |
| **INFO** | General information | Startup, shutdown, API requests | Component lifecycle, successful operations |
| **DEBUG** | Detailed debugging | Database queries, Redis operations, request bodies | API request/response details, state changes |

### Changing Log Level

1. Edit `.env` file:
   ```bash
   LOG_LEVEL=DEBUG
   ```

2. Restart services:
   ```bash
   make down
   make dev
   ```

3. View detailed logs:
   ```bash
   make logs service=backend follow=true
   ```

## Log Format

### Backend Structured JSON Format

All backend logs are output in structured JSON format (or pretty-printed in development):

```json
{
  "timestamp": "2025-11-10T14:30:45.123Z",
  "level": "info",
  "service": "backend",
  "message": "Incoming request",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "path": "/api/users",
  "query": {"page": "1", "limit": "10"},
  "statusCode": 200,
  "responseTime": 125
}
```

#### Required Fields

Every backend log entry includes:

- **timestamp** - ISO 8601 format timestamp
- **level** - Log level (error, warn, info, debug)
- **service** - Always "backend" for API server logs
- **message** - Human-readable log message

#### Optional Fields

Depending on context, logs may include:

- **requestId** - Unique identifier for request tracing
- **method** - HTTP method (GET, POST, etc.)
- **path** - Request path
- **url** - Full request URL
- **query** - Query parameters
- **statusCode** - HTTP response status code
- **responseTime** - Response time in milliseconds
- **duration** - Operation duration in milliseconds
- **error** - Error message and stack trace
- **type** - Operation type (database, cache, etc.)

### Frontend Log Format

Frontend logs are formatted for browser console readability:

**Development Mode:**
```
[2025-11-10T14:30:45.123Z] [INFO] [App] Health check successful {status: "ok"}
[2025-11-10T14:30:46.234Z] [DEBUG] [API] API Request {method: "GET", url: "/health"}
```

**Production Mode (JSON):**
```json
{"timestamp":"2025-11-10T14:30:45.123Z","level":"INFO","component":"App","message":"Health check successful","status":"ok"}
```

## Request Tracing

### What is Request Tracing?

Every API request is assigned a unique **requestId** that appears in all logs related to that request. This allows you to trace a single request through the entire system.

### How it Works

1. **Request arrives** - Backend generates unique requestId (UUID v4)
2. **Logged throughout** - All operations (queries, cache, etc.) include requestId
3. **Returned in response** - Response includes `X-Request-ID` header
4. **Error tracking** - Errors include requestId for troubleshooting

### Tracing a Request

To trace a specific request through the logs:

1. Get requestId from API response header:
   ```bash
   curl -I http://localhost:3001/health
   # Look for: X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
   ```

2. Search logs for that requestId:
   ```bash
   make logs service=backend | grep "550e8400-e29b-41d4-a716-446655440000"
   ```

3. See all operations for that request:
   ```
   Incoming request - requestId: 550e8400...
   Database query - requestId: 550e8400...
   Response sent - requestId: 550e8400...
   ```

## Backend Logging

### Automatic Request/Response Logging

All API requests and responses are automatically logged:

```json
// Request
{
  "timestamp": "2025-11-10T14:30:45.123Z",
  "level": "info",
  "msg": "Incoming request",
  "requestId": "550e8400...",
  "method": "POST",
  "path": "/api/users",
  "query": {},
  "body": {"username": "john"},
  "bodySize": 23
}

// Response
{
  "timestamp": "2025-11-10T14:30:45.248Z",
  "level": "info",
  "msg": "Response sent",
  "requestId": "550e8400...",
  "statusCode": 201,
  "responseTime": 125
}
```

### Database Query Logging

When `LOG_LEVEL=DEBUG`, all database queries are logged:

```json
{
  "timestamp": "2025-11-10T14:30:45.150Z",
  "level": "debug",
  "msg": "Database query",
  "requestId": "550e8400...",
  "query": "SELECT * FROM users WHERE id = $1",
  "params": [123],
  "duration": 15
}
```

### Redis Operation Logging

When `LOG_LEVEL=DEBUG`, Redis operations are logged:

```json
{
  "timestamp": "2025-11-10T14:30:45.160Z",
  "level": "debug",
  "msg": "Redis operation",
  "requestId": "550e8400...",
  "operation": "GET",
  "key": "session:abc123",
  "type": "cache"
}
```

### Custom Logging in Code

```typescript
import { logger } from './utils/logger';

// Basic logging
logger.info({ msg: 'User registered', userId: 123 });
logger.error({ msg: 'Operation failed', error: err.message });

// Logging with requestId context
import { createChildLogger } from './config/logger';
const log = createChildLogger({ requestId: req.requestId });
log.info({ msg: 'Processing request', userId: req.user.id });

// Database query with logging
import { executeQuery } from './config/database';
await executeQuery('SELECT * FROM users', [], req.requestId);
```

## Frontend Logging

### Component Lifecycle Logging

```typescript
import { useLogger } from './utils/logger';

function MyComponent() {
  const log = useLogger('MyComponent');

  useEffect(() => {
    log.lifecycle('mount');
    return () => log.lifecycle('unmount');
  }, []);

  return <div>...</div>;
}
```

### API Call Logging

API calls are automatically logged:

```typescript
// Automatic logging in api.ts
const response = await fetch(`${API_URL}/users`);
// Logs: [DEBUG] [API] API Request {method: "GET", url: "/users"}
// Logs: [DEBUG] [API] API Response {status: 200, duration: 150}
```

### Custom Frontend Logging

```typescript
import { logger } from './utils/logger';

// Component-level logging
logger.info('Form submitted', { formId: 'login' }, 'LoginForm');
logger.error('Validation failed', { field: 'email' }, 'LoginForm');

// Using component-scoped hook
const log = useLogger('UserProfile');
log.info('Profile updated', { userId: 123 });
log.warn('Avatar upload failed', { reason: 'File too large' });
```

### User Interaction Logging (Optional)

Enable interaction logging for debugging:

```bash
# .env
VITE_LOG_INTERACTIONS=true
```

```typescript
logger.interaction('click', 'submit-button', { formId: 'login' }, 'LoginForm');
// Only logs if VITE_LOG_INTERACTIONS=true
```

## Best Practices

### Do's ✅

- **Use appropriate log levels** - ERROR for failures, INFO for normal operations, DEBUG for detailed info
- **Include context** - Add relevant data to help troubleshoot issues
- **Use requestId** - Always pass requestId through for request tracing
- **Log state changes** - Log when important state changes occur
- **Log errors with context** - Include what operation failed and why

### Don'ts ❌

- **Never log passwords** - Sensitive data is automatically sanitized, but be careful
- **Don't log tokens or API keys** - These are filtered, but avoid explicit logging
- **Avoid excessive DEBUG logging** - Too much logging hurts performance
- **Don't log in tight loops** - Consider sampling or conditional logging
- **Don't include PII unnecessarily** - Only log user data when needed for debugging

### Sensitive Data Handling

The logging system automatically sanitizes:

- `password`, `newPassword`, `oldPassword`
- `token`, `accessToken`, `refreshToken`
- `apiKey`, `secret`
- `authorization` headers
- `cookie` values

Database and Redis connection strings are automatically sanitized to mask passwords.

## Troubleshooting

### No Logs Appearing

**Problem:** Running `make logs` shows no output

**Solutions:**
1. Verify services are running:
   ```bash
   docker compose ps
   ```

2. Start services if needed:
   ```bash
   make dev
   ```

3. Check specific service:
   ```bash
   make logs service=backend
   ```

### Logs Not Showing DEBUG Information

**Problem:** Database queries or detailed info not appearing

**Solutions:**
1. Set log level to DEBUG:
   ```bash
   # .env
   LOG_LEVEL=DEBUG
   ```

2. Restart services:
   ```bash
   make down && make dev
   ```

3. Verify level is applied:
   ```bash
   make logs service=backend | grep level
   ```

### Frontend Logs Not in Browser Console

**Problem:** Expected logs not showing in browser developer tools

**Solutions:**
1. Check log level:
   ```bash
   # .env
   VITE_LOG_LEVEL=DEBUG
   ```

2. Hard refresh browser:
   ```
   Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
   ```

3. Check console filters - ensure all log levels are visible

### RequestId Not Consistent

**Problem:** Same request shows different requestIds

**Solution:**
- Ensure requestId is passed to all operations
- Use `req.requestId` in route handlers
- Pass requestId to database/cache operations

### Logs Too Verbose

**Problem:** Too many logs making it hard to find issues

**Solutions:**
1. Increase log level:
   ```bash
   LOG_LEVEL=WARN  # Only warnings and errors
   ```

2. Filter by service:
   ```bash
   make logs service=backend
   ```

3. Use grep to filter:
   ```bash
   make logs | grep ERROR
   make logs | grep requestId=<id>
   ```

### Docker Logs Delayed

**Problem:** Logs appear with a delay

**Explanation:** Docker buffers logs slightly. For real-time logs:
```bash
make logs follow=true
```

## Additional Resources

- [Pino Documentation](https://getpino.io/) - Backend logging library
- [Docker Compose Logs](https://docs.docker.com/compose/reference/logs/) - Log retrieval
- [Architecture Documentation](./architecture.md) - System architecture

## Support

For issues or questions about logging:
1. Check this documentation
2. Review logs with `make logs service=backend follow=true`
3. Verify configuration in `.env` file
4. Check service health with `make dev`

---

**Last Updated:** 2025-11-10
**Story:** 2.4 - Structured Logging Implementation
