# Health Verification System

## Overview

The Zero-to-Running health verification system ensures all services are fully operational before development work begins. When you run `make dev`, the system automatically starts all services and verifies their health, providing clear feedback about readiness and any issues.

## Table of Contents

- [What "Healthy" Means for Each Service](#what-healthy-means-for-each-service)
- [Health Check Flow](#health-check-flow)
- [How to Use](#how-to-use)
- [Success Output](#success-output)
- [Failure Output](#failure-output)
- [Manual Health Verification](#manual-health-verification)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)
- [Configuration Options](#configuration-options)
- [Performance Expectations](#performance-expectations)

## What "Healthy" Means for Each Service

### Database (PostgreSQL)

A healthy database meets all of these criteria:

1. **Connectivity**: Can accept connections on configured port (default: 5432)
2. **Authentication**: Accepts credentials from environment configuration
3. **Database Exists**: The `zero_to_running_dev` database exists
4. **Schema Initialized**: All required tables exist (users, sessions, api_keys, audit_logs, health_checks)

**Health Check Method**: Executes `/infrastructure/scripts/check-db-health.sh` script which runs SQL queries to verify connectivity and schema.

### Backend API (Express.js)

A healthy backend meets these criteria:

1. **HTTP Server Running**: Responds to HTTP requests on configured port (default: 3001)
2. **Health Endpoint**: `GET /health/ready` returns HTTP 200
3. **Database Connected**: Backend can query the database
4. **Cache Connected**: Backend can communicate with Redis

**Health Check Method**: HTTP GET request to `http://localhost:3001/health/ready` with expected response:

```json
{
  "status": "ready",
  "timestamp": "2025-11-10T...",
  "database": "ok",
  "cache": "ok"
}
```

### Cache (Redis)

A healthy Redis cache meets these criteria:

1. **Server Running**: Redis server is accepting connections on configured port (default: 6379)
2. **Backend Connected**: Backend API can successfully communicate with Redis

**Health Check Method**: Checked via Backend's `/health/ready` endpoint `cache` field. A direct Redis PING could also be used but is not currently implemented.

### Frontend (React + Vite)

A healthy frontend meets these criteria:

1. **HTTP Server Running**: Development server responds on configured port (default: 3000)
2. **Application Loaded**: Returns HTTP 200 for root path `/`

**Health Check Method**: HTTP GET request to `http://localhost:3000/` expecting HTTP 200 response.

## Health Check Flow

```
make dev
  ↓
Pre-flight Checks
  ├─ Docker daemon running?
  ├─ Docker Compose installed?
  ├─ .env file exists?
  └─ Port conflicts?
  ↓
Start Services (docker-compose up -d)
  ↓
Health Verification (parallel polling, 2-minute timeout)
  ├─ Database Health
  │   ├─ Connectivity test
  │   ├─ Database exists check
  │   └─ Schema initialization check
  ├─ Backend Health
  │   ├─ HTTP endpoint responding
  │   ├─ Database connection via backend
  │   └─ Redis connection via backend
  ├─ Cache Health (via backend)
  │   └─ Backend reports cache: "ok"
  └─ Frontend Health
      └─ HTTP endpoint responding
  ↓
All Healthy? ──YES──> Success Message with URLs
       │
       NO
       ↓
  Display Errors + Troubleshooting + Offer Logs
```

## How to Use

### Start Development Environment

```bash
make dev
```

This single command:
1. Starts all services via Docker Compose
2. Waits for services to become healthy (up to 2 minutes)
3. Displays success message with access URLs and connection strings
4. Exits with code 0 if successful, non-zero if any service fails

### Stop Services

```bash
make down
```

Stops all running services while preserving data volumes.

### View Logs

```bash
docker-compose logs [service-name]
# Examples:
docker-compose logs backend
docker-compose logs postgres
docker-compose logs --tail=100 -f backend  # Follow last 100 lines
```

## Success Output

When all services are healthy, you'll see output like this:

```
=====================================
  Zero-to-Running Development
=====================================

✓ Docker daemon is running
✓ Docker Compose installed: docker-compose version 1.29.2
✓ Environment configuration valid
✓ No port conflicts detected

Starting Docker Compose services...

✓ Services started in detached mode

Verifying services are healthy...

  Database:    Healthy ✓
  Backend:     Healthy ✓
  Cache:       Healthy ✓
  Frontend:    Healthy ✓

✓ All services are healthy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS! Environment ready for development.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Service Access:

Frontend:   http://localhost:3000
Backend:    http://localhost:3001

Connection Strings:

Database:   postgresql://postgres:dev_password_123@localhost:5432/zero_to_running_dev
Redis:      redis://localhost:6379

Useful Commands:

  make down    - Stop all services
  make logs    - View service logs (coming soon)
  make status  - Check service health (coming soon)

Press Ctrl+C to stop monitoring (services will continue running)
```

## Failure Output

When a service fails to become healthy, the system provides:

1. **Clear indication** of which service(s) failed
2. **Specific troubleshooting suggestions** for the failed service
3. **Option to view logs** interactively
4. **Non-zero exit code** (fails CI/CD pipelines appropriately)

Example:

```
  Database:    Healthy ✓
  Backend:     Checking... (108s remaining)
  Backend:     Failed ✗

Troubleshooting suggestions for Backend:
  - Check backend logs: docker-compose logs backend
  - Verify backend can connect to database and Redis
  - Check if backend port 3001 is available
  - Ensure .env variables are set correctly
  - Check backend health endpoint manually: curl http://localhost:3001/health/ready

General troubleshooting:
  - Stop and restart: make down && make dev
  - Check Docker resources: docker system df
  - View all logs: docker-compose logs
  - Check container status: docker-compose ps

View logs for backend? (y/N):
```

## Manual Health Verification

You can manually verify each service's health:

### Database

```bash
# Using the health check script
bash infrastructure/scripts/check-db-health.sh 5 5

# Manual connection test
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev -c "SELECT 1;"
```

### Backend

```bash
# Health check
curl http://localhost:3001/health

# Readiness check (includes database and Redis)
curl http://localhost:3001/health/ready

# Detailed output
curl http://localhost:3001/health/ready | jq
```

### Redis

```bash
# Via backend health endpoint
curl http://localhost:3001/health/ready | jq '.cache'

# Direct Redis ping
docker exec -it zero-to-running-redis redis-cli PING
```

### Frontend

```bash
# Check if responding
curl -I http://localhost:3000/

# Full page
curl http://localhost:3000/
```

## Troubleshooting Common Issues

### Database Connection Failures

**Symptoms**: Database health check fails, backend can't connect to database

**Solutions**:
1. Verify `DATABASE_PASSWORD` is set in `.env`
2. Check database logs: `docker-compose logs postgres`
3. Ensure port 5432 is not in use: `netstat -tuln | grep 5432`
4. Check database container is running: `docker ps | grep postgres`
5. Try manual connection: `docker exec -it zero-to-running-postgres psql -U postgres`

### Backend Startup Timeout

**Symptoms**: Backend shows "Checking..." for extended period, then fails

**Solutions**:
1. Check backend logs: `docker-compose logs backend`
2. Look for database connection errors in logs
3. Verify Redis is healthy (backend depends on it)
4. Check for port conflicts on 3001
5. Ensure `REDIS_URL` and `DATABASE_URL` are correct in `.env`
6. Increase timeout: `HEALTH_CHECK_TIMEOUT=240 make dev` (4 minutes)

### Frontend Build Errors

**Symptoms**: Frontend health check fails, shows build errors in logs

**Solutions**:
1. Check frontend logs: `docker-compose logs frontend`
2. Verify `VITE_API_URL` is set correctly in `.env`
3. Check for port conflicts on 3000
4. Ensure frontend can reach backend: `curl http://localhost:3001/health` from frontend container
5. Try rebuilding: `docker-compose build frontend && make dev`

### Redis Connection Issues

**Symptoms**: Cache shows "Failed", backend reports cache: "error"

**Solutions**:
1. Check Redis logs: `docker-compose logs redis`
2. Verify Redis container is running: `docker ps | grep redis`
3. Check port 6379 is available: `netstat -tuln | grep 6379`
4. Test Redis directly: `docker exec -it zero-to-running-redis redis-cli PING`
5. Verify `REDIS_URL` in `.env` matches Redis container configuration

### Port Conflicts

**Symptoms**: Startup warns about ports in use, services fail to start

**Solutions**:
1. Stop existing services using the ports
2. Change port numbers in `.env`:
   ```
   FRONTEND_PORT=3010
   BACKEND_PORT=3011
   DATABASE_PORT=5433
   REDIS_PORT=6380
   ```
3. Find what's using a port: `lsof -i :3000` (macOS/Linux) or `netstat -ano | findstr :3000` (Windows)

### Docker Daemon Not Running

**Symptoms**: "Docker daemon is not running" error

**Solutions**:
1. Start Docker Desktop (macOS/Windows) or Docker daemon (Linux)
2. Verify Docker is running: `docker ps`
3. Check Docker service status: `systemctl status docker` (Linux)

### Timeout After 2 Minutes

**Symptoms**: Services are still starting but health check times out

**Solutions**:
1. Increase timeout environment variable: `HEALTH_CHECK_TIMEOUT=300 make dev` (5 minutes)
2. Check if your machine is resource-constrained (CPU, memory, disk)
3. Check Docker resource limits: `docker system df`
4. Consider increasing Docker Desktop resource allocation (Settings → Resources)

## Configuration Options

Health verification behavior can be customized via environment variables:

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HEALTH_CHECK_TIMEOUT` | 120 | Total timeout in seconds (2 minutes) |
| `HEALTH_CHECK_INTERVAL` | 2 | Seconds between health check polls |
| `SHOW_LOGS_ON_FAILURE` | false | Automatically show logs when service fails (non-interactive) |
| `BACKEND_PORT` | 3001 | Backend API port for health checks |
| `FRONTEND_PORT` | 3000 | Frontend port for health checks |
| `DATABASE_PORT` | 5432 | Database port |
| `REDIS_PORT` | 6379 | Redis port |

### Example Usage

```bash
# Increase timeout to 5 minutes for slow machines
HEALTH_CHECK_TIMEOUT=300 make dev

# Auto-show logs on failure (useful for CI/CD)
SHOW_LOGS_ON_FAILURE=true make dev

# Use custom ports
BACKEND_PORT=8080 FRONTEND_PORT=8000 make dev
```

### Persistent Configuration

Add these to your `.env` file for permanent changes:

```bash
# .env
HEALTH_CHECK_TIMEOUT=180
SHOW_LOGS_ON_FAILURE=false
```

## Performance Expectations

### Typical Startup Times

On a modern development machine:

- **Database**: 2-5 seconds
- **Redis**: 1-2 seconds
- **Backend**: 5-10 seconds (waits for database and Redis)
- **Frontend**: 10-20 seconds (Vite build and server start)

**Total typical startup**: 15-30 seconds

### First-Time Startup

First time running `make dev` (pulling images, building containers):

- **Docker image pulls**: 1-3 minutes
- **Container builds**: 2-5 minutes
- **Total first startup**: 3-8 minutes

### Factors Affecting Performance

- **Machine resources**: CPU, RAM, disk speed
- **Docker resource allocation**: Limits set in Docker Desktop
- **Network speed**: For downloading images
- **Background processes**: Other applications using resources
- **First run vs. subsequent runs**: Image pulls only happen once

### Optimization Tips

1. **Allocate sufficient Docker resources**: At least 4GB RAM, 2 CPUs
2. **Use SSD for Docker storage**: Much faster than HDD
3. **Close unnecessary applications**: Free up system resources
4. **Pre-pull images**: Run `docker-compose pull` before `make dev`
5. **Keep images updated**: Run `docker-compose build` periodically

## Advanced Usage

### CI/CD Integration

For continuous integration environments:

```bash
# Non-interactive mode with auto-show logs
SHOW_LOGS_ON_FAILURE=true HEALTH_CHECK_TIMEOUT=180 make dev
```

The startup script exits with non-zero status code on failure, which will fail CI/CD pipelines appropriately.

### Custom Health Checks

To add custom health checks for your application:

1. Add checks to `/infrastructure/scripts/startup.sh`
2. Follow the pattern of existing `check_*_health()` functions
3. Add service to health verification in `wait_for_all_services()`

### Debugging Health Checks

Enable verbose logging:

```bash
# Run startup script directly with bash -x for debugging
bash -x infrastructure/scripts/startup.sh
```

## Support

For issues not covered here:

1. Check README.md for quick start instructions
2. Review Docker Compose logs: `docker-compose logs`
3. Verify environment configuration: `cat .env`
4. Check Docker system health: `docker system info`
5. Consult project documentation in `/docs`

## Related Documentation

- [README.md](../README.md) - Quick start guide
- [Docker Compose Configuration](../docker-compose.yml) - Service definitions
- [Environment Configuration](./.env.example) - Required environment variables
- [Database Health Check Script](../infrastructure/scripts/check-db-health.sh) - Database verification
