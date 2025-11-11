# Error Codes Reference

**Version**: 1.0
**Last Updated**: 2025-11-11
**Story**: 4.4 - Enhanced Error Messages & Developer Feedback

---

## Table of Contents

1. [Overview](#overview)
2. [Error Code Format](#error-code-format)
3. [Database Errors](#database-errors)
4. [Redis Errors](#redis-errors)
5. [Configuration Errors](#configuration-errors)
6. [Network Errors](#network-errors)
7. [Initialization Errors](#initialization-errors)
8. [API Errors (Frontend)](#api-errors-frontend)
9. [Quick Reference](#quick-reference)

---

## Overview

This document provides a comprehensive catalog of all error codes used in the Zero-to-Running application. Each error code follows a consistent format and includes:

- **What**: Description of what went wrong
- **Why**: Common reasons this error occurs
- **Next Steps**: Actionable steps to resolve the error
- **Documentation**: Link to relevant documentation section

All errors in the application follow the enhanced error message format with these components to help developers quickly understand and resolve issues.

---

## Error Code Format

Error codes follow the pattern: `E_<CATEGORY>_<DESCRIPTION>`

**Categories**:
- `DB` - Database-related errors
- `REDIS` - Redis cache-related errors
- `CONFIG` - Configuration errors
- `NETWORK` - Network/connectivity errors
- `STARTUP` - Initialization/startup errors
- `API` - API client errors (frontend)
- `HEALTH` - Health check errors

**Examples**:
- `E_DB_CONNECTION_FAILED` - Database connection failure
- `E_REDIS_OPERATION_FAILED` - Redis operation failure
- `E_CONFIG_MISSING` - Missing configuration variable
- `E_NETWORK_FAILED` - Network request failure

---

## Database Errors

### E_DB_CONNECTION_FAILED

**Category**: CONNECTION
**Severity**: ERROR
**Service**: PostgreSQL

**What**: Failed to connect to PostgreSQL database

**Common Causes**:
- PostgreSQL service is not running
- Port is blocked or in use by another process
- Incorrect database credentials
- Network configuration issue
- DNS resolution failure

**Error Discrimination**:
The system automatically discriminates between:
- `SERVICE_DOWN`: PostgreSQL not accepting connections (ECONNREFUSED)
- `TIMEOUT`: Connection timeout (ETIMEDOUT)
- `DNS_FAILURE`: Cannot resolve hostname (ENOTFOUND)
- `NETWORK_MISCONFIGURED`: Network routing issue (ENETUNREACH)
- `CONNECTION_RESET`: Server closed connection (ECONNRESET)

**Next Steps**:
1. Verify PostgreSQL is running: `docker-compose ps postgres`
2. Check PostgreSQL logs: `docker-compose logs postgres`
3. Verify port availability: `lsof -i :5432`
4. Check DATABASE_* environment variables in .env
5. Try manual connection: `docker exec -it zero-to-running-postgres psql -U postgres`

**Documentation**: [TROUBLESHOOTING.md#database-connection-errors](/docs/TROUBLESHOOTING.md#database-connection-errors)

---

### E_DB_QUERY_42P01

**Category**: VALIDATION
**Severity**: ERROR
**Service**: PostgreSQL

**What**: Database query failed - table does not exist

**Common Causes**:
- Database schema not initialized
- Migrations not run
- Wrong database selected
- Table name typo in query

**Next Steps**:
1. Verify database schema is initialized
2. Run database migrations: `npm run migrate`
3. Check PostgreSQL logs for schema initialization: `docker-compose logs postgres`
4. Verify correct database is selected

**Documentation**: [TROUBLESHOOTING.md#database-query-errors](/docs/TROUBLESHOOTING.md#database-query-errors)

---

### E_DB_QUERY_42703

**Category**: VALIDATION
**Severity**: ERROR
**Service**: PostgreSQL

**What**: Database query failed - column does not exist

**Common Causes**:
- Database schema out of date
- Migrations not applied
- Column name typo in query
- Schema mismatch with code

**Next Steps**:
1. Verify database schema matches application code
2. Run database migrations to update schema
3. Check for typos in column names
4. Review schema definition in migrations

**Documentation**: [TROUBLESHOOTING.md#database-query-errors](/docs/TROUBLESHOOTING.md#database-query-errors)

---

### E_DB_QUERY_23505

**Category**: VALIDATION
**Severity**: ERROR
**Service**: PostgreSQL

**What**: Database query failed - unique constraint violation

**Common Causes**:
- Attempting to insert duplicate value for unique field
- Record with same key already exists
- Concurrent insert race condition

**Next Steps**:
1. Check if record already exists before inserting
2. Use UPSERT (INSERT ... ON CONFLICT) for idempotent inserts
3. Handle constraint violation in application code
4. Check unique constraints in database schema

**Documentation**: [TROUBLESHOOTING.md#database-query-errors](/docs/TROUBLESHOOTING.md#database-query-errors)

---

### E_DB_QUERY_53300

**Category**: RESOURCE
**Severity**: ERROR
**Service**: PostgreSQL

**What**: Database query failed - too many connections

**Common Causes**:
- Connection pool exhausted
- Connection leaks (not releasing connections)
- DATABASE_POOL_MAX too low for workload
- Too many concurrent requests

**Next Steps**:
1. Increase DATABASE_POOL_MAX in .env
2. Check for connection leaks (ensure connections are released)
3. Monitor active connections: `SELECT count(*) FROM pg_stat_activity;`
4. Review application code for proper connection handling

**Documentation**: [TROUBLESHOOTING.md#database-query-errors](/docs/TROUBLESHOOTING.md#database-query-errors)

---

## Redis Errors

### E_REDIS_CONNECTION_FAILED

**Category**: CONNECTION
**Severity**: ERROR
**Service**: Redis

**What**: Failed to connect to Redis cache

**Common Causes**:
- Redis service is not running
- Port is blocked or in use
- Incorrect Redis credentials
- Network configuration issue
- DNS resolution failure

**Error Discrimination**:
The system automatically discriminates between:
- `SERVICE_DOWN`: Redis not accepting connections (ECONNREFUSED)
- `TIMEOUT`: Connection timeout (ETIMEDOUT)
- `DNS_FAILURE`: Cannot resolve hostname (ENOTFOUND)
- `NETWORK_MISCONFIGURED`: Network routing issue (ENETUNREACH)

**Next Steps**:
1. Verify Redis is running: `docker-compose ps redis`
2. Check Redis logs: `docker-compose logs redis`
3. Verify port availability: `lsof -i :6379`
4. Check REDIS_* environment variables in .env
5. Test connection: `docker exec -it zero-to-running-redis redis-cli PING`

**Documentation**: [TROUBLESHOOTING.md#redis-connection-errors](/docs/TROUBLESHOOTING.md#redis-connection-errors)

---

### E_REDIS_OPERATION_FAILED

**Category**: RUNTIME
**Severity**: ERROR
**Service**: Redis

**What**: Redis operation failed

**Common Causes**:
- Redis is in read-only mode
- Redis out of memory (OOM)
- Invalid operation parameters
- Connection lost during operation
- Operation not supported

**Next Steps**:
1. Check Redis server status and logs
2. Verify operation syntax and parameters
3. Check Redis connection is still active
4. For OOM errors: Check memory usage with `redis-cli INFO memory`
5. Review Redis configuration (maxmemory, eviction policy)

**Documentation**: [TROUBLESHOOTING.md#redis-operation-errors](/docs/TROUBLESHOOTING.md#redis-operation-errors)

---

## Configuration Errors

### E_CONFIG_MISSING

**Category**: CONFIGURATION
**Severity**: ERROR

**What**: Required environment variable is not set

**Common Causes**:
- .env file missing or incomplete
- Required variable not defined
- Variable name typo
- .env file not loaded

**Next Steps**:
1. Add the missing variable to your .env file
2. See .env.example for template and description
3. Generate secrets if needed: `openssl rand -base64 32`
4. Restart services after updating: `make dev`

**Documentation**: [CONFIGURATION.md](/docs/CONFIGURATION.md)

---

### E_CONFIG_INVALID_VALUE

**Category**: CONFIGURATION
**Severity**: ERROR

**What**: Environment variable has invalid value

**Common Causes**:
- Value doesn't match expected format
- Value outside acceptable range
- Typo in variable value
- Wrong data type (e.g., string instead of number)

**Next Steps**:
1. Update variable in .env file to acceptable value
2. See error message for list of acceptable values
3. Copy from .env.example if unsure
4. Restart services after updating: `make dev`

**Documentation**: [CONFIGURATION.md](/docs/CONFIGURATION.md)

---

## Network Errors

### E_NETWORK_FAILED

**Category**: INTEGRATION
**Severity**: ERROR

**What**: Network connection failed (frontend)

**Common Causes**:
- Backend server is not running
- Network connectivity issue
- CORS configuration problem
- Firewall blocking request
- Backend URL misconfigured

**Next Steps**:
1. Check your internet connection
2. Verify backend server is running: `docker-compose ps backend`
3. Check if backend is accessible: `curl http://localhost:3001/health`
4. Look for CORS errors in browser console
5. Verify VITE_API_URL in .env

**Documentation**: [TROUBLESHOOTING.md#network-errors](/docs/TROUBLESHOOTING.md#network-errors)

---

## Initialization Errors

### E_STARTUP_FAILED

**Category**: INITIALIZATION
**Severity**: ERROR

**What**: Service failed during startup/initialization

**Common Causes**:
- Configuration error preventing startup
- Dependency service not available
- Port conflict
- Missing required files
- Initialization script failed

**Next Steps**:
1. Check service configuration in .env file
2. View service logs: `docker-compose logs <service-name>`
3. Verify all required services are running: `docker-compose ps`
4. Check for port conflicts: `lsof -i :<port>`
5. Try restarting: `make down && make dev`

**Documentation**: [TROUBLESHOOTING.md#startup-failures](/docs/TROUBLESHOOTING.md#startup-failures)

---

### E_HEALTH_CHECK_FAILED

**Category**: INITIALIZATION
**Severity**: ERROR

**What**: Service health check failed

**Common Causes**:
- Service not fully started
- Dependencies not available
- Health check endpoint error
- Configuration issue
- Service crashed after startup

**Next Steps**:
1. Check service logs: `docker-compose logs <service-name>`
2. Verify container is running: `docker ps`
3. Try health check manually: `curl <health-endpoint>`
4. Check service dependencies (database, Redis, etc.)
5. Review recent code changes

**Documentation**: [TROUBLESHOOTING.md#health-check-failures](/docs/TROUBLESHOOTING.md#health-check-failures)

---

## API Errors (Frontend)

### E_BAD_REQUEST

**HTTP Status**: 400
**Retryable**: No

**What**: Invalid request to API

**Common Causes**:
- Request validation failed
- Missing required parameters
- Invalid parameter format
- Malformed request body

**User Message**: "The request was invalid. Please check your input and try again."

**Next Steps**:
1. Check request parameters and body format
2. Verify API documentation for correct format
3. Check browser console for validation errors
4. Review request payload in Network tab

**Documentation**: [TROUBLESHOOTING.md#api-errors](/docs/TROUBLESHOOTING.md#api-errors)

---

### E_UNAUTHORIZED

**HTTP Status**: 401
**Retryable**: No

**What**: Authentication required

**Common Causes**:
- Not signed in
- Session expired
- Invalid authentication token
- Missing credentials

**User Message**: "You need to sign in to access this resource."

**Next Steps**:
1. Sign in to your account
2. Check if session has expired
3. Verify authentication token is being sent
4. Clear cookies and sign in again

**Documentation**: [TROUBLESHOOTING.md#authentication-errors](/docs/TROUBLESHOOTING.md#authentication-errors)

---

### E_FORBIDDEN

**HTTP Status**: 403
**Retryable**: No

**What**: Access denied

**Common Causes**:
- Insufficient permissions
- User role doesn't allow access
- Resource ownership mismatch
- Account suspended

**User Message**: "You do not have permission to access this resource."

**Next Steps**:
1. Verify you have the required permissions
2. Contact administrator if you need access
3. Check user role and permissions
4. Verify resource ownership

**Documentation**: [TROUBLESHOOTING.md#authorization-errors](/docs/TROUBLESHOOTING.md#authorization-errors)

---

### E_NOT_FOUND

**HTTP Status**: 404
**Retryable**: No

**What**: Resource not found

**Common Causes**:
- Resource was deleted
- Wrong URL or ID
- Endpoint doesn't exist
- Typo in URL

**User Message**: "The requested resource could not be found."

**Next Steps**:
1. Verify the URL is correct
2. Check if resource still exists
3. Review API documentation for correct endpoint
4. Check for typos in resource ID

**Documentation**: [TROUBLESHOOTING.md#api-errors](/docs/TROUBLESHOOTING.md#api-errors)

---

### E_TIMEOUT

**HTTP Status**: 408
**Retryable**: Yes

**What**: Request timeout

**Common Causes**:
- Server overloaded
- Slow database query
- Network latency
- Request taking too long

**User Message**: "The request took too long to complete. Please try again."

**Next Steps**:
1. Retry the request
2. Check server performance and logs
3. Consider increasing timeout configuration
4. Look for slow database queries

**Documentation**: [TROUBLESHOOTING.md#timeout-errors](/docs/TROUBLESHOOTING.md#timeout-errors)

---

### E_RATE_LIMIT

**HTTP Status**: 429
**Retryable**: Yes (after delay)

**What**: Rate limit exceeded

**Common Causes**:
- Too many requests in short time
- Rate limit threshold exceeded
- No throttling on client side
- Multiple tabs/instances making requests

**User Message**: "Too many requests. Please wait a moment and try again."

**Next Steps**:
1. Wait before retrying (exponential backoff)
2. Implement request throttling in client
3. Check rate limit configuration
4. Close duplicate tabs/instances

**Documentation**: [TROUBLESHOOTING.md#rate-limiting](/docs/TROUBLESHOOTING.md#rate-limiting)

---

### E_SERVER_ERROR

**HTTP Status**: 500-599
**Retryable**: Yes

**What**: Internal server error

**Common Causes**:
- Unhandled exception in server code
- Database connection issue
- Redis connection issue
- Application bug
- Resource exhaustion

**User Message**: "A server error occurred. Our team has been notified. Please try again later."

**Next Steps**:
1. Check backend logs for error details
2. Verify database and Redis connections
3. Check for unhandled exceptions
4. Review recent code changes
5. Monitor server resources

**Documentation**: [TROUBLESHOOTING.md#server-errors](/docs/TROUBLESHOOTING.md#server-errors)

---

### E_SERVICE_UNAVAILABLE

**HTTP Status**: 503
**Retryable**: Yes

**What**: Service temporarily unavailable

**Common Causes**:
- Server is down
- Server is overloaded
- Maintenance mode
- Dependency service down

**User Message**: "The service is temporarily unavailable. Please try again in a few moments."

**Next Steps**:
1. Wait and retry in a few moments
2. Check if backend service is running
3. Verify database and Redis are accessible
4. Check server health endpoints

**Documentation**: [TROUBLESHOOTING.md#service-health](/docs/TROUBLESHOOTING.md#service-health)

---

## Quick Reference

### Error Code Index

| Code | Category | Severity | Service | Retryable |
|------|----------|----------|---------|-----------|
| E_DB_CONNECTION_FAILED | CONNECTION | ERROR | PostgreSQL | No |
| E_DB_QUERY_42P01 | VALIDATION | ERROR | PostgreSQL | No |
| E_DB_QUERY_42703 | VALIDATION | ERROR | PostgreSQL | No |
| E_DB_QUERY_23505 | VALIDATION | ERROR | PostgreSQL | No |
| E_DB_QUERY_53300 | RESOURCE | ERROR | PostgreSQL | No |
| E_REDIS_CONNECTION_FAILED | CONNECTION | ERROR | Redis | No |
| E_REDIS_OPERATION_FAILED | RUNTIME | ERROR | Redis | No |
| E_CONFIG_MISSING | CONFIGURATION | ERROR | - | No |
| E_CONFIG_INVALID_VALUE | CONFIGURATION | ERROR | - | No |
| E_NETWORK_FAILED | INTEGRATION | ERROR | - | Yes |
| E_STARTUP_FAILED | INITIALIZATION | ERROR | - | No |
| E_HEALTH_CHECK_FAILED | INITIALIZATION | ERROR | - | No |
| E_BAD_REQUEST | VALIDATION | ERROR | API | No |
| E_UNAUTHORIZED | VALIDATION | ERROR | API | No |
| E_FORBIDDEN | VALIDATION | ERROR | API | No |
| E_NOT_FOUND | VALIDATION | ERROR | API | No |
| E_TIMEOUT | RUNTIME | ERROR | API | Yes |
| E_RATE_LIMIT | RESOURCE | WARNING | API | Yes |
| E_SERVER_ERROR | RUNTIME | ERROR | API | Yes |
| E_SERVICE_UNAVAILABLE | RUNTIME | ERROR | API | Yes |

---

## See Also

- [TROUBLESHOOTING.md](/docs/TROUBLESHOOTING.md) - Detailed troubleshooting guides
- [CONFIGURATION.md](/docs/CONFIGURATION.md) - Configuration reference
- [ERROR_MESSAGE_STANDARDS.md](/docs/ERROR_MESSAGE_STANDARDS.md) - Developer guide for creating error messages
- [HOW_IT_WORKS.md](/docs/HOW_IT_WORKS.md) - System architecture and design

---

**Note**: This document is automatically generated from error definitions in the codebase. For the most up-to-date error information, refer to the source code in `backend/src/utils/errors.ts` and `frontend/src/utils/error-handler.ts`.
