# Health Check Endpoints

This document describes the health check endpoints available in the Zero-to-Running backend API. These endpoints are designed to help developers, monitoring systems, and orchestration tools verify that the backend service and its dependencies are operational.

## Overview

The backend provides two health check endpoints:

1. **`/health`** - Basic liveness check that verifies the application is running
2. **`/health/ready`** - Readiness check that verifies all dependencies (database, cache) are accessible

These endpoints follow common health check patterns and can be integrated with:
- Docker health checks
- Kubernetes liveness and readiness probes
- Load balancers and API gateways
- Monitoring and alerting systems
- Development orchestration scripts

## Endpoints

### GET `/health`

Basic health endpoint that confirms the application is alive and responding to requests.

**Purpose**: Liveness check - verifies the process is running and can handle requests.

**Response Time**: Responds immediately (typically < 10ms)

**Success Response** (HTTP 200):
```json
{
  "status": "ok",
  "timestamp": "2025-11-10T14:30:00.000Z"
}
```

**Fields**:
- `status` (string): Always "ok" if the endpoint responds
- `timestamp` (string): ISO 8601 formatted timestamp of when the check was performed

**Use Cases**:
- Verify the application process is running
- Basic smoke test after deployment
- Liveness probe for container orchestration

**Example Usage**:
```bash
# Basic health check
curl http://localhost:3000/health

# Check with verbose output
curl -v http://localhost:3000/health

# Use in scripts
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
  echo "Backend is alive"
else
  echo "Backend is not responding"
fi
```

---

### GET `/health/ready`

Comprehensive readiness endpoint that verifies all backend dependencies are accessible and healthy.

**Purpose**: Readiness check - verifies the application can serve production traffic.

**Response Time**: Maximum 1 second (enforced timeout)

**Dependencies Checked**:
1. **Database** (PostgreSQL) - Executes `SELECT NOW()` query to verify connection
2. **Cache** (Redis) - Executes `PING` command to verify connection

**Success Response** (HTTP 200):
```json
{
  "status": "ready",
  "timestamp": "2025-11-10T14:30:00.000Z",
  "database": "ok",
  "cache": "ok"
}
```

**Failure Response - Database Down** (HTTP 503):
```json
{
  "status": "unavailable",
  "timestamp": "2025-11-10T14:30:00.000Z",
  "database": "error",
  "cache": "ok",
  "errors": {
    "database": "Connection timeout after 5000ms"
  }
}
```

**Failure Response - Redis Down** (HTTP 503):
```json
{
  "status": "unavailable",
  "timestamp": "2025-11-10T14:30:00.000Z",
  "database": "ok",
  "cache": "error",
  "errors": {
    "cache": "Redis connection refused"
  }
}
```

**Failure Response - Both Down** (HTTP 503):
```json
{
  "status": "unavailable",
  "timestamp": "2025-11-10T14:30:00.000Z",
  "database": "error",
  "cache": "error",
  "errors": {
    "database": "Database connection test returned false",
    "cache": "Redis connection test returned false"
  }
}
```

**Failure Response - Timeout** (HTTP 503):
```json
{
  "status": "unavailable",
  "timestamp": "2025-11-10T14:30:00.000Z",
  "errors": {
    "timeout": "Health check exceeded 1 second timeout"
  }
}
```

**Fields**:
- `status` (string): "ready" if all dependencies are healthy, "unavailable" otherwise
- `timestamp` (string): ISO 8601 formatted timestamp
- `database` (string): "ok" or "error" - PostgreSQL connection status
- `cache` (string): "ok" or "error" - Redis connection status
- `errors` (object, optional): Detailed error messages for debugging (only present when errors occur)

**HTTP Status Codes**:
- `200 OK`: All dependencies are healthy, application is ready to serve traffic
- `503 Service Unavailable`: One or more dependencies are unhealthy or check timed out

**Use Cases**:
- Verify backend is fully initialized before sending traffic
- Readiness probe for container orchestration (Kubernetes, Docker Swarm)
- Pre-deployment smoke tests
- Dependency health monitoring dashboards
- Startup verification in orchestration scripts

**Example Usage**:
```bash
# Check if backend is ready
curl http://localhost:3000/health/ready

# Check with pretty-printed JSON
curl -s http://localhost:3000/health/ready | jq

# Use in startup scripts
until curl -f http://localhost:3000/health/ready > /dev/null 2>&1; do
  echo "Waiting for backend to be ready..."
  sleep 2
done
echo "Backend is ready!"

# Check specific dependency status
curl -s http://localhost:3000/health/ready | jq '.database'

# Monitor continuously
watch -n 5 'curl -s http://localhost:3000/health/ready | jq'
```

---

## Integration with Docker

The `/health/ready` endpoint is designed to work seamlessly with Docker health checks.

**Example docker-compose.yml configuration**:
```yaml
services:
  backend:
    image: zero-to-running-backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/ready"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 30s
```

**Health Check Behavior**:
- `interval`: How often to check (every 10 seconds)
- `timeout`: Maximum time to wait for response (3 seconds)
- `retries`: Number of consecutive failures before marking unhealthy (3 times)
- `start_period`: Grace period during container startup (30 seconds)

---

## Integration with Monitoring Tools

### Prometheus/Grafana

You can create monitors based on HTTP status codes:

```yaml
# Alertmanager rule
- alert: BackendNotReady
  expr: probe_success{job="backend-health"} == 0
  for: 2m
  annotations:
    summary: "Backend is not ready"
    description: "Backend /health/ready endpoint returning non-200 status"
```

### Uptime Monitoring (Pingdom, UptimeRobot, etc.)

Configure your uptime monitor to:
- Check URL: `https://your-domain.com/health/ready`
- Expected status: `200`
- Check interval: 1-5 minutes
- Alert on: Status code != 200

---

## Troubleshooting

### Issue: `/health` returns 200 but `/health/ready` returns 503

**Cause**: The application is running, but one or more dependencies are not accessible.

**Diagnosis Steps**:
1. Check the response body for the `errors` object to see which dependency failed
2. Review the backend logs for detailed error messages
3. Verify database and Redis services are running:
   ```bash
   docker-compose ps postgres redis
   ```
4. Test connectivity manually:
   ```bash
   # Test database
   docker-compose exec postgres psql -U postgres -c "SELECT NOW();"

   # Test Redis
   docker-compose exec redis redis-cli PING
   ```

**Common Causes**:
- Database container not started or crashed
- Redis container not started or crashed
- Network configuration issues in Docker
- Database credentials incorrect
- Redis authentication required but not configured

---

### Issue: `/health/ready` returns timeout error

**Cause**: Dependency checks are taking longer than 1 second.

**Diagnosis Steps**:
1. Check if database or Redis is under heavy load
2. Review database connection pool settings (`DATABASE_POOL_MAX`, `DATABASE_POOL_MIN`)
3. Check for network latency between containers
4. Review backend logs for slow query warnings

**Solutions**:
- Increase database connection pool size if pool is exhausted
- Check for slow queries in PostgreSQL logs
- Verify Redis is not running out of memory
- Review Docker network configuration

---

### Issue: Health checks succeed locally but fail in production

**Common Causes**:
1. **Environment Variables**: Verify `DATABASE_HOST`, `REDIS_HOST` point to correct services
2. **Network Policies**: Ensure backend can reach database and Redis on the network
3. **Credentials**: Verify `DATABASE_PASSWORD`, `REDIS_PASSWORD` are correct
4. **Service Discovery**: In orchestrated environments, verify service names resolve correctly

**Debugging**:
```bash
# Check environment variables
docker-compose exec backend env | grep -E "DATABASE|REDIS"

# Test network connectivity from backend container
docker-compose exec backend ping postgres
docker-compose exec backend ping redis

# Check backend logs
docker-compose logs backend | grep -i error
```

---

## Response Format Reference

### Success Response Schema

```typescript
interface HealthResponse {
  status: 'ok';
  timestamp: string; // ISO 8601 format
}

interface ReadyResponse {
  status: 'ready';
  timestamp: string; // ISO 8601 format
  database: 'ok';
  cache: 'ok';
}
```

### Error Response Schema

```typescript
interface ReadyErrorResponse {
  status: 'unavailable';
  timestamp: string; // ISO 8601 format
  database?: 'ok' | 'error';
  cache?: 'ok' | 'error';
  errors: {
    database?: string;
    cache?: string;
    timeout?: string;
  };
}
```

---

## Performance Characteristics

| Endpoint | Typical Response Time | Maximum Response Time | Dependencies Checked |
|----------|----------------------|----------------------|---------------------|
| `/health` | < 10ms | < 50ms | None |
| `/health/ready` | 50-200ms | 1000ms (enforced) | Database, Redis |

**Note**: The `/health/ready` endpoint enforces a strict 1-second timeout to prevent health checks from hanging indefinitely. This ensures orchestration systems receive timely responses even when dependencies are unresponsive.

---

## Best Practices

1. **Use `/health` for liveness probes**: Fast response time ensures quick failure detection
2. **Use `/health/ready` for readiness probes**: Ensures traffic is only sent when fully operational
3. **Monitor both endpoints**: Track both basic availability and dependency health
4. **Set appropriate timeouts**: Allow at least 2-3 seconds for readiness checks in orchestration configs
5. **Review error messages**: The `errors` object provides actionable debugging information
6. **Log health check failures**: Backend logs include structured data for troubleshooting
7. **Don't cache results**: Health checks should always reflect current state

---

## Related Documentation

- [Database Configuration](./src/config/database.ts) - PostgreSQL connection pool settings
- [Redis Configuration](./src/config/redis.ts) - Redis client configuration
- [Logging Utilities](./src/utils/logger.ts) - Structured logging for health checks
- [API Routes](./src/routes/health.ts) - Health endpoint implementation

---

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-11-10 | 1.0.0 | Initial documentation for health check endpoints |
