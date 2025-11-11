# Zero-to-Running Development Profiles

This guide explains the different development profiles available in Zero-to-Running and when to use each one.

## Table of Contents

- [Overview](#overview)
- [Available Profiles](#available-profiles)
  - [Minimal Profile](#minimal-profile)
  - [Full Profile](#full-profile)
- [Quick Start](#quick-start)
- [Profile Comparison](#profile-comparison)
- [Usage Examples](#usage-examples)
- [Creating Custom Profiles](#creating-custom-profiles)
- [Troubleshooting](#troubleshooting)

## Overview

Development profiles allow you to optimize your local environment based on the type of work you're doing. Instead of always starting all services, you can choose a profile that starts only the services you need.

**Benefits:**
- Faster startup times
- Lower resource usage (CPU, RAM)
- Optimized workflow for specific tasks
- Easier debugging with fewer moving parts

## Available Profiles

### Minimal Profile

**Purpose:** Fast backend-only development

**Services Included:**
- PostgreSQL Database
- Node.js Backend API

**Services Excluded:**
- Frontend (React)
- Redis Cache

**When to Use:**
- Backend API development
- Database schema changes
- API endpoint testing
- Backend debugging
- Backend unit/integration tests
- Working on backend services only

**Performance Characteristics:**
- Startup Time: ~30-45 seconds
- Memory Usage: ~400-600 MB
- CPU Usage: Low
- Container Count: 2

**Usage:**
```bash
make dev profile=minimal
```

**Benefits:**
- Faster iteration on backend code
- Lower resource consumption
- Simpler debugging (fewer logs)
- Quick database schema testing

**Limitations:**
- Cannot test full-stack integration
- No frontend UI available
- No Redis caching (backend may use in-memory fallback)
- Cannot test features requiring frontend

**Example Workflow:**
```bash
# Start minimal profile
make dev profile=minimal

# Work on backend API endpoints
# Edit files in ./backend/src/

# Backend hot-reloads automatically
# Test API with curl or Postman

# Stop services when done
make down
```

### Full Profile

**Purpose:** Complete development environment with all services

**Services Included:**
- PostgreSQL Database
- Node.js Backend API
- React Frontend
- Redis Cache

**Services Excluded:**
- None (all services included)

**When to Use:**
- Full-stack feature development
- End-to-end testing
- Integration testing with all services
- Frontend development
- Testing Redis caching behavior
- Demonstrating the complete application
- Production-like environment testing

**Performance Characteristics:**
- Startup Time: ~60-90 seconds
- Memory Usage: ~1-1.5 GB
- CPU Usage: Moderate
- Container Count: 4

**Usage:**
```bash
make dev profile=full
# OR simply:
make dev
```

**Benefits:**
- Complete application environment
- Realistic production-like setup
- All features available
- Full integration testing
- Frontend hot-reload support

**Limitations:**
- Slower startup time
- Higher resource usage
- More complex debugging (more logs)

**Example Workflow:**
```bash
# Start full profile (default)
make dev

# Access frontend at http://localhost:3000
# Access backend at http://localhost:3001

# Work on any part of the stack
# All services hot-reload automatically

# Stop services when done
make down
```

## Quick Start

### Starting with a Profile

```bash
# Start minimal profile (backend + database only)
make dev profile=minimal

# Start full profile (all services)
make dev profile=full

# Default: full profile
make dev
```

### Listing Available Profiles

```bash
# Show all available profiles and their descriptions
make profiles
```

### Switching Profiles

```bash
# Stop current services
make down

# Start with different profile
make dev profile=minimal
```

### Checking Service Status

```bash
# View running services and their health
make status

# View logs from all services
make logs

# View logs from specific service
make logs service=backend
```

## Profile Comparison

| Feature | Minimal | Full |
|---------|---------|------|
| **Services** | | |
| PostgreSQL Database | ✓ | ✓ |
| Backend API | ✓ | ✓ |
| Frontend UI | ✗ | ✓ |
| Redis Cache | ✗ | ✓ |
| **Performance** | | |
| Startup Time | 30-45s | 60-90s |
| Memory Usage | 400-600 MB | 1-1.5 GB |
| CPU Usage | Low | Moderate |
| Containers | 2 | 4 |
| **Use Cases** | | |
| Backend Development | ✓✓✓ | ✓ |
| Frontend Development | ✗ | ✓✓✓ |
| Full-Stack Development | ✗ | ✓✓✓ |
| API Testing | ✓✓✓ | ✓ |
| E2E Testing | ✗ | ✓✓✓ |
| Database Work | ✓✓✓ | ✓ |
| Quick Iteration | ✓✓✓ | ✓ |

**Legend:**
- ✓✓✓ = Excellent
- ✓ = Supported
- ✗ = Not Available

## Usage Examples

### Example 1: Backend API Development

**Scenario:** You're working on a new API endpoint and want fast iteration.

```bash
# Start minimal profile
make dev profile=minimal

# Edit backend code
vim backend/src/controllers/userController.ts

# Backend hot-reloads automatically

# Test API endpoint
curl http://localhost:3001/api/users

# View backend logs
make logs service=backend

# Stop when done
make down
```

### Example 2: Full-Stack Feature Development

**Scenario:** You're building a new feature that requires frontend and backend changes.

```bash
# Start full profile
make dev profile=full

# Access frontend: http://localhost:3000
# Access backend: http://localhost:3001

# Edit frontend
vim frontend/src/components/UserProfile.tsx

# Edit backend
vim backend/src/controllers/userController.ts

# Both hot-reload automatically

# Test in browser at http://localhost:3000

# Stop when done
make down
```

### Example 3: Database Schema Changes

**Scenario:** You need to modify database schema and test migrations.

```bash
# Start minimal profile (faster for DB work)
make dev profile=minimal

# Edit migration files
vim backend/src/migrations/001_create_users_table.sql

# Run migrations (example)
# docker exec -it zero-to-running-backend npm run migrate

# Test with psql
docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev

# Stop when done
make down
```

### Example 4: Testing with Different Profiles

**Scenario:** You want to ensure your code works in both profiles.

```bash
# Test with minimal profile
make dev profile=minimal
# Run backend tests
make down

# Test with full profile
make dev profile=full
# Run E2E tests
make down
```

## Creating Custom Profiles

You can create custom profiles for specialized workflows.

### Step 1: Create Profile Configuration File

Create a new file: `.env.{profile-name}`

```bash
cp .env.minimal .env.myprofile
```

### Step 2: Customize Services

Edit `.env.myprofile` to configure which services to include:

```bash
# Set profile identifier
PROFILE=myprofile

# Configure service-specific variables
# ...
```

### Step 3: Update Docker Compose (if needed)

If you need custom service combinations, update `docker-compose.yml`:

```yaml
services:
  my-custom-service:
    # ...
    profiles:
      - myprofile
```

### Step 4: Use Your Custom Profile

```bash
make dev profile=myprofile
```

## Troubleshooting

### Profile Not Found Error

**Problem:** `Invalid profile: 'xyz'`

**Solution:**
```bash
# List available profiles
make profiles

# Use a valid profile name
make dev profile=minimal
```

### Services Not Starting

**Problem:** Services fail to start with a specific profile

**Solution:**
```bash
# Check Docker logs
docker-compose logs

# Verify profile configuration
cat .env.minimal

# Try default profile
make down
make dev
```

### Port Conflicts

**Problem:** Port already in use

**Solution:**
```bash
# Check which ports are in use
netstat -tuln | grep -E ':(3000|3001|5432|6379)'

# Stop conflicting services
# OR change ports in .env file
```

### Services From Previous Profile Still Running

**Problem:** Redis or frontend still running after switching to minimal profile

**Solution:**
```bash
# Always stop services before switching profiles
make down

# Then start with new profile
make dev profile=minimal
```

### Docker Compose Version Issues

**Problem:** Profiles not working correctly

**Solution:**
```bash
# Check Docker Compose version (needs 1.28+)
docker-compose --version

# Upgrade if needed
# See: https://docs.docker.com/compose/install/
```

### Profile Configuration Validation Failed

**Problem:** Configuration validation fails

**Solution:**
```bash
# Validate specific profile
bash infrastructure/scripts/validate-profile.sh minimal

# Check for required variables
# Ensure DATABASE_PASSWORD is set
```

## Advanced Usage

### Environment Variable Precedence

Configuration is loaded in this order (later overrides earlier):

1. `.env.example` (defaults)
2. `.env.{profile}` (profile-specific)
3. `.env` (user customization - highest priority)

### Checking Current Profile

```bash
# View active profile in .env
grep "^PROFILE=" .env

# View running containers
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Profile-Specific Environment Variables

Some variables only apply to certain profiles:

**Minimal Profile:**
- `REDIS_*` variables are ignored (service not started)
- `FRONTEND_PORT` not used

**Full Profile:**
- All variables are used

### Performance Tuning

For minimal profile, you can further optimize:

```bash
# In .env.minimal
LOG_LEVEL=ERROR          # Less verbose logging
DATABASE_POOL_MAX=5      # Smaller connection pool
```

For full profile, optimize for development:

```bash
# In .env.full
LOG_LEVEL=DEBUG          # More verbose for debugging
ENABLE_HOT_RELOAD=true   # Hot reload enabled
```

## Best Practices

1. **Use minimal profile for focused backend work**
   - Faster iteration
   - Lower resource usage

2. **Use full profile for integration testing**
   - Ensures all services work together
   - Tests realistic scenarios

3. **Always stop services before switching profiles**
   ```bash
   make down && make dev profile=minimal
   ```

4. **Keep profile-specific configurations in `.env.{profile}`**
   - Don't modify `.env` directly
   - Use `.env` for user-specific overrides only

5. **Validate profiles after changes**
   ```bash
   bash infrastructure/scripts/validate-profile.sh minimal
   ```

## Related Documentation

- [README.md](../README.md) - Quick start guide
- [CONFIGURATION.md](./CONFIGURATION.md) - Environment configuration details
- [HEALTH_VERIFICATION.md](./HEALTH_VERIFICATION.md) - Service health checks

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. View service logs: `make logs`
3. Check service status: `make status`
4. Review [GitHub Issues](../../issues)
