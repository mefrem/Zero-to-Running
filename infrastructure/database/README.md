# Database Documentation

This directory contains database-related scripts, configurations, and documentation for the Zero-to-Running PostgreSQL database.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Connecting to the Database](#connecting-to-the-database)
- [Database Schema](#database-schema)
- [Initialization Script](#initialization-script)
- [Migrations](#migrations)
- [Troubleshooting](#troubleshooting)

## Overview

The Zero-to-Running project uses PostgreSQL 16 (Alpine) as its primary database. The database runs in a Docker container and is orchestrated via Docker Compose along with other services.

**Key Features**:
- Automatic initialization via `init.sql` script
- Persistent data storage using Docker volumes
- Environment-based configuration
- Health check monitoring
- Pre-configured schema with common tables

## Quick Start

### Starting the Database

The database starts automatically when you run the full stack:

```bash
# Start all services including database
make dev
```

To start only the database service:

```bash
# From project root
docker-compose up postgres -d
```

### Stopping the Database

```bash
# Stop all services
make down

# Or stop only database
docker-compose stop postgres
```

### Viewing Database Logs

```bash
# View real-time logs
docker-compose logs -f postgres

# View last 100 lines
docker-compose logs --tail=100 postgres
```

## Connecting to the Database

### Connection Details

The database is accessible via the following connection parameters:

| Parameter | Default Value | Environment Variable |
|-----------|---------------|---------------------|
| Host | `localhost` | `DATABASE_HOST` |
| Port | `5432` | `DATABASE_PORT` |
| Database | `zero_to_running_dev` | `DATABASE_NAME` |
| User | `postgres` | `DATABASE_USER` |
| Password | `CHANGE_ME_secure_password_123` | `DATABASE_PASSWORD` |

**Connection String Format**:
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

**Example**:
```
postgresql://postgres:CHANGE_ME_secure_password_123@localhost:5432/zero_to_running_dev
```

### Connecting via psql (PostgreSQL CLI)

Install psql if not already available:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Download from https://www.postgresql.org/download/windows/
```

Connect to the database:
```bash
# Using connection string
psql postgresql://postgres:CHANGE_ME_secure_password_123@localhost:5432/zero_to_running_dev

# Or using individual parameters
psql -h localhost -p 5432 -U postgres -d zero_to_running_dev
# Enter password when prompted
```

### Connecting via GUI Tools

#### DBeaver (Free, Cross-platform)

1. Download from [dbeaver.io](https://dbeaver.io/)
2. Create new PostgreSQL connection:
   - Host: `localhost`
   - Port: `5432`
   - Database: `zero_to_running_dev`
   - Username: `postgres`
   - Password: `CHANGE_ME_secure_password_123`

#### pgAdmin (Free, Cross-platform)

1. Download from [pgadmin.org](https://www.pgadmin.org/)
2. Add new server:
   - General > Name: `Zero-to-Running Local`
   - Connection > Host: `localhost`
   - Connection > Port: `5432`
   - Connection > Database: `zero_to_running_dev`
   - Connection > Username: `postgres`
   - Connection > Password: `CHANGE_ME_secure_password_123`

#### TablePlus (Paid, macOS/Windows/Linux)

1. Download from [tableplus.com](https://tableplus.com/)
2. Create new PostgreSQL connection using the details above

### Connecting from Backend Service

From within the Docker network (e.g., backend service), use:
- Host: `postgres` (Docker Compose service name)
- Port: `5432`
- Other parameters remain the same

The backend uses the `DATABASE_URL` environment variable:
```
postgresql://postgres:CHANGE_ME_secure_password_123@postgres:5432/zero_to_running_dev
```

## Database Schema

The database is initialized with the following tables:

### Tables Overview

| Table Name | Purpose | Key Fields |
|------------|---------|------------|
| `users` | User accounts | id, email, username, password_hash |
| `sessions` | User sessions | id, user_id, token, expires_at |
| `api_keys` | API authentication | id, user_id, key_hash, is_active |
| `audit_logs` | Activity tracking | id, user_id, action, entity_type |
| `health_checks` | System monitoring | id, service_name, status |

### Users Table

Stores user account information:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);
```

### Sessions Table

Manages user authentication sessions:

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Viewing Schema

```bash
# Connect via psql
psql postgresql://postgres:CHANGE_ME_secure_password_123@localhost:5432/zero_to_running_dev

# List all tables
\dt

# Describe a specific table
\d users

# View indexes
\di

# View all schema information
\d+
```

## Initialization Script

The `init.sql` script runs automatically when the PostgreSQL container is first created. It:

1. Enables required PostgreSQL extensions (`uuid-ossp`, `pgcrypto`)
2. Creates database tables with proper relationships
3. Sets up indexes for query optimization
4. Creates triggers for automatic timestamp updates
5. Inserts initial health check record

**Location**: `/infrastructure/database/init.sql`

**When it runs**:
- Only on first container creation
- Does not re-run on container restart
- To re-run, delete the volume: `docker volume rm zero-to-running-postgres-data`

**Note**: The script uses `IF NOT EXISTS` clauses, making it safe to run multiple times.

## Migrations

Database migrations are managed in the `migrations/` directory.

**Current Status**: Migration system to be implemented in future stories.

**Planned Approach**:
- Use a migration tool (e.g., node-pg-migrate, Knex, TypeORM)
- Version-controlled migration files
- Up/down migration support
- Automated migration running on service startup

## Troubleshooting

### Database Container Won't Start

**Check if container is running**:
```bash
docker ps | grep postgres
```

**View container logs**:
```bash
docker-compose logs postgres
```

**Common causes**:
- Port 5432 already in use
- Insufficient disk space
- Corrupted data volume

**Solutions**:
```bash
# Stop and remove container
docker-compose down

# Remove data volume (WARNING: deletes all data)
docker volume rm zero-to-running-postgres-data

# Restart services
docker-compose up postgres -d
```

### Cannot Connect to Database

**Symptoms**: Connection refused or timeout errors

**Checklist**:
1. Verify container is running: `docker ps | grep postgres`
2. Check container health: `docker inspect --format='{{.State.Health.Status}}' zero-to-running-postgres`
3. Verify port mapping: `docker port zero-to-running-postgres`
4. Check credentials in `.env` file
5. Wait 10-30 seconds for database to fully initialize

**Test connection**:
```bash
# From host machine
psql -h localhost -p 5432 -U postgres -d zero_to_running_dev

# From within backend container
docker-compose exec backend psql -h postgres -p 5432 -U postgres -d zero_to_running_dev
```

### Permission Denied Errors

**Symptoms**: "permission denied" when connecting or querying

**Solutions**:
- Verify username/password in `.env` match docker-compose configuration
- Check that user has necessary privileges:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE zero_to_running_dev TO postgres;
  ```

### Data Not Persisting

**Symptoms**: Data disappears after container restart

**Diagnosis**:
```bash
# Check if volume exists
docker volume ls | grep postgres

# Inspect volume
docker volume inspect zero-to-running-postgres-data
```

**Solution**:
Ensure volume is properly mounted in `docker-compose.yml`:
```yaml
volumes:
  - postgres-data:/var/lib/postgresql/data
```

### Schema Not Initialized

**Symptoms**: Tables don't exist after container startup

**Diagnosis**:
```bash
# Connect and check tables
psql postgresql://postgres:CHANGE_ME_secure_password_123@localhost:5432/zero_to_running_dev -c "\dt"
```

**Solutions**:
1. Check if `init.sql` is properly mounted in docker-compose.yml
2. Verify init.sql syntax is valid
3. Delete volume and recreate:
   ```bash
   docker-compose down
   docker volume rm zero-to-running-postgres-data
   docker-compose up postgres -d
   ```

### Slow Query Performance

**Diagnosis**:
```sql
-- Enable query timing
\timing on

-- Explain query plan
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

**Solutions**:
- Ensure indexes are created (check `init.sql`)
- Add missing indexes for frequently queried columns
- Analyze table statistics: `ANALYZE users;`
- Vacuum tables: `VACUUM ANALYZE;`

### Out of Disk Space

**Symptoms**: "No space left on device" errors

**Check disk usage**:
```bash
# Check Docker disk usage
docker system df

# Check volume size
docker system df -v | grep postgres
```

**Clean up**:
```bash
# Remove unused containers/images
docker system prune

# Remove unused volumes (WARNING: may delete data)
docker volume prune
```

## Best Practices

### Security

1. **Change default password**: Update `DATABASE_PASSWORD` in `.env` file
2. **Use strong passwords**: Minimum 16 characters with mixed case, numbers, symbols
3. **Don't commit .env**: The `.env` file is gitignored - never commit credentials
4. **Rotate credentials**: Regularly update passwords, especially in production
5. **Limit access**: Only expose database port when needed for development

### Performance

1. **Use connection pooling**: Backend should use connection pools (configured in backend)
2. **Add indexes**: Create indexes for frequently queried columns
3. **Regular maintenance**: Run `VACUUM` and `ANALYZE` periodically
4. **Monitor queries**: Use `EXPLAIN` to understand query performance
5. **Limit result sets**: Use pagination for large datasets

### Data Management

1. **Regular backups**: Backup production data regularly
2. **Version migrations**: Keep migration files in version control
3. **Test migrations**: Test on development data before production
4. **Seed data**: Use seed scripts for consistent test data
5. **Documentation**: Document schema changes and decisions

## Additional Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [Docker PostgreSQL Image](https://hub.docker.com/_/postgres)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [SQL Style Guide](https://www.sqlstyle.guide/)

---

**Last Updated**: 2025-11-10
**PostgreSQL Version**: 16 (Alpine)
**Maintained By**: Development Team
