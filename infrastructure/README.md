# Infrastructure

Infrastructure, orchestration, and deployment configurations for Zero-to-Running.

## Overview

This directory contains all infrastructure-related files including:
- Docker configurations and Dockerfiles
- Docker Compose orchestration
- Database initialization and migrations
- Utility scripts for automation

## Directory Structure

```
infrastructure/
├── docker/                      # Docker and container configurations
│   ├── docker-compose.yml       # Main service orchestration (Story 1.2)
│   ├── Dockerfile.frontend      # Frontend container image (Story 1.5)
│   ├── Dockerfile.backend       # Backend container image (Story 1.4)
│   └── .dockerignore            # Docker build exclusions
│
├── database/                    # Database setup and management
│   ├── init.sql                 # Database initialization script (Story 1.2)
│   ├── migrations/              # Schema migration files
│   │   └── (migration files)    # Versioned schema changes
│   └── seeds/                   # Seed data for development
│       └── (seed scripts)       # Sample data scripts (Story 3.5)
│
└── scripts/                     # Automation and utility scripts
    ├── startup.sh               # Orchestration startup script (Story 1.6)
    ├── health-check.sh          # Service health validation (Story 2.3)
    ├── cleanup.sh               # Cleanup utility
    └── (additional scripts)     # Other automation scripts
```

## Docker Configuration

### docker-compose.yml

Orchestrates the following services:
- **frontend**: React application (port 3000)
- **backend**: Node.js API server (port 3001, debug 9229)
- **db**: PostgreSQL database (port 5432)
- **cache**: Redis cache (port 6379)

All services are networked together and can communicate via service names.

### Dockerfiles

Each service has its own Dockerfile:
- `Dockerfile.frontend` - Multi-stage build for React app
- `Dockerfile.backend` - Node.js runtime with TypeScript compilation

## Database Management

### Initialization

`database/init.sql` sets up:
- Database schema
- Initial tables
- Indexes and constraints
- Default data

### Migrations

Schema changes are managed through versioned migration files in `database/migrations/`:
- Numbered sequentially (e.g., `001_initial_schema.sql`)
- Applied in order during database initialization
- Tracked to prevent re-application

### Seeds

Development seed data in `database/seeds/`:
- Sample users
- Test data
- Demo content
- Development-only data (not used in production)

## Utility Scripts

### startup.sh

Master orchestration script that:
1. Validates environment configuration
2. Starts Docker Compose services
3. Waits for service health checks
4. Displays service status and URLs
5. Handles startup errors gracefully

### health-check.sh

Validates that all services are healthy:
- Checks Docker container status
- Verifies network connectivity
- Tests service endpoints
- Reports detailed health status

### cleanup.sh

Cleanup utility for development:
- Stops all containers
- Removes volumes (with confirmation)
- Cleans up orphaned containers
- Prunes unused images

## Usage

Infrastructure is managed through Make commands:

```bash
# Start all services
make dev

# Stop all services
make down

# View logs
make logs

# Check service status
make status

# Clean up everything
make clean
```

## Status

**Implementation Status**: Directory structure created in Story 1.1

Infrastructure components will be implemented across multiple stories:
- Story 1.2: Docker Compose and database initialization
- Story 1.4: Backend Dockerfile
- Story 1.5: Frontend Dockerfile
- Story 1.6: Startup orchestration script
- Story 2.3: Health check script
