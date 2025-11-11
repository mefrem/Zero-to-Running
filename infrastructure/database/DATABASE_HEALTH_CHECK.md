# Database Health Verification Guide

## Overview

This guide explains how Zero-to-Running verifies database health to ensure PostgreSQL is ready for development work. Database health verification goes beyond simple connectivity checks to confirm that:

1. The database server is accepting connections
2. Query execution works correctly
3. The application database exists
4. The database schema is properly initialized
5. All critical tables are present

## Automatic Health Checks

### During Startup (`make dev`)

When you run `make dev`, the startup orchestration script automatically performs comprehensive database health verification:

1. **Docker Health Check**: Docker Compose monitors PostgreSQL using a built-in healthcheck that runs every 10 seconds
   - Tests connectivity with `pg_isready`
   - Executes `SELECT 1` to verify query execution
   - 5-second timeout per check
   - 5 retry attempts before failing
   - 10-second startup grace period

2. **Comprehensive Health Verification**: After Docker reports PostgreSQL as healthy, the startup script runs additional checks:
   - Verifies database connectivity with `SELECT 1`
   - Confirms the application database exists
   - Validates schema initialization (checks for critical tables)
   - Verifies all 5 expected tables are present
   - 5-second timeout for the entire check
   - Up to 5 retry attempts with 1-second delay between retries

**Startup Flow**:
```
1. PostgreSQL container starts
2. Docker healthcheck runs (pg_isready + SELECT 1)
3. Once healthy, comprehensive health check runs
4. Verifies: connectivity → database exists → schema initialized
5. If all checks pass, backend service starts
6. If any check fails, startup halts with error message
```

### Health Check Script

The database health check is implemented in `/infrastructure/scripts/check-db-health.sh`.

**Usage**:
```bash
# Run with defaults (5 second timeout, 5 retries)
./infrastructure/scripts/check-db-health.sh

# Custom timeout and retries
./infrastructure/scripts/check-db-health.sh <timeout_seconds> <max_retries>

# Example: 10 second timeout, 3 retries
./infrastructure/scripts/check-db-health.sh 10 3
```

**Exit Codes**:
- `0` - Health check passed
- `1` - Connectivity failure
- `2` - Database not found
- `3` - Schema not initialized
- `4` - Timeout
- `5` - Missing DATABASE_PASSWORD

## Manual Health Verification

### Using psql (Recommended)

**Basic connectivity test**:
```bash
# From host machine (requires psql client)
psql -h localhost -p 5432 -U postgres -d zero_to_running_dev -c "SELECT 1"

# From inside Docker container
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev -c "SELECT 1"
```

**Comprehensive health check**:
```bash
# Verify database exists and schema is initialized
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev <<EOF
-- Test connectivity
SELECT 1 as connectivity_test;

-- Verify database name
SELECT current_database() as database_name;

-- Check PostgreSQL version
SELECT version();

-- Verify schema initialization
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables
  WHERE table_schema='public' AND table_name='users'
) as schema_initialized;

-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
ORDER BY table_name;

-- Count expected tables
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('users', 'sessions', 'api_keys', 'audit_logs', 'health_checks');
EOF
```

**Expected output**: Should show 5 tables (users, sessions, api_keys, audit_logs, health_checks)

### Using Backend Health Endpoint

The backend service provides a `/health/ready` endpoint that includes database health checks:

```bash
# Check if backend and database are ready
curl http://localhost:3001/health/ready

# Example successful response:
# {
#   "status": "ready",
#   "timestamp": "2025-11-10T...",
#   "checks": {
#     "database": "healthy"
#   }
# }
```

### Using the Health Check Script

```bash
# Navigate to project root
cd /path/to/Zero-to-Running

# Run health check script
bash infrastructure/scripts/check-db-health.sh

# With custom parameters
bash infrastructure/scripts/check-db-health.sh 10 3  # 10s timeout, 3 retries
```

## Connection Configuration

### Environment Variables

Database health checks use these environment variables (defined in `.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_HOST` | `postgres` | Database hostname (use `localhost` from host, `postgres` from Docker) |
| `DATABASE_PORT` | `5432` | PostgreSQL port |
| `DATABASE_NAME` | `zero_to_running_dev` | Application database name |
| `DATABASE_USER` | `postgres` | Database username |
| `DATABASE_PASSWORD` | *(required)* | Database password (no default) |

### Connection Strings

**From host machine**:
```
postgresql://postgres:your_password@localhost:5432/zero_to_running_dev
```

**From Docker container** (backend service):
```
postgresql://postgres:your_password@postgres:5432/zero_to_running_dev
```

**Using psql**:
```bash
# From host
psql "postgresql://postgres:your_password@localhost:5432/zero_to_running_dev"

# From container
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev
```

## Timeout and Retry Configuration

### Docker Compose Healthcheck

Configured in `docker-compose.yml`:
- **Interval**: 10 seconds (checks run every 10s)
- **Timeout**: 5 seconds (each check must complete within 5s)
- **Retries**: 5 attempts
- **Start Period**: 10 seconds (grace period before health checks start)
- **Total time**: Up to 60 seconds (10s start period + 5 retries × 10s interval)

### Startup Script Health Check

Configured in `check-db-health.sh`:
- **Default timeout**: 5 seconds per check
- **Default retries**: 5 attempts
- **Retry delay**: 1 second between attempts
- **Total time**: Up to 25 seconds (5 attempts × 5s timeout, though checks typically complete in < 1s)

### Customizing Timeouts

Edit `infrastructure/scripts/startup.sh` line 239:
```bash
# Change timeout and retry values
if bash "${SCRIPT_DIR}/check-db-health.sh" 5 5; then
#                                          ^  ^
#                                          |  |
#                                     timeout retries
```

## Troubleshooting Guide

### Error: "Failed to connect to database"

**Symptoms**: Health check fails with connectivity error

**Possible causes**:
1. Database service is not running
2. Wrong host, port, or credentials
3. Network connectivity issue
4. Database still starting up

**Solutions**:
```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Verify environment variables
cat .env | grep DATABASE

# Test basic connectivity
docker exec -it zero-to-running-postgres pg_isready -U postgres

# Try manual connection
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev
```

### Error: "Database not found"

**Symptoms**: Can connect but database doesn't exist

**Possible causes**:
1. Wrong database name in `DATABASE_NAME` variable
2. Database initialization failed
3. Connected to wrong database instance

**Solutions**:
```bash
# List all databases
docker exec -it zero-to-running-postgres psql -U postgres -c "\l"

# Check if init.sql was executed
docker-compose logs postgres | grep "Database schema initialized"

# Verify DATABASE_NAME in .env
grep DATABASE_NAME .env

# Recreate database (WARNING: destroys data)
make down
docker volume rm zero-to-running-postgres-data
make dev
```

### Error: "Schema not initialized"

**Symptoms**: Database exists but tables are missing

**Possible causes**:
1. `init.sql` script did not run
2. Database was created without running initialization
3. Tables were dropped

**Solutions**:
```bash
# Check if init.sql ran successfully
docker-compose logs postgres | grep initialized

# Manually verify tables exist
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev -c "\dt"

# Expected tables: users, sessions, api_keys, audit_logs, health_checks

# Re-initialize database (WARNING: destroys data)
docker-compose down
docker volume rm zero-to-running-postgres-data
docker-compose up -d postgres
```

### Error: "Health check timeout"

**Symptoms**: Health check fails after 5 seconds

**Possible causes**:
1. Database is overloaded or slow
2. Network latency
3. Query execution is hanging
4. Database locked or in recovery mode

**Solutions**:
```bash
# Check database performance
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev -c "
  SELECT * FROM pg_stat_activity WHERE datname = 'zero_to_running_dev';
"

# Check for locks
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev -c "
  SELECT * FROM pg_locks;
"

# Restart database
docker-compose restart postgres

# Increase timeout (in check-db-health.sh)
./infrastructure/scripts/check-db-health.sh 10 5  # 10 second timeout
```

### Error: "DATABASE_PASSWORD is not set"

**Symptoms**: Health check fails immediately with missing password error

**Solutions**:
```bash
# Check if .env file exists
ls -la .env

# Copy from example if needed
cp .env.example .env

# Edit .env and set DATABASE_PASSWORD
# DATABASE_PASSWORD=your_secure_password_here

# Verify password is set
grep DATABASE_PASSWORD .env | grep -v "^#"
```

### Warning: "Found X of 5 expected tables"

**Symptoms**: Some tables are missing

**Solutions**:
```bash
# List existing tables
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev -c "\dt"

# Expected: users, sessions, api_keys, audit_logs, health_checks

# Check init.sql logs for errors
docker-compose logs postgres | grep ERROR

# Re-run init.sql manually
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev -f /docker-entrypoint-initdb.d/init.sql
```

## Integration with Docker and Docker Compose

### How It Works

1. **Container Health**: Docker Compose uses the `healthcheck` configuration to monitor PostgreSQL
2. **Service Dependencies**: Backend service waits for postgres to be `healthy` via `depends_on` with `condition: service_healthy`
3. **Startup Orchestration**: The `startup.sh` script waits for Docker health, then runs comprehensive checks
4. **Graceful Degradation**: If health checks fail, startup halts with clear error messages

### Health Check Command in Docker

The Docker healthcheck runs inside the PostgreSQL container:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d zero_to_running_dev && PGPASSWORD=${DATABASE_PASSWORD} psql -U postgres -d zero_to_running_dev -c 'SELECT 1' -q -t || exit 1"]
```

**What it does**:
1. `pg_isready` checks if PostgreSQL is accepting connections
2. `psql -c 'SELECT 1'` verifies query execution works
3. Returns exit code 0 if both succeed, 1 if either fails

### Viewing Health Status

```bash
# Check health status of all containers
docker ps

# Inspect specific health check details
docker inspect zero-to-running-postgres --format='{{json .State.Health}}' | jq

# View health check logs
docker inspect zero-to-running-postgres --format='{{range .State.Health.Log}}{{.Output}}{{end}}'
```

## Performance Considerations

### Health Check Overhead

- **Docker healthcheck**: Runs every 10 seconds, minimal overhead (< 10ms per check)
- **Startup health check**: Runs once during startup, typically completes in < 1 second
- **Backend `/health/ready`**: On-demand only when endpoint is called

### Impact on Database

- Health checks use simple queries (`SELECT 1`) that don't impact database performance
- No writes are performed during health checks
- Connection pooling prevents excessive connection overhead
- Health check connections are released immediately after use

### Best Practices

1. **Don't reduce timeout below 5 seconds**: Database startup can take a few seconds
2. **Keep healthcheck interval at 10 seconds**: More frequent checks don't improve reliability
3. **Use the script for automation**: Don't run manual health checks in tight loops
4. **Monitor logs during startup**: Health check output helps diagnose issues quickly

## Advanced Usage

### Custom Health Checks

You can extend the health check script to include additional verification:

```bash
# Add custom check to verify specific data exists
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev -c "
  SELECT COUNT(*) FROM health_checks WHERE service_name = 'database';
"
```

### CI/CD Integration

The health check script is designed to work in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Start services
  run: make dev

- name: Verify database health
  run: bash infrastructure/scripts/check-db-health.sh

- name: Run tests
  run: npm test
```

### Monitoring and Alerting

For production monitoring, consider:
- Running health checks on a schedule (cron job)
- Alerting when health checks fail
- Logging health check results to a monitoring system
- Tracking health check response times

## Related Documentation

- [PostgreSQL Service Setup](/infrastructure/database/init.sql) - Database initialization script
- [Backend Health Endpoints](/backend/src/routes/health.ts) - Backend health check API
- [Startup Orchestration](/infrastructure/scripts/startup.sh) - Service startup flow
- [Docker Compose Configuration](/docker-compose.yml) - Service definitions and health checks

## Support

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting Guide](#troubleshooting-guide) section above
2. Review logs: `docker-compose logs postgres`
3. Verify configuration: `cat .env | grep DATABASE`
4. Test manual connection: `docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev`

For persistent issues, ensure your `.env` file is properly configured and all services are running with `docker ps`.
