# Redis Cache Service

This directory contains configuration and documentation for the Redis cache service used by the Zero-to-Running application.

## Overview

Redis is used as an in-memory data store for caching frequently accessed data, session storage, and improving application performance.

- **Image**: `redis:7-alpine`
- **Default Port**: 6379
- **Service Name**: `redis` (for Docker DNS resolution)
- **Data Persistence**: Enabled via named Docker volume

## Quick Start

### Starting Redis

Redis starts automatically when you run Docker Compose:

```bash
# Start all services including Redis
docker compose up -d

# Start only Redis
docker compose up -d redis

# View Redis logs
docker compose logs redis

# Follow Redis logs
docker compose logs -f redis
```

### Verifying Redis Connectivity

#### From Host Machine

Using redis-cli (requires redis-cli installed locally):

```bash
# Test connection
redis-cli -h localhost -p 6379 ping
# Expected output: PONG

# Connect to Redis CLI
redis-cli -h localhost -p 6379

# Once connected, try basic commands:
SET test "Hello Redis"
GET test
KEYS *
```

#### From Docker Container

```bash
# Execute redis-cli inside the running Redis container
docker compose exec redis redis-cli ping
# Expected output: PONG

# Open interactive redis-cli session
docker compose exec redis redis-cli

# Test basic operations
SET mykey "myvalue"
GET mykey
INFO server
```

#### From Backend Service

The backend service can connect to Redis using Docker DNS:

**Connection String**: `redis://redis:6379`

Environment variables (from .env file):
- `REDIS_HOST=redis` (Docker DNS name)
- `REDIS_PORT=6379`
- `REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/${REDIS_DB}`

Example Node.js connection test:

```javascript
const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

client.on('connect', () => console.log('Redis connected'));
client.on('error', (err) => console.error('Redis error:', err));

await client.connect();
const result = await client.ping();
console.log('Redis PING:', result); // Should print "PONG"
```

## Configuration

### Environment Variables

Configure Redis via environment variables in your `.env` file:

```bash
# Redis Configuration
REDIS_HOST=localhost        # Use "redis" from within Docker network
REDIS_PORT=6379            # Default Redis port
REDIS_PASSWORD=            # Optional password (empty by default)
REDIS_DB=0                 # Default database index
REDIS_URL=redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}
```

### Port Configuration

The Redis port is configurable via the `REDIS_PORT` environment variable:

```bash
# In .env file
REDIS_PORT=6380

# Restart services to apply
docker compose down
docker compose up -d
```

### Data Persistence

Redis data persists automatically using a named Docker volume:

- **Volume Name**: `zero-to-running-redis-data`
- **Mount Point**: `/data` (inside container)
- **Persistence Mode**: AOF (Append Only File) enabled

Data survives container restarts and removals but not volume deletion.

#### Managing Persistence

```bash
# View volume details
docker volume inspect zero-to-running-redis-data

# Backup Redis data (while container is running)
docker compose exec redis redis-cli BGSAVE
docker cp $(docker compose ps -q redis):/data /path/to/backup/

# Clear all Redis data (flush database)
docker compose exec redis redis-cli FLUSHALL

# Remove Redis data volume (DANGER: deletes all data)
docker compose down
docker volume rm zero-to-running-redis-data
```

## Health Checks

Redis includes automatic health checks:

- **Check Command**: `redis-cli ping`
- **Interval**: 10 seconds
- **Timeout**: 5 seconds
- **Retries**: 5
- **Start Period**: 5 seconds

View health status:

```bash
# Check container health
docker compose ps redis

# View detailed health status
docker inspect $(docker compose ps -q redis) | grep -A 10 Health
```

## Common Operations

### Monitoring Redis

```bash
# Monitor real-time commands
docker compose exec redis redis-cli MONITOR

# View server info
docker compose exec redis redis-cli INFO

# Check memory usage
docker compose exec redis redis-cli INFO memory

# View connected clients
docker compose exec redis redis-cli CLIENT LIST

# Get server statistics
docker compose exec redis redis-cli INFO stats
```

### Performance Testing

```bash
# Benchmark Redis performance
docker compose exec redis redis-benchmark -q -n 10000

# Test specific operations
docker compose exec redis redis-benchmark -t set,get -n 100000 -q
```

## Troubleshooting

### Redis Container Won't Start

```bash
# Check container logs
docker compose logs redis

# Check if port is already in use
lsof -i :6379

# Verify Docker Compose configuration
docker compose config
```

### Cannot Connect to Redis

From host machine:
```bash
# Verify Redis is running
docker compose ps redis

# Check health status
docker compose exec redis redis-cli ping

# Test connection with full details
redis-cli -h localhost -p ${REDIS_PORT:-6379} ping
```

From backend service:
```bash
# Test DNS resolution
docker compose exec backend ping -c 3 redis

# Test Redis connection from backend container
docker compose exec backend nc -zv redis 6379
```

### Redis Connection Refused

1. Verify Redis service is running: `docker compose ps redis`
2. Check health status shows "healthy"
3. Verify port configuration in `.env` matches docker-compose.yml
4. Ensure backend service is on the same Docker network
5. Check firewall rules if connecting from host machine

### Data Not Persisting

```bash
# Verify volume exists
docker volume ls | grep redis

# Check volume mount
docker compose exec redis df -h /data

# Verify AOF is enabled
docker compose exec redis redis-cli CONFIG GET appendonly
# Should return: appendonly yes

# Check AOF file exists
docker compose exec redis ls -lh /data/appendonly.aof
```

### High Memory Usage

```bash
# Check memory stats
docker compose exec redis redis-cli INFO memory

# View largest keys
docker compose exec redis redis-cli --bigkeys

# Set maxmemory limit (if needed)
docker compose exec redis redis-cli CONFIG SET maxmemory 256mb
docker compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## Security Considerations

### Development Environment

- Default configuration has NO password protection
- Redis is exposed to localhost only (not internet-accessible)
- Suitable for local development

### Production Recommendations

For production deployments:

1. **Enable password authentication**:
   ```bash
   # In docker-compose.yml, add to redis command:
   command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
   ```

2. **Restrict network access**: Remove port exposure or use firewall rules

3. **Enable TLS/SSL** for encrypted connections

4. **Limit memory usage**: Configure maxmemory and eviction policies

5. **Monitor security**: Regular updates and security scanning

## Additional Resources

- [Redis Official Documentation](https://redis.io/documentation)
- [Redis Commands Reference](https://redis.io/commands)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
- [Redis Best Practices](https://redis.io/topics/best-practices)
- [Redis Security](https://redis.io/topics/security)

## Related Documentation

- [Infrastructure README](../README.md) - Overall infrastructure documentation
- [Database README](../database/README.md) - PostgreSQL database documentation
- [Docker README](../docker/README.md) - Docker configuration details
