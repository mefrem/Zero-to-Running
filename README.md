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

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

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
make dev       # Start all services in development mode
make down      # Stop all running services
make logs      # View logs from all services (coming soon)
make status    # Check health status of all services (coming soon)
```

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
