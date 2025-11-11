# Configuration Guide

Complete guide to configuring Zero-to-Running environment variables for development and production environments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration Overview](#configuration-overview)
3. [Environment Variables](#environment-variables)
4. [Configuration Validation](#configuration-validation)
5. [Service Configuration](#service-configuration)
6. [Security Settings](#security-settings)
7. [Environment-Specific Configuration](#environment-specific-configuration)
8. [Advanced Configuration](#advanced-configuration)
9. [Troubleshooting](#troubleshooting)

## Quick Start

### Initial Setup

1. **Copy the example configuration:**
   ```bash
   cp .env.example .env
   ```

2. **Set required variables:**
   ```bash
   # Edit .env file
   DATABASE_PASSWORD=your_secure_password_here
   SESSION_SECRET=generate_random_secret_32chars_minimum
   ```

3. **Validate configuration:**
   ```bash
   make config
   ```

4. **Start services:**
   ```bash
   make dev
   ```

### Quick Reference

**Most Common Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PASSWORD` | *required* | PostgreSQL password (min 8 chars) |
| `SESSION_SECRET` | *required* | Session encryption key (min 32 chars) |
| `LOG_LEVEL` | `INFO` | Logging verbosity (ERROR/WARN/INFO/DEBUG) |
| `FRONTEND_PORT` | `3000` | Frontend application port |
| `BACKEND_PORT` | `3001` | Backend API port |

## Configuration Overview

Zero-to-Running uses a hierarchical configuration system:

```
.env.example (committed, reference)
    ↓
.env (local, git-ignored)
    ↓
Environment variables loaded by:
  - Docker Compose (for container setup)
  - Backend (for API configuration)
  - Frontend (for build-time config)
    ↓
Validation on startup
    ↓
Application uses configuration
```

### Key Principles

1. **Environment-Based**: All configuration via environment variables
2. **Sensible Defaults**: Optional variables have reasonable defaults
3. **Validation**: Configuration validated before services start
4. **Security**: Sensitive values never committed to git
5. **Documentation**: All variables documented in `.env.example`

### File Structure

```
/
├── .env.example       # Template with all variables and documentation
├── .env               # Your local configuration (git-ignored)
└── docs/
    └── CONFIGURATION.md   # This file - comprehensive guide
```

## Environment Variables

### Application Settings

#### `NODE_ENV`
- **Type**: String (enum)
- **Default**: `development`
- **Valid Values**: `development`, `production`, `test`
- **Description**: Application environment mode
- **Affects**: Logging, error handling, optimization

```bash
NODE_ENV=development
```

#### `APP_NAME`
- **Type**: String
- **Default**: `Zero-to-Running`
- **Description**: Application name for logging and display

```bash
APP_NAME=Zero-to-Running
```

#### `APP_VERSION`
- **Type**: String
- **Default**: `1.0.0`
- **Description**: Application version for tracking

```bash
APP_VERSION=1.0.0
```

### Service Ports

#### `FRONTEND_PORT`
- **Type**: Integer
- **Default**: `3000`
- **Range**: 1-65535 (recommend 1024-65535)
- **Description**: Frontend React application port
- **Notes**: Must be unique across all services

```bash
FRONTEND_PORT=3000
```

#### `BACKEND_PORT`
- **Type**: Integer
- **Default**: `3001`
- **Range**: 1-65535 (recommend 1024-65535)
- **Description**: Backend API server port
- **Notes**: Frontend connects to this port

```bash
BACKEND_PORT=3001
```

#### `DATABASE_PORT`
- **Type**: Integer
- **Default**: `5432`
- **Range**: 1-65535
- **Description**: PostgreSQL database port
- **Notes**: Standard PostgreSQL port is 5432

```bash
DATABASE_PORT=5432
```

#### `REDIS_PORT`
- **Type**: Integer
- **Default**: `6379`
- **Range**: 1-65535
- **Description**: Redis cache port
- **Notes**: Standard Redis port is 6379

```bash
REDIS_PORT=6379
```

#### `NODE_DEBUG_PORT`
- **Type**: Integer
- **Default**: `9229`
- **Range**: 1-65535
- **Description**: Node.js debugger port
- **Notes**: Used for remote debugging

```bash
NODE_DEBUG_PORT=9229
```

### Database Configuration

#### `DATABASE_HOST`
- **Type**: String
- **Default**: `localhost`
- **Description**: PostgreSQL hostname
- **Notes**: Use `postgres` when connecting from backend container

```bash
DATABASE_HOST=localhost
```

#### `DATABASE_PORT`
- **Type**: Integer
- **Default**: `5432`
- **Description**: PostgreSQL port (see Service Ports section)

#### `DATABASE_NAME`
- **Type**: String
- **Default**: `zero_to_running_dev`
- **Description**: PostgreSQL database name
- **Pattern**: Lowercase, underscores allowed

```bash
DATABASE_NAME=zero_to_running_dev
```

#### `DATABASE_USER`
- **Type**: String
- **Default**: `postgres`
- **Description**: PostgreSQL username

```bash
DATABASE_USER=postgres
```

#### `DATABASE_PASSWORD`
- **Type**: String
- **Required**: Yes
- **Min Length**: 8 characters
- **Description**: PostgreSQL password
- **Security**:
  - Never use default value in production
  - Minimum 8 characters
  - Avoid common passwords (password, postgres, 123456, etc.)
  - Use random, strong passwords

```bash
DATABASE_PASSWORD=your_secure_password_here
```

#### `DATABASE_POOL_MIN`
- **Type**: Integer
- **Default**: `2`
- **Range**: 1-100
- **Description**: Minimum database connections in pool

```bash
DATABASE_POOL_MIN=2
```

#### `DATABASE_POOL_MAX`
- **Type**: Integer
- **Default**: `10`
- **Range**: 1-100
- **Description**: Maximum database connections in pool
- **Notes**: Must be >= `DATABASE_POOL_MIN`

```bash
DATABASE_POOL_MAX=10
```

### Redis Configuration

#### `REDIS_HOST`
- **Type**: String
- **Default**: `localhost`
- **Description**: Redis hostname
- **Notes**: Use `redis` when connecting from backend container

```bash
REDIS_HOST=localhost
```

#### `REDIS_PORT`
- **Type**: Integer
- **Default**: `6379`
- **Description**: Redis port (see Service Ports section)

#### `REDIS_PASSWORD`
- **Type**: String
- **Default**: (empty)
- **Description**: Redis password
- **Notes**: Optional, but recommended for production

```bash
REDIS_PASSWORD=
```

#### `REDIS_DB`
- **Type**: Integer
- **Default**: `0`
- **Range**: 0-15
- **Description**: Redis database index

```bash
REDIS_DB=0
```

### Logging Configuration

#### `LOG_LEVEL`
- **Type**: String (enum)
- **Default**: `INFO`
- **Valid Values**: `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE`
- **Case**: Insensitive
- **Description**: Backend logging verbosity
- **Performance**: DEBUG/TRACE can impact performance

```bash
LOG_LEVEL=INFO
```

**Log Levels Explained:**
- `ERROR`: Critical errors only
- `WARN`: Warnings and errors
- `INFO`: General information, normal operations
- `DEBUG`: Detailed debugging info, includes database queries
- `TRACE`: Very detailed debugging (rarely needed)

#### `LOG_FORMAT`
- **Type**: String (enum)
- **Default**: `pretty`
- **Valid Values**: `json`, `pretty`
- **Description**: Backend log output format
- **Recommendations**:
  - `pretty` for local development (human-readable with colors)
  - `json` for production (structured, machine-parseable)

```bash
LOG_FORMAT=pretty
```

#### `LOG_LINES`
- **Type**: Integer
- **Default**: `100`
- **Description**: Number of log lines displayed by `make logs`

```bash
LOG_LINES=100
```

#### `VITE_LOG_LEVEL`
- **Type**: String (enum)
- **Default**: `INFO`
- **Valid Values**: `ERROR`, `WARN`, `INFO`, `DEBUG`
- **Description**: Frontend browser console logging level

```bash
VITE_LOG_LEVEL=INFO
```

#### `VITE_LOG_INTERACTIONS`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Log user interactions (clicks, navigation, forms)
- **Recommendation**: Only enable for debugging UI issues

```bash
VITE_LOG_INTERACTIONS=false
```

### CORS Configuration

#### `CORS_ORIGIN`
- **Type**: String (comma-separated URLs)
- **Default**: `http://localhost:3000,http://localhost:3001`
- **Description**: Allowed origins for CORS requests
- **Format**: Comma-separated list of complete URLs

```bash
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

#### `CORS_CREDENTIALS`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Allow credentials in CORS requests

```bash
CORS_CREDENTIALS=true
```

### API Configuration

#### `API_BASE_PATH`
- **Type**: String
- **Default**: `/api`
- **Description**: API endpoint prefix
- **Format**: Must start with `/`

```bash
API_BASE_PATH=/api
```

#### `VITE_API_URL`
- **Type**: URL
- **Default**: `http://localhost:3001`
- **Description**: Backend API URL for frontend
- **Format**: Complete URL including protocol and port

```bash
VITE_API_URL=http://localhost:3001
```

#### `RATE_LIMIT_WINDOW_MS`
- **Type**: Integer
- **Default**: `60000` (1 minute)
- **Unit**: Milliseconds
- **Description**: Rate limiting time window

```bash
RATE_LIMIT_WINDOW_MS=60000
```

#### `RATE_LIMIT_MAX_REQUESTS`
- **Type**: Integer
- **Default**: `100`
- **Range**: 1-10000
- **Description**: Maximum requests per window

```bash
RATE_LIMIT_MAX_REQUESTS=100
```

#### `REQUEST_TIMEOUT`
- **Type**: Integer
- **Default**: `30000` (30 seconds)
- **Unit**: Milliseconds
- **Range**: 1000-300000
- **Description**: Request timeout duration

```bash
REQUEST_TIMEOUT=30000
```

### Security Settings

#### `SESSION_SECRET`
- **Type**: String
- **Required**: Yes
- **Min Length**: 32 characters
- **Description**: Session encryption secret key
- **Security**:
  - Never use default value
  - Minimum 32 characters recommended
  - Use cryptographically random values
  - Rotate regularly in production
  - Generate with: `openssl rand -base64 32`

```bash
SESSION_SECRET=your_random_session_secret_here
```

#### `SESSION_MAX_AGE`
- **Type**: Integer
- **Default**: `86400000` (24 hours)
- **Unit**: Milliseconds
- **Description**: Session expiration time

```bash
SESSION_MAX_AGE=86400000
```

#### `JWT_SECRET`
- **Type**: String
- **Optional**: Yes (if using JWT authentication)
- **Min Length**: 32 characters recommended
- **Description**: JWT signing secret
- **Security**: Same security considerations as `SESSION_SECRET`

```bash
JWT_SECRET=your_jwt_secret_here
```

#### `JWT_EXPIRATION`
- **Type**: String
- **Default**: `7d`
- **Format**: Time string (e.g., "1h", "7d", "30d")
- **Description**: JWT token expiration time

```bash
JWT_EXPIRATION=7d
```

#### `BCRYPT_SALT_ROUNDS`
- **Type**: Integer
- **Default**: `10`
- **Range**: 4-20
- **Description**: Bcrypt password hashing rounds
- **Performance**: Higher = more secure but slower
- **Recommendation**: 10-12 for most use cases

```bash
BCRYPT_SALT_ROUNDS=10
```

#### `ENABLE_HTTPS`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable HTTPS
- **Notes**: Requires SSL certificates

```bash
ENABLE_HTTPS=false
```

### Docker Configuration

#### `COMPOSE_PROJECT_NAME`
- **Type**: String
- **Default**: `zero-to-running`
- **Description**: Docker Compose project name
- **Notes**: Used as prefix for container names

```bash
COMPOSE_PROJECT_NAME=zero-to-running
```

#### `DOCKER_NETWORK`
- **Type**: String
- **Default**: `zero-to-running-network`
- **Description**: Docker network name

```bash
DOCKER_NETWORK=zero-to-running-network
```

### Feature Flags

#### `ENABLE_HOT_RELOAD`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable frontend hot module replacement

```bash
ENABLE_HOT_RELOAD=true
```

#### `ENABLE_SOURCE_MAPS`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Generate source maps
- **Recommendation**: false in production

```bash
ENABLE_SOURCE_MAPS=false
```

#### `VERBOSE_ERRORS`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Show detailed error messages
- **Security**: Disable in production to avoid leaking information

```bash
VERBOSE_ERRORS=true
```

#### `ENABLE_API_DOCS`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable Swagger/OpenAPI documentation

```bash
ENABLE_API_DOCS=true
```

#### `ENABLE_HEALTH_CHECKS`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable health check endpoints

```bash
ENABLE_HEALTH_CHECKS=true
```

#### `ENABLE_METRICS`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable metrics collection

```bash
ENABLE_METRICS=false
```

#### `ENABLE_AUTO_SEED`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Automatically seed database on startup

```bash
ENABLE_AUTO_SEED=false
```

## Configuration Validation

### Using `make config`

The `make config` command validates your `.env` file:

```bash
make config
```

**What it checks:**
- Required variables are set and not empty
- Port numbers are valid (1-65535)
- No duplicate port assignments
- LOG_LEVEL is valid (ERROR/WARN/INFO/DEBUG/TRACE)
- LOG_FORMAT is valid (json/pretty)
- Database password is not weak or default
- Session secret is not weak or default
- Database pool settings are valid (min <= max)
- CORS origins are valid URLs

**Example output (success):**
```
===========================================
Environment Configuration Validator
===========================================

✓ Found .env file
Checking required variables...
Validating port numbers...
Validating logging configuration...
Validating security settings...

✓ Configuration is valid!

Summary:
  • Frontend Port: 3000
  • Backend Port: 3001
  • Database Port: 5432
  • Redis Port: 6379
  • Log Level: INFO
  • Log Format: pretty

===========================================
```

**Example output (errors):**
```
===========================================
Environment Configuration Validator
===========================================

✗ Found 3 error(s):

  1. DATABASE_PASSWORD is using a default/weak password
  2. Duplicate port 3000 used by FRONTEND_PORT and BACKEND_PORT
  3. Invalid LOG_LEVEL: INVALID. Must be one of: ERROR, WARN, INFO, DEBUG, TRACE

Please fix the errors above and run 'make config' again.
===========================================
```

### Automatic Validation

Configuration is automatically validated when you run:

```bash
make dev
```

The startup script runs validation before starting services. If validation fails, services won't start.

### Validation in Code

Backend validates configuration on startup in `/backend/src/index.ts`:

```typescript
// Validation runs automatically
const validationResult = validateConfig(config);

if (!validationResult.valid) {
  // Logs all errors and exits
  process.exit(1);
}
```

## Service Configuration

### Backend Service

**Configuration file:** `/backend/src/config/env.ts`

**Environment variables used:**
- All `DATABASE_*` variables
- All `REDIS_*` variables
- `LOG_LEVEL`, `LOG_FORMAT`
- `SESSION_SECRET`, `JWT_SECRET`
- `BACKEND_PORT` (exposed as `PORT`)
- `CORS_ORIGIN`, `API_BASE_PATH`

**Accessing configuration:**
```typescript
import { config } from './config/env';

// Use configuration
console.log(config.server.port);
console.log(config.database.host);
```

### Frontend Service

**Configuration file:** `/frontend/src/config/env.ts`

**Environment variables used:**
- `VITE_API_URL`
- `VITE_LOG_LEVEL`
- `VITE_LOG_INTERACTIONS`
- `FRONTEND_PORT` (exposed as `VITE_PORT`)

**Accessing configuration:**
```typescript
import { config } from './config/env';

// Use configuration
console.log(config.api.url);
console.log(config.logging.level);
```

### Docker Compose

**File:** `/docker-compose.yml`

**Environment variables used:**
- All service ports
- Database credentials
- Redis configuration
- `COMPOSE_PROJECT_NAME`
- `DOCKER_NETWORK`

Environment variables are automatically substituted in `docker-compose.yml`.

## Security Settings

### Generating Secure Secrets

**Session Secret:**
```bash
# Generate 32-character random secret
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**JWT Secret:**
```bash
# Generate 64-character random secret
openssl rand -base64 64
```

**Database Password:**
```bash
# Generate random password
openssl rand -base64 24
```

### Security Best Practices

1. **Never commit `.env` file** - Already in `.gitignore`
2. **Use strong, random secrets** - Minimum 32 characters
3. **Rotate secrets regularly** - Especially in production
4. **Different credentials per environment** - Don't reuse dev credentials in prod
5. **Limit secret access** - Only those who need it
6. **Use secret management** - Consider Vault, AWS Secrets Manager for production

### Production Security Checklist

- [ ] Change `DATABASE_PASSWORD` from default
- [ ] Change `SESSION_SECRET` from default
- [ ] Change `JWT_SECRET` from default (if using JWT)
- [ ] Set `VERBOSE_ERRORS=false`
- [ ] Set `LOG_LEVEL=INFO` or `WARN`
- [ ] Set `LOG_FORMAT=json`
- [ ] Set `ENABLE_SOURCE_MAPS=false`
- [ ] Set `ENABLE_HTTPS=true` (with SSL certificates)
- [ ] Review and restrict `CORS_ORIGIN`
- [ ] Set appropriate `RATE_LIMIT_MAX_REQUESTS`

## Environment-Specific Configuration

### Local Development

**File:** `.env`

```bash
NODE_ENV=development
LOG_LEVEL=DEBUG
LOG_FORMAT=pretty
VERBOSE_ERRORS=true
ENABLE_HOT_RELOAD=true
ENABLE_SOURCE_MAPS=false
DATABASE_PASSWORD=local_dev_password
SESSION_SECRET=local_dev_session_secret_32_chars_min
```

### Staging Environment

```bash
NODE_ENV=production
LOG_LEVEL=INFO
LOG_FORMAT=json
VERBOSE_ERRORS=false
ENABLE_HOT_RELOAD=false
ENABLE_SOURCE_MAPS=false
VITE_API_URL=https://api.staging.example.com
DATABASE_PASSWORD=<strong-staging-password>
SESSION_SECRET=<strong-staging-secret>
```

### Production Environment

```bash
NODE_ENV=production
LOG_LEVEL=WARN
LOG_FORMAT=json
VERBOSE_ERRORS=false
ENABLE_HOT_RELOAD=false
ENABLE_SOURCE_MAPS=false
ENABLE_HTTPS=true
VITE_API_URL=https://api.example.com
DATABASE_PASSWORD=<strong-production-password>
SESSION_SECRET=<strong-production-secret>
JWT_SECRET=<strong-jwt-secret>
ENABLE_METRICS=true
```

## Advanced Configuration

### Custom Port Configuration

To avoid conflicts with other services:

```bash
# In .env
FRONTEND_PORT=4000
BACKEND_PORT=5000
DATABASE_PORT=5433
REDIS_PORT=6380

# Validate
make config

# Restart
make down && make dev
```

### Multi-Developer Environments

Each developer can customize their `.env`:

**Developer A:**
```bash
FRONTEND_PORT=3000
BACKEND_PORT=3001
```

**Developer B (avoiding conflicts):**
```bash
FRONTEND_PORT=4000
BACKEND_PORT=4001
```

### Database Connection Tuning

For high-traffic applications:

```bash
# Increase connection pool
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=50

# Increase rate limits
RATE_LIMIT_MAX_REQUESTS=1000
```

### Debug Configuration

Enable maximum logging for troubleshooting:

```bash
LOG_LEVEL=DEBUG
LOG_FORMAT=pretty
VITE_LOG_LEVEL=DEBUG
VITE_LOG_INTERACTIONS=true
VERBOSE_ERRORS=true
```

## Troubleshooting

### Common Configuration Errors

#### "DATABASE_PASSWORD is not set"

**Cause:** Required variable missing from `.env`

**Solution:**
```bash
# Edit .env
DATABASE_PASSWORD=your_secure_password_here

# Verify
make config
```

#### "Duplicate port assignments"

**Cause:** Two services configured to use the same port

**Solution:**
```bash
# In .env, ensure all ports are unique
FRONTEND_PORT=3000
BACKEND_PORT=3001  # Was 3000
DATABASE_PORT=5432
REDIS_PORT=6379

# Verify
make config
```

#### "Invalid LOG_LEVEL"

**Cause:** LOG_LEVEL has a typo or invalid value

**Solution:**
```bash
# In .env, use valid log level
LOG_LEVEL=INFO  # Was INFOO (typo)

# Valid values: ERROR, WARN, INFO, DEBUG, TRACE
```

#### "Port already in use"

**Cause:** Another application is using a configured port

**Solution:**
```bash
# Find process using port (macOS/Linux)
lsof -i :3000

# Kill process or change port in .env
FRONTEND_PORT=4000

# Restart
make down && make dev
```

#### "Configuration validation failed on startup"

**Cause:** `.env` file has errors

**Solution:**
```bash
# Run validation to see detailed errors
make config

# Fix errors shown in output
# Restart
make dev
```

### Getting Help

1. **Check `.env.example`** - Reference for all variables
2. **Run `make config`** - Detailed validation output
3. **Check logs** - `make logs service=backend`
4. **Review this guide** - Comprehensive variable documentation

## Adding New Configuration Variables

When adding new configuration variables:

1. **Add to `.env.example`** with documentation
2. **Update `/backend/src/config/env.ts`** or `/frontend/src/config/env.ts`
3. **Add validation** in `/backend/src/utils/config-validator.ts`
4. **Update validation script** in `/infrastructure/scripts/validate-config.sh`
5. **Add tests** in `__tests__/config.test.ts`
6. **Document here** in CONFIGURATION.md
7. **Update README** if it's a commonly-used variable

---

**For more information:**
- [README.md](../README.md) - Quick start guide
- [.env.example](../.env.example) - Complete variable reference
- [Backend Config](../backend/src/config/env.ts) - Backend configuration module
- [Frontend Config](../frontend/src/config/env.ts) - Frontend configuration module
