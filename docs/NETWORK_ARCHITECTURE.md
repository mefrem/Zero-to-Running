# Network Architecture

## Overview

The Zero-to-Running application uses Docker Compose with a custom bridge network to enable secure, reliable inter-service communication. All services are connected to a single custom network (`zero-to-running-network`) which provides automatic DNS resolution for service discovery.

## Network Topology

```
┌─────────────────────────────────────────────────────────────┐
│                 zero-to-running-network                     │
│                    (Docker Bridge)                          │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────┐│
│  │          │    │          │    │          │    │      ││
│  │ Frontend │───▶│ Backend  │───▶│PostgreSQL│    │Redis ││
│  │  :3000   │    │  :3001   │    │  :5432   │    │:6379 ││
│  │          │    │          │───▶│          │    │      ││
│  └──────────┘    └──────────┘    └──────────┘    └──────┘│
│       │               │                │              │    │
└───────┼───────────────┼────────────────┼──────────────┼────┘
        │               │                │              │
        ▼               ▼                ▼              ▼
    localhost:3000  localhost:3001  localhost:5432  localhost:6379
                    (Host Machine Ports)
```

## Network Configuration

### Docker Compose Network Definition

The custom network is defined in `docker-compose.yml`:

```yaml
networks:
  zero-to-running-network:
    name: ${DOCKER_NETWORK:-zero-to-running-network}
    driver: bridge
```

**Key Characteristics**:
- **Network Type**: Bridge (allows container-to-container communication)
- **Network Name**: `zero-to-running-network` (customizable via `DOCKER_NETWORK` env var)
- **Driver**: Bridge (Docker's default, suitable for single-host deployments)
- **Automatic Creation**: Created automatically by `docker-compose up`
- **DNS Resolution**: Docker provides embedded DNS server at 127.0.0.11:53

### Service Network Connections

All four services are explicitly connected to the custom network:

```yaml
services:
  postgres:
    networks:
      - zero-to-running-network
    # Internal: postgres:5432
    # External: localhost:5432

  redis:
    networks:
      - zero-to-running-network
    # Internal: redis:6379
    # External: localhost:6379

  backend:
    networks:
      - zero-to-running-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    # Internal: backend:3001
    # External: localhost:3001

  frontend:
    networks:
      - zero-to-running-network
    depends_on:
      backend:
        condition: service_healthy
    # Internal: frontend:3000
    # External: localhost:3000
```

## Service Discovery Mechanism

### DNS Resolution Process

Docker provides automatic DNS resolution for services on the custom network:

1. **Service Name Registration**: When a container starts, Docker registers its service name with the embedded DNS server
2. **DNS Query**: When a container tries to connect to another service by name (e.g., `postgres`), the DNS query goes to Docker's embedded DNS server (127.0.0.11:53)
3. **IP Address Resolution**: The DNS server returns the current IP address of the target service's container
4. **Connection Establishment**: The requesting container connects to the resolved IP address
5. **Transparent to Application**: Applications use service names just like regular hostnames

### Example DNS Resolution

When the backend connects to PostgreSQL using `postgres:5432`:

```
Backend Container
    ↓
DNS Query: "postgres"
    ↓
Docker Embedded DNS (127.0.0.11:53)
    ↓
Returns: 172.18.0.2 (postgres container IP)
    ↓
Backend establishes TCP connection to 172.18.0.2:5432
    ↓
PostgreSQL container receives connection
```

**Important**: Service names only resolve within the Docker network. From the host machine, use `localhost` instead.

## Service Communication Patterns

### 1. Backend → PostgreSQL Database

**Connection Details**:
- **Service Name**: `postgres`
- **Port**: `5432`
- **Connection String**: `postgresql://postgres:${DATABASE_PASSWORD}@postgres:5432/${DATABASE_NAME}`

**Configuration** (`backend/src/config/database.ts`):
```typescript
const dbConfig: PoolConfig = {
  host: process.env.DATABASE_HOST || 'postgres',  // Service name
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME || 'zero_to_running_dev',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD,
};
```

**Environment Variables** (set in `docker-compose.yml`):
```yaml
backend:
  environment:
    DATABASE_HOST: postgres  # DNS service name
    DATABASE_PORT: 5432
    DATABASE_NAME: ${DATABASE_NAME:-zero_to_running_dev}
    DATABASE_USER: ${DATABASE_USER:-postgres}
    DATABASE_PASSWORD: ${DATABASE_PASSWORD}
```

**Connection Test**:
The backend tests the database connection on startup:
```typescript
// Executes test query on startup
const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
```

### 2. Backend → Redis Cache

**Connection Details**:
- **Service Name**: `redis`
- **Port**: `6379`
- **Connection URL**: `redis://redis:6379`

**Configuration** (`backend/src/config/redis.ts`):
```typescript
const redisHost = process.env.REDIS_HOST || 'redis';  // Service name
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

const redisUrl = `redis://${redisHost}:${redisPort}`;
```

**Environment Variables** (set in `docker-compose.yml`):
```yaml
backend:
  environment:
    REDIS_HOST: redis  # DNS service name
    REDIS_PORT: 6379
```

**Connection Test**:
The backend tests the Redis connection on startup:
```typescript
// Executes PING command on startup
const pong = await redisClient.ping();  // Returns 'PONG' if successful
```

### 3. Frontend → Backend API

**Connection Details**:
- **Browser Access**: `http://localhost:3001` (from host machine)
- **Container Access**: `http://backend:3001` (if frontend made SSR calls)
- **Port**: `3001`

**Configuration** (`frontend/src/config/api.ts`):
```typescript
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
}
```

**Environment Variables** (set in `docker-compose.yml`):
```yaml
frontend:
  environment:
    VITE_API_URL: ${VITE_API_URL:-http://localhost:3001}
```

**Important Note**: The frontend runs in the browser (client-side), not in the container. Therefore, it accesses the backend via `localhost:3001` on the host machine, not via the Docker service name. If the frontend performed server-side rendering (SSR), it would use `http://backend:3001` instead.

### 4. Service Dependencies and Startup Order

Docker Compose `depends_on` with health conditions ensures services start in the correct order:

```yaml
# PostgreSQL and Redis start first (no dependencies)

backend:
  depends_on:
    postgres:
      condition: service_healthy  # Wait for PostgreSQL to be healthy
    redis:
      condition: service_healthy  # Wait for Redis to be healthy

frontend:
  depends_on:
    backend:
      condition: service_healthy  # Wait for backend to be healthy
```

**Startup Sequence**:
1. **PostgreSQL** starts → Health check passes
2. **Redis** starts → Health check passes
3. **Backend** starts (after PostgreSQL and Redis are healthy) → Connects to both → Health check passes
4. **Frontend** starts (after backend is healthy) → Can call backend API → Health check passes

## Port Mapping Strategy

### Internal vs. External Ports

Each service has two types of port access:

1. **Internal Ports** (within Docker network):
   - Used for inter-service communication
   - Accessed via service name (e.g., `postgres:5432`)
   - Not directly accessible from host machine

2. **External Ports** (published to host):
   - Used for development and debugging
   - Accessed via `localhost` (e.g., `localhost:5432`)
   - Mapped in `docker-compose.yml` using `ports` directive

### Port Mappings

| Service    | Internal Address  | External Address    | Purpose |
|------------|------------------|---------------------|---------|
| PostgreSQL | `postgres:5432`  | `localhost:5432`    | Database |
| Redis      | `redis:6379`     | `localhost:6379`    | Cache |
| Backend    | `backend:3001`   | `localhost:3001`    | API |
| Frontend   | `frontend:3000`  | `localhost:3000`    | Web UI |

**Configuration**:
```yaml
services:
  postgres:
    ports:
      - "${DATABASE_PORT:-5432}:5432"  # Host:Container

  redis:
    ports:
      - "${REDIS_PORT:-6379}:6379"

  backend:
    ports:
      - "${BACKEND_PORT:-3001}:${BACKEND_PORT:-3001}"

  frontend:
    ports:
      - "${FRONTEND_PORT:-3000}:${FRONTEND_PORT:-3000}"
```

## Network Inspection and Verification

### Check Network Exists

```bash
# List all Docker networks
docker network ls

# Expected output includes:
# NETWORK ID     NAME                        DRIVER    SCOPE
# abc123def456   zero-to-running-network     bridge    local
```

### Inspect Network Details

```bash
# Inspect network configuration and connected services
docker network inspect zero-to-running-network

# Output shows:
# - Network configuration (driver, subnet, gateway)
# - Connected containers and their IP addresses
# - Network aliases
```

Example output:
```json
{
  "Name": "zero-to-running-network",
  "Driver": "bridge",
  "Containers": {
    "container-id-1": {
      "Name": "zero-to-running-postgres",
      "IPv4Address": "172.18.0.2/16"
    },
    "container-id-2": {
      "Name": "zero-to-running-redis",
      "IPv4Address": "172.18.0.3/16"
    },
    "container-id-3": {
      "Name": "zero-to-running-backend",
      "IPv4Address": "172.18.0.4/16"
    },
    "container-id-4": {
      "Name": "zero-to-running-frontend",
      "IPv4Address": "172.18.0.5/16"
    }
  }
}
```

### Verify Service Connectivity

#### From Backend to PostgreSQL

```bash
# Test DNS resolution
docker-compose exec backend ping -c 3 postgres

# Test port connectivity
docker-compose exec backend nc -zv postgres 5432

# Expected: "postgres (172.18.0.2:5432) open"
```

#### From Backend to Redis

```bash
# Test DNS resolution
docker-compose exec backend ping -c 3 redis

# Test port connectivity
docker-compose exec backend nc -zv redis 6379

# Test Redis PING command
docker-compose exec backend sh -c "echo PING | nc redis 6379"

# Expected: "+PONG"
```

#### From Frontend to Backend

```bash
# Test DNS resolution
docker-compose exec frontend ping -c 3 backend

# Test HTTP connectivity
docker-compose exec frontend wget -qO- http://backend:3001/health

# Expected: {"status":"ok","timestamp":"2025-11-10T..."}
```

### Check Service Logs

```bash
# View backend logs for connection messages
docker-compose logs backend | grep -i "connection"
docker-compose logs backend | grep -i "database"
docker-compose logs backend | grep -i "redis"

# Expected messages:
# - "Database connection successful"
# - "Redis client ready"
# - "Application started successfully"
```

### Verify Health Checks

```bash
# Check all service statuses
docker-compose ps

# Expected: All services show "healthy" status
# NAME                      STATUS
# zero-to-running-postgres  Up (healthy)
# zero-to-running-redis     Up (healthy)
# zero-to-running-backend   Up (healthy)
# zero-to-running-frontend  Up (healthy)
```

## Troubleshooting Network Issues

### Connection Refused

**Symptom**: "Connection refused" error when connecting to another service

**Possible Causes**:
1. Target service not running or not healthy
2. Incorrect port number
3. Service not fully initialized (health check not passed yet)

**Resolution**:
```bash
# Check if service is running
docker-compose ps

# Check service health
docker-compose ps | grep -i health

# View service logs
docker-compose logs [service-name]

# Verify port is listening
docker-compose exec [service-name] netstat -tlnp
```

### Name Resolution Failure

**Symptom**: "postgres: Name or service not known" or similar DNS error

**Possible Causes**:
1. Service name typo in configuration
2. Services on different networks
3. DNS server issue

**Resolution**:
```bash
# Verify service name in docker-compose.yml
grep "services:" docker-compose.yml -A 50

# Check services are on same network
docker network inspect zero-to-running-network

# Test DNS resolution from within container
docker-compose exec backend nslookup postgres
docker-compose exec backend cat /etc/resolv.conf
```

### Timeout Errors

**Symptom**: Connection times out when reaching another service

**Possible Causes**:
1. Service not healthy or slow to start
2. Firewall or security group blocking traffic
3. Network configuration issue

**Resolution**:
```bash
# Check health check status
docker-compose ps

# Increase health check start_period
# Edit docker-compose.yml and increase start_period value

# Check for firewall rules (Linux)
sudo iptables -L -n

# View detailed logs
docker-compose logs -f [service-name]
```

### Port Already in Use

**Symptom**: Cannot start service, port already in use

**Possible Causes**:
1. Another container using the same port
2. Host machine process using the port
3. Previous container not cleaned up

**Resolution**:
```bash
# Find what's using the port
sudo lsof -i :3001
# or
sudo netstat -tlnp | grep 3001

# Stop conflicting container
docker ps -a
docker stop [container-id]
docker rm [container-id]

# Change port in .env file
echo "BACKEND_PORT=3002" >> .env

# Clean up and restart
docker-compose down
docker-compose up -d
```

### Network Not Created

**Symptom**: Services fail to start, network doesn't exist

**Possible Causes**:
1. Docker Compose version too old
2. Syntax error in docker-compose.yml
3. Docker daemon issue

**Resolution**:
```bash
# Verify Docker Compose version (requires 1.27.0+)
docker-compose --version

# Validate docker-compose.yml syntax
docker-compose config

# Manually create network (if needed)
docker network create zero-to-running-network

# Restart Docker daemon
sudo systemctl restart docker
```

### Services Can't Communicate After Network Changes

**Symptom**: Services worked before, but now can't connect after changes

**Possible Causes**:
1. Containers using cached DNS entries
2. Network configuration changed
3. IP address conflicts

**Resolution**:
```bash
# Stop all services
docker-compose down

# Remove the network
docker network rm zero-to-running-network

# Restart services (network will be recreated)
docker-compose up -d

# Verify connectivity
docker-compose exec backend ping postgres
```

## Security Considerations

### Network Isolation

**Internal Communication Only**:
- Services communicate only on the custom network
- No direct external access to PostgreSQL or Redis (ports are mapped for dev only)
- Backend is the only service that needs external access (API)

**Production Recommendations**:
```yaml
# Remove port mappings for databases in production
postgres:
  # ports:  # Comment out to prevent external access
  #   - "5432:5432"
  networks:
    - zero-to-running-network

redis:
  # ports:  # Comment out to prevent external access
  #   - "6379:6379"
  networks:
    - zero-to-running-network
```

### Environment Variable Security

**Never commit sensitive values**:
- Use `.env` file for secrets (included in `.gitignore`)
- Use `.env.example` for documentation only
- Use Docker secrets or vault in production

```bash
# .env file (NOT committed)
DATABASE_PASSWORD=super_secret_password
REDIS_PASSWORD=another_secret

# .env.example (committed)
DATABASE_PASSWORD=change_me_in_production
REDIS_PASSWORD=change_me_in_production
```

### Network Segmentation (Future)

For production, consider network segmentation:
```yaml
networks:
  frontend-network:
    driver: bridge
  backend-network:
    driver: bridge
  database-network:
    driver: bridge

services:
  frontend:
    networks:
      - frontend-network
      - backend-network  # Can reach backend only

  backend:
    networks:
      - backend-network
      - database-network  # Can reach databases only

  postgres:
    networks:
      - database-network  # Isolated from frontend

  redis:
    networks:
      - database-network  # Isolated from frontend
```

## Best Practices

### 1. Always Use Service Names in Configuration

**Good**:
```typescript
const dbConfig = {
  host: process.env.DATABASE_HOST || 'postgres',  // Service name
  port: 5432,
};
```

**Bad**:
```typescript
const dbConfig = {
  host: '172.18.0.2',  // Hardcoded IP (will break if container restarts)
  port: 5432,
};
```

### 2. Use Environment Variables for Flexibility

```yaml
backend:
  environment:
    DATABASE_HOST: ${DATABASE_HOST:-postgres}  # Overridable, with default
    DATABASE_PORT: ${DATABASE_PORT:-5432}
```

### 3. Implement Health Checks

```yaml
backend:
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s  # Allow time for connections to establish
```

### 4. Use `depends_on` with Health Conditions

```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy  # Don't start until dependency is ready
```

### 5. Log Connection Status

```typescript
logger.info('Database connection successful', {
  host: dbConfig.host,
  database: dbConfig.database,
});
```

### 6. Handle Connection Failures Gracefully

```typescript
try {
  await testDatabaseConnection();
} catch (error) {
  logger.error('Database connection failed', { error });
  // Optionally retry or exit gracefully
}
```

### 7. Use Connection Pooling

```typescript
// Good: Use connection pool
const pool = new Pool(dbConfig);

// Bad: Create new connection for each query
const client = new Client(dbConfig);
await client.connect();  // Expensive operation
```

## Testing Network Configuration

### Manual Test Checklist

Run these commands to verify the entire network setup:

```bash
# 1. Start all services
make dev

# 2. Verify all services are healthy
docker-compose ps
# All services should show "Up (healthy)"

# 3. Verify network exists
docker network ls | grep zero-to-running
# Should show: zero-to-running-network

# 4. Inspect network
docker network inspect zero-to-running-network
# Should show all 4 services connected

# 5. Test backend-to-postgres connectivity
docker-compose exec backend ping -c 2 postgres
docker-compose exec backend nc -zv postgres 5432
# Both should succeed

# 6. Test backend-to-redis connectivity
docker-compose exec backend ping -c 2 redis
docker-compose exec backend nc -zv redis 6379
# Both should succeed

# 7. Test frontend-to-backend connectivity
docker-compose exec frontend wget -qO- http://backend:3001/health
# Should return: {"status":"ok","timestamp":"..."}

# 8. Check backend logs for connection messages
docker-compose logs backend | grep -E "(Database connection|Redis)"
# Should show successful connection messages

# 9. Test from host machine
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}

# 10. Access frontend from browser
open http://localhost:3000
# Should show "Ready!" with healthy backend status
```

### Automated Test Script

Create a test script (`scripts/test-network.sh`):

```bash
#!/bin/bash

echo "Testing network configuration..."

# Test 1: Network exists
echo "✓ Checking network exists..."
docker network inspect zero-to-running-network > /dev/null 2>&1 || { echo "✗ Network not found"; exit 1; }
echo "  Network exists"

# Test 2: All services healthy
echo "✓ Checking service health..."
docker-compose ps | grep -q "healthy" || { echo "✗ Services not healthy"; exit 1; }
echo "  All services healthy"

# Test 3: Backend can reach postgres
echo "✓ Testing backend → postgres..."
docker-compose exec -T backend nc -zv postgres 5432 > /dev/null 2>&1 || { echo "✗ Cannot reach postgres"; exit 1; }
echo "  Connection successful"

# Test 4: Backend can reach redis
echo "✓ Testing backend → redis..."
docker-compose exec -T backend nc -zv redis 6379 > /dev/null 2>&1 || { echo "✗ Cannot reach redis"; exit 1; }
echo "  Connection successful"

# Test 5: Frontend can reach backend
echo "✓ Testing frontend → backend..."
docker-compose exec -T frontend wget -qO- http://backend:3001/health > /dev/null 2>&1 || { echo "✗ Cannot reach backend"; exit 1; }
echo "  API call successful"

echo ""
echo "All network tests passed! ✓"
```

## Additional Resources

- [Docker Networking Documentation](https://docs.docker.com/network/)
- [Docker Compose Networking](https://docs.docker.com/compose/networking/)
- [Docker DNS Resolution](https://docs.docker.com/config/containers/container-networking/#dns-services)
- [Health Check Best Practices](https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck)

## Summary

The Zero-to-Running application uses a well-architected Docker network configuration that:

1. ✓ Uses a custom bridge network for all services
2. ✓ Enables automatic DNS-based service discovery
3. ✓ Provides secure inter-service communication
4. ✓ Maintains proper service dependencies with health checks
5. ✓ Exposes necessary ports for development and debugging
6. ✓ Follows Docker networking best practices
7. ✓ Includes comprehensive testing and troubleshooting procedures

All services can communicate reliably using service names, and the configuration is flexible enough to adapt to different environments through environment variables.
