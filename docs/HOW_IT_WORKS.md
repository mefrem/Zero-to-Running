# How It Works: System Orchestration

## Table of Contents

- [Overview](#overview)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Startup Orchestration](#startup-orchestration)
- [Service Initialization Details](#service-initialization-details)
- [Inter-Service Communication](#inter-service-communication)
- [Health Check Verification](#health-check-verification)
- [Normal Operation Flow](#normal-operation-flow)
- [Data Flow Examples](#data-flow-examples)
- [Shutdown and Cleanup](#shutdown-and-cleanup)
- [Timing and Performance](#timing-and-performance)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## Overview

Zero-to-Running orchestrates four containerized services using Docker Compose to provide a complete development environment. This document explains exactly how the system starts, operates, and shuts down, with timing details and troubleshooting guidance.

**Key Orchestration Features**:
- **Single Command Startup**: `make dev` starts everything with one command
- **Dependency Management**: Services start in the correct order automatically
- **Health-Based Sequencing**: Each service waits for dependencies to be healthy
- **Automatic Verification**: Built-in health checks confirm system readiness
- **Graceful Shutdown**: Clean teardown with proper connection closure

**Orchestration Components**:
- **Makefile**: Entry point for developer commands
- **Docker Compose**: Service orchestration and networking
- **Health Checks**: Service readiness verification
- **Startup Scripts**: Environment validation and initialization
- **Shutdown Handlers**: Graceful termination logic

---

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────┐
│                    Orchestration Flow                            │
└──────────────────────────────────────────────────────────────────┘

User runs: make dev
      ↓
   Makefile
      ↓
   ┌─────────────────────────────────────┐
   │  Startup Script                     │
   │  1. Check Docker daemon             │
   │  2. Validate .env configuration     │
   │  3. Check port availability         │
   │  4. Determine profile (full/minimal)│
   └─────────────┬───────────────────────┘
                 ↓
   ┌─────────────────────────────────────┐
   │  Docker Compose                     │
   │  1. Create network                  │
   │  2. Create volumes                  │
   │  3. Start services (ordered)        │
   └─────────────┬───────────────────────┘
                 ↓
   ┌─────────────────────────────────────┐
   │  Service Dependency Chain           │
   │                                     │
   │  PostgreSQL → Health Check          │
   │       ↓                             │
   │  Redis → Health Check               │
   │       ↓                             │
   │  Backend → Health Check             │
   │       ↓                             │
   │  Frontend → Health Check            │
   └─────────────┬───────────────────────┘
                 ↓
   ┌─────────────────────────────────────┐
   │  Health Verification Script         │
   │  1. Poll each service health        │
   │  2. Timeout after 2 minutes         │
   │  3. Display success or failure      │
   └─────────────┬───────────────────────┘
                 ↓
   ┌─────────────────────────────────────┐
   │  System Ready                       │
   │  • All services healthy             │
   │  • URLs and connection strings shown│
   │  • Ready for development            │
   └─────────────────────────────────────┘
```

---

## Startup Orchestration

### Phase 1: Pre-Flight Checks

**Command**: `make dev`

**What Happens**:

```bash
1. Check Docker Daemon
   ├─ Verify Docker is running: docker info
   ├─ If not running: Display error and exit
   └─ ✓ Docker daemon is running

2. Check Docker Compose Installation
   ├─ Verify Docker Compose is available: docker-compose --version
   ├─ Require version 1.27.0 or higher
   └─ ✓ Docker Compose installed: Docker Compose version v2.20.0

3. Validate Environment Configuration
   ├─ Check .env file exists
   ├─ Validate required variables:
   │  ├─ DATABASE_PASSWORD (must not be empty)
   │  ├─ SESSION_SECRET (must not be empty)
   │  └─ All port variables (must be valid integers)
   ├─ Detect mock secrets (CHANGE_ME_ prefix)
   ├─ Display warning if mock secrets detected
   └─ ✓ Environment configuration valid

4. Check Port Availability
   ├─ Test ports: 3000, 3001, 5432, 6379, 9229
   ├─ Check if any are already in use
   ├─ If conflicts found: Display error and exit
   └─ ✓ No port conflicts detected

5. Determine Profile
   ├─ Check PROFILE environment variable
   ├─ Default: full
   ├─ Options: minimal (backend + database only), full (all services)
   └─ Profile: full
```

**Typical Time**: 2-5 seconds

**Success Output**:
```
=====================================
  Zero-to-Running Development
=====================================
  Profile: full
=====================================

✓ Docker daemon is running
✓ Docker Compose installed: Docker Compose version v2.20.0
✓ Environment configuration valid
✓ No port conflicts detected
```

---

### Phase 2: Network and Volume Creation

**What Happens**:

```bash
1. Create Docker Network
   ├─ Network name: zero-to-running-network
   ├─ Driver: bridge
   ├─ Enable DNS resolution
   └─ ✓ Network created

2. Create Volumes
   ├─ postgres-data (for PostgreSQL data persistence)
   └─ redis-data (for Redis data persistence)
```

**Docker Commands**:
```bash
docker network create zero-to-running-network
docker volume create zero-to-running-postgres-data
docker volume create zero-to-running-redis-data
```

**Typical Time**: 1-2 seconds

---

### Phase 3: Service Startup (Dependency Order)

**What Happens**:

Docker Compose starts services in dependency order based on `depends_on` with health conditions.

#### Step 1: PostgreSQL Starts

```
Container: zero-to-running-postgres
Image: postgres:16-alpine
Status: Starting...

1. Docker pulls image (if not cached)
   ⏱️  First time: 30-60 seconds
   ⏱️  Cached: <1 second

2. Container starts
   ├─ Mount init.sql script
   ├─ Mount postgres-data volume
   └─ Run PostgreSQL server

3. Database Initialization (First Run Only)
   ├─ Create data directory
   ├─ Initialize PostgreSQL cluster
   ├─ Run init.sql script:
   │  ├─ CREATE EXTENSION uuid-ossp
   │  ├─ CREATE EXTENSION pgcrypto
   │  ├─ CREATE TABLE users
   │  ├─ CREATE TABLE sessions
   │  ├─ CREATE TABLE api_keys
   │  ├─ CREATE TABLE audit_logs
   │  ├─ CREATE TABLE health_checks
   │  ├─ CREATE INDEXES (10 indexes)
   │  ├─ CREATE TRIGGERS (2 triggers)
   │  └─ INSERT initial health check record
   └─ Database ready

4. Health Check Execution
   ├─ Every 10 seconds
   ├─ Command: pg_isready -U postgres -d zero_to_running_dev
   ├─ Command: psql -U postgres -d zero_to_running_dev -c 'SELECT 1'
   ├─ Retry up to 5 times
   ├─ Start period: 10 seconds (grace period)
   └─ ✓ Health check passes

Status: Healthy ✓
```

**Typical Time**: 10-30 seconds (first run), 5-10 seconds (subsequent)

---

#### Step 2: Redis Starts (Full Profile Only)

```
Container: zero-to-running-redis
Image: redis:7-alpine
Status: Starting... (waits for PostgreSQL to be healthy)

1. Docker pulls image (if not cached)
   ⏱️  First time: 20-30 seconds
   ⏱️  Cached: <1 second

2. Container starts
   ├─ Command: redis-server --appendonly yes
   ├─ Mount redis-data volume
   ├─ Enable AOF persistence
   └─ Redis server ready

3. Health Check Execution
   ├─ Every 10 seconds
   ├─ Command: redis-cli ping
   ├─ Expected response: PONG
   ├─ Retry up to 5 times
   ├─ Start period: 5 seconds (grace period)
   └─ ✓ Health check passes

Status: Healthy ✓
```

**Typical Time**: 5-10 seconds

**Note**: In minimal profile, Redis is skipped

---

#### Step 3: Backend Starts

```
Container: zero-to-running-backend
Image: Custom (built from infrastructure/docker/Dockerfile.backend)
Status: Starting... (waits for PostgreSQL and Redis to be healthy)

1. Build Docker Image (if not cached)
   ├─ Base image: node:20-alpine
   ├─ COPY package.json and package-lock.json
   ├─ RUN npm install (install dependencies)
   ├─ COPY source code
   ├─ RUN npm run build (compile TypeScript)
   └─ Image built
   ⏱️  First time: 2-5 minutes
   ⏱️  Cached: <5 seconds

2. Container starts
   ├─ Mount backend source code (for hot-reload)
   ├─ Set environment variables
   └─ Run: npm run dev

3. Backend Application Initialization
   ├─ Load environment variables from .env
   ├─ Validate configuration:
   │  ├─ Check required variables exist
   │  ├─ Validate port numbers
   │  ├─ Check log levels
   │  └─ Detect mock secrets
   ├─ Display configuration summary
   ├─ Log: "Starting application"
   │
   ├─ Connect to PostgreSQL:
   │  ├─ Connection string: postgresql://postgres:***@postgres:5432/zero_to_running_dev
   │  ├─ Create connection pool
   │  ├─ Test connection: SELECT NOW(), version()
   │  └─ Log: "Database connection successful"
   │
   ├─ Connect to Redis:
   │  ├─ Connection string: redis://redis:6379
   │  ├─ Create Redis client
   │  ├─ Test connection: PING command
   │  └─ Log: "Redis client ready"
   │
   ├─ Start Express HTTP server:
   │  ├─ Listen on port 3001
   │  ├─ Register routes: /health, /health/ready, /health/dashboard
   │  ├─ Register middleware: logging, error handling
   │  └─ Log: "Application started successfully"
   │
   └─ Register shutdown handlers (SIGTERM, SIGINT)

4. Health Check Execution
   ├─ Every 10 seconds
   ├─ Command: wget --quiet --tries=1 --spider http://localhost:3001/health
   ├─ Expected: HTTP 200
   ├─ Retry up to 5 times
   ├─ Start period: 30 seconds (grace period for startup)
   └─ ✓ Health check passes

Status: Healthy ✓
```

**Typical Time**: 30-60 seconds (first run: 2-5 minutes)

**Backend Logs**:
```json
{"timestamp":"2025-11-11T02:00:00.000Z","level":"info","msg":"Starting application","environment":"development","port":3001}
{"timestamp":"2025-11-11T02:00:01.000Z","level":"info","msg":"Connecting to database"}
{"timestamp":"2025-11-11T02:00:02.000Z","level":"info","msg":"Database connection successful"}
{"timestamp":"2025-11-11T02:00:03.000Z","level":"info","msg":"Connecting to Redis"}
{"timestamp":"2025-11-11T02:00:04.000Z","level":"info","msg":"Redis client ready"}
{"timestamp":"2025-11-11T02:00:05.000Z","level":"info","msg":"Application started successfully","port":3001,"healthEndpoint":"http://localhost:3001/health"}
```

---

#### Step 4: Frontend Starts (Full Profile Only)

```
Container: zero-to-running-frontend
Image: Custom (built from infrastructure/docker/Dockerfile.frontend)
Status: Starting... (waits for Backend to be healthy)

1. Build Docker Image (if not cached)
   ├─ Base image: node:20-alpine
   ├─ COPY package.json and package-lock.json
   ├─ RUN npm install (install dependencies)
   ├─ COPY source code
   └─ Image built
   ⏱️  First time: 2-5 minutes
   ⏱️  Cached: <5 seconds

2. Container starts
   ├─ Mount frontend source code (for hot-reload)
   ├─ Set environment variables
   └─ Run: npm run dev (Vite dev server)

3. Vite Dev Server Initialization
   ├─ Load environment variables
   ├─ Start Vite dev server on port 3000
   ├─ Enable hot module replacement (HMR)
   ├─ Compile React components
   └─ Server ready

4. Health Check Execution
   ├─ Every 10 seconds
   ├─ Command: wget --quiet --tries=1 --spider http://localhost:3000
   ├─ Expected: HTTP 200
   ├─ Retry up to 5 times
   ├─ Start period: 30 seconds (grace period)
   └─ ✓ Health check passes

Status: Healthy ✓
```

**Typical Time**: 30-60 seconds (first run: 2-5 minutes)

**Note**: In minimal profile, Frontend is skipped

---

### Phase 4: Health Verification

**What Happens**:

After all services start, a verification script polls each service to confirm health.

```
Verifying services are healthy (profile: full)...

  Database:    Checking... ⏳
  Database:    Healthy ✓

  Cache:       Checking... ⏳
  Cache:       Healthy ✓

  Backend:     Checking... ⏳
  Backend:     Healthy ✓

  Frontend:    Checking... ⏳
  Frontend:    Healthy ✓

✓ All services in profile are healthy
```

**Verification Commands**:
```bash
# PostgreSQL
docker-compose exec -T postgres pg_isready -U postgres -d zero_to_running_dev

# Redis
docker-compose exec -T redis redis-cli ping

# Backend
curl -f http://localhost:3001/health

# Frontend
curl -f http://localhost:3000
```

**Timeout**: 2 minutes (configurable via `HEALTH_CHECK_TIMEOUT` env var)

**Retry Strategy**:
- Poll every 5 seconds
- Maximum 24 attempts (2 minutes)
- Display progress for each service

**Typical Time**: 5-15 seconds (services usually healthy immediately after startup)

---

### Phase 5: Success Message

**What Happens**:

Once all services are healthy, the system displays success message with access URLs.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS! Environment ready for development.
Profile: full
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Service Access:

Frontend:   http://localhost:3000
Backend:    http://localhost:3001

Connection Strings:

Database:   postgresql://postgres:CHANGE_ME_postgres_123@localhost:5432/zero_to_running_dev
Redis:      redis://:CHANGE_ME_redis_123@localhost:6379

Useful Commands:

  make down    - Stop all services
  make logs    - View service logs
  make status  - Check service health

Press Ctrl+C to stop monitoring (services will continue running)
```

**System is now ready for development!**

---

## Service Initialization Details

### PostgreSQL Initialization

**First Run**:
```sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create tables (5 tables)
CREATE TABLE users (...);
CREATE TABLE sessions (...);
CREATE TABLE api_keys (...);
CREATE TABLE audit_logs (...);
CREATE TABLE health_checks (...);

-- Create indexes (10 indexes)
CREATE INDEX idx_users_email ON users(email);
-- ... (9 more indexes)

-- Create triggers (2 triggers)
CREATE TRIGGER update_users_updated_at ...;
CREATE TRIGGER update_api_keys_updated_at ...;

-- Insert initial data
INSERT INTO health_checks VALUES (...);
```

**Subsequent Runs**:
- PostgreSQL finds existing data in postgres-data volume
- Skips initialization (tables already exist)
- Starts directly with existing data
- Much faster startup (5-10 seconds)

---

### Backend Initialization

**Connection Pooling**:
```typescript
// backend/src/config/database.ts
const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'zero_to_running_dev',
  user: 'postgres',
  password: process.env.DATABASE_PASSWORD,
  max: 20,                    // Maximum connections in pool
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000  // Timeout after 2s
});
```

**Health Check Implementation**:
```typescript
// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();
    logger.info('Database connection test successful', {
      currentTime: result.rows[0].current_time,
      version: result.rows[0].pg_version
    });
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error });
    return false;
  }
}
```

---

### Frontend Initialization

**Vite Dev Server**:
```javascript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',           // Listen on all interfaces
    port: 3000,
    strictPort: true,          // Fail if port unavailable
    hmr: {
      clientPort: 3000         // Hot module replacement port
    }
  }
});
```

**Environment Variables at Build Time**:
```javascript
// frontend/src/config/api.ts
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

---

## Inter-Service Communication

### Docker DNS Resolution

**How it Works**:

```
Backend container wants to connect to PostgreSQL:

1. Backend uses connection string: postgresql://postgres:***@postgres:5432/...
                                                               ^^^^^^^^
                                                            Service name
2. Backend's network stack queries DNS for "postgres"
   ├─ Query goes to Docker's embedded DNS server (127.0.0.11:53)
   └─ Docker DNS is configured for zero-to-running-network

3. Docker DNS returns IP address: 172.18.0.2
   ├─ This is the current IP of the postgres container
   └─ IP may change if container restarts, but DNS always returns current IP

4. Backend establishes TCP connection to 172.18.0.2:5432
   └─ PostgreSQL accepts connection

5. PostgreSQL authentication
   ├─ Backend sends credentials (user: postgres, password: ***)
   ├─ PostgreSQL validates credentials
   └─ Connection established

6. Backend can now execute queries
```

**Key Points**:
- Service names act as hostnames within Docker network
- DNS resolution is automatic and transparent
- IP addresses are abstracted away (no hardcoding needed)
- Works across container restarts (DNS always up-to-date)

---

### Connection Sequence

**Backend Startup Connection Flow**:

```
Backend Container Starts
    ↓
Load Environment Variables
    ├─ DATABASE_HOST=postgres
    ├─ DATABASE_PORT=5432
    ├─ REDIS_HOST=redis
    └─ REDIS_PORT=6379
    ↓
Create Database Pool
    ├─ DNS resolution: postgres → 172.18.0.2
    ├─ TCP connection to 172.18.0.2:5432
    ├─ PostgreSQL authentication
    └─ Connection pool ready (20 connections)
    ↓
Test Database Connection
    ├─ Query: SELECT NOW(), version()
    ├─ Log result
    └─ ✓ Database connected
    ↓
Create Redis Client
    ├─ DNS resolution: redis → 172.18.0.3
    ├─ TCP connection to 172.18.0.3:6379
    └─ Redis client ready
    ↓
Test Redis Connection
    ├─ Command: PING
    ├─ Response: PONG
    └─ ✓ Redis connected
    ↓
Start HTTP Server
    ├─ Listen on 0.0.0.0:3001
    └─ ✓ Backend ready
```

---

## Health Check Verification

### Health Check Architecture

**Every service implements health checks**:

```
┌─────────────────────────────────────────────────────────┐
│  Docker Health Check System                             │
└─────────────────────────────────────────────────────────┘

PostgreSQL:
  Command:  pg_isready -U postgres && psql ... -c 'SELECT 1'
  Interval: 10 seconds
  Timeout:  5 seconds
  Retries:  5 times
  Start Period: 10 seconds

Redis:
  Command:  redis-cli ping
  Interval: 10 seconds
  Timeout:  5 seconds
  Retries:  5 times
  Start Period: 5 seconds

Backend:
  Command:  wget --quiet --tries=1 --spider http://localhost:3001/health
  Interval: 10 seconds
  Timeout:  5 seconds
  Retries:  5 times
  Start Period: 30 seconds

Frontend:
  Command:  wget --quiet --tries=1 --spider http://localhost:3000
  Interval: 10 seconds
  Timeout:  5 seconds
  Retries:  5 times
  Start Period: 30 seconds
```

### Health Check States

**Container Health States**:

1. **starting** - Container is starting (within start_period grace period)
2. **healthy** - Health check command succeeded
3. **unhealthy** - Health check command failed (after retries exhausted)

**State Transitions**:
```
Container starts
    ↓
State: starting (grace period: 10-30s depending on service)
    ↓
Health check executes (every 10s)
    ↓
Success? ──Yes──> State: healthy
    │
    No
    ↓
Retry (up to 5 times with 10s interval)
    ↓
All retries failed? ──Yes──> State: unhealthy
```

### Dependency Wait Logic

**Backend depends on PostgreSQL**:

```
Backend Container Scheduled to Start
    ↓
Check: Is postgres container healthy?
    │
    ├─ No: Wait 1 second, check again
    │       (repeat until healthy or timeout)
    │
    └─ Yes: Start backend container
            ↓
         Backend begins initialization
```

**Docker Compose Configuration**:
```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy  # Wait for health check to pass
```

---

## Normal Operation Flow

Once all services are healthy, the system operates continuously.

### Request Flow: Health Dashboard

**User accesses monitoring dashboard**:

```
Step 1: User Opens Browser
  ↓
  Browser navigates to: http://localhost:3000
  ↓
Step 2: Frontend Container Serves App
  ├─ Vite dev server receives HTTP request
  ├─ Serves index.html
  ├─ Serves React bundle (JavaScript)
  └─ Browser renders React app
  ↓
Step 3: React App Makes API Call
  ├─ JavaScript executes: fetch('http://localhost:3001/health/dashboard')
  ├─ Browser sends HTTP GET request to backend
  └─ Request includes headers (User-Agent, etc.)
  ↓
Step 4: Backend Receives Request
  ├─ Express router matches route: GET /health/dashboard
  ├─ Request logging middleware:
  │  ├─ Generate unique requestId (UUID)
  │  ├─ Log incoming request (method, path, requestId)
  │  └─ Attach requestId to response headers
  │
  ├─ Health check handler executes:
  │  ├─ Start timer (for responseTime)
  │  ├─ Test database connection:
  │  │  ├─ Execute: SELECT 1
  │  │  ├─ Timeout: 1 second
  │  │  └─ Result: ok or error
  │  │
  │  ├─ Test Redis connection:
  │  │  ├─ Execute: PING
  │  │  ├─ Timeout: 1 second
  │  │  └─ Result: ok or error
  │  │
  │  ├─ Calculate responseTime
  │  └─ Build response JSON
  │
  └─ Response logging middleware:
     ├─ Log response (statusCode, responseTime, requestId)
     └─ Send JSON response
  ↓
Step 5: Frontend Receives Response
  ├─ Parse JSON response
  ├─ Update React state
  └─ Re-render dashboard with health status
  ↓
Step 6: Auto-Refresh (10 seconds later)
  └─ Repeat steps 3-5
```

**Example Logs**:

Frontend (browser console):
```
[2025-11-11 02:00:10] INFO: Fetching health dashboard data
```

Backend (structured logs):
```json
{"timestamp":"2025-11-11T02:00:10.123Z","level":"info","msg":"Incoming request","requestId":"550e8400-e29b-41d4-a716-446655440000","method":"GET","path":"/health/dashboard"}
{"timestamp":"2025-11-11T02:00:10.168Z","level":"info","msg":"Outgoing response","requestId":"550e8400-e29b-41d4-a716-446655440000","statusCode":200,"responseTime":45}
```

---

### Database Query Flow

**Example: User Login Query**:

```
Frontend sends login request
  ↓
POST http://localhost:3001/api/auth/login
Body: { email: "user@example.com", password: "***" }
  ↓
Backend receives request
  ├─ Generate requestId
  └─ Route to auth handler
  ↓
Auth handler extracts credentials
  ↓
Query database for user
  ├─ SQL: SELECT id, email, password_hash, is_active FROM users WHERE email = $1
  ├─ Backend → postgres:5432 (DNS resolved)
  └─ PostgreSQL executes query and returns row
  ↓
Backend verifies password
  ├─ Compare provided password with password_hash (bcrypt)
  └─ Password matches? Yes
  ↓
Create session
  ├─ Generate session token
  ├─ SQL: INSERT INTO sessions (user_id, token, expires_at) VALUES (...)
  └─ Store session in Redis (optional caching)
     ├─ Command: SET session:${token} ${userData} EX 86400
     └─ Backend → redis:6379 (DNS resolved)
  ↓
Return session token to frontend
  ↓
Frontend stores token (localStorage or cookie)
  ↓
Future requests include token in Authorization header
```

---

### Cache Usage Flow

**Example: Cache User Profile**:

```
Frontend requests user profile
  ↓
GET http://localhost:3001/api/users/:id
  ↓
Backend checks Redis cache first
  ├─ Command: GET user:${id}
  ├─ Backend → redis:6379
  └─ Cache hit? ──Yes──> Return cached data (fast!)
      │
      No (cache miss)
      ↓
Backend queries PostgreSQL
  ├─ SQL: SELECT * FROM users WHERE id = $1
  ├─ Backend → postgres:5432
  └─ PostgreSQL returns user data
  ↓
Backend stores in Redis cache
  ├─ Command: SETEX user:${id} 300 ${userData}  # TTL: 5 minutes
  └─ Backend → redis:6379
  ↓
Return user data to frontend
```

**Cache Benefits**:
- Reduces database load
- Faster response times (Redis: <1ms, PostgreSQL: 5-10ms)
- Frequently accessed data stays in memory

---

## Shutdown and Cleanup

### Graceful Shutdown Process

**Command**: `make down` or `Ctrl+C`

```
User initiates shutdown
  ↓
Docker Compose receives signal (SIGTERM)
  ↓
Services shut down in reverse dependency order
  ↓
Step 1: Frontend Shutdown
  ├─ Docker sends SIGTERM to frontend container
  ├─ Vite dev server receives signal
  ├─ Close HTTP server (stop accepting new connections)
  ├─ Wait for in-flight requests to complete (up to 10s)
  └─ Container exits (code 0)
  ⏱️  Time: 2-5 seconds
  ↓
Step 2: Backend Shutdown
  ├─ Docker sends SIGTERM to backend container
  ├─ Node.js receives signal (process.on('SIGTERM'))
  ├─ Graceful shutdown handler executes:
  │  ├─ Stop accepting new HTTP requests
  │  ├─ Wait for in-flight requests to complete
  │  ├─ Close database connections:
  │  │  ├─ Close all connections in pool
  │  │  └─ Log: "Database connections closed"
  │  ├─ Close Redis connections:
  │  │  ├─ Close Redis client
  │  │  └─ Log: "Redis connection closed"
  │  └─ Exit process (code 0)
  └─ Container exits
  ⏱️  Time: 5-10 seconds
  ↓
Step 3: Redis Shutdown
  ├─ Docker sends SIGTERM to redis container
  ├─ Redis receives signal
  ├─ Save AOF file to disk (append only file)
  ├─ Close all client connections
  └─ Container exits
  ⏱️  Time: 2-5 seconds
  ↓
Step 4: PostgreSQL Shutdown
  ├─ Docker sends SIGTERM to postgres container
  ├─ PostgreSQL receives signal
  ├─ Checkpoint WAL (write-ahead log)
  ├─ Close all client connections
  ├─ Flush data to disk
  └─ Container exits
  ⏱️  Time: 5-10 seconds
  ↓
All containers stopped
  ├─ Volumes persist (data retained)
  └─ Network remains (unless --volumes flag used)
```

**Total Shutdown Time**: 10-30 seconds

---

### Forced Shutdown

If graceful shutdown times out (after 10 seconds), Docker sends SIGKILL:

```
Graceful shutdown timeout exceeded
  ↓
Docker sends SIGKILL to all containers
  ↓
Containers terminate immediately (force kill)
  ├─ No cleanup performed
  ├─ Connections may be left open
  └─ Data may not be fully flushed to disk
  ↓
Containers stopped
```

**To avoid forced shutdown**: Ensure services handle SIGTERM properly and shut down within timeout.

---

### Cleanup Commands

**Remove containers only** (keep volumes):
```bash
make down
# or
docker-compose down
```

**Remove containers and volumes** (delete all data):
```bash
make down --volumes
# or
docker-compose down --volumes
```

**Remove containers, volumes, and images**:
```bash
docker-compose down --volumes --rmi all
```

**Full cleanup** (including network):
```bash
docker-compose down --volumes --rmi all
docker network rm zero-to-running-network
```

---

## Timing and Performance

### Startup Times

**First Run (Cold Start)**:
- Image downloads: 2-5 minutes
- Image builds: 2-5 minutes (frontend + backend)
- Service initialization: 1-2 minutes
- **Total**: 5-12 minutes

**Subsequent Runs (Warm Start)**:
- PostgreSQL: 5-10 seconds
- Redis: 5-10 seconds
- Backend: 30-60 seconds
- Frontend: 30-60 seconds
- **Total**: 60-90 seconds

**Minimal Profile** (backend + database only):
- PostgreSQL: 5-10 seconds
- Backend: 30-60 seconds
- **Total**: 30-45 seconds

---

### Performance Metrics

**Service Resource Usage** (Typical):

| Service    | CPU (Idle) | CPU (Load) | Memory   | Startup Time |
|-----------|-----------|-----------|----------|-------------|
| PostgreSQL | 0.5-1%    | 5-15%     | 80-120MB | 5-10s       |
| Redis      | 0.1-0.5%  | 1-5%      | 30-50MB  | 5-10s       |
| Backend    | 0.5-2%    | 10-30%    | 150-250MB| 30-60s      |
| Frontend   | 0.5-2%    | 5-15%     | 100-200MB| 30-60s      |
| **Total**  | **2-5%**  | **20-65%**| **500-700MB**| **60-90s**|

**Request Latency** (Typical):
- Health check endpoints: 5-15ms
- Database queries: 1-10ms
- Cache operations: <1ms
- API requests: 10-50ms

---

### Optimization Tips

**Reduce Startup Time**:
1. Use minimal profile when not working on frontend
2. Keep Docker images cached (don't prune frequently)
3. Use volume mounts instead of COPY in Dockerfiles for development
4. Adjust health check start_period if services start slowly

**Improve Performance**:
1. Increase database connection pool size for high load
2. Use Redis caching for frequently accessed data
3. Enable query result caching in PostgreSQL
4. Optimize Docker resource limits in Docker Desktop settings

---

## Troubleshooting Common Issues

### Service Won't Start

**Symptom**: Service stuck in "starting" state

**Possible Causes**:
1. Dependency not healthy (waiting for database/redis)
2. Port already in use
3. Configuration error (invalid environment variables)
4. Health check failing

**Resolution**:
```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs [service-name]

# Check health check logs
docker inspect zero-to-running-[service-name] | grep Health

# Check port conflicts
lsof -i :3001  # Check if port 3001 is in use

# Validate configuration
make config
```

---

### Health Check Fails

**Symptom**: Service shows "unhealthy" status

**Possible Causes**:
1. Service crashed or failed to start
2. Database/Redis connection failed
3. Health check command incorrect
4. Timeout too short

**Resolution**:
```bash
# View logs for error messages
docker-compose logs [service-name]

# Test health check manually
docker-compose exec backend wget -qO- http://localhost:3001/health

# Test database connection
docker-compose exec backend nc -zv postgres 5432

# Test Redis connection
docker-compose exec backend nc -zv redis 6379

# Increase start_period in docker-compose.yml if needed
```

---

### Slow Startup

**Symptom**: Services take >5 minutes to start

**Possible Causes**:
1. First run (downloading images)
2. Building images from scratch
3. Slow disk (on macOS with bind mounts)
4. Resource constraints (low memory)

**Resolution**:
```bash
# Check Docker resource limits
# Docker Desktop → Settings → Resources → Advanced

# Increase memory allocation to 4-8GB
# Increase CPU allocation to 4-6 cores

# Use minimal profile
make dev profile=minimal

# Check disk space
df -h

# Clean up unused Docker resources
docker system prune
```

---

### Connection Refused Errors

**Symptom**: Backend can't connect to database/Redis

**Possible Causes**:
1. Service not fully initialized
2. DNS resolution failure
3. Network configuration issue
4. Service not on same Docker network

**Resolution**:
```bash
# Verify services are on same network
docker network inspect zero-to-running-network

# Test DNS resolution
docker-compose exec backend ping postgres
docker-compose exec backend ping redis

# Test port connectivity
docker-compose exec backend nc -zv postgres 5432

# Check service dependencies in docker-compose.yml
# Ensure depends_on is configured correctly
```

---

### Data Not Persisting

**Symptom**: Database data lost after restart

**Possible Causes**:
1. Volumes not mounted correctly
2. Volume deleted with `docker-compose down --volumes`
3. PostgreSQL data directory misconfigured

**Resolution**:
```bash
# List volumes
docker volume ls | grep zero-to-running

# Inspect volume
docker volume inspect zero-to-running-postgres-data

# Verify volume mount in docker-compose.yml
# Should have: postgres-data:/var/lib/postgresql/data

# Don't use --volumes flag unless you want to delete data
make down  # Correct (keeps volumes)
# NOT: docker-compose down --volumes  # Deletes data!
```

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture overview
- [NETWORK_ARCHITECTURE.md](NETWORK_ARCHITECTURE.md) - Detailed networking documentation
- [CONFIGURATION.md](CONFIGURATION.md) - Configuration and environment variables
- [HEALTH_VERIFICATION.md](HEALTH_VERIFICATION.md) - Health check implementation
- [MONITORING.md](MONITORING.md) - Monitoring and observability
- [README.md](../README.md) - Quick start and overview

---

**Last Updated**: 2025-11-11
**Document Version**: 1.0
**Target Audience**: Developers, DevOps Engineers
