# System Architecture

## Table of Contents

- [Overview](#overview)
- [System Architecture Diagram](#system-architecture-diagram)
- [Service Architecture](#service-architecture)
  - [Frontend Service](#frontend-service)
  - [Backend API Service](#backend-api-service)
  - [PostgreSQL Database Service](#postgresql-database-service)
  - [Redis Cache Service](#redis-cache-service)
- [Inter-Service Communication](#inter-service-communication)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Orchestration Flow](#orchestration-flow)
- [Related Documentation](#related-documentation)

---

## Overview

Zero-to-Running is a containerized full-stack development environment orchestrated via Docker Compose. The system consists of four interconnected services that provide a complete development platform going from zero to running in one command.

**Key Architecture Principles**:
- **Containerization**: All services run in isolated Docker containers
- **Service Discovery**: Automatic DNS-based service resolution via Docker networking
- **Health-First Design**: Every service implements health checks for reliability
- **Configuration-Driven**: Environment variables control all configuration
- **Development-Optimized**: Hot-reload and debugging support built-in

**Technology Stack**:
- **Frontend**: React 18 with TypeScript and Tailwind CSS
- **Backend**: Node.js with Dora framework and TypeScript
- **Database**: PostgreSQL 16 (Alpine)
- **Cache**: Redis 7 (Alpine)
- **Orchestration**: Docker Compose v3.9

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Zero-to-Running System                          │
│                     Docker Network: zero-to-running-network             │
└─────────────────────────────────────────────────────────────────────────┘

                          Browser (localhost)
                                  │
                                  │ HTTP (port 3000)
                                  ▼
                    ┌─────────────────────────────┐
                    │   Frontend Service          │
                    │   (React + TypeScript)      │
                    ├─────────────────────────────┤
                    │ • Port: 3000                │
                    │ • Hot Reload: Enabled       │
                    │ • Container: frontend       │
                    │ • Build: Vite               │
                    └───────────┬─────────────────┘
                                │
                                │ REST API calls (http://localhost:3001)
                                ▼
                    ┌─────────────────────────────┐
                    │   Backend API Service       │
                    │   (Node.js + Dora)          │
                    ├─────────────────────────────┤
                    │ • Port: 3001 (API)          │
                    │ • Port: 9229 (Debug)        │
                    │ • Container: backend        │
                    │ • Health: /health endpoints │
                    │ • Logging: Structured JSON  │
                    └────┬──────────────────┬─────┘
                         │                  │
             ┌───────────┘                  └──────────┐
             │                                         │
             │ SQL Queries                   Redis Commands
             │ postgres:5432                 redis:6379
             ▼                                         ▼
    ┌──────────────────────┐                ┌──────────────────────┐
    │ PostgreSQL Database  │                │   Redis Cache        │
    ├──────────────────────┤                ├──────────────────────┤
    │ • Port: 5432         │                │ • Port: 6379         │
    │ • Version: 16-alpine │                │ • Version: 7-alpine  │
    │ • Container: postgres│                │ • Container: redis   │
    │ • Volume: postgres-  │                │ • Volume: redis-data │
    │   data (persistent)  │                │ • Persistence: AOF   │
    │ • Schema: 5 tables   │                │ • Use: Sessions,     │
    │ • Extensions: uuid,  │                │   Caching            │
    │   pgcrypto           │                │                      │
    └──────────────────────┘                └──────────────────────┘

                       All services connected via Docker
                       bridge network with DNS resolution
```

### Service Relationships

```
Startup Order (with health checks):
  1. PostgreSQL → 2. Redis → 3. Backend → 4. Frontend

Dependency Chain:
  Frontend → Backend → PostgreSQL
                    └→ Redis

Communication Flow:
  User → Frontend → Backend → Database (read/write)
                           └→ Cache (read/write)
```

---

## Service Architecture

### Frontend Service

**Purpose**: React-based user interface providing developer interaction and system monitoring.

**Technology Stack**:
- **Framework**: React 18
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Development**: Hot Module Replacement (HMR) enabled

**Key Files and Directory Structure**:
```
frontend/
├── package.json              # Dependencies (react, typescript, tailwind, vite)
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite build configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── src/
│   ├── App.tsx               # Main application component
│   ├── main.tsx              # Entry point
│   ├── config/
│   │   └── api.ts            # API endpoint configuration
│   ├── components/           # React components
│   └── styles/               # CSS and styling
└── public/                   # Static assets
```

**Development Workflow**:
1. Changes to `.tsx` files trigger hot reload
2. No manual rebuild required during development
3. Vite dev server watches for file changes
4. TypeScript compilation happens in real-time

**Backend Connection**:
- **Development**: `http://localhost:3001` (host machine)
- **Environment Variable**: `VITE_API_URL`
- **API Calls**: Frontend makes REST API calls to backend endpoints
- **Note**: Frontend runs in browser (client-side), not in container

**Environment Variables**:
```bash
VITE_API_URL=http://localhost:3001   # Backend API base URL
VITE_LOG_LEVEL=INFO                  # Frontend logging level
FRONTEND_PORT=3000                   # Frontend service port
```

**Container Details**:
- **Image**: Custom (built from `infrastructure/docker/Dockerfile.frontend`)
- **Base**: node:20-alpine
- **Container Name**: `zero-to-running-frontend`
- **Restart Policy**: unless-stopped
- **Network**: zero-to-running-network
- **Volumes**:
  - `./frontend:/app` (source code mount for hot-reload)
  - `/app/node_modules` (anonymous volume to prevent overwriting)

---

### Backend API Service

**Purpose**: Node.js REST API providing business logic and orchestrating database/cache interactions.

**Technology Stack**:
- **Runtime**: Node.js 20
- **Framework**: Dora (Express-based)
- **Language**: TypeScript 5
- **Database Client**: node-postgres (pg)
- **Cache Client**: ioredis
- **Logging**: Custom structured logger

**Key Files and Directory Structure**:
```
backend/
├── package.json              # Dependencies (express, pg, ioredis, typescript)
├── tsconfig.json             # TypeScript configuration
├── src/
│   ├── index.ts              # Application entry point and startup
│   ├── routes/
│   │   └── health.ts         # Health check endpoints
│   ├── middleware/
│   │   └── logging.ts        # Request/response logging middleware
│   ├── config/
│   │   ├── database.ts       # PostgreSQL connection configuration
│   │   ├── redis.ts          # Redis connection configuration
│   │   ├── logger.ts         # Structured logging configuration
│   │   └── env.ts            # Environment variable loading
│   └── utils/
│       ├── logger.ts         # Logger utility
│       └── config-validator.ts  # Configuration validation
└── tests/                    # Test suites
```

**Database Connection**:
- **Host**: `postgres` (Docker service name)
- **Port**: 5432
- **Connection String**: `postgresql://${USER}:${PASSWORD}@postgres:5432/${DATABASE}`
- **Environment Variables**: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`
- **Connection Pooling**: Enabled via pg.Pool
- **Health Check**: `SELECT 1` query on `/health/ready` endpoint

**Redis Connection**:
- **Host**: `redis` (Docker service name)
- **Port**: 6379
- **Connection String**: `redis://redis:6379`
- **Environment Variables**: `REDIS_HOST`, `REDIS_PORT`
- **Client**: ioredis with automatic reconnection
- **Health Check**: `PING` command on `/health/ready` endpoint

**Health Check Endpoints**:
- `GET /health` - Basic health check (always returns 200)
- `GET /health/ready` - Readiness check with database and cache status
- `GET /health/dashboard` - Comprehensive health data for monitoring UI

**Startup Sequence**:
1. Load environment variables from `.env`
2. Validate configuration (required variables, port conflicts, etc.)
3. Connect to PostgreSQL and test connection
4. Connect to Redis and test connection
5. Start Express HTTP server on configured port
6. Register graceful shutdown handlers (SIGTERM, SIGINT)

**Environment Variables**:
```bash
NODE_ENV=development              # Environment (development, production)
PORT=3001                         # Backend API port
DATABASE_HOST=postgres            # PostgreSQL service name
DATABASE_PORT=5432                # PostgreSQL port
DATABASE_NAME=zero_to_running_dev # Database name
DATABASE_USER=postgres            # Database username
DATABASE_PASSWORD=***             # Database password
REDIS_HOST=redis                  # Redis service name
REDIS_PORT=6379                   # Redis port
LOG_LEVEL=INFO                    # Logging level (ERROR, WARN, INFO, DEBUG)
LOG_FORMAT=pretty                 # Log format (pretty, json)
```

**Container Details**:
- **Image**: Custom (built from `infrastructure/docker/Dockerfile.backend`)
- **Base**: node:20-alpine
- **Container Name**: `zero-to-running-backend`
- **Restart Policy**: unless-stopped
- **Network**: zero-to-running-network
- **Depends On**: postgres (healthy), redis (healthy - full profile only)
- **Ports**:
  - 3001 (API)
  - 9229 (Node.js debugger)
- **Volumes**:
  - `./backend:/app` (source code mount for hot-reload)
  - `/app/node_modules` (anonymous volume)

---

### PostgreSQL Database Service

**Purpose**: Primary relational data store for persistent application data.

**Technology Stack**:
- **Version**: PostgreSQL 16-alpine
- **Extensions**: uuid-ossp, pgcrypto
- **Initialization**: Automatic via `init.sql` script

**Key Files and Directory Structure**:
```
infrastructure/database/
├── README.md                  # Database setup documentation
├── init.sql                   # Schema initialization script
├── seeds/                     # Seed data for development
│   └── seed.sql               # Test user and data seeding
└── DATABASE_HEALTH_CHECK.md   # Health check documentation
```

**Schema Overview**:
The database contains 5 tables for user management, authentication, and monitoring:

1. **users** - User accounts and profiles
2. **sessions** - Active user sessions
3. **api_keys** - API key management
4. **audit_logs** - Audit trail for compliance
5. **health_checks** - Service health monitoring records

See [Database Schema](#database-schema) section for detailed schema documentation.

**Data Persistence**:
- **Volume**: `postgres-data` (Docker named volume)
- **Mount Point**: `/var/lib/postgresql/data/pgdata`
- **Persistence**: Data survives container restarts
- **Backup Strategy**: Volume can be backed up via `docker volume` commands

**Initialization Process**:
1. Container starts for first time
2. PostgreSQL creates data directory
3. `init.sql` script runs automatically (via `/docker-entrypoint-initdb.d/`)
4. Extensions are created (uuid-ossp, pgcrypto)
5. Tables are created with indexes
6. Triggers are created for automatic timestamp updates
7. Initial health check record is inserted

**Connection Information**:
- **Internal Address**: `postgres:5432` (from other containers)
- **External Address**: `localhost:5432` (from host machine)
- **Default Database**: `zero_to_running_dev`
- **Default User**: `postgres`

**Environment Variables**:
```bash
POSTGRES_DB=zero_to_running_dev  # Database name
POSTGRES_USER=postgres            # Database superuser
POSTGRES_PASSWORD=***             # Database password
PGDATA=/var/lib/postgresql/data/pgdata  # Data directory
DATABASE_PORT=5432                # External port mapping
```

**Container Details**:
- **Image**: postgres:16-alpine
- **Container Name**: `zero-to-running-postgres`
- **Restart Policy**: unless-stopped
- **Network**: zero-to-running-network
- **Health Check**: `pg_isready` and `SELECT 1` query every 10 seconds
- **Volume**: postgres-data mounted to `/var/lib/postgresql/data`

---

### Redis Cache Service

**Purpose**: In-memory data store for session management, caching, and rate limiting.

**Technology Stack**:
- **Version**: Redis 7-alpine
- **Persistence**: AOF (Append Only File) enabled
- **Command**: `redis-server --appendonly yes`

**Key Configuration**:
- **Persistence Mode**: AOF (Append Only File)
  - Provides durability with minimal performance impact
  - Writes every command to disk
  - Can be replayed to reconstruct dataset
- **Profile**: Full profile only (not included in minimal profile)

**Directory Structure**:
```
# Redis configuration is primarily in docker-compose.yml
# No dedicated directory (standard Redis image used)
```

**Cache Usage Patterns**:
- **Session Storage**: User session tokens and data
- **API Response Caching**: Frequently accessed data
- **Rate Limiting**: Request throttling counters
- **Temporary Data**: Short-lived application state

**TTL (Time To Live) Strategies**:
- **Sessions**: 24 hours (configurable)
- **Cache Entries**: 5-60 minutes (depending on data type)
- **Rate Limit Counters**: 1 minute windows

**Data Persistence**:
- **Volume**: `redis-data` (Docker named volume)
- **Mount Point**: `/data`
- **AOF File**: `appendonly.aof`
- **Persistence**: Data survives container restarts
- **Rebuild**: AOF file can rebuild entire dataset

**Connection Information**:
- **Internal Address**: `redis:6379` (from other containers)
- **External Address**: `localhost:6379` (from host machine)
- **Protocol**: Redis protocol (RESP)
- **Authentication**: None by default (configurable)

**Environment Variables**:
```bash
REDIS_PORT=6379                   # External port mapping
# Redis configuration via command arguments in docker-compose.yml
```

**Container Details**:
- **Image**: redis:7-alpine
- **Container Name**: `zero-to-running-redis`
- **Restart Policy**: unless-stopped
- **Network**: zero-to-running-network
- **Health Check**: `redis-cli ping` every 10 seconds
- **Profile**: full (not started in minimal profile)
- **Volume**: redis-data mounted to `/data`

---

## Inter-Service Communication

All services communicate through Docker's built-in DNS resolution on the custom bridge network `zero-to-running-network`.

### Docker Networking

**Network Configuration**:
```yaml
networks:
  zero-to-running-network:
    name: zero-to-running-network
    driver: bridge
```

**Key Features**:
- **DNS Resolution**: Services resolve by name (e.g., `postgres` → `172.18.0.2`)
- **Network Isolation**: Services can only communicate within the network
- **Automatic Discovery**: No manual IP configuration needed
- **Embedded DNS**: Docker provides DNS server at 127.0.0.11:53

### Service-to-Service Connections

#### Backend → PostgreSQL

**Connection Details**:
```
Backend Service (172.18.0.4)
    ↓
DNS Query: "postgres"
    ↓
Docker DNS (127.0.0.11) returns: 172.18.0.2
    ↓
TCP Connection: 172.18.0.2:5432
    ↓
PostgreSQL Service
```

**Connection String**:
```
postgresql://postgres:${PASSWORD}@postgres:5432/zero_to_running_dev
```

**Configuration** (`backend/src/config/database.ts`):
```typescript
{
  host: 'postgres',      // Service name (DNS resolved)
  port: 5432,
  database: 'zero_to_running_dev',
  user: 'postgres',
  password: process.env.DATABASE_PASSWORD
}
```

#### Backend → Redis

**Connection Details**:
```
Backend Service (172.18.0.4)
    ↓
DNS Query: "redis"
    ↓
Docker DNS returns: 172.18.0.3
    ↓
TCP Connection: 172.18.0.3:6379
    ↓
Redis Service
```

**Connection String**:
```
redis://redis:6379
```

**Configuration** (`backend/src/config/redis.ts`):
```typescript
{
  host: 'redis',         // Service name (DNS resolved)
  port: 6379
}
```

#### Frontend → Backend

**Connection Details**:
```
Browser (Host Machine)
    ↓
HTTP Request: http://localhost:3001/health
    ↓
Docker Port Mapping (3001:3001)
    ↓
Backend Service (172.18.0.4:3001)
```

**Important Note**: Frontend runs in the browser (client-side), not in the Docker container. Therefore, it accesses the backend via `localhost:3001` on the host machine, not via Docker's internal DNS.

**Configuration** (`frontend/src/config/api.ts`):
```typescript
export const API_URL = 'http://localhost:3001';  // Host machine address
```

### Port Mappings

| Service    | Internal Address | External Address   | Protocol | Purpose            |
|------------|-----------------|-------------------|----------|-------------------|
| Frontend   | frontend:3000   | localhost:3000    | HTTP     | Web UI            |
| Backend    | backend:3001    | localhost:3001    | HTTP     | REST API          |
| Backend    | backend:9229    | localhost:9229    | TCP      | Node.js Debugger  |
| PostgreSQL | postgres:5432   | localhost:5432    | TCP      | PostgreSQL        |
| Redis      | redis:6379      | localhost:6379    | TCP      | Redis             |

**Port Mapping Format**: `${EXTERNAL_PORT}:${INTERNAL_PORT}`

**Example**: `3001:3001` means:
- External (host): localhost:3001
- Internal (container): backend:3001

### Startup Dependencies

Services start in order based on health check dependencies:

```
1. PostgreSQL starts
   ↓
   Health check passes (pg_isready + SELECT 1)
   ↓
2. Redis starts (full profile only)
   ↓
   Health check passes (PING)
   ↓
3. Backend starts
   ↓
   Connects to PostgreSQL
   ↓
   Connects to Redis (if available)
   ↓
   Health check passes (GET /health)
   ↓
4. Frontend starts
   ↓
   Can call backend API
   ↓
   Health check passes (HTTP 200 on port 3000)
```

**Docker Compose Configuration**:
```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy  # Full profile only

frontend:
  depends_on:
    backend:
      condition: service_healthy
```

For detailed network architecture and troubleshooting, see [NETWORK_ARCHITECTURE.md](NETWORK_ARCHITECTURE.md).

---

## Database Schema

The PostgreSQL database uses a normalized schema with 5 tables designed for user management, authentication, auditing, and monitoring.

### Entity Relationship Diagram

```
┌─────────────────────────────┐
│         users               │
│─────────────────────────────│
│ id (PK, UUID)               │
│ email (UNIQUE)              │
│ username (UNIQUE)           │
│ password_hash               │
│ first_name                  │
│ last_name                   │
│ is_active                   │
│ is_verified                 │
│ created_at                  │
│ updated_at                  │
│ last_login_at               │
└────────┬────────────────────┘
         │
         │ 1:N
         ├────────────────────────────┐
         │                            │
         │                            │
┌────────▼────────────────┐  ┌────────▼────────────────┐
│      sessions           │  │      api_keys           │
│─────────────────────────│  │─────────────────────────│
│ id (PK, UUID)           │  │ id (PK, UUID)           │
│ user_id (FK → users.id) │  │ user_id (FK → users.id) │
│ token (UNIQUE)          │  │ key_hash (UNIQUE)       │
│ ip_address              │  │ name                    │
│ user_agent              │  │ description             │
│ expires_at              │  │ is_active               │
│ created_at              │  │ last_used_at            │
└─────────────────────────┘  │ expires_at              │
                             │ created_at              │
                             │ updated_at              │
                             └─────────────────────────┘

┌─────────────────────────────┐
│      audit_logs             │
│─────────────────────────────│
│ id (PK, UUID)               │
│ user_id (FK → users.id)     │  (nullable, SET NULL on delete)
│ action                      │
│ entity_type                 │
│ entity_id                   │
│ changes (JSONB)             │
│ ip_address                  │
│ user_agent                  │
│ created_at                  │
└─────────────────────────────┘

┌─────────────────────────────┐
│      health_checks          │
│─────────────────────────────│
│ id (PK, UUID)               │
│ service_name                │
│ status                      │
│ message                     │
│ checked_at                  │
└─────────────────────────────┘
```

### Table Schemas

#### users

**Purpose**: Core user account data

| Column         | Type                  | Constraints           | Description                    |
|---------------|----------------------|----------------------|-------------------------------|
| id            | UUID                 | PRIMARY KEY          | Unique user identifier         |
| email         | VARCHAR(255)         | UNIQUE, NOT NULL     | User email address             |
| username      | VARCHAR(100)         | UNIQUE, NOT NULL     | Username for login             |
| password_hash | VARCHAR(255)         | NOT NULL             | Bcrypt password hash           |
| first_name    | VARCHAR(100)         |                      | User's first name              |
| last_name     | VARCHAR(100)         |                      | User's last name               |
| is_active     | BOOLEAN              | DEFAULT true         | Account active status          |
| is_verified   | BOOLEAN              | DEFAULT false        | Email verification status      |
| created_at    | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Account creation time   |
| updated_at    | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Last update time        |
| last_login_at | TIMESTAMP WITH TIME ZONE |                      | Last login timestamp           |

**Indexes**:
- `idx_users_email` on `email`
- `idx_users_username` on `username`
- `idx_users_created_at` on `created_at DESC`

**Triggers**:
- `update_users_updated_at` - Automatically updates `updated_at` on row changes

---

#### sessions

**Purpose**: Active user session tracking

| Column     | Type                  | Constraints           | Description                    |
|-----------|----------------------|----------------------|-------------------------------|
| id        | UUID                 | PRIMARY KEY          | Unique session identifier      |
| user_id   | UUID                 | FOREIGN KEY, NOT NULL | References users.id           |
| token     | VARCHAR(255)         | UNIQUE, NOT NULL     | Session token                  |
| ip_address| INET                 |                      | Client IP address              |
| user_agent| TEXT                 |                      | Client user agent string       |
| expires_at| TIMESTAMP WITH TIME ZONE | NOT NULL         | Session expiration time        |
| created_at| TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Session creation time   |

**Indexes**:
- `idx_sessions_token` on `token`
- `idx_sessions_user_id` on `user_id`
- `idx_sessions_expires_at` on `expires_at`

**Foreign Keys**:
- `user_id` → `users.id` (ON DELETE CASCADE)

---

#### api_keys

**Purpose**: API key management for programmatic access

| Column       | Type                  | Constraints           | Description                    |
|-------------|----------------------|----------------------|-------------------------------|
| id          | UUID                 | PRIMARY KEY          | Unique API key identifier      |
| user_id     | UUID                 | FOREIGN KEY, NOT NULL | References users.id           |
| key_hash    | VARCHAR(255)         | UNIQUE, NOT NULL     | Hashed API key                 |
| name        | VARCHAR(100)         | NOT NULL             | Friendly name for key          |
| description | TEXT                 |                      | Key purpose description        |
| is_active   | BOOLEAN              | DEFAULT true         | Key active status              |
| last_used_at| TIMESTAMP WITH TIME ZONE |                  | Last usage timestamp           |
| expires_at  | TIMESTAMP WITH TIME ZONE |                  | Key expiration time            |
| created_at  | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Key creation time       |
| updated_at  | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Last update time        |

**Indexes**:
- `idx_api_keys_key_hash` on `key_hash`
- `idx_api_keys_user_id` on `user_id`

**Foreign Keys**:
- `user_id` → `users.id` (ON DELETE CASCADE)

**Triggers**:
- `update_api_keys_updated_at` - Automatically updates `updated_at` on row changes

---

#### audit_logs

**Purpose**: Audit trail for compliance and security

| Column      | Type                  | Constraints           | Description                    |
|-----------|----------------------|----------------------|-------------------------------|
| id        | UUID                 | PRIMARY KEY          | Unique log entry identifier    |
| user_id   | UUID                 | FOREIGN KEY (nullable)| References users.id           |
| action    | VARCHAR(100)         | NOT NULL             | Action performed (CREATE, UPDATE, DELETE) |
| entity_type | VARCHAR(100)       | NOT NULL             | Type of entity affected        |
| entity_id | UUID                 |                      | ID of affected entity          |
| changes   | JSONB                |                      | JSON of changes made           |
| ip_address| INET                 |                      | Client IP address              |
| user_agent| TEXT                 |                      | Client user agent              |
| created_at| TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Log entry time          |

**Indexes**:
- `idx_audit_logs_user_id` on `user_id`
- `idx_audit_logs_entity_type` on `entity_type`
- `idx_audit_logs_entity_id` on `entity_id`
- `idx_audit_logs_created_at` on `created_at DESC`
- `idx_audit_logs_action` on `action`

**Foreign Keys**:
- `user_id` → `users.id` (ON DELETE SET NULL) - Preserves audit logs even if user deleted

---

#### health_checks

**Purpose**: Service health monitoring records

| Column       | Type                  | Constraints           | Description                    |
|-------------|----------------------|----------------------|-------------------------------|
| id          | UUID                 | PRIMARY KEY          | Unique health check identifier |
| service_name| VARCHAR(100)         | NOT NULL             | Name of service checked        |
| status      | VARCHAR(50)          | NOT NULL             | Health status (healthy, unhealthy) |
| message     | TEXT                 |                      | Status message or error        |
| checked_at  | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Check timestamp         |

**Indexes**:
- `idx_health_checks_checked_at` on `checked_at DESC`
- `idx_health_checks_service_name` on `service_name`

---

### Database Extensions

**uuid-ossp**: Provides UUID generation functions
- Used for primary key generation: `uuid_generate_v4()`

**pgcrypto**: Cryptographic functions
- Used for password hashing and encryption

### Typical Query Patterns

**User Authentication**:
```sql
SELECT id, email, username, password_hash, is_active, is_verified
FROM users
WHERE email = $1;
```

**Session Validation**:
```sql
SELECT s.id, s.user_id, s.expires_at, u.email, u.is_active
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.token = $1 AND s.expires_at > NOW();
```

**Audit Trail Retrieval**:
```sql
SELECT * FROM audit_logs
WHERE entity_type = $1 AND entity_id = $2
ORDER BY created_at DESC
LIMIT 50;
```

**Health Monitoring**:
```sql
SELECT service_name, status, message, checked_at
FROM health_checks
WHERE checked_at > NOW() - INTERVAL '1 hour'
ORDER BY checked_at DESC;
```

For database seeding and test data, see [DATABASE_SEEDING.md](DATABASE_SEEDING.md).

---

## API Reference

The backend provides RESTful API endpoints for health monitoring and system status.

### Base URL

**Development**: `http://localhost:3001`
**Container (internal)**: `http://backend:3001`

### Endpoints

#### GET /health

**Purpose**: Basic health check endpoint

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-11T02:00:00.000Z"
}
```

**Status Codes**:
- `200 OK` - Service is running

**Example**:
```bash
curl http://localhost:3001/health
```

---

#### GET /health/ready

**Purpose**: Readiness check with dependency health verification

**Response (Healthy)**:
```json
{
  "status": "ready",
  "timestamp": "2025-11-11T02:00:00.000Z",
  "database": "ok",
  "cache": "ok"
}
```

**Response (Unhealthy)**:
```json
{
  "status": "unavailable",
  "timestamp": "2025-11-11T02:00:00.000Z",
  "database": "error",
  "cache": "ok",
  "errors": {
    "database": "Connection refused"
  }
}
```

**Status Codes**:
- `200 OK` - All dependencies healthy
- `503 Service Unavailable` - One or more dependencies unhealthy

**Health Check Details**:
- **Timeout**: 1 second for all checks
- **Database Check**: Executes `SELECT 1` query
- **Cache Check**: Executes Redis `PING` command
- **Parallel Execution**: Both checks run simultaneously

**Example**:
```bash
curl http://localhost:3001/health/ready
```

---

#### GET /health/dashboard

**Purpose**: Comprehensive health information for monitoring dashboard

**Response (Healthy)**:
```json
{
  "status": "ready",
  "services": {
    "backend": "ok",
    "database": "ok",
    "cache": "ok"
  },
  "timestamp": "2025-11-11T02:00:00.000Z",
  "responseTime": 45
}
```

**Response (Degraded)**:
```json
{
  "status": "degraded",
  "services": {
    "backend": "ok",
    "database": "error",
    "cache": "ok"
  },
  "timestamp": "2025-11-11T02:00:00.000Z",
  "responseTime": 1002,
  "errors": {
    "database": "Connection timeout"
  }
}
```

**Status Codes**:
- `200 OK` - Always returns 200 (even if degraded) to allow frontend to display status

**Response Fields**:
- `status`: Overall system status (`ready` or `degraded`)
- `services`: Individual service health status
  - `backend`: Always `ok` if responding
  - `database`: PostgreSQL connection status
  - `cache`: Redis connection status
- `timestamp`: ISO 8601 timestamp
- `responseTime`: Total check duration in milliseconds
- `errors`: (Optional) Error messages for failed checks

**Example**:
```bash
curl http://localhost:3001/health/dashboard
```

---

### Authentication

**Current Implementation**: None (health endpoints are public)

**Future Implementation**: API endpoints for user management will require authentication via:
- Session tokens (stored in Redis)
- API keys (stored in database)
- JWT tokens (optional)

### Common Error Responses

**404 Not Found**:
```json
{
  "error": "Not Found",
  "message": "The requested resource was not found"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

All responses include structured logging with `requestId` for tracing.

For comprehensive API testing examples, see the Postman collection in `docs/examples/`.

---

## Orchestration Flow

The system startup is orchestrated via Docker Compose with health-based dependencies ensuring proper initialization order.

### High-Level Startup Flow

```
1. Environment Loading
   ↓
2. Docker Network Creation
   ↓
3. Service Startup (dependency order)
   ↓
4. Health Verification
   ↓
5. System Ready
```

### Detailed Startup Sequence

```
STEP 1: Environment Variable Loading
├─ Load .env file
├─ Validate required variables exist
├─ Check for port conflicts
└─ Display configuration summary

STEP 2: Docker Network Creation
├─ Create zero-to-running-network (bridge)
└─ Enable DNS resolution

STEP 3: PostgreSQL Startup
├─ Pull postgres:16-alpine image (if needed)
├─ Create postgres-data volume
├─ Start container
├─ Run init.sql script
│  ├─ Create extensions (uuid-ossp, pgcrypto)
│  ├─ Create 5 tables with indexes
│  ├─ Create triggers
│  └─ Insert initial health check record
└─ Health check passes (pg_isready + SELECT 1)
   ⏱️  Typical time: 10-30 seconds

STEP 4: Redis Startup (Full Profile Only)
├─ Pull redis:7-alpine image (if needed)
├─ Create redis-data volume
├─ Start container with AOF persistence
└─ Health check passes (redis-cli PING)
   ⏱️  Typical time: 5-10 seconds

STEP 5: Backend Startup
├─ Build backend image (if needed)
│  ├─ Install dependencies (npm install)
│  └─ Compile TypeScript
├─ Start container
├─ Backend application initialization:
│  ├─ Load environment variables
│  ├─ Validate configuration
│  ├─ Connect to PostgreSQL (test with SELECT NOW())
│  ├─ Connect to Redis (test with PING)
│  └─ Start Express server on port 3001
└─ Health check passes (GET /health)
   ⏱️  Typical time: 30-60 seconds (first build: 2-5 minutes)

STEP 6: Frontend Startup (Full Profile Only)
├─ Build frontend image (if needed)
│  ├─ Install dependencies (npm install)
│  └─ Start Vite dev server
├─ Start container
└─ Health check passes (HTTP 200 on port 3000)
   ⏱️  Typical time: 30-60 seconds (first build: 2-5 minutes)

STEP 7: Health Verification
├─ Verify all services report healthy
├─ Display success message with URLs
└─ System ready for development
   ⏱️  Total typical time: 60-90 seconds (first run: 3-8 minutes)
```

### Data Flow: User Request Example

**Example**: User accesses monitoring dashboard

```
1. User opens browser
   ↓
   GET http://localhost:3000
   ↓
2. Frontend container serves React app
   ↓
3. React app loads and makes API call
   ↓
   GET http://localhost:3001/health/dashboard
   ↓
4. Backend receives request
   ├─ Request logging middleware generates requestId
   ├─ Query PostgreSQL: SELECT 1
   ├─ Query Redis: PING
   └─ Aggregate health status
   ↓
5. Backend returns JSON response
   ↓
6. Frontend displays health dashboard
   ↓
   Auto-refresh every 10 seconds (repeat steps 3-6)
```

### Service Communication During Operation

**Normal Operation**:
```
Frontend (Browser)
  └─ API calls every 10s → Backend
                              ├─ Database queries → PostgreSQL
                              └─ Cache operations → Redis
```

**Health Check Flow**:
```
Docker Health Check (every 10s)
  ├─ PostgreSQL: pg_isready + SELECT 1
  ├─ Redis: redis-cli PING
  ├─ Backend: wget http://localhost:3001/health
  └─ Frontend: wget http://localhost:3000
```

### Teardown Process

**Command**: `make down`

```
1. Stop accepting new requests
   ↓
2. Graceful shutdown signals (SIGTERM)
   ├─ Backend closes database connections
   ├─ Backend closes Redis connections
   └─ Backend stops HTTP server
   ↓
3. Stop containers (in reverse dependency order)
   ├─ Frontend stops
   ├─ Backend stops
   ├─ Redis stops
   └─ PostgreSQL stops
   ↓
4. Network remains (unless removed with --volumes)
5. Volumes remain (data persists)
   ⏱️  Typical time: 5-10 seconds
```

For detailed orchestration documentation, see [HOW_IT_WORKS.md](HOW_IT_WORKS.md).

---

## Related Documentation

### Configuration and Setup
- [README.md](../README.md) - Project overview and quick start guide
- [CONFIGURATION.md](CONFIGURATION.md) - Environment variables and configuration options
- [SECRET_MANAGEMENT.md](SECRET_MANAGEMENT.md) - Secret handling and production deployment
- [PROFILES.md](PROFILES.md) - Development profile configurations (minimal vs full)

### Networking and Communication
- [NETWORK_ARCHITECTURE.md](NETWORK_ARCHITECTURE.md) - Detailed Docker networking and service discovery
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) - Complete orchestration flow documentation

### Services and Features
- [LOGGING.md](LOGGING.md) - Structured logging implementation
- [MONITORING.md](MONITORING.md) - Health checks and monitoring dashboard
- [HEALTH_VERIFICATION.md](HEALTH_VERIFICATION.md) - Health check implementation details
- [DATABASE_SEEDING.md](DATABASE_SEEDING.md) - Database seeding and test data

### Development Resources
- [infrastructure/database/README.md](../infrastructure/database/README.md) - Database setup and management
- [docs/prd.md](prd.md) - Product requirements and feature specifications
- [docs/orchestration-flow.md](orchestration-flow.md) - Epic and story tracking

---

## Quick Reference

### Service Overview

| Service    | Port | URL                         | Purpose                    |
|-----------|------|----------------------------|----------------------------|
| Frontend  | 3000 | http://localhost:3000      | React web application      |
| Backend   | 3001 | http://localhost:3001      | REST API                   |
| Backend   | 9229 | localhost:9229             | Node.js debugger           |
| PostgreSQL| 5432 | localhost:5432             | Database                   |
| Redis     | 6379 | localhost:6379             | Cache                      |

### Health Check URLs

- Basic: http://localhost:3001/health
- Ready: http://localhost:3001/health/ready
- Dashboard: http://localhost:3001/health/dashboard
- Frontend: http://localhost:3000

### Key Commands

```bash
# Start all services
make dev

# Check service status
make status

# View logs
make logs

# Stop all services
make down

# Seed database
make seed

# Reset database
make reset-db seed=true
```

### Docker Service Names (Internal DNS)

- Frontend: `frontend`
- Backend: `backend`
- PostgreSQL: `postgres`
- Redis: `redis`
- Network: `zero-to-running-network`

---

**Last Updated**: 2025-11-11
**Architecture Version**: 1.0
**Target Audience**: Developers, DevOps Engineers, Technical Stakeholders
