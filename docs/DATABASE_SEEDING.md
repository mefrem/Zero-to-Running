# Database Seeding & Test Data Management

This guide provides comprehensive documentation on database seeding capabilities in Zero-to-Running. Database seeding allows developers to populate the database with realistic test data, enabling immediate feature testing without manual data creation.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Available Seed Data](#available-seed-data)
- [Seeding Commands](#seeding-commands)
- [Auto-Seeding](#auto-seeding)
- [Idempotency](#idempotency)
- [Customizing Seed Data](#customizing-seed-data)
- [Database Reset](#database-reset)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

Database seeding provides realistic test data for development and testing. All seed scripts are **idempotent**, meaning they can be safely run multiple times without creating duplicate data or errors.

### Key Features

- **One-command seeding**: `make seed` populates database with test data
- **Auto-seeding**: Optionally seed on first startup with `AUTO_SEED_DATABASE=true`
- **Idempotent scripts**: Safe to run multiple times without errors
- **Realistic data**: Representative users, sessions, API keys, and audit logs
- **Database reset**: `make reset-db` for complete database refresh
- **Comprehensive tests**: Seed data includes various edge cases

---

## Quick Start

### Manual Seeding

```bash
# Seed database with test data
make seed
```

This populates your database with:
- 5 test users with different states
- 2 active user sessions
- 3 API keys (2 active, 1 inactive)
- 5 audit log entries
- 4 health check records

### Auto-Seeding on Startup

Enable automatic seeding in your `.env` file:

```bash
# Enable auto-seeding
AUTO_SEED_DATABASE=true
```

Then start your services:

```bash
make dev
```

The database will be automatically seeded **only if it's empty**.

---

## Available Seed Data

### Test Users

All test users use the password: **`password123`**

| Email | Username | Status | Verified | Description |
|-------|----------|--------|----------|-------------|
| admin@example.com | admin | Active | Yes | Admin user with full access |
| john.doe@example.com | johndoe | Active | Yes | Regular active user |
| jane.smith@example.com | janesmith | Active | No | Unverified user (email not confirmed) |
| disabled.user@example.com | disableduser | Inactive | Yes | Disabled account |
| developer@example.com | developer | Active | Yes | Developer account for API testing |

### Test Sessions

- **Admin session**: Active session for admin@example.com (expires in 7 days)
- **User session**: Active session for john.doe@example.com (expires in 7 days)

### Test API Keys

| Name | User | Status | Expires In | Description |
|------|------|--------|------------|-------------|
| Production API Key | admin | Active | 365 days | Main API key for production integrations |
| Development Test Key | developer | Active | 90 days | API key for development and testing |
| Old API Key | johndoe | Inactive | Expired | Deprecated API key - no longer in use |

### Audit Logs

Sample audit log entries include:
- User login events (successful and failed)
- Profile update records
- API key creation events
- Account disable actions
- JSONB change tracking

### Health Checks

Historical health check data for:
- Database service (healthy and degraded states)
- Backend service
- Redis cache service

---

## Seeding Commands

### `make seed`

Populates the database with test data.

```bash
make seed
```

**What it does:**
1. Loads database configuration from `.env`
2. Verifies database is running and accessible
3. Executes all seed scripts in `/infrastructure/database/seeds/` in order
4. Reports progress and completion status
5. Verifies seed data was inserted

**Output:**
```
==============================================
  Database Seeding
==============================================

ℹ Loading environment configuration...
✓ Environment loaded
ℹ Database: zero_to_running_dev @ localhost:5432
ℹ Checking database connection...
✓ Database connection verified
ℹ Found 1 seed script(s)
ℹ Executing seed scripts...

ℹ Executing: 001_initial_seed.sql
✓ Completed: 001_initial_seed.sql

✓ All 1 script(s) executed successfully
ℹ Verifying seed data...
✓ Found 5 user(s) in database
ℹ Seed data summary:
ℹ   - Users: 5
ℹ   - Sessions: 2
ℹ   - API Keys: 3
==============================================
✓ Database seeding completed!
```

**Idempotency:**
Running `make seed` multiple times is safe:
```bash
make seed  # First run - inserts data
make seed  # Second run - updates existing data (no duplicates)
make seed  # Third run - still safe
```

---

## Auto-Seeding

Auto-seeding automatically populates the database with test data on first startup if the database is empty.

### Enable Auto-Seeding

Edit `.env` file:

```bash
AUTO_SEED_DATABASE=true
```

### How It Works

1. When you run `make dev`, the startup script checks the `AUTO_SEED_DATABASE` variable
2. If `true`, it queries the database to check if it's empty (checks users table)
3. If the database is empty, seed scripts are automatically executed
4. If the database already has data, seeding is skipped (idempotency)
5. Startup continues normally with or without seeding

### Startup Output (with auto-seed)

```
=====================================
  Zero-to-Running Development
=====================================
  Profile: full
=====================================

ℹ Checking Docker daemon...
✓ Docker daemon is running
...
✓ Database health verification passed

ℹ Checking for auto-seed configuration...
✓ AUTO_SEED_DATABASE=true and database is empty
ℹ Running seed scripts...

==============================================
  Database Seeding
==============================================
...
✓ Database auto-seeded successfully
ℹ Test users available with password: password123
```

### Disable Auto-Seeding

Set in `.env`:

```bash
AUTO_SEED_DATABASE=false
```

Or omit the variable entirely (defaults to false).

---

## Idempotency

All seed scripts are **idempotent**, meaning they can be run multiple times safely without creating duplicate data or errors.

### How Idempotency Works

Seed scripts use PostgreSQL's `INSERT ... ON CONFLICT` syntax:

```sql
INSERT INTO users (id, email, username, password_hash, ...)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@example.com',
    'admin',
    crypt('password123', gen_salt('bf')),
    ...
)
ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    ...;
```

**What this does:**
1. Tries to insert the record
2. If the record exists (conflict on email), updates it instead
3. No duplicate key errors
4. Consistent results across multiple runs

### Benefits

- **Safe to re-run**: No errors if data already exists
- **Updates existing data**: Changes to seed scripts are applied on next run
- **Development-friendly**: Reset data without dropping database
- **CI/CD compatible**: Can run seeds in automated pipelines

### Testing Idempotency

```bash
# Run seeds three times
make seed
make seed
make seed

# Verify no duplicate data
psql -h localhost -U postgres -d zero_to_running_dev
# SELECT COUNT(*) FROM users;  -- Should still be 5
```

---

## Customizing Seed Data

### Adding New Seed Data

1. **Create a new seed script** with the next sequence number:

```bash
touch infrastructure/database/seeds/002_additional_data.sql
```

2. **Use the idempotent pattern**:

```sql
-- Example: Add a new user
INSERT INTO users (id, email, username, password_hash, first_name, last_name, is_active, is_verified)
VALUES (
    '00000000-0000-0000-0000-000000000006',
    'newuser@example.com',
    'newuser',
    crypt('password123', gen_salt('bf')),
    'New',
    'User',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;
```

3. **Test your script**:

```bash
make seed
```

4. **Verify data**:

```bash
psql -h localhost -U postgres -d zero_to_running_dev
\c zero_to_running_dev
SELECT * FROM users WHERE email = 'newuser@example.com';
```

### Modifying Existing Seed Data

1. Edit the seed script file (e.g., `001_initial_seed.sql`)
2. Modify the data values
3. Run `make seed` to apply changes (idempotent)

**Example:**

```sql
-- Change admin user's name
INSERT INTO users (id, email, username, first_name, last_name, ...)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'admin', 'Super', 'Admin', ...)
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;
```

### Best Practices for Custom Seeds

1. **Use fixed UUIDs** for reproducibility:
   ```sql
   '00000000-0000-0000-0000-000000000001'  -- Users
   '10000000-0000-0000-0000-000000000001'  -- Sessions
   '20000000-0000-0000-0000-000000000001'  -- API Keys
   ```

2. **Respect foreign keys**: Create parent records before child records

3. **Add comments**: Document what each seed data represents

4. **Keep it minimal**: Include enough data for testing but not too much

5. **Use realistic data**: Mirror actual production usage patterns

6. **Test edge cases**: Include boundary conditions (nulls, long values, special characters)

### Seed Script Organization

Seed scripts are executed in numerical order:

```
001_initial_seed.sql        # Base users and entities
002_additional_users.sql    # More users
003_transactions.sql        # Sample transactions
004_relationships.sql       # Complex relationships
```

---

## Database Reset

The `make reset-db` command completely resets the database.

### Reset Database (No Seed)

```bash
make reset-db
```

**What it does:**
1. Prompts for confirmation (destructive operation)
2. Drops the existing database
3. Recreates the database
4. Runs schema migrations (init.sql)
5. Leaves database empty (no seed data)

### Reset Database with Seeding

```bash
make reset-db seed=true
```

**What it does:**
1. Drops the existing database
2. Recreates the database
3. Runs schema migrations
4. **Runs seed scripts** to populate test data

### Force Mode (Skip Confirmation)

The Makefile automatically uses force mode:

```bash
make reset-db          # Force mode enabled
make reset-db seed=true  # Force mode with seeding
```

To run manually with confirmation prompt:

```bash
bash infrastructure/scripts/reset-database.sh --seed
```

### When to Use Reset

- **Fresh start**: Start with a clean database
- **Schema changes**: After modifying database schema
- **Corrupted data**: Database in inconsistent state
- **Testing**: Before running integration tests
- **Development**: Switching between feature branches

⚠️ **WARNING**: This is a destructive operation. All data will be lost!

---

## Troubleshooting

### Database Not Running

**Error:**
```
✗ Cannot connect to database!
Please ensure:
  1. Database service is running (try: make dev)
```

**Solution:**
```bash
# Start services
make dev

# Check database status
make status

# View database logs
make logs service=postgres
```

### Permission Denied

**Error:**
```
✗ DATABASE_PASSWORD not set in .env file
```

**Solution:**
```bash
# Ensure .env exists
cp .env.example .env

# Edit .env and set DATABASE_PASSWORD
vim .env
```

### Seed Script Syntax Error

**Error:**
```
✗ Failed: 001_initial_seed.sql
ERROR:  syntax error at or near "..."
```

**Solution:**
1. Check SQL syntax in seed script
2. Test query manually in psql
3. Verify PostgreSQL compatibility

### Duplicate Key Errors

**Error:**
```
ERROR:  duplicate key value violates unique constraint "users_email_key"
```

**Solution:**
This shouldn't happen with idempotent scripts. Verify:
- Seed script uses `ON CONFLICT` clause
- Conflict target column is correct (e.g., `ON CONFLICT (email)`)
- Column has UNIQUE constraint

### Foreign Key Violations

**Error:**
```
ERROR:  insert or update on table "sessions" violates foreign key constraint
```

**Solution:**
- Ensure parent records exist before child records
- Check seed script execution order
- Verify user IDs match in sessions table

### Auto-Seed Not Running

**Symptom:** Database is empty after `make dev`

**Solution:**
1. Check `AUTO_SEED_DATABASE` in `.env`:
   ```bash
   grep AUTO_SEED_DATABASE .env
   ```

2. Ensure variable is set to `true`:
   ```bash
   AUTO_SEED_DATABASE=true
   ```

3. Verify database is actually empty:
   ```bash
   psql -h localhost -U postgres -d zero_to_running_dev -c "SELECT COUNT(*) FROM users;"
   ```

4. Run manual seed:
   ```bash
   make seed
   ```

---

## Best Practices

### Development Workflow

1. **Enable auto-seeding** during initial development:
   ```bash
   AUTO_SEED_DATABASE=true
   ```

2. **Use manual seeding** when you need fresh data:
   ```bash
   make seed
   ```

3. **Reset database** when schema changes:
   ```bash
   make reset-db seed=true
   ```

### Seed Data Management

1. **Keep seed data in version control**: Commit seed scripts to git
2. **Document seed changes**: Update comments when modifying data
3. **Test idempotency**: Run seeds multiple times to verify
4. **Use realistic data**: Mirror production patterns
5. **Include edge cases**: Test boundary conditions
6. **Maintain consistency**: Keep seed data aligned with schema

### Security Considerations

⚠️ **Development Only**: Seed data is for development and testing only.

- **Never use in production**: Seed data contains weak passwords and test data
- **No real user data**: Don't include actual user information
- **Mock secrets**: Passwords are intentionally weak (`password123`)
- **Committed to git**: Seed data is public - no sensitive information

### Testing with Seed Data

```bash
# Reset database with fresh seed data before tests
make reset-db seed=true

# Run your tests
npm test

# Or use seed data in integration tests
make seed
make test
```

### CI/CD Integration

```yaml
# Example: GitHub Actions
- name: Setup database
  run: |
    make dev
    make seed

- name: Run tests
  run: npm test

- name: Cleanup
  run: make down
```

---

## Advanced Usage

### Manual Seed Execution

Execute seed scripts manually with psql:

```bash
# Source environment variables
source .env

# Run seed script
psql -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USER -d $DATABASE_NAME \
  -f infrastructure/database/seeds/001_initial_seed.sql
```

### Querying Seed Data

```bash
# Connect to database
psql -h localhost -U postgres -d zero_to_running_dev

# Query users
SELECT email, username, is_active, is_verified, created_at FROM users;

# Query sessions
SELECT u.email, s.token, s.expires_at
FROM sessions s
JOIN users u ON s.user_id = u.id;

# Query API keys
SELECT u.email, a.name, a.is_active, a.expires_at
FROM api_keys a
JOIN users u ON a.user_id = u.id;

# Query audit logs
SELECT u.email, a.action, a.entity_type, a.created_at
FROM audit_logs a
LEFT JOIN users u ON a.user_id = u.id
ORDER BY a.created_at DESC;
```

### Seed Script Structure

Location: `/infrastructure/database/seeds/`

```
seeds/
├── README.md                    # Seed documentation
├── 001_initial_seed.sql         # Base seed data
├── 002_additional_data.sql      # Additional entities (optional)
└── 003_relationships.sql        # Complex relationships (optional)
```

Naming convention: `NNN_description.sql`
- `NNN`: Three-digit sequence number (001, 002, 003, ...)
- `description`: Brief description of seed data

---

## Related Documentation

- [README.md](../README.md) - Project overview and quick start
- [Database README](../infrastructure/database/README.md) - Database setup
- [Seeds README](../infrastructure/database/seeds/README.md) - Seed script details
- [Environment Configuration](.env.example) - Configuration variables

---

## Summary

Database seeding in Zero-to-Running provides:

✅ One-command seeding with `make seed`
✅ Automatic seeding on first startup with `AUTO_SEED_DATABASE=true`
✅ Idempotent scripts safe to run multiple times
✅ Realistic test data for immediate development
✅ Database reset with `make reset-db`
✅ Comprehensive documentation and examples

For more help, see:
- Seed script source: `/infrastructure/database/seeds/`
- Seed script runner: `/infrastructure/scripts/seed-database.sh`
- Reset script: `/infrastructure/scripts/reset-database.sh`
