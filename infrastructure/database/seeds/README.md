# Database Seed Scripts

This directory contains SQL scripts for populating the database with test data for development.

## Overview

Seed scripts provide realistic test data that allows developers to immediately start testing features without manually creating data. All seed scripts are **idempotent**, meaning they can be safely run multiple times without creating duplicate data or errors.

## Seed Script Organization

### Naming Convention

Seed scripts use a numerical prefix for ordering:

```
001_initial_seed.sql        # Base seed data (users, sessions, API keys)
002_additional_data.sql     # Additional entities (if needed)
003_relationships.sql       # Complex relationships (if needed)
```

Scripts are executed in numerical order to ensure dependencies are satisfied.

### Current Seed Scripts

- **001_initial_seed.sql**: Core seed data including:
  - 5 test users with different states (active, inactive, verified, unverified)
  - 2 active user sessions
  - 3 API keys (2 active, 1 inactive)
  - 5 audit log entries showing user activity
  - 4 health check records

## Available Test Data

### Test Users

All test users use the password: `password123`

| Email | Username | State | Description |
|-------|----------|-------|-------------|
| admin@example.com | admin | Active, Verified | Admin user with full access |
| john.doe@example.com | johndoe | Active, Verified | Regular active user |
| jane.smith@example.com | janesmith | Active, Unverified | User who hasn't confirmed email |
| disabled.user@example.com | disableduser | Inactive, Verified | Disabled account |
| developer@example.com | developer | Active, Verified | Developer account for API testing |

### Test Sessions

- Admin user session (expires in 7 days)
- John Doe user session (expires in 7 days)

### Test API Keys

- Admin production API key (active, expires in 365 days)
- Developer test API key (active, expires in 90 days)
- John Doe old API key (inactive, expired)

### Audit Logs

Sample audit logs include:
- User login events
- Profile updates
- API key creation
- Failed login attempts
- Account disable actions

### Health Checks

Historical health check data for:
- Database service
- Backend service
- Redis cache service
- Degraded state examples

## Running Seed Scripts

### Via Make Command (Recommended)

```bash
# Seed the database with test data
make seed
```

### Manually with psql

```bash
# Source environment variables
source .env

# Run seed script manually
psql -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USER -d $DATABASE_NAME -f infrastructure/database/seeds/001_initial_seed.sql
```

### Automatic Seeding on Startup

Set the environment variable in `.env`:

```bash
AUTO_SEED_DATABASE=true
```

With this setting, the database will be automatically seeded on first startup if it's empty.

## Idempotency Strategy

All seed scripts use PostgreSQL's `INSERT ... ON CONFLICT` syntax to ensure idempotency:

```sql
INSERT INTO users (id, email, username, ...)
VALUES (...)
ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    ...;
```

This approach:
- Inserts data if it doesn't exist
- Updates existing data with new values if it already exists
- Prevents duplicate key errors
- Ensures consistent results across multiple runs

## Adding New Seed Data

### Creating a New Seed Script

1. Create a new file with the next sequence number:
   ```bash
   touch infrastructure/database/seeds/002_my_new_data.sql
   ```

2. Use the idempotent pattern:
   ```sql
   -- Add your seed data
   INSERT INTO table_name (id, column1, column2)
   VALUES ('fixed-uuid', 'value1', 'value2')
   ON CONFLICT (unique_column) DO UPDATE SET
       column1 = EXCLUDED.column1,
       column2 = EXCLUDED.column2;
   ```

3. Test your script:
   ```bash
   # Run seed command
   make seed

   # Verify data
   psql -h localhost -U postgres -d zero_to_running_dev -c "SELECT * FROM table_name;"
   ```

4. Test idempotency:
   ```bash
   # Run seed command multiple times
   make seed
   make seed
   make seed

   # Verify no duplicate data created
   ```

### Best Practices

1. **Use Fixed UUIDs**: Use predictable UUIDs for seed data to maintain consistency
   ```sql
   '00000000-0000-0000-0000-000000000001'  -- User ID format
   '10000000-0000-0000-0000-000000000001'  -- Session ID format
   '20000000-0000-0000-0000-000000000001'  -- API Key ID format
   ```

2. **Respect Foreign Keys**: Ensure referenced records exist before creating dependent records

3. **Use Realistic Data**: Create data that mirrors actual production usage

4. **Add Comments**: Document what each section of seed data represents

5. **Keep It Minimal**: Include enough data for testing but not so much it slows down startup

6. **Test Edge Cases**: Include data that tests boundary conditions (empty strings, nulls, long values)

## Modifying Existing Seed Data

To modify seed data:

1. Edit the seed script file directly
2. Run `make seed` to apply changes (idempotent)
3. Or run `make reset-db --seed` to reset and reseed from scratch

Changes to seed scripts will be applied on the next seed run due to the `ON CONFLICT` update behavior.

## Resetting the Database

To completely reset the database:

```bash
# Reset database without seeding
make reset-db

# Reset database and reseed with test data
make reset-db --seed
```

**Warning**: This will delete all data in the database!

## Troubleshooting

### "Database not running" Error

Ensure the database service is running:
```bash
make dev
make status
```

### "Permission denied" Error

Check database credentials in `.env` file:
```bash
cat .env | grep DATABASE
```

### Foreign Key Constraint Violations

Ensure seed scripts are executed in the correct order. Dependencies must be created before dependent records.

### Duplicate Key Errors

If you encounter duplicate key errors despite using `ON CONFLICT`, verify:
- The conflict target column is correct
- The column has a UNIQUE constraint or is a PRIMARY KEY
- You're matching on the right column

## Environment Variables

Seed scripts use these environment variables from `.env`:

- `DATABASE_HOST`: Database hostname (default: localhost)
- `DATABASE_PORT`: Database port (default: 5432)
- `DATABASE_NAME`: Database name
- `DATABASE_USER`: Database username
- `DATABASE_PASSWORD`: Database password
- `AUTO_SEED_DATABASE`: Auto-seed on startup (true/false)

## Seed Script Execution Flow

1. Load environment variables from `.env`
2. Verify database is running and accessible
3. List all seed scripts in `/infrastructure/database/seeds/`
4. Sort scripts by filename (numerical order)
5. Execute each script in sequence
6. Check for errors and rollback on failure
7. Display completion summary

## Testing Seed Data

After seeding, verify data is present:

```bash
# Connect to database
psql -h localhost -U postgres -d zero_to_running_dev

# Check users
SELECT email, username, is_active, is_verified FROM users;

# Check sessions
SELECT user_id, token, expires_at FROM sessions;

# Check API keys
SELECT user_id, name, is_active FROM api_keys;

# Check audit logs
SELECT action, entity_type, created_at FROM audit_logs ORDER BY created_at DESC;

# Check health checks
SELECT service_name, status, checked_at FROM health_checks ORDER BY checked_at DESC;
```

## Security Notes

⚠️ **Development Only**: Seed data is for development and testing only. **Never use seed data in production!**

- Seed passwords are intentionally weak (`password123`)
- Seed data is committed to version control
- Test data does not contain real user information
- Seed scripts should never contain production secrets

## Further Documentation

For more detailed information, see:
- [DATABASE_SEEDING.md](/docs/DATABASE_SEEDING.md) - Comprehensive seeding guide
- [README.md](/README.md) - Project overview and quick start
- [init.sql](../init.sql) - Database schema definition
