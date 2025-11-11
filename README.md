# Zero-to-Running

A complete, containerized local development environment that goes from zero to running in one command. This project provides a production-like stack with frontend, backend, database, and caching services orchestrated via Docker Compose.

## Overview

Zero-to-Running is a monorepo designed to demonstrate modern full-stack development best practices:

- **Frontend**: React with TypeScript and Tailwind CSS
- **Backend**: Node.js with Dora framework and TypeScript
- **Database**: PostgreSQL for persistent storage
- **Cache**: Redis for session management and caching
- **Orchestration**: Docker Compose for service coordination
- **Developer Experience**: Single-command setup with GNU Make

The entire stack starts with a single `make dev` command and includes health checks, logging, and graceful shutdown capabilities.

## Network Architecture

All services communicate through a custom Docker network (`zero-to-running-network`) that provides automatic DNS-based service discovery. This means services can reference each other by name (e.g., `postgres:5432`, `redis:6379`) without hardcoding IP addresses.

### Service Communication

The `make dev` command automatically sets up the network and connects all services:

```
Frontend (port 3000)
    ↓ HTTP API calls
Backend (port 3001)
    ↓ Database queries        ↓ Cache operations
PostgreSQL (port 5432)    Redis (port 6379)
```

**Key Features**:
- **Automatic DNS Resolution**: Services resolve by name (e.g., backend connects to `postgres:5432`)
- **Service Discovery**: No manual IP configuration needed
- **Network Isolation**: Services communicate on a private Docker network
- **Health Checks**: Services wait for dependencies to be healthy before starting
- **Port Mapping**: All services accessible from host machine via `localhost`

**Connection Examples**:

| From | To | Internal Address | External Address (from host) |
|------|----|-----------------|-----------------------------|
| Backend | PostgreSQL | `postgres:5432` | `localhost:5432` |
| Backend | Redis | `redis:6379` | `localhost:6379` |
| Frontend (browser) | Backend | N/A | `localhost:3001` |

**Note**: The frontend runs in the browser (client-side), so it accesses the backend via `localhost:3001` on your host machine, not via Docker's internal network.

For detailed network architecture, troubleshooting, and manual verification commands, see [docs/NETWORK_ARCHITECTURE.md](docs/NETWORK_ARCHITECTURE.md).

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Desktop** (v20.10+) - [Download](https://www.docker.com/products/docker-desktop)
  - Includes Docker Engine and Docker Compose
  - Ensure Docker is running before executing commands
- **GNU Make** - Pre-installed on macOS/Linux, available via WSL2 on Windows
  - Verify: `make --version`
- **Git** (v2.0+) - For repository management
- **Minimum System Requirements**:
  - 8GB RAM (16GB recommended)
  - 10GB available disk space
  - macOS 10.15+, Ubuntu 20.04+, or Windows 10/11 with WSL2

## Quick Start

Get the entire development environment running in three simple steps:

```bash
# 1. Clone the repository
git clone <repository-url>
cd Zero-to-Running

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your preferred settings (defaults work for local development)

# 3. Start all services
make dev
```

The `make dev` command will:
1. Start all Docker containers
2. Verify each service is healthy (with 2-minute timeout)
3. Display success message with access URLs and connection strings

**Note**: The first run may take 3-8 minutes as Docker downloads images and builds containers. Subsequent runs take 15-30 seconds.

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Configuration

Zero-to-Running uses environment variables for all configuration, making it easy to customize your local development environment.

### Setting Up Your Environment

1. **Copy the example configuration:**
   ```bash
   cp .env.example .env
   ```

2. **Required Variables:**
   Edit `.env` and set these required variables:
   ```bash
   DATABASE_PASSWORD=your_secure_password_here
   SESSION_SECRET=your_random_session_secret_here
   ```

3. **Validate Your Configuration:**
   ```bash
   make config
   ```

This will check that:
- All required variables are set
- Port numbers are valid and not duplicated
- Passwords and secrets are not using default values
- Log levels and formats are correct

### Key Configuration Options

**Service Ports:**
```bash
FRONTEND_PORT=3000       # React application
BACKEND_PORT=3001        # API server
DATABASE_PORT=5432       # PostgreSQL
REDIS_PORT=6379          # Redis cache
```

**Logging:**
```bash
LOG_LEVEL=INFO          # ERROR, WARN, INFO, DEBUG
LOG_FORMAT=pretty       # pretty (dev) or json (production)
VITE_LOG_LEVEL=INFO     # Frontend log level
```

**Database:**
```bash
DATABASE_HOST=localhost
DATABASE_NAME=zero_to_running_dev
DATABASE_USER=postgres
DATABASE_PASSWORD=CHANGE_ME_secure_password_123
```

**Security:**
```bash
SESSION_SECRET=CHANGE_ME_random_session_secret_key_xyz789
JWT_SECRET=CHANGE_ME_jwt_secret_key_abc456  # Optional, for JWT auth
```

### Configuration Commands

```bash
# Validate configuration before starting
make config

# Start services (automatically validates config)
make dev
```

### Common Configuration Scenarios

**Change Service Ports:**
```bash
# In .env file
FRONTEND_PORT=4000
BACKEND_PORT=5000

# Verify changes
make config

# Restart services
make down && make dev
```

**Enable Debug Logging:**
```bash
# In .env file
LOG_LEVEL=DEBUG
VITE_LOG_LEVEL=DEBUG

# Restart to apply
make down && make dev
```

**Use Different Database Credentials:**
```bash
# In .env file
DATABASE_USER=myuser
DATABASE_PASSWORD=mypassword
DATABASE_NAME=mydb

# Restart to apply
make down && make dev
```

### Troubleshooting Configuration

**Common Issues:**

1. **"DATABASE_PASSWORD is not set"**
   - Edit `.env` and set `DATABASE_PASSWORD` to a secure value
   - Run `make config` to verify

2. **"Duplicate port assignments"**
   - Check that all service ports are unique in `.env`
   - Use `make config` to identify conflicts

3. **"Invalid LOG_LEVEL"**
   - Must be one of: ERROR, WARN, INFO, DEBUG
   - Check for typos in `.env`

4. **Configuration validation fails on startup**
   - Run `make config` to see detailed error messages
   - Fix errors in `.env` file
   - Restart with `make dev`

For comprehensive configuration documentation, see [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Secret Management

Zero-to-Running uses a **mock secret pattern** for development that teaches production-ready practices while remaining safe and convenient.

### Mock Secrets in Development

The `.env.example` file contains development-only secrets prefixed with `CHANGE_ME_`:

```bash
DATABASE_PASSWORD=CHANGE_ME_postgres_123
REDIS_PASSWORD=CHANGE_ME_redis_123
SESSION_SECRET=CHANGE_ME_session_secret_32_character_minimum
JWT_SECRET=CHANGE_ME_jwt_secret_32_character_minimum
```

**These are safe for local development** and work out of the box. When you start the application, you'll see a warning if mock secrets are detected:

```
================================================================================
⚠️  WARNING: Mock secrets detected in use (development only!)
================================================================================

The following mock secrets are currently configured:
  • DATABASE_PASSWORD (set to: CHANGE_ME_postgres_123)
  • REDIS_PASSWORD (set to: CHANGE_ME_redis_123)
  • SESSION_SECRET (set to: CHANGE_ME_session_sec...)
  • JWT_SECRET (set to: CHANGE_ME_jwt_secret...)

These are safe for local development, but should NEVER be used in production.
================================================================================
```

**This warning is intentional and expected** in local development. It does NOT prevent the application from starting.

### Quick Start: Using Mock Secrets

For local development, you can use the mock secrets as-is:

```bash
# Copy .env.example to .env
cp .env.example .env

# Start with mock secrets (safe for development)
make dev
```

The application will start successfully and display the mock secret warning.

### Generating Real Secrets (Optional)

For enhanced local security or production deployment, generate real secrets:

```bash
# Generate a strong password (32 characters)
openssl rand -base64 32

# Copy to your .env file
DATABASE_PASSWORD=<generated-value>
SESSION_SECRET=<generated-value>
JWT_SECRET=<generated-value>
```

Real secrets (without the `CHANGE_ME_` prefix) won't trigger warnings.

### Production Deployment

**IMPORTANT**: Never use mock secrets in production! For production deployments, see:

- **[Secret Management Guide](docs/SECRET_MANAGEMENT.md)** - Comprehensive guide to secret handling
- **Production Integration Examples:**
  - [AWS Secrets Manager](docs/examples/secret-management-aws.md) - For AWS deployments
  - [HashiCorp Vault](docs/examples/secret-management-vault.md) - For multi-cloud/on-premises
  - [Kubernetes Secrets](docs/examples/secret-management-kubernetes.md) - For Kubernetes deployments
  - [CI/CD Environment Injection](docs/examples/secret-management-env-inject.md) - For simple deployments

### Best Practices

**✓ Do:**

- Use mock secrets (`CHANGE_ME_` prefix) for local development
- Generate unique secrets for each environment (dev, staging, production)
- Never commit `.env` file to version control (it's git-ignored)
- Use a secret management system in production
- Rotate secrets regularly (every 90 days)

**✗ Don't:**

- Use mock secrets in production
- Hardcode secrets in source code
- Commit real secrets to version control
- Share secrets via email or chat
- Use the same secrets across environments

For detailed secret management patterns, database credential handling, and production integration, see [docs/SECRET_MANAGEMENT.md](docs/SECRET_MANAGEMENT.md).

## Repository Structure

This monorepo is organized to separate concerns while keeping everything in one place:

```
/
├── README.md                    # This file - project overview and quick start
├── LICENSE                      # Project license (MIT)
├── .gitignore                   # Git ignore patterns
├── .env.example                 # Environment variable template
├── Makefile                     # Developer commands and task automation
│
├── frontend/                    # React/TypeScript frontend service
│   ├── package.json             # Frontend dependencies
│   ├── tsconfig.json            # TypeScript configuration
│   ├── src/                     # Frontend source code
│   └── public/                  # Static assets
│
├── backend/                     # Node.js/Dora/TypeScript backend API
│   ├── package.json             # Backend dependencies
│   ├── tsconfig.json            # TypeScript configuration
│   ├── src/                     # Backend source code
│   └── tests/                   # Backend test suites
│
├── infrastructure/              # Infrastructure and orchestration
│   ├── docker/                  # Docker-related configurations
│   │   ├── docker-compose.yml   # Service orchestration definition
│   │   ├── Dockerfile.frontend  # Frontend container image
│   │   ├── Dockerfile.backend   # Backend container image
│   │   └── .dockerignore        # Docker ignore patterns
│   ├── database/                # Database setup and migrations
│   │   ├── init.sql             # Database initialization script
│   │   ├── migrations/          # Schema migration files
│   │   └── seeds/               # Seed data for development
│   └── scripts/                 # Utility scripts
│       ├── startup.sh           # Startup orchestration script
│       ├── health-check.sh      # Service health validation
│       └── cleanup.sh           # Cleanup utilities
│
└── docs/                        # Project documentation
    ├── architecture/            # Architecture documentation
    ├── prd/                     # Product requirements
    └── stories/                 # User stories and development tasks
```

### Directory Purposes

- **`/frontend`**: Contains the React-based user interface. Runs on port 3000 in development mode with hot-reload enabled.

- **`/backend`**: Houses the Node.js API server built with the Dora framework. Provides RESTful endpoints and business logic. Runs on port 3001 with debug support on port 9229.

- **`/infrastructure`**: Central location for all deployment and orchestration configurations:
  - `docker/`: Container definitions and Docker Compose orchestration
  - `database/`: PostgreSQL initialization scripts, schema migrations, and seed data
  - `scripts/`: Automation scripts for startup, health checks, and utilities

- **`/docs`**: Project documentation including architecture decisions, requirements, and development stories.

## Available Commands

Run `make help` to see all available commands:

```bash
make help      # Display all available commands
make dev       # Start all services in development mode with health verification
make down      # Stop all running services
make logs      # View logs from all services (filter by service, follow, or limit lines)
make status    # Check health status and resource usage of all services
```

### Health Verification

The `make dev` command includes automatic health verification:

- **Timeout**: 2 minutes for all services to become healthy
- **Progress Indicators**: Real-time status updates for each service
- **Success Message**: Displays all service URLs and connection strings when ready
- **Error Handling**: Provides troubleshooting suggestions if services fail
- **Log Viewing**: Offers to display logs for failed services

**Customization** via environment variables:
```bash
# Increase timeout to 5 minutes (useful for slower machines)
HEALTH_CHECK_TIMEOUT=300 make dev

# Automatically show logs on failure (useful for CI/CD)
SHOW_LOGS_ON_FAILURE=true make dev
```

For detailed health verification documentation, see [docs/HEALTH_VERIFICATION.md](docs/HEALTH_VERIFICATION.md).

## Logging

Zero-to-Running implements structured logging across all services for visibility and troubleshooting.

### Viewing Logs

```bash
# View all service logs
make logs

# View logs for specific service
make logs service=backend
make logs service=frontend
make logs service=postgres
make logs service=redis

# Follow logs in real-time
make logs follow=true
make logs service=backend follow=true

# Customize number of lines
make logs lines=200
```

### Log Configuration

Configure logging behavior in your `.env` file:

```bash
# Backend log level: ERROR, WARN, INFO, DEBUG
LOG_LEVEL=INFO

# Backend log format: json (structured), pretty (human-readable)
LOG_FORMAT=pretty

# Frontend log level
VITE_LOG_LEVEL=INFO

# Number of log lines to display
LOG_LINES=100
```

**Log Levels:**
- **ERROR** - Critical errors only
- **WARN** - Warnings and errors
- **INFO** - General information (default)
- **DEBUG** - Detailed debugging (includes database queries)

### Structured Logging

All backend logs are output in structured JSON format with fields:
- `timestamp` - ISO 8601 timestamp
- `level` - Log level (error, warn, info, debug)
- `service` - Service name (backend, frontend, etc.)
- `message` - Human-readable message
- `requestId` - Unique identifier for request tracing

Example log entry:
```json
{
  "timestamp": "2025-11-10T14:30:45.123Z",
  "level": "info",
  "service": "backend",
  "message": "Incoming request",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "path": "/api/users",
  "statusCode": 200,
  "responseTime": 125
}
```

### Request Tracing

Every API request is assigned a unique `requestId` that appears in all related logs. This enables tracing a request through the entire system.

For comprehensive logging documentation, see [docs/LOGGING.md](docs/LOGGING.md).

## Monitoring

Zero-to-Running provides comprehensive monitoring tools to track service health, resource usage, and system status.

### CLI Status Command

Get a quick overview of all services with resource usage and port mappings:

```bash
# View service status
make status
```

**Example output:**

```
Zero-to-Running Service Status

Service      Status       Uptime       CPU      Memory     Ports
--------     ------       ------       ---      ------     -----
frontend     Healthy      5m 32s       0.5%     125MB      3000
backend      Healthy      5m 35s       1.2%     180MB      3001
postgres     Healthy      5m 40s       0.8%     95MB       5432
redis        Healthy      5m 41s       0.3%     42MB       6379

✓ All services are healthy
```

**Status Indicators:**
- **Healthy** (Green) - Service running with health checks passing
- **Unhealthy** (Red) - Service running but health checks failing
- **Stopped** (Yellow) - Service not running
- **Running** (Blue) - Service running (no health check configured)

**Disable color output** (useful for scripting):
```bash
NO_COLOR=1 make status
```

### Web Dashboard

Access the real-time monitoring dashboard for visual health status:

**URL**: `http://localhost:3000/#dashboard`

**Features:**
- Real-time service health indicators for all 4 services
- Auto-refresh every 10 seconds
- Response time metrics (backend API latency)
- Last check timestamp
- Manual refresh button
- Error state handling with troubleshooting tips
- Color-coded status badges (Green=Healthy, Red=Unhealthy, Yellow=Checking)

**Access the dashboard:**

1. Start services: `make dev`
2. Open browser to: `http://localhost:3000`
3. Click **"View Full Monitoring Dashboard"** button

OR navigate directly to: `http://localhost:3000/#dashboard`

**Dashboard displays:**
- Overall system status banner
- Service health cards for Frontend, Backend, Database, and Redis
- Response time in milliseconds
- Timestamp of last health check
- Troubleshooting tips and command reference

### Health Check Endpoint

The backend provides a comprehensive health endpoint for monitoring:

**URL**: `http://localhost:3001/health/dashboard`

**Response format:**
```json
{
  "status": "ready",
  "services": {
    "backend": "ok",
    "database": "ok",
    "cache": "ok"
  },
  "timestamp": "2025-11-10T14:30:45.123Z",
  "responseTime": 45
}
```

**Status values:**
- `ready` - All services healthy
- `degraded` - One or more services unhealthy

**Service status values:**
- `ok` - Service healthy and responding
- `error` - Service unhealthy or unreachable

### Monitoring Tips

**Check status before debugging:**
```bash
# Quick health check
make status

# If services are unhealthy, view logs
make logs service=<service-name>
```

**Monitor during development:**
- Keep the web dashboard open while developing
- Auto-refresh provides real-time status updates
- Response time helps identify performance issues

**Troubleshooting unhealthy services:**
1. Run `make status` to identify which service is unhealthy
2. Run `make logs service=<name>` to view error messages
3. Check network connectivity: `docker network inspect zero-to-running-network`
4. Restart services: `make dev`

For comprehensive monitoring documentation, see [docs/MONITORING.md](docs/MONITORING.md).

## Database Setup

The PostgreSQL database starts automatically with `make dev` and is accessible at `localhost:5432`.

### Connection Information

**Default credentials** (from `.env` file):
- Host: `localhost`
- Port: `5432`
- Database: `zero_to_running_dev`
- User: `postgres`
- Password: `CHANGE_ME_secure_password_123`

**Connection string**:
```
postgresql://postgres:CHANGE_ME_secure_password_123@localhost:5432/zero_to_running_dev
```

### Connecting to the Database

**Using psql (PostgreSQL CLI)**:
```bash
psql postgresql://postgres:CHANGE_ME_secure_password_123@localhost:5432/zero_to_running_dev
```

**Using GUI tools** (DBeaver, pgAdmin, TablePlus):
- Use the connection details above
- Ensure the database container is running: `docker ps | grep postgres`

**From the backend service**:
- Host: `postgres` (Docker service name)
- Port: `5432`
- Use `DATABASE_URL` environment variable

### Database Schema

The database is automatically initialized with:
- User authentication tables (users, sessions, api_keys)
- Audit logging table
- Health check table
- UUID and encryption extensions (uuid-ossp, pgcrypto)

### Data Persistence

Database data persists across container restarts using a Docker volume (`postgres-data`). To reset the database:

```bash
# Stop services
make down

# Remove database volume (WARNING: deletes all data)
docker volume rm zero-to-running-postgres-data

# Restart services (database will reinitialize)
make dev
```

For detailed database documentation, see [infrastructure/database/README.md](infrastructure/database/README.md).

## Cache Setup

The Redis cache starts automatically with `make dev` and is accessible at `localhost:6379`.

### Connection Information

**Default configuration** (from `.env` file):
- Host: `localhost` (or `redis` from within Docker network)
- Port: `6379`
- Password: (none by default)
- Database: `0`

**Connection string**:
```
redis://localhost:6379
```

### Verifying Redis Connectivity

**Using redis-cli**:
```bash
# Test connection
redis-cli -h localhost -p 6379 ping
# Expected output: PONG

# Connect to Redis
redis-cli -h localhost -p 6379
```

**From Docker container**:
```bash
# Execute redis-cli inside the running Redis container
docker compose exec redis redis-cli ping

# Open interactive session
docker compose exec redis redis-cli
```

**From the backend service**:
- Host: `redis` (Docker service name)
- Port: `6379`
- Connection string: `redis://redis:6379`

### Data Persistence

Redis data persists across container restarts using a Docker volume (`redis-data`) with AOF (Append Only File) enabled. To reset the cache:

```bash
# Stop services
make down

# Remove Redis volume (WARNING: deletes all cached data)
docker volume rm zero-to-running-redis-data

# Restart services (Redis will start fresh)
make dev
```

For detailed cache documentation and troubleshooting, see [infrastructure/cache/README.md](infrastructure/cache/README.md).

## Troubleshooting

### Services won't start

**Issue**: `make dev` fails or services don't start

**Solutions**:
1. Verify Docker is running: `docker ps`
2. Check for port conflicts: Ensure ports 3000, 3001, 5432, 6379, 9229 are available
3. Review logs: `docker-compose logs` (from infrastructure/docker directory)
4. Reset environment: `make down` then `make dev`

### Port already in use

**Issue**: Error message about ports 3000, 3001, 5432, or 6379 being in use

**Solutions**:
1. Identify the process: `lsof -i :<port>` (macOS/Linux) or `netstat -ano | findstr :<port>` (Windows)
2. Stop conflicting services or change ports in `.env` file
3. Update port mappings in `docker-compose.yml` if needed

### Database connection issues

**Issue**: Backend cannot connect to PostgreSQL

**Solutions**:
1. Verify database container is running: `docker ps | grep postgres`
2. Check database credentials in `.env` match `docker-compose.yml`
3. Wait for database initialization (can take 10-30 seconds on first run)
4. View database logs: `docker-compose logs postgres`
5. Verify network connectivity: `docker-compose exec backend nc -zv postgres 5432`

### Service communication issues

**Issue**: Services cannot communicate with each other

**Solutions**:
1. Verify all services are on the same network: `docker network inspect zero-to-running-network`
2. Check service names are correct (must match docker-compose.yml)
3. Ensure services are healthy: `docker-compose ps`
4. Test DNS resolution: `docker-compose exec backend ping postgres`
5. Review detailed troubleshooting: [docs/NETWORK_ARCHITECTURE.md](docs/NETWORK_ARCHITECTURE.md#troubleshooting-network-issues)

### Out of memory or disk space

**Issue**: Docker reports insufficient resources

**Solutions**:
1. Increase Docker Desktop memory allocation (Settings > Resources)
2. Clean up unused containers: `docker system prune -a`
3. Remove old volumes: `docker volume prune`
4. Ensure at least 10GB free disk space

### Make command not found

**Issue**: `make: command not found`

**Solutions**:
- **macOS**: Install via Xcode Command Line Tools: `xcode-select --install`
- **Linux**: Install via package manager: `sudo apt-get install build-essential` (Debian/Ubuntu)
- **Windows**: Use WSL2 (Windows Subsystem for Linux)

## Contributing

This project follows standard Git workflow practices:

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes with clear commit messages
3. Test thoroughly: Ensure all services start and health checks pass
4. Submit a pull request with a detailed description

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or contributions:
- Review existing documentation in `/docs`
- Check troubleshooting section above
- Review Docker and service logs
- Open an issue with detailed error messages and environment info

---

**Status**: Active Development

Built with modern development practices for a seamless local development experience.
