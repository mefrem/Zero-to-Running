# Error Message Standards

**Version**: 1.0
**Last Updated**: 2025-11-11
**Story**: 4.4 - Enhanced Error Messages & Developer Feedback

---

## Table of Contents

1. [Introduction](#introduction)
2. [The "What, Why, Next Steps" Format](#the-what-why-next-steps-format)
3. [Error Message Components](#error-message-components)
4. [Backend Error Guidelines](#backend-error-guidelines)
5. [Frontend Error Guidelines](#frontend-error-guidelines)
6. [Error Code Conventions](#error-code-conventions)
7. [Documentation References](#documentation-references)
8. [Testing Error Messages](#testing-error-messages)
9. [Examples](#examples)
10. [Common Pitfalls](#common-pitfalls)

---

## Introduction

Good error messages are essential for developer productivity and user satisfaction. This document defines the standards for creating clear, actionable error messages throughout the Zero-to-Running application.

### Goals

1. **Clarity**: Developers should immediately understand what went wrong
2. **Actionability**: Error messages should suggest concrete next steps
3. **Consistency**: All errors follow the same format and style
4. **Context**: Errors include relevant technical details for debugging
5. **Documentation**: Errors reference relevant documentation when available

### Audience

Error messages serve two audiences:
- **End Users**: Non-technical users who need friendly, actionable guidance
- **Developers**: Technical users who need detailed context for debugging

This document focuses primarily on developer-facing error messages. For user-facing messages, see the Frontend Error Guidelines section.

---

## The "What, Why, Next Steps" Format

All error messages in the Zero-to-Running application follow a three-part structure:

### 1. What Went Wrong

A clear, concise description of the error.

**Good Examples**:
- "Failed to connect to PostgreSQL database"
- "Database query execution failed"
- "Required environment variable SESSION_SECRET is not set"

**Bad Examples**:
- "Error" (too vague)
- "An unexpected error occurred" (not specific)
- "Connection failed" (missing context - connection to what?)

### 2. Why It Might Have Happened

One or more possible reasons for the error.

**Good Examples**:
- "PostgreSQL service is not running or not accepting connections"
- "Port 5432 on localhost is not reachable"
- "Database password may be incorrect"

**Bad Examples**:
- "Something went wrong" (not informative)
- "Check your configuration" (too generic)
- (empty - no explanation provided)

### 3. Next Steps

Specific, actionable steps to resolve the error.

**Good Examples**:
1. "Verify PostgreSQL is running: `docker-compose ps postgres`"
2. "Check PostgreSQL logs: `docker-compose logs postgres`"
3. "Verify DATABASE_PASSWORD in .env file"

**Bad Examples**:
- "Fix the problem" (not actionable)
- "Contact support" (should be last resort, not first step)
- "Debug the issue" (too vague)

---

## Error Message Components

### Required Components

Every enhanced error must include:

1. **What**: Clear description of what went wrong
2. **Why**: Array of possible reasons (can be empty for obvious errors)
3. **Next Steps**: Array of actionable steps (minimum 1)
4. **Code**: Error code following naming convention (e.g., `E_DB_CONNECTION_FAILED`)
5. **Category**: Error category (CONNECTION, VALIDATION, RUNTIME, etc.)
6. **Severity**: ERROR, WARNING, or INFO
7. **Timestamp**: ISO timestamp when error occurred

### Optional Components

These enhance error messages but are not required:

1. **Service**: Service name (e.g., "PostgreSQL", "Redis", "Backend API")
2. **Context**: Object with debugging information (e.g., host, port, query)
3. **Documentation**: Reference to documentation section
4. **Request ID**: For tracing requests across services

### Component Guidelines

#### Error Codes

- Format: `E_<CATEGORY>_<DESCRIPTION>`
- Categories: DB, REDIS, CONFIG, NETWORK, STARTUP, API, HEALTH
- Use SCREAMING_SNAKE_CASE
- Be descriptive but concise

**Examples**:
- `E_DB_CONNECTION_FAILED`
- `E_REDIS_OPERATION_FAILED`
- `E_CONFIG_MISSING`

#### Categories

Use these standard categories:

- **INITIALIZATION**: Startup and initialization errors
- **CONNECTION**: Database, Redis, network connections
- **VALIDATION**: Input validation, schema validation
- **RUNTIME**: Unexpected runtime errors
- **RESOURCE**: Memory, connections, rate limits
- **INTEGRATION**: External service errors
- **CONFIGURATION**: Config and environment errors

#### Severity Levels

- **ERROR**: Prevents operation from completing, requires intervention
- **WARNING**: Operation completed but with issues, action may be needed
- **INFO**: Informational message, no action needed

#### Context Object

Include relevant debugging information:

```typescript
context: {
  host: 'localhost',
  port: 5432,
  database: 'zero_to_running_dev',
  user: 'postgres',
  errorCode: 'ECONNREFUSED',
  errorMessage: 'connect ECONNREFUSED 127.0.0.1:5432'
}
```

**Guidelines**:
- Include connection details (host, port)
- Include operation parameters
- Include original error code/message
- Redact sensitive information (passwords, tokens)
- Keep context concise (< 10 fields)

---

## Backend Error Guidelines

### Using Enhanced Error Classes

The backend provides enhanced error classes:

- `DatabaseError` - PostgreSQL errors
- `RedisError` - Redis cache errors
- `ConfigurationError` - Configuration errors
- `NetworkError` - Network/connectivity errors
- `InitializationError` - Startup/initialization errors
- `ValidationError` - Validation errors

### Creating Enhanced Errors

```typescript
import { createDatabaseConnectionError } from '../utils/error-messages';

try {
  await pool.connect();
} catch (error) {
  const enhancedError = createDatabaseConnectionError(
    error,
    {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
    },
    requestId // optional
  );

  // Log structured error
  enhancedError.log();

  // Display formatted error message
  console.error(enhancedError.format());

  throw enhancedError;
}
```

### Error Message Builders

Use the provided error message builders in `backend/src/utils/error-messages.ts`:

- `createDatabaseConnectionError()` - Database connection failures
- `createDatabaseQueryError()` - Database query failures
- `createRedisConnectionError()` - Redis connection failures
- `createRedisOperationError()` - Redis operation failures
- `createConfigValidationError()` - Configuration validation errors
- `createConfigMissingError()` - Missing configuration errors
- `createStartupError()` - Startup/initialization errors
- `createHealthCheckError()` - Health check failures

These builders automatically:
- Discriminate network error types
- Generate appropriate "why" reasons
- Provide relevant "next steps"
- Include documentation references
- Add context information

### Network Error Discrimination

The `discriminateNetworkError()` function automatically classifies network errors:

- **SERVICE_DOWN**: Connection refused (ECONNREFUSED)
- **TIMEOUT**: Connection timeout (ETIMEDOUT)
- **DNS_FAILURE**: DNS resolution failed (ENOTFOUND)
- **NETWORK_MISCONFIGURED**: Network unreachable (ENETUNREACH, EHOSTUNREACH)
- **CONNECTION_RESET**: Connection reset (ECONNRESET)
- **UNKNOWN**: Other network errors

Use this to provide specific guidance for each error type.

### Logging Errors

Enhanced errors provide automatic logging:

```typescript
// Logs with appropriate level based on severity
enhancedError.log();
```

For manual logging:

```typescript
logger.error({
  msg: 'Database connection failed',
  code: 'E_DB_CONNECTION_FAILED',
  context: { host, port, database },
  requestId
});
```

---

## Frontend Error Guidelines

### User-Facing Messages

Frontend errors should prioritize user-friendly messages:

```typescript
import { handleApiError, formatErrorForDisplay } from '../utils/error-handler';

try {
  const response = await fetch(url);
  if (!response.ok) {
    const error = handleApiError(
      { status: response.status, message: response.statusText },
      url,
      requestId
    );

    // Show to user
    setError(formatErrorForDisplay(error)); // User-friendly message

    // Log for developers
    console.error(formatErrorForConsole(error)); // Detailed message

    throw new Error(error.userMessage);
  }
} catch (error) {
  // Handle error
}
```

### Error Boundary Component

Wrap your application with ErrorBoundary:

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

<ErrorBoundary>
  <App />
</ErrorBoundary>
```

The ErrorBoundary:
- Catches unhandled React errors
- Displays user-friendly error page
- Shows detailed error info in development
- Provides action buttons (Try Again, Reload)
- Logs errors for debugging

### API Error Handling

The `discriminateApiError()` function classifies API errors by HTTP status:

- **400**: Bad Request - Invalid input
- **401**: Unauthorized - Authentication required
- **403**: Forbidden - Access denied
- **404**: Not Found - Resource doesn't exist
- **408**: Timeout - Request took too long
- **429**: Rate Limit - Too many requests
- **500-599**: Server Error - Internal error
- **No Status**: Network Error - Connection failed

Each provides:
- User-friendly message
- Developer-friendly message
- Next steps for resolution
- Retryable flag

### Retryable Errors

Some errors can be automatically retried:

```typescript
import { isRetryable, getRetryDelay } from '../utils/error-handler';

if (isRetryable(error)) {
  const delay = getRetryDelay(error, attempt);
  setTimeout(() => retry(), delay);
}
```

Retryable errors:
- Network failures
- Timeouts
- Rate limits
- Server errors (5xx)
- Service unavailable (503)

---

## Error Code Conventions

### Naming Convention

`E_<CATEGORY>_<DESCRIPTION>`

### Categories

- **DB**: Database (PostgreSQL)
- **REDIS**: Redis cache
- **CONFIG**: Configuration
- **NETWORK**: Network/connectivity
- **STARTUP**: Initialization
- **API**: API client (frontend)
- **HEALTH**: Health checks

### Description Guidelines

- Use descriptive but concise names
- Focus on the error type, not the cause
- Use positive language (FAILED, not NOT_WORKING)
- Include HTTP status for API errors when relevant

### Examples

**Good**:
- `E_DB_CONNECTION_FAILED`
- `E_REDIS_OPERATION_FAILED`
- `E_CONFIG_MISSING`
- `E_STARTUP_FAILED`
- `E_API_TIMEOUT`

**Bad**:
- `E_ERROR` (not descriptive)
- `E_DATABASE_IS_NOT_WORKING` (too verbose)
- `E_CONN_FAIL` (too abbreviated)
- `ERROR_1234` (numeric codes less meaningful)

---

## Documentation References

### Format

Include documentation references in errors:

```typescript
documentation: {
  section: 'docs/TROUBLESHOOTING.md#database-connection-errors',
  url: '/docs/TROUBLESHOOTING.md#database-connection-errors' // optional
}
```

### Documentation Structure

Organize troubleshooting docs by error category:

- Database Connection Errors
- Database Query Errors
- Redis Connection Errors
- Redis Operation Errors
- Configuration Errors
- Network Errors
- Startup Failures
- Health Check Failures
- API Errors

### Keeping Documentation Current

- Update TROUBLESHOOTING.md when adding new error types
- Update ERROR_CODES.md with all error codes
- Include examples of error messages in documentation
- Link error messages to relevant documentation sections

---

## Testing Error Messages

### Unit Tests

Test error message generation:

```typescript
describe('createDatabaseConnectionError', () => {
  it('should create error with correct structure', () => {
    const error = createDatabaseConnectionError(
      new Error('ECONNREFUSED'),
      { host: 'localhost', port: 5432, database: 'test', user: 'postgres' }
    );

    expect(error.info.code).toBe('E_DB_CONNECTION_FAILED');
    expect(error.info.what).toContain('PostgreSQL');
    expect(error.info.why.length).toBeGreaterThan(0);
    expect(error.info.nextSteps.length).toBeGreaterThan(0);
    expect(error.info.documentation).toBeDefined();
  });

  it('should discriminate SERVICE_DOWN errors', () => {
    const error = createDatabaseConnectionError(
      { code: 'ECONNREFUSED' },
      { host: 'localhost', port: 5432, database: 'test', user: 'postgres' }
    );

    expect(error.info.context?.errorType).toBe('SERVICE_DOWN');
    expect(error.info.nextSteps).toContain(expect.stringContaining('docker-compose ps'));
  });
});
```

### Integration Tests

Test error scenarios:

```typescript
describe('Database Connection Errors', () => {
  it('should display enhanced error when database is down', async () => {
    // Stop database
    await exec('docker-compose stop postgres');

    // Attempt connection
    await expect(testDatabaseConnection()).rejects.toThrow();

    // Verify error message format
    // Check logs for enhanced error
  });
});
```

### Manual Testing

Test common error scenarios:

1. **Database Connection**:
   - Stop PostgreSQL: `docker-compose stop postgres`
   - Verify error message is clear and actionable

2. **Redis Connection**:
   - Stop Redis: `docker-compose stop redis`
   - Verify error message discriminates connection type

3. **Configuration Errors**:
   - Set invalid LOG_LEVEL
   - Verify error shows acceptable values

4. **Network Errors**:
   - Stop backend: `docker-compose stop backend`
   - Verify frontend shows user-friendly message

---

## Examples

### Example 1: Database Connection Error

**Code**:
```typescript
const error = createDatabaseConnectionError(
  { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:5432' },
  { host: 'localhost', port: 5432, database: 'mydb', user: 'postgres' },
  'req_12345'
);
```

**Formatted Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR: Failed to connect to PostgreSQL database
Service: PostgreSQL
Error Code: E_DB_CONNECTION_FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Why this happened:
  • PostgreSQL service is not running or not accepting connections
  • Port 5432 on localhost is not reachable

Next Steps:
  1. Verify PostgreSQL is running: docker-compose ps postgres
  2. Check PostgreSQL logs: docker-compose logs postgres
  3. Verify port 5432 is not in use by another process: lsof -i :5432
  4. Try restarting PostgreSQL: docker-compose restart postgres

Additional Context:
  host: "localhost"
  port: 5432
  database: "mydb"
  user: "postgres"
  errorType: "SERVICE_DOWN"

Documentation:
  See docs/TROUBLESHOOTING.md#database-connection-errors

Timestamp: 2025-11-11T10:30:45.123Z
Request ID: req_12345
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Example 2: Configuration Validation Error

**Code**:
```typescript
const error = createConfigValidationError(
  'LOG_LEVEL',
  'debug2',
  ['trace', 'debug', 'info', 'warn', 'error']
);
```

**Formatted Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR: Invalid configuration: LOG_LEVEL
Error Code: E_CONFIG_INVALID_VALUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Why this happened:
  • Environment variable LOG_LEVEL has invalid value: "debug2"

Next Steps:
  1. Update LOG_LEVEL in .env file to one of: trace, debug, info, warn, error
  2. Copy from .env.example if unsure: cp .env.example .env
  3. Restart services after updating: make dev

Additional Context:
  variable: "LOG_LEVEL"
  currentValue: "debug2"
  acceptableValues: ["trace","debug","info","warn","error"]

Documentation:
  See docs/CONFIGURATION.md

Timestamp: 2025-11-11T10:31:12.456Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Example 3: Frontend API Error

**Code**:
```typescript
const error = handleApiError(
  { status: 503, message: 'Service Unavailable' },
  'http://localhost:3001/api/users',
  'req_67890'
);
```

**User Message**:
```
The service is temporarily unavailable. Please try again in a few moments.
```

**Developer Console**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API Error: Service unavailable
Status: 503
Code: E_SERVICE_UNAVAILABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Developer Message:
  Service unavailable at http://localhost:3001/api/users. Server is down or overloaded.

Next Steps:
  1. Wait and retry in a few moments
  2. Check if backend service is running
  3. Verify database and Redis are accessible
  4. Check server health endpoints

Documentation: /docs/TROUBLESHOOTING.md#service-health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Common Pitfalls

### Avoid These Mistakes

1. **Vague error messages**:
   - Bad: "Error occurred"
   - Good: "Failed to connect to PostgreSQL database"

2. **Missing context**:
   - Bad: "Connection failed"
   - Good: "Connection failed to localhost:5432"

3. **No actionable steps**:
   - Bad: "Fix your configuration"
   - Good: "Update DATABASE_PASSWORD in .env file"

4. **Too technical for users**:
   - Bad: "ECONNREFUSED 127.0.0.1:3001"
   - Good: "Unable to connect to the server. Please check your internet connection."

5. **Missing error codes**:
   - Always include error codes for tracking and documentation

6. **Not using error builders**:
   - Use provided error builders instead of creating errors manually

7. **Forgetting documentation links**:
   - Always reference relevant documentation sections

8. **Not discriminating error types**:
   - Use network error discrimination to provide specific guidance

9. **Exposing sensitive information**:
   - Never include passwords, tokens, or secrets in error messages

10. **Inconsistent formatting**:
    - Use the enhanced error classes for consistent formatting

---

## Checklist for Good Error Messages

When creating or reviewing error messages, check:

- [ ] Follows "What, Why, Next Steps" format
- [ ] Has clear, descriptive "what" message
- [ ] Includes at least one "why" reason (unless obvious)
- [ ] Has at least one actionable "next step"
- [ ] Includes error code following naming convention
- [ ] Has appropriate category and severity
- [ ] Includes relevant context information
- [ ] References documentation section
- [ ] Uses error builder when available
- [ ] Tested with actual error scenario
- [ ] User-friendly for frontend errors
- [ ] No sensitive information exposed
- [ ] Consistent with other error messages
- [ ] Documented in ERROR_CODES.md
- [ ] Has corresponding troubleshooting guide

---

## See Also

- [ERROR_CODES.md](/docs/ERROR_CODES.md) - Complete error code reference
- [TROUBLESHOOTING.md](/docs/TROUBLESHOOTING.md) - Error troubleshooting guides
- [CONFIGURATION.md](/docs/CONFIGURATION.md) - Configuration reference
- [HOW_IT_WORKS.md](/docs/HOW_IT_WORKS.md) - System architecture

---

**Contributing**: When adding new error types, update this document with examples and add entries to ERROR_CODES.md. Ensure all errors follow these standards for consistency.
