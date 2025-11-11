# Troubleshooting Guide

Comprehensive troubleshooting guide for resolving common issues in the Zero-to-Running development environment.

> **New!** For a complete catalog of error codes with detailed explanations, see [ERROR_CODES.md](ERROR_CODES.md). All errors in the application now follow enhanced error message standards with "what", "why", and "next steps" format. For developer guidance on creating error messages, see [ERROR_MESSAGE_STANDARDS.md](ERROR_MESSAGE_STANDARDS.md).

## Table of Contents

- [Quick Reference](#quick-reference)
- [Common Issues](#common-issues)
  - [Port Conflicts](#port-conflicts)
  - [Docker Issues](#docker-issues)
  - [Service Startup Failures](#service-startup-failures)
  - [Database Connection Errors](#database-connection-errors)
- [Debugging Commands](#debugging-commands)
  - [View Logs](#view-logs)
  - [Restart Services](#restart-services)
  - [Check Service Status](#check-service-status)
- [Service-Specific Debugging](#service-specific-debugging)
  - [Frontend Debugging](#frontend-debugging)
  - [Backend Debugging](#backend-debugging)
  - [Database Debugging](#database-debugging)
  - [Redis Debugging](#redis-debugging)
- [FAQ](#faq)
  - [Customization](#customization)
  - [Performance](#performance)
  - [Usage](#usage)
- [Escalation Path](#escalation-path)

---

## Quick Reference

### Most Common Issues

| Problem | Quick Solution | Details |
|---------|---------------|---------|
| Port already in use | `lsof -i :<port>` then kill process | [Port Conflicts](#port-conflicts) |
| Docker daemon not running | Start Docker Desktop | [Docker Issues](#docker-issues) |
| Service won't start | Check logs: `make logs service=<name>` | [Service Startup Failures](#service-startup-failures) |
| Database connection timeout | Verify health: `make status` | [Database Connection Errors](#database-connection-errors) |
| Frontend can't reach backend | Check `VITE_API_URL` in `.env` | [Frontend Debugging](#frontend-debugging) |

### Emergency Commands

```bash
# Stop everything and start fresh
make down && make dev

# View all logs
make logs follow=true

# Check service health
make status

# Reset database (destructive!)
make reset-db seed=true
```

---

## Common Issues

### Port Conflicts

Port conflicts occur when another application is already using one of the required ports.

#### Port 3000 (Frontend) Conflict

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
Container zero-to-running-frontend exited with code 1
```

**Cause:**
Another application (often another React app, Create React App, or Vite server) is using port 3000.

**Resolution:**

1. **Find the process using port 3000:**
   ```bash
   # On macOS/Linux
   lsof -i :3000

   # On Windows (PowerShell)
   netstat -ano | findstr :3000
   ```

2. **Kill the conflicting process:**
   ```bash
   # On macOS/Linux (replace PID with actual process ID)
   kill -9 <PID>

   # On Windows (PowerShell, replace PID)
   Stop-Process -Id <PID> -Force
   ```

3. **Alternative: Change the port in `.env`:**
   ```bash
   # Edit .env file
   FRONTEND_PORT=4000

   # Restart services
   make down && make dev
   ```

#### Port 3001 (Backend) Conflict

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3001
Backend service failed to start
```

**Cause:**
Another Node.js application or API server is using port 3001.

**Resolution:**

1. **Find and kill the process:**
   ```bash
   lsof -i :3001
   kill -9 <PID>
   ```

2. **Or change the backend port:**
   ```bash
   # Edit .env file
   BACKEND_PORT=4001

   # Also update frontend API URL
   VITE_API_URL=http://localhost:4001

   # Restart
   make down && make dev
   ```

#### Port 5432 (PostgreSQL) Conflict

**Symptoms:**
```
Error: Bind for 0.0.0.0:5432 failed: port is already allocated
PostgreSQL container fails to start
```

**Cause:**
Local PostgreSQL installation or another containerized database is using port 5432.

**Resolution:**

1. **Find the conflicting process:**
   ```bash
   lsof -i :5432
   ```

2. **Stop local PostgreSQL (if installed):**
   ```bash
   # On macOS with Homebrew
   brew services stop postgresql

   # On Linux with systemd
   sudo systemctl stop postgresql

   # On Windows
   # Stop PostgreSQL service from Services panel
   ```

3. **Or change the database port:**
   ```bash
   # Edit .env file
   DATABASE_PORT=5433

   # Restart services
   make down && make dev
   ```

#### Port 6379 (Redis) Conflict

**Symptoms:**
```
Error: Bind for 0.0.0.0:6379 failed: port is already allocated
Redis container fails to start
```

**Cause:**
Local Redis installation or another Redis container is using port 6379.

**Resolution:**

1. **Find and stop the conflicting process:**
   ```bash
   lsof -i :6379

   # Stop local Redis
   redis-cli shutdown
   # Or on macOS
   brew services stop redis
   ```

2. **Or change the Redis port:**
   ```bash
   # Edit .env file
   REDIS_PORT=6380

   # Restart services
   make down && make dev
   ```

---

### Docker Issues

#### Docker Daemon Not Running

**Symptoms:**
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
Is the Docker daemon running?
```

**Cause:**
Docker Desktop is not running or Docker service is stopped.

**Resolution:**

1. **Start Docker Desktop:**
   - **macOS**: Open Docker Desktop from Applications
   - **Windows**: Start Docker Desktop from Start Menu
   - **Linux**: Start Docker service:
     ```bash
     sudo systemctl start docker
     ```

2. **Verify Docker is running:**
   ```bash
   docker ps
   # Should show container list (may be empty)
   ```

3. **If Docker won't start:**
   - Restart your computer
   - Reinstall Docker Desktop
   - Check system resources (RAM, disk space)

#### Docker Networking Issues

**Symptoms:**
```
Backend cannot connect to postgres: getaddrinfo ENOTFOUND postgres
Services cannot communicate with each other
```

**Cause:**
Docker network not created or services not on the same network.

**Resolution:**

1. **Verify the network exists:**
   ```bash
   docker network ls | grep zero-to-running-network
   ```

2. **Inspect network configuration:**
   ```bash
   docker network inspect zero-to-running-network
   ```

3. **Recreate the network:**
   ```bash
   make down
   docker network rm zero-to-running-network
   make dev
   ```

4. **Check service connectivity:**
   ```bash
   # Test backend can reach database
   docker compose exec backend ping -c 2 postgres

   # Test backend can reach Redis
   docker compose exec backend ping -c 2 redis
   ```

#### Docker Volume Permission Errors

**Symptoms:**
```
PostgreSQL: /var/lib/postgresql/data/pgdata: Permission denied
Database fails to initialize with permission errors
```

**Cause:**
Volume mount permissions are incorrect, preventing PostgreSQL from writing data.

**Resolution:**

1. **Remove the volume and recreate:**
   ```bash
   make down
   docker volume rm zero-to-running-postgres-data
   make dev
   ```

2. **If problem persists, check Docker Desktop settings:**
   - **macOS**: Ensure file sharing is enabled for the project directory
   - **Windows WSL2**: Ensure project is in WSL2 filesystem, not Windows filesystem
   - **Linux**: Check user permissions with Docker daemon

#### Docker Image Pull Failures

**Symptoms:**
```
Error response from daemon: Get https://registry-1.docker.io/v2/: net/http: TLS handshake timeout
Failed to pull image: postgres:16-alpine
```

**Cause:**
Network connectivity issues, proxy configuration, or Docker Hub rate limiting.

**Resolution:**

1. **Check internet connectivity:**
   ```bash
   ping registry-1.docker.io
   ```

2. **Retry with explicit pull:**
   ```bash
   docker pull postgres:16-alpine
   docker pull redis:7-alpine
   docker pull node:20-alpine
   ```

3. **If behind a proxy, configure Docker proxy settings:**
   ```bash
   # Edit ~/.docker/config.json
   {
     "proxies": {
       "default": {
         "httpProxy": "http://proxy.example.com:8080",
         "httpsProxy": "http://proxy.example.com:8080"
       }
     }
   }
   ```

4. **Check Docker Hub rate limits:**
   - Rate limit: 100 pulls per 6 hours for anonymous users
   - Consider authenticating: `docker login`

#### Container Memory/Resource Constraints

**Symptoms:**
```
Container killed due to out of memory
Services are slow or unresponsive
Docker reports insufficient resources
```

**Cause:**
Insufficient memory allocated to Docker or system resource constraints.

**Resolution:**

1. **Check current resource usage:**
   ```bash
   docker stats
   ```

2. **Increase Docker Desktop memory allocation:**
   - Open Docker Desktop > Settings > Resources
   - Increase Memory to at least 4GB (8GB recommended)
   - Increase CPU cores to 2+ (4+ recommended)
   - Click "Apply & Restart"

3. **Clean up unused resources:**
   ```bash
   # Remove stopped containers
   docker container prune -f

   # Remove unused images
   docker image prune -a -f

   # Remove unused volumes
   docker volume prune -f

   # Remove everything (nuclear option)
   docker system prune -a --volumes -f
   ```

4. **Monitor resource usage:**
   ```bash
   # Real-time stats
   docker stats

   # Or use make command
   make status
   ```

---

### Service Startup Failures

#### Backend Service Fails to Start

**Symptoms:**
```
Backend container exits immediately after starting
Health check fails: connection refused
```

**Cause:**
Database not ready, missing dependencies, or configuration errors.

**Resolution:**

1. **Check backend logs:**
   ```bash
   make logs service=backend
   ```

2. **Common issues and fixes:**

   **Database connection error:**
   ```
   Error: connect ECONNREFUSED postgres:5432
   ```
   - Wait for database to be healthy: `make status`
   - Verify database credentials in `.env`
   - Check database service is running: `docker ps | grep postgres`

   **Missing dependencies:**
   ```
   Error: Cannot find module 'express'
   ```
   - Rebuild backend image: `docker compose build backend`
   - Verify `package.json` has all dependencies

   **Port already in use inside container:**
   ```
   Error: listen EADDRINUSE: address already in use :::3001
   ```
   - Backend port conflicts with another service
   - Change `BACKEND_PORT` in `.env`

3. **Verify database health:**
   ```bash
   docker compose exec postgres pg_isready -U postgres
   # Should output: postgres:5432 - accepting connections
   ```

4. **Manual restart with logs:**
   ```bash
   docker compose restart backend
   docker compose logs -f backend
   ```

#### Frontend Service Fails to Start

**Symptoms:**
```
Frontend container exits or becomes unhealthy
Cannot access http://localhost:3000
```

**Cause:**
Backend not available, dependency issues, or build errors.

**Resolution:**

1. **Check frontend logs:**
   ```bash
   make logs service=frontend
   ```

2. **Common issues:**

   **Cannot connect to backend:**
   ```
   Failed to fetch http://localhost:3001
   ```
   - Verify backend is running: `make status`
   - Check `VITE_API_URL` in `.env`
   - Ensure backend port matches: `VITE_API_URL=http://localhost:3001`

   **Vite build errors:**
   ```
   Error: Could not resolve entry module
   ```
   - Rebuild frontend image: `docker compose build frontend`
   - Check for TypeScript compilation errors

   **Node module errors:**
   ```
   Error: Cannot find module '@vitejs/plugin-react'
   ```
   - Rebuild with fresh modules: `docker compose build --no-cache frontend`

3. **Access frontend directly in container:**
   ```bash
   docker compose exec frontend sh
   cd /app
   npm run dev
   ```

#### Database Service Fails to Initialize

**Symptoms:**
```
PostgreSQL container exits with error
relation "users" does not exist
Database initialization script failed
```

**Cause:**
Schema initialization errors, permission issues, or corrupted data volume.

**Resolution:**

1. **Check PostgreSQL logs:**
   ```bash
   make logs service=postgres
   ```

2. **Common issues:**

   **Initialization script failed:**
   ```
   ERROR: syntax error at or near "CREATE"
   ```
   - Check `/infrastructure/database/init.sql` for syntax errors
   - Verify file has Unix line endings (LF, not CRLF)

   **Data directory corruption:**
   ```
   FATAL: data directory has wrong ownership
   ```
   - Remove volume and reinitialize:
     ```bash
     make down
     docker volume rm zero-to-running-postgres-data
     make dev
     ```

   **Password authentication failed:**
   ```
   FATAL: password authentication failed for user "postgres"
   ```
   - Verify `DATABASE_PASSWORD` in `.env`
   - Reset database with correct password:
     ```bash
     make reset-db
     ```

3. **Manually initialize database:**
   ```bash
   # Connect to database
   docker compose exec postgres psql -U postgres -d zero_to_running_dev

   # Run initialization script
   \i /docker-entrypoint-initdb.d/init.sql
   ```

#### Redis Service Fails to Start

**Symptoms:**
```
Redis container exits or becomes unhealthy
Backend cannot connect to Redis
```

**Cause:**
Persistence errors, memory issues, or configuration problems.

**Resolution:**

1. **Check Redis logs:**
   ```bash
   make logs service=redis
   ```

2. **Common issues:**

   **AOF (Append Only File) corruption:**
   ```
   Bad file format reading the append only file
   ```
   - Remove Redis volume and restart:
     ```bash
     make down
     docker volume rm zero-to-running-redis-data
     make dev
     ```

   **Memory allocation issues:**
   ```
   WARNING: overcommit_memory is set to 0
   ```
   - This is a warning, not an error (safe to ignore in development)
   - To fix on Linux: `echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf`

3. **Test Redis connectivity:**
   ```bash
   docker compose exec redis redis-cli ping
   # Should output: PONG
   ```

---

### Database Connection Errors

#### PostgreSQL Connection Timeout

**Symptoms:**
```
Error: connect ETIMEDOUT
Backend cannot connect to database
Health check fails: connection timeout
```

**Cause:**
Database not ready, network issues, or firewall blocking connection.

**Resolution:**

1. **Verify PostgreSQL is running and healthy:**
   ```bash
   make status
   docker ps | grep postgres
   ```

2. **Test database connectivity:**
   ```bash
   # From host machine
   psql postgresql://postgres:CHANGE_ME_postgres_123@localhost:5432/zero_to_running_dev -c "SELECT 1"

   # From backend container
   docker compose exec backend sh -c "nc -zv postgres 5432"
   ```

3. **Check database accepts connections:**
   ```bash
   docker compose exec postgres pg_isready -U postgres
   ```

4. **Review PostgreSQL logs:**
   ```bash
   make logs service=postgres | grep -i error
   ```

5. **Increase health check timeout (if slow machine):**
   - Edit `docker-compose.yml`:
     ```yaml
     healthcheck:
       start_period: 30s  # Increase from 10s
     ```

#### Database Authentication Failures

**Symptoms:**
```
FATAL: password authentication failed for user "postgres"
Error: authentication failed
```

**Cause:**
Incorrect database credentials or password mismatch between `.env` and database.

**Resolution:**

1. **Verify credentials in `.env`:**
   ```bash
   # Check environment variables
   grep DATABASE .env
   ```

2. **Ensure passwords match:**
   - `DATABASE_PASSWORD` in `.env`
   - `POSTGRES_PASSWORD` in `docker-compose.yml`
   - Backend `DATABASE_PASSWORD` environment variable

3. **Reset database with correct password:**
   ```bash
   make down
   docker volume rm zero-to-running-postgres-data
   # Update .env with correct password
   make dev
   ```

4. **Test connection with credentials:**
   ```bash
   docker compose exec postgres psql -U postgres -d zero_to_running_dev
   # Enter password when prompted
   ```

#### Database Schema Mismatch

**Symptoms:**
```
ERROR: relation "users" does not exist
Table or column not found errors
```

**Cause:**
Database schema not initialized or migrations not applied.

**Resolution:**

1. **Check if tables exist:**
   ```bash
   docker compose exec postgres psql -U postgres -d zero_to_running_dev -c "\dt"
   ```

2. **If tables missing, reinitialize database:**
   ```bash
   make reset-db seed=true
   ```

3. **Manually run initialization script:**
   ```bash
   docker compose exec postgres psql -U postgres -d zero_to_running_dev -f /docker-entrypoint-initdb.d/init.sql
   ```

4. **Verify schema is correct:**
   ```bash
   docker compose exec postgres psql -U postgres -d zero_to_running_dev -c "\d users"
   ```

#### Connection Pool Exhaustion

**Symptoms:**
```
Error: sorry, too many clients already
Backend slows down or becomes unresponsive
Connection pool timeout errors
```

**Cause:**
Too many concurrent connections or connections not being released.

**Resolution:**

1. **Check current connections:**
   ```bash
   docker compose exec postgres psql -U postgres -d zero_to_running_dev -c "SELECT count(*) FROM pg_stat_activity;"
   ```

2. **View active connections:**
   ```bash
   docker compose exec postgres psql -U postgres -d zero_to_running_dev -c "SELECT pid, usename, application_name, client_addr, state FROM pg_stat_activity WHERE datname = 'zero_to_running_dev';"
   ```

3. **Kill idle connections:**
   ```bash
   docker compose exec postgres psql -U postgres -d zero_to_running_dev -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < current_timestamp - INTERVAL '5' MINUTE;"
   ```

4. **Restart backend to reset connection pool:**
   ```bash
   docker compose restart backend
   ```

5. **Increase max connections (if needed):**
   - Edit `infrastructure/database/init.sql` or create custom PostgreSQL config
   - Default is 100 connections (sufficient for development)

---

## Debugging Commands

### View Logs

#### View All Service Logs

```bash
# View logs from all services
make logs

# Follow logs in real-time
make logs follow=true

# Show last 200 lines
make logs lines=200
```

#### View Logs for Specific Service

```bash
# Frontend logs
make logs service=frontend

# Backend logs
make logs service=backend

# Database logs
make logs service=postgres

# Redis logs
make logs service=redis
```

#### Filter Logs by Pattern

```bash
# Show only errors from backend
docker compose logs backend | grep -i error

# Show database connection logs
docker compose logs backend | grep -i "database connected"

# Show request logs
docker compose logs backend | grep -i "incoming request"
```

#### View Logs with Timestamps

```bash
# Docker compose logs with timestamps
docker compose logs -t -f backend

# Last 50 lines with timestamps
docker compose logs -t --tail=50 frontend
```

### Restart Services

#### Restart Individual Services

```bash
# Restart backend only
docker compose restart backend

# Restart frontend only
docker compose restart frontend

# Restart database (be careful - may cause connection interruptions)
docker compose restart postgres
```

#### Graceful Restart vs Hard Restart

**Graceful restart** (recommended):
```bash
# Stop services gracefully
make down

# Start services
make dev
```

**Hard restart** (faster but may leave stale connections):
```bash
# Restart all services
docker compose restart
```

#### Restart with Rebuild

If you've changed code or dependencies:

```bash
# Rebuild and restart specific service
docker compose up -d --build backend

# Rebuild and restart all services
make down
docker compose build --no-cache
make dev
```

#### Health Check Verification After Restart

```bash
# Check service health status
make status

# Or manually check health endpoint
curl http://localhost:3001/health/ready

# Wait for all services to be healthy
docker compose ps
```

### Check Service Status

#### View Service Health

```bash
# Quick health check of all services
make status

# Example output:
# Service      Status       Uptime       CPU      Memory     Ports
# --------     ------       ------       ---      ------     -----
# frontend     Healthy      5m 32s       0.5%     125MB      3000
# backend      Healthy      5m 35s       1.2%     180MB      3001
# postgres     Healthy      5m 40s       0.8%     95MB       5432
# redis        Healthy      5m 41s       0.3%     42MB       6379
```

#### Check Running Containers

```bash
# List all running containers
docker ps

# Filter by project
docker ps --filter "name=zero-to-running"

# Show container IDs only
docker ps -q --filter "name=zero-to-running"
```

#### Check Service Health Endpoints

```bash
# Backend health check
curl http://localhost:3001/health

# Backend ready check (includes dependencies)
curl http://localhost:3001/health/ready

# Backend dashboard with all service status
curl http://localhost:3001/health/dashboard
```

#### Check Network Connectivity

```bash
# View network details
docker network inspect zero-to-running-network

# Test connectivity from backend to database
docker compose exec backend ping -c 2 postgres

# Test connectivity from backend to Redis
docker compose exec backend ping -c 2 redis

# Check DNS resolution
docker compose exec backend nslookup postgres
```

#### Monitor Resource Usage

```bash
# Real-time resource monitoring
docker stats

# Single snapshot of all containers
docker stats --no-stream

# Monitor specific service
docker stats zero-to-running-backend --no-stream
```

---

## Service-Specific Debugging

### Frontend Debugging

#### Browser Console Error Inspection

**Access Browser DevTools:**
1. Open http://localhost:3000
2. Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
3. Go to Console tab

**Common errors:**

**API connection error:**
```
Failed to fetch http://localhost:3001/api/...
TypeError: Failed to fetch
```
- **Cause**: Backend not running or wrong API URL
- **Fix**:
  - Verify backend is running: `make status`
  - Check `.env`: `VITE_API_URL=http://localhost:3001`
  - Verify no trailing slash: `VITE_API_URL=http://localhost:3001` (not `.../`)

**CORS error:**
```
Access to fetch at 'http://localhost:3001' from origin 'http://localhost:3000' has been blocked by CORS policy
```
- **Cause**: Backend CORS not configured for frontend origin
- **Fix**: Backend should allow origin `http://localhost:3000`
- **Verify**: Check backend CORS configuration in `backend/src/index.ts`

#### Network Tab Analysis for API Calls

**Inspect API requests:**
1. Open DevTools > Network tab
2. Filter by "Fetch/XHR"
3. Reload page or trigger API call
4. Click request to see details

**Check for:**
- **Status Code**: Should be 200 for successful requests
- **Response**: Check response body for errors
- **Headers**: Verify Content-Type, CORS headers
- **Timing**: Identify slow requests

**Common issues:**

**404 Not Found:**
```
GET http://localhost:3001/api/users 404 (Not Found)
```
- **Cause**: API endpoint doesn't exist or wrong URL
- **Fix**: Verify backend route exists, check API URL in frontend code

**500 Internal Server Error:**
```
GET http://localhost:3001/api/users 500 (Internal Server Error)
```
- **Cause**: Backend error processing request
- **Fix**: Check backend logs: `make logs service=backend`

#### Hot Reload Troubleshooting

**Symptoms:**
- Changes to frontend code don't appear in browser
- Page doesn't refresh automatically

**Resolution:**

1. **Check Vite dev server is running:**
   ```bash
   docker compose logs frontend | grep "Local:"
   # Should show: Local: http://localhost:3000/
   ```

2. **Verify file watching is working:**
   ```bash
   docker compose logs frontend | grep "hmr update"
   # Should show hot module replacement updates
   ```

3. **Hard refresh browser:**
   - Windows/Linux: `Ctrl+F5` or `Ctrl+Shift+R`
   - macOS: `Cmd+Shift+R`

4. **Clear browser cache:**
   - DevTools > Network tab > Check "Disable cache"

5. **Restart frontend service:**
   ```bash
   docker compose restart frontend
   ```

#### TypeScript Compilation Errors

**Symptoms:**
```
error TS2304: Cannot find name 'useState'
error TS7006: Parameter 'event' implicitly has an 'any' type
```

**Resolution:**

1. **View compilation errors:**
   ```bash
   docker compose logs frontend | grep "error TS"
   ```

2. **Check TypeScript configuration:**
   ```bash
   cat frontend/tsconfig.json
   ```

3. **Rebuild with clean cache:**
   ```bash
   docker compose build --no-cache frontend
   docker compose up -d frontend
   ```

4. **Fix common TypeScript errors:**
   - Missing imports: Add `import { useState } from 'react'`
   - Type annotations: Add explicit types for parameters
   - Module resolution: Check `tsconfig.json` paths

#### Style/CSS Debugging with Tailwind

**Symptoms:**
- Tailwind classes not applying
- Styles not updating after changes

**Resolution:**

1. **Verify Tailwind is configured:**
   ```bash
   cat frontend/tailwind.config.js
   ```

2. **Check Tailwind content paths:**
   ```javascript
   // Should include all component files
   content: ['./src/**/*.{js,jsx,ts,tsx}']
   ```

3. **Inspect compiled CSS:**
   - DevTools > Elements tab
   - Check if Tailwind classes are present in HTML
   - Verify classes are in compiled CSS

4. **Common issues:**
   - **Class name typo**: `bg-bule-500` → `bg-blue-500`
   - **Missing content path**: Add file extensions to `tailwind.config.js`
   - **CSS not rebuilding**: Restart frontend service

5. **Force Tailwind rebuild:**
   ```bash
   docker compose restart frontend
   ```

### Backend Debugging

#### Node.js Error Stack Traces

**View detailed error stack traces:**

```bash
# View backend logs with full stack traces
make logs service=backend follow=true

# Filter for errors only
docker compose logs backend | grep -A 20 "Error:"
```

**Common errors:**

**Unhandled promise rejection:**
```
UnhandledPromiseRejectionWarning: Error: connect ECONNREFUSED postgres:5432
```
- **Cause**: Database connection failed
- **Fix**: Verify database is running and credentials are correct

**Module not found:**
```
Error: Cannot find module './routes/users'
```
- **Cause**: Missing file or incorrect import path
- **Fix**: Check file exists, verify import path is correct

**Type error:**
```
TypeError: Cannot read property 'id' of undefined
```
- **Cause**: Accessing property on undefined/null object
- **Fix**: Add null checks, verify data structure

#### Database Query Debugging

**Enable query logging:**

```bash
# In .env file
LOG_LEVEL=DEBUG

# Restart backend
docker compose restart backend

# View query logs
make logs service=backend | grep "query:"
```

**Manual query testing:**

```bash
# Connect to database
docker compose exec postgres psql -U postgres -d zero_to_running_dev

# Run query
SELECT * FROM users LIMIT 5;

# Explain query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

**Check for slow queries:**

```sql
-- View slow queries (> 1 second)
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;
```

#### Redis Connection Verification

**Test Redis connectivity from backend:**

```bash
# Access backend container
docker compose exec backend sh

# Test Redis connection
nc -zv redis 6379
# Should output: redis (6379) open

# Exit container
exit
```

**Test Redis from host:**

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 ping
# Should output: PONG

# Check Redis info
redis-cli -h localhost -p 6379 info
```

**Check backend Redis connection:**

```bash
# View backend logs for Redis connection
docker compose logs backend | grep -i redis
```

#### Route/Endpoint Testing with curl

**Test backend endpoints:**

```bash
# Health check endpoint
curl http://localhost:3001/health

# Health ready endpoint (with dependencies)
curl http://localhost:3001/health/ready

# Dashboard endpoint
curl http://localhost:3001/health/dashboard

# Test API endpoint with JSON response
curl -s http://localhost:3001/api/users | jq .

# POST request with JSON data
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Test with authentication header
curl http://localhost:3001/api/protected \
  -H "Authorization: Bearer <token>"
```

**Alternative: Use REST client tools:**
- Postman: https://www.postman.com/
- Insomnia: https://insomnia.rest/
- HTTPie: `brew install httpie` then `http localhost:3001/health`

#### Middleware Execution Order and Errors

**Debug middleware execution:**

```bash
# Add debug logging to middleware
LOG_LEVEL=DEBUG make down && make dev

# View request flow in logs
make logs service=backend follow=true
```

**Check middleware order:**

1. View backend startup logs:
   ```bash
   docker compose logs backend | grep "middleware"
   ```

2. Verify middleware registration order in `backend/src/index.ts`

3. Common middleware issues:
   - **CORS middleware**: Must be before routes
   - **Body parser**: Must be before routes that parse JSON
   - **Error handler**: Must be last middleware

### Database Debugging

#### Connect Directly to PostgreSQL with psql

**From host machine:**

```bash
# Connect with connection string
psql postgresql://postgres:CHANGE_ME_postgres_123@localhost:5432/zero_to_running_dev

# Or with individual parameters
psql -h localhost -p 5432 -U postgres -d zero_to_running_dev
# Enter password when prompted
```

**From Docker container:**

```bash
# Execute psql in container
docker compose exec postgres psql -U postgres -d zero_to_running_dev
```

**Common psql commands:**

```sql
-- List all tables
\dt

-- Describe table schema
\d users

-- List all databases
\l

-- List all schemas
\dn

-- Show current database and user
SELECT current_database(), current_user;

-- Exit psql
\q
```

#### View Table Contents and Schema

**View table data:**

```sql
-- View all users
SELECT * FROM users;

-- View first 10 users
SELECT * FROM users LIMIT 10;

-- View specific columns
SELECT id, email, created_at FROM users;

-- Count rows
SELECT COUNT(*) FROM users;

-- View table with formatting
\x
SELECT * FROM users LIMIT 1;
\x
```

**View table schema:**

```sql
-- Describe table structure
\d users

-- View table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users';

-- View table indexes
\di users*

-- View table constraints
\d+ users
```

#### Check Trigger Execution

**List triggers:**

```sql
-- List all triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public';

-- View trigger definition
\d+ users
```

**Test trigger execution:**

```sql
-- Insert test data and check trigger
INSERT INTO users (email, password_hash)
VALUES ('trigger-test@example.com', 'hash')
RETURNING id, created_at, updated_at;

-- Check updated_at trigger
UPDATE users SET email = 'updated@example.com' WHERE email = 'trigger-test@example.com'
RETURNING updated_at;
```

#### Query Performance Analysis

**Analyze query performance:**

```sql
-- Explain query plan
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';

-- Explain with actual execution times
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- Check if indexes are being used
EXPLAIN (FORMAT JSON) SELECT * FROM users WHERE email = 'test@example.com';
```

**Find slow queries:**

```sql
-- Enable query statistics (if not already enabled)
-- Requires pg_stat_statements extension
SELECT * FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Check missing indexes:**

```sql
-- Find sequential scans (potential missing indexes)
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_scan DESC;
```

#### Database Lock and Transaction Inspection

**View active locks:**

```sql
-- Check for locks
SELECT
  pid,
  usename,
  pg_blocking_pids(pid) as blocked_by,
  query as blocked_query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;

-- View all locks
SELECT * FROM pg_locks;
```

**View active transactions:**

```sql
-- Show long-running transactions
SELECT
  pid,
  now() - xact_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Kill long-running query
SELECT pg_terminate_backend(<pid>);
```

**Check for deadlocks:**

```sql
-- View recent deadlocks in PostgreSQL logs
-- From container
docker compose logs postgres | grep -i deadlock
```

### Redis Debugging

#### Connect with redis-cli

**From host machine:**

```bash
# Connect to Redis
redis-cli -h localhost -p 6379

# Test connection
redis-cli -h localhost -p 6379 ping
# Should output: PONG
```

**From Docker container:**

```bash
# Execute redis-cli in container
docker compose exec redis redis-cli

# Or one-off command
docker compose exec redis redis-cli PING
```

**Common redis-cli commands:**

```bash
# Ping test
PING

# Check database size
DBSIZE

# Get info about Redis server
INFO

# Get memory stats
INFO memory

# Monitor all commands in real-time
MONITOR

# Exit redis-cli
exit
```

#### View Cached Data and TTL

**View keys and data:**

```bash
# List all keys (be careful in production!)
KEYS *

# List keys with pattern
KEYS session:*

# Get value of a key
GET mykey

# Get type of a key
TYPE mykey

# View hash fields
HGETALL user:123

# View list items
LRANGE mylist 0 -1

# View set members
SMEMBERS myset
```

**Check TTL (Time To Live):**

```bash
# Get TTL in seconds
TTL mykey
# Returns:
#   -2 = key doesn't exist
#   -1 = key exists but has no TTL
#   >0 = TTL in seconds

# Get TTL in milliseconds
PTTL mykey

# Set TTL for key
EXPIRE mykey 3600  # 1 hour

# Remove TTL
PERSIST mykey
```

#### Monitor Memory Usage

**Check memory stats:**

```bash
# Get memory info
docker compose exec redis redis-cli INFO memory

# Key output metrics:
# used_memory_human: Total memory used
# used_memory_peak_human: Peak memory usage
# used_memory_rss_human: Resident Set Size (actual RAM)
```

**Find largest keys:**

```bash
# Sample largest keys (run from host)
docker compose exec redis redis-cli --bigkeys

# Example output:
# Biggest string: session:abc123 (1024 bytes)
# Biggest list: queue:tasks (500 items)
```

**Check key sizes:**

```bash
# Get memory usage of specific key
MEMORY USAGE mykey

# Estimate all keys memory usage
DBSIZE  # Number of keys
INFO memory  # Total memory
```

#### Flush Cache for Testing

**Clear cache data:**

```bash
# Flush current database (database 0)
docker compose exec redis redis-cli FLUSHDB

# Flush all databases (nuclear option)
docker compose exec redis redis-cli FLUSHALL

# Flush asynchronously (doesn't block)
docker compose exec redis redis-cli FLUSHDB ASYNC
```

**Verify cache is empty:**

```bash
# Check database size
docker compose exec redis redis-cli DBSIZE
# Should output: (integer) 0
```

**Repopulate cache:**

After flushing, restart backend to repopulate cache:

```bash
docker compose restart backend
```

#### Check AOF Persistence Status

**View AOF (Append Only File) status:**

```bash
# Get persistence info
docker compose exec redis redis-cli INFO persistence

# Key output metrics:
# aof_enabled: 1 (enabled) or 0 (disabled)
# aof_last_bgrewrite_status: ok or failed
# aof_last_write_status: ok or failed
```

**View AOF file:**

```bash
# Access Redis container
docker compose exec redis sh

# View AOF file
cat /data/appendonly.aof

# Exit container
exit
```

**Rebuild AOF file:**

```bash
# Trigger AOF rewrite
docker compose exec redis redis-cli BGREWRITEAOF

# Check rewrite status
docker compose exec redis redis-cli INFO persistence | grep aof_rewrite_in_progress
```

**AOF errors and recovery:**

If AOF is corrupted:

```bash
# Check AOF file integrity
docker compose exec redis redis-cli-check-aof /data/appendonly.aof

# Fix AOF corruption (removes corrupted data)
docker compose exec redis redis-cli-check-aof --fix /data/appendonly.aof

# Restart Redis
docker compose restart redis
```

---

## FAQ

### Customization

#### How do I change environment variables?

**Answer:**

1. **Edit the `.env` file:**
   ```bash
   # Open .env in your editor
   nano .env
   # or
   vim .env
   # or
   code .env
   ```

2. **Change the desired variables:**
   ```bash
   # Example: Change frontend port
   FRONTEND_PORT=4000

   # Example: Enable debug logging
   LOG_LEVEL=DEBUG
   ```

3. **Validate configuration:**
   ```bash
   make config
   ```

4. **Restart services to apply changes:**
   ```bash
   make down && make dev
   ```

**Note**: Some variables require rebuilding containers (e.g., NODE_ENV). Use `docker compose build --no-cache` if changes don't take effect.

#### How do I modify the database schema?

**Answer:**

1. **Edit the initialization script:**
   ```bash
   # Open init.sql
   nano infrastructure/database/init.sql
   ```

2. **Add your schema changes:**
   ```sql
   -- Example: Add new table
   CREATE TABLE IF NOT EXISTS posts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES users(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     content TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Add trigger for updated_at
   CREATE TRIGGER update_posts_updated_at
   BEFORE UPDATE ON posts
   FOR EACH ROW
   EXECUTE FUNCTION update_updated_at_column();
   ```

3. **Reset database to apply changes:**
   ```bash
   make reset-db seed=true
   ```

**For production migrations:**
- Use a migration tool (e.g., Flyway, Liquibase, or custom Node.js migrations)
- Create versioned migration files in `infrastructure/database/migrations/`
- Never modify existing migrations - always create new ones

#### How do I add a new API endpoint?

**Answer:**

1. **Create route file (if needed):**
   ```bash
   # Create new route file
   touch backend/src/routes/posts.ts
   ```

2. **Define the route:**
   ```typescript
   // backend/src/routes/posts.ts
   import { Router } from 'express';

   const router = Router();

   // GET /api/posts
   router.get('/posts', async (req, res) => {
     // Your logic here
     res.json({ message: 'List posts' });
   });

   // POST /api/posts
   router.post('/posts', async (req, res) => {
     // Your logic here
     res.status(201).json({ message: 'Post created' });
   });

   export default router;
   ```

3. **Register the route in main app:**
   ```typescript
   // backend/src/index.ts
   import postsRouter from './routes/posts';

   app.use('/api', postsRouter);
   ```

4. **Test the endpoint:**
   ```bash
   curl http://localhost:3001/api/posts
   ```

**No rebuild needed** - changes are hot-reloaded in development mode.

#### How do I customize the frontend UI?

**Answer:**

**Option 1: Modify existing components**

```bash
# Edit component file
nano frontend/src/components/Dashboard.tsx
```

**Option 2: Add new components**

```bash
# Create new component
touch frontend/src/components/NewFeature.tsx

# Import and use in App.tsx
import NewFeature from './components/NewFeature';
```

**Option 3: Customize Tailwind theme**

```javascript
// frontend/tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',  // Custom blue
        secondary: '#10B981' // Custom green
      }
    }
  }
}
```

**Changes are hot-reloaded** - no restart needed. Just save the file and see changes in browser.

#### How do I change service ports?

**Answer:**

1. **Edit `.env` file:**
   ```bash
   # Change ports
   FRONTEND_PORT=4000
   BACKEND_PORT=4001
   DATABASE_PORT=5433
   REDIS_PORT=6380
   ```

2. **Update API URL (if changing backend port):**
   ```bash
   # Must match new backend port
   VITE_API_URL=http://localhost:4001
   ```

3. **Validate no port conflicts:**
   ```bash
   make config
   ```

4. **Restart services:**
   ```bash
   make down && make dev
   ```

5. **Access services on new ports:**
   - Frontend: `http://localhost:4000`
   - Backend: `http://localhost:4001`

### Performance

#### Why is the system slow on startup?

**Answer:**

**Common causes and solutions:**

1. **First-time startup (3-8 minutes):**
   - **Cause**: Docker downloading images, building containers
   - **Normal behavior**: Subsequent startups take 15-30 seconds
   - **Solution**: Wait for first startup to complete

2. **Insufficient system resources:**
   - **Symptoms**: Services timeout, containers killed
   - **Check**: `docker stats` - high CPU/memory usage
   - **Solution**: Increase Docker Desktop resources:
     - Settings > Resources > Memory: 4GB minimum, 8GB recommended
     - Settings > Resources > CPUs: 2 minimum, 4 recommended

3. **Database initialization:**
   - **Cause**: Running init.sql and migrations
   - **Duration**: 10-30 seconds on first run
   - **Solution**: Normal behavior, subsequent starts are faster

4. **Volume mounting (Windows/macOS):**
   - **Cause**: Docker Desktop volume mounting overhead
   - **Solution**:
     - macOS: Ensure project is in `/Users` directory
     - Windows: Use WSL2 and keep project in WSL2 filesystem

5. **Background processes:**
   - **Check**: Close unnecessary applications
   - **Solution**: Free up system resources

#### How do I optimize database queries?

**Answer:**

**Step 1: Identify slow queries**

```sql
-- Enable query stats
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Step 2: Analyze query performance**

```sql
-- Use EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

**Step 3: Add indexes**

```sql
-- Add index on frequently queried columns
CREATE INDEX idx_users_email ON users(email);

-- Add composite index
CREATE INDEX idx_users_created_at_status ON users(created_at, status);

-- Verify index is used
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
```

**Step 4: Optimize query structure**

```sql
-- Bad: SELECT *
SELECT * FROM users;  -- Returns all columns

-- Good: Select only needed columns
SELECT id, email, name FROM users;

-- Bad: Multiple round trips
-- Good: Use JOINs
SELECT u.name, p.title
FROM users u
INNER JOIN posts p ON u.id = p.user_id;
```

#### How do I enable caching for better performance?

**Answer:**

Redis is already running in the `full` profile. Enable caching in backend:

**Step 1: Use Redis in backend**

```typescript
// backend/src/services/cache.ts
import redis from '../config/redis';

export async function getCachedData(key: string) {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

export async function setCachedData(key: string, data: any, ttl: number = 3600) {
  await redis.setex(key, ttl, JSON.stringify(data));
}
```

**Step 2: Implement caching in routes**

```typescript
// backend/src/routes/users.ts
import { getCachedData, setCachedData } from '../services/cache';

router.get('/users', async (req, res) => {
  // Try cache first
  const cacheKey = 'users:all';
  const cached = await getCachedData(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  // Fetch from database
  const users = await db.query('SELECT * FROM users');

  // Cache for 1 hour
  await setCachedData(cacheKey, users, 3600);

  res.json(users);
});
```

**Step 3: Verify caching works**

```bash
# Check Redis has keys
docker compose exec redis redis-cli KEYS "*"

# Monitor cache hits
docker compose exec redis redis-cli MONITOR
```

#### What are the recommended resource requirements?

**Answer:**

**Minimum Requirements:**
- **RAM**: 8GB total system memory
  - Docker Desktop: 4GB allocated
  - Host OS: 4GB remaining
- **CPU**: 2 cores
- **Disk**: 10GB free space
- **OS**: macOS 10.15+, Ubuntu 20.04+, Windows 10/11 with WSL2

**Recommended Requirements:**
- **RAM**: 16GB total system memory
  - Docker Desktop: 8GB allocated
  - Host OS: 8GB remaining
- **CPU**: 4+ cores
- **Disk**: 20GB+ free space (includes images, volumes, node_modules)
- **SSD**: Highly recommended for performance

**Resource allocation by profile:**

| Profile | Memory | CPU | Startup Time | Containers |
|---------|--------|-----|--------------|------------|
| minimal | 400-600MB | Low | 30-45s | 2 (backend, postgres) |
| full | 1-1.5GB | Medium | 60-90s | 4 (all services) |

**Docker Desktop settings:**

```bash
# Open Docker Desktop
# Settings > Resources

Memory: 8192 MB (8GB)
CPUs: 4
Swap: 2 GB
Disk image size: 64 GB
```

#### How do I monitor system performance?

**Answer:**

**Option 1: CLI monitoring**

```bash
# Check service health and resources
make status

# Real-time resource monitoring
docker stats

# Watch specific service
watch -n 2 'docker stats --no-stream zero-to-running-backend'
```

**Option 2: Web dashboard**

```bash
# Start services
make dev

# Open dashboard in browser
open http://localhost:3000/#dashboard
```

**Option 3: Backend monitoring endpoint**

```bash
# Get JSON health data
curl http://localhost:3001/health/dashboard | jq .

# Monitor with watch
watch -n 5 'curl -s http://localhost:3001/health/dashboard | jq .'
```

**Option 4: Log monitoring**

```bash
# View all logs
make logs follow=true

# Monitor backend performance logs
docker compose logs -f backend | grep -i "response time"
```

**Option 5: Database monitoring**

```sql
-- Connect to database
docker compose exec postgres psql -U postgres -d zero_to_running_dev

-- View active queries
SELECT pid, usename, state, query
FROM pg_stat_activity
WHERE state != 'idle';

-- View query statistics
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

### Usage

#### How do I access the frontend application?

**Answer:**

1. **Start services:**
   ```bash
   make dev
   ```

2. **Wait for services to be healthy:**
   ```
   ✓ All services in profile are healthy
   Frontend:   http://localhost:3000
   ```

3. **Open in browser:**
   ```bash
   # Automatic
   open http://localhost:3000   # macOS
   xdg-open http://localhost:3000  # Linux
   start http://localhost:3000  # Windows

   # Manual
   # Open browser and navigate to http://localhost:3000
   ```

4. **Verify frontend is working:**
   - You should see the React application
   - Browser console should have no errors
   - Dashboard link should work

**Troubleshooting:**
- If port 3000 is in use, change `FRONTEND_PORT` in `.env`
- If "Cannot connect to backend", verify backend is running: `make status`
- If seeing 404, verify service is healthy: `docker ps`

#### How do I make API calls to the backend?

**Answer:**

**From command line (curl):**

```bash
# Health check
curl http://localhost:3001/health

# GET request
curl http://localhost:3001/api/users

# GET with query parameters
curl "http://localhost:3001/api/users?status=active&limit=10"

# POST request with JSON
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# PUT request
curl -X PUT http://localhost:3001/api/users/123 \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'

# DELETE request
curl -X DELETE http://localhost:3001/api/users/123

# With authentication
curl http://localhost:3001/api/protected \
  -H "Authorization: Bearer your-token-here"
```

**From frontend JavaScript:**

```javascript
// GET request
const response = await fetch('http://localhost:3001/api/users');
const users = await response.json();

// POST request
const response = await fetch('http://localhost:3001/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'test@example.com',
    name: 'Test User'
  })
});
const newUser = await response.json();
```

**From REST client tools:**
- Postman: Import collection with base URL `http://localhost:3001`
- Insomnia: Create workspace with base URL `http://localhost:3001`
- VS Code REST Client: Create `.http` file with requests

#### How do I view service logs?

**Answer:**

**View all logs:**
```bash
make logs
```

**View specific service:**
```bash
make logs service=frontend
make logs service=backend
make logs service=postgres
make logs service=redis
```

**Follow logs in real-time:**
```bash
make logs follow=true
make logs service=backend follow=true
```

**Customize log output:**
```bash
# Show last 200 lines
make logs lines=200

# Show logs with timestamps
docker compose logs -t backend

# Filter logs by pattern
docker compose logs backend | grep -i error
docker compose logs backend | grep -i "user created"
```

**View logs from specific time:**
```bash
# Logs since 10 minutes ago
docker compose logs --since 10m backend

# Logs from specific timestamp
docker compose logs --since "2025-11-11T10:00:00" backend
```

#### How do I stop and restart services?

**Answer:**

**Stop all services:**
```bash
make down
```

**Stop specific service:**
```bash
docker compose stop backend
docker compose stop frontend
```

**Restart all services:**
```bash
# Graceful restart
make down && make dev

# Quick restart (keeps containers)
docker compose restart
```

**Restart specific service:**
```bash
docker compose restart backend
docker compose restart frontend
```

**Stop and remove everything (including volumes):**
```bash
# WARNING: This deletes all data!
docker compose down -v

# Remove specific volume
docker volume rm zero-to-running-postgres-data
docker volume rm zero-to-running-redis-data
```

**Start with different profile:**
```bash
# Stop current profile
make down

# Start minimal profile
make dev profile=minimal

# Switch back to full profile
make down
make dev profile=full
```

#### How do I reset the database?

**Answer:**

**Option 1: Reset with seed data (recommended)**
```bash
make reset-db seed=true
```

This will:
- Drop all tables
- Recreate schema from `init.sql`
- Insert test data (5 users, sessions, API keys)

**Option 2: Reset without seed data**
```bash
make reset-db
```

This will:
- Drop all tables
- Recreate schema from `init.sql`
- Leave database empty

**Option 3: Nuclear option (complete volume removal)**
```bash
# Stop services
make down

# Remove database volume (deletes everything)
docker volume rm zero-to-running-postgres-data

# Restart (will reinitialize from scratch)
make dev
```

**Option 4: Manual reset via psql**
```bash
# Connect to database
docker compose exec postgres psql -U postgres -d zero_to_running_dev

# Drop all tables manually
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS health_check CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

# Re-run init script
\i /docker-entrypoint-initdb.d/init.sql

# Exit
\q
```

**Verify reset:**
```bash
# Check tables exist
docker compose exec postgres psql -U postgres -d zero_to_running_dev -c "\dt"

# Check user count (should be 5 if seeded)
docker compose exec postgres psql -U postgres -d zero_to_running_dev -c "SELECT COUNT(*) FROM users;"
```

---

## Escalation Path

### When to Escalate

If you've tried the troubleshooting steps and the issue persists, it may be time to escalate. Escalate when:

1. **Services won't start after multiple attempts**
   - Tried restarting: `make down && make dev`
   - Checked logs: `make logs`
   - Verified Docker is running
   - No port conflicts detected

2. **Data loss or corruption**
   - Database won't initialize
   - Persistent errors after `make reset-db`
   - Volume mounting issues

3. **Critical security issues**
   - Suspected security vulnerabilities
   - Unauthorized access
   - Data breach concerns

4. **Production deployment issues**
   - Using mock secrets in production (see [Secret Management](./SECRET_MANAGEMENT.md))
   - Performance degradation in production
   - Service outages affecting users

5. **Bugs or unexpected behavior**
   - Services crash repeatedly
   - Data integrity issues
   - Application errors not covered in this guide

### How to Escalate

#### Step 1: Gather Information

Before escalating, collect the following diagnostic information:

**System Information:**
```bash
# Docker version
docker --version
docker compose version

# System info
uname -a  # Linux/macOS
systeminfo  # Windows

# Available resources
docker info
```

**Service Status:**
```bash
# Service health
make status

# Container status
docker ps -a

# Network status
docker network inspect zero-to-running-network
```

**Logs:**
```bash
# Save all logs to file
docker compose logs --no-color > logs-$(date +%Y%m%d-%H%M%S).txt

# Or save specific service logs
docker compose logs backend --no-color > backend-logs.txt
docker compose logs postgres --no-color > postgres-logs.txt
```

**Environment Configuration:**
```bash
# Export environment variables (REDACT SECRETS!)
cat .env | sed 's/PASSWORD=.*/PASSWORD=<REDACTED>/' > env-config.txt
```

**Error Messages:**
- Copy exact error messages from console
- Include stack traces if available
- Note when the error first occurred

#### Step 2: Create a Bug Report

Create a detailed bug report with the following template:

```markdown
## Issue Summary
Brief description of the problem

## Environment
- OS: [e.g., macOS 13.5, Ubuntu 22.04, Windows 11]
- Docker Desktop Version: [e.g., 4.20.0]
- Docker Compose Version: [e.g., v2.20.0]
- Profile: [minimal or full]

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What you expected to happen

## Actual Behavior
What actually happened

## Error Messages
```
Paste exact error messages here
```

## Logs
Attach logs file or paste relevant sections

## Troubleshooting Steps Attempted
- [ ] Restarted services: `make down && make dev`
- [ ] Checked logs: `make logs`
- [ ] Verified Docker is running
- [ ] Checked for port conflicts
- [ ] Reset database: `make reset-db`
- [ ] Removed volumes and restarted
- [ ] Other: (describe)

## Additional Context
Any other relevant information
```

#### Step 3: Submit to Support Channels

**GitHub Issues** (Recommended):
- Repository: [Your GitHub Repository URL]
- Create new issue with bug report template
- Attach logs file
- Tag with appropriate labels: `bug`, `help wanted`, `support`

**Discussion Forums**:
- GitHub Discussions: [Your GitHub Discussions URL]
- Category: Troubleshooting / Support
- Search existing discussions before posting

**Email Support** (if available):
- Email: [support@example.com]
- Subject: `[Zero-to-Running] Issue: <brief description>`
- Include bug report and logs

**Stack Overflow**:
- Tag: `zero-to-running`, `docker`, `docker-compose`
- Include detailed bug report
- Link to this repository

### Expected Response Times

| Channel | Expected Response | Resolution Target |
|---------|------------------|-------------------|
| GitHub Issues | 1-2 business days | 1-2 weeks |
| GitHub Discussions | 1-3 business days | N/A (community) |
| Email Support | 24-48 hours | Case-dependent |
| Stack Overflow | Varies (community) | N/A (community) |

**Note**: These are estimated response times and may vary based on issue complexity and support availability.

### Community Support

**Before escalating, consider:**

1. **Search existing issues:**
   - [GitHub Issues](https://github.com/your-repo/issues?q=is%3Aissue)
   - Stack Overflow questions

2. **Review documentation:**
   - [README.md](../README.md)
   - [Architecture Documentation](./ARCHITECTURE.md)
   - [Configuration Guide](./CONFIGURATION.md)
   - [Network Architecture](./NETWORK_ARCHITECTURE.md)

3. **Ask the community:**
   - GitHub Discussions
   - Stack Overflow
   - Discord/Slack (if available)

### Emergency Contact

For **critical production issues** affecting live users:

- **Priority Email**: [urgent@example.com]
- **On-Call Phone**: [if available]
- **Status Page**: [status.example.com]

**What constitutes a critical issue:**
- Complete service outage
- Data loss or corruption
- Security breach
- Sensitive data exposure

---

## Additional Resources

### Documentation

- [README.md](../README.md) - Project overview and quick start
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design
- [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) - Startup sequence and orchestration
- [CONFIGURATION.md](./CONFIGURATION.md) - Environment variables and configuration
- [SECRET_MANAGEMENT.md](./SECRET_MANAGEMENT.md) - Secret handling and security
- [NETWORK_ARCHITECTURE.md](./NETWORK_ARCHITECTURE.md) - Docker networking details
- [HEALTH_VERIFICATION.md](./HEALTH_VERIFICATION.md) - Health check mechanisms
- [LOGGING.md](./LOGGING.md) - Logging implementation
- [MONITORING.md](./MONITORING.md) - Monitoring and observability
- [DATABASE_SEEDING.md](./DATABASE_SEEDING.md) - Database seeding guide
- [PROFILES.md](./PROFILES.md) - Development profiles

### External Resources

**Docker:**
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Docker Networking](https://docs.docker.com/network/)

**PostgreSQL:**
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [psql Command Reference](https://www.postgresql.org/docs/current/app-psql.html)

**Redis:**
- [Redis Documentation](https://redis.io/documentation)
- [Redis Commands](https://redis.io/commands)

**Node.js & TypeScript:**
- [Node.js Documentation](https://nodejs.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

**React:**
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**Last Updated**: 2025-11-11

**Need help?** If this guide doesn't solve your issue, see the [Escalation Path](#escalation-path) section above.
