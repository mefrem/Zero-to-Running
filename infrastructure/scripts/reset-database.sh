#!/usr/bin/env bash
# ============================================================================
# Database Reset Script
# ============================================================================
# Purpose: Drop, recreate, and optionally reseed the database
# Usage: bash infrastructure/scripts/reset-database.sh [--seed|--no-seed] [--force]
#        OR: make reset-db
#        OR: make reset-db seed=true
#
# This script:
# - Drops the existing database (with confirmation)
# - Recreates the database with same credentials
# - Runs schema migration (init.sql)
# - Optionally runs seed scripts
#
# ⚠️  WARNING: This is a DESTRUCTIVE operation - all data will be lost!
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# ============================================================================
# Script Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
INIT_SQL="$PROJECT_ROOT/infrastructure/database/init.sql"
SEED_SCRIPT="$SCRIPT_DIR/seed-database.sh"

# Default options
RUN_SEEDS=false
FORCE_MODE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo "=============================================="
    echo "  Database Reset"
    echo "=============================================="
    echo ""
}

print_footer() {
    echo ""
    echo "=============================================="
}

# ============================================================================
# Parse Command Line Arguments
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --seed)
                RUN_SEEDS=true
                shift
                ;;
            --no-seed)
                RUN_SEEDS=false
                shift
                ;;
            --force)
                FORCE_MODE=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Usage: $0 [--seed|--no-seed] [--force]"
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# Environment Loading
# ============================================================================

load_environment() {
    log_info "Loading environment configuration..."

    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file not found: $ENV_FILE"
        log_error "Please copy .env.example to .env and configure it"
        exit 1
    fi

    # Load .env file (ignore comments and empty lines)
    set -a
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^$' | sed 's/\r$//')
    set +a

    # Set defaults if not provided
    export DATABASE_HOST="${DATABASE_HOST:-localhost}"
    export DATABASE_PORT="${DATABASE_PORT:-5432}"
    export DATABASE_NAME="${DATABASE_NAME:-zero_to_running_dev}"
    export DATABASE_USER="${DATABASE_USER:-postgres}"

    if [ -z "${DATABASE_PASSWORD:-}" ]; then
        log_error "DATABASE_PASSWORD not set in .env file"
        exit 1
    fi

    log_success "Environment loaded"
    log_info "Database: ${DATABASE_NAME} @ ${DATABASE_HOST}:${DATABASE_PORT}"
}

# ============================================================================
# Confirmation Prompt
# ============================================================================

confirm_reset() {
    if [ "$FORCE_MODE" = true ]; then
        log_warning "Force mode enabled - skipping confirmation"
        return 0
    fi

    echo ""
    log_warning "⚠️  WARNING: This will DELETE ALL DATA in the database!"
    log_warning "Database: ${DATABASE_NAME}"
    log_warning "Host: ${DATABASE_HOST}:${DATABASE_PORT}"
    echo ""
    echo -n "Are you sure you want to continue? Type 'yes' to confirm: "
    read -r confirmation

    if [ "$confirmation" != "yes" ]; then
        log_info "Reset cancelled by user"
        exit 0
    fi

    log_info "Confirmation received - proceeding with reset"
}

# ============================================================================
# Database Operations
# ============================================================================

check_postgres_connection() {
    log_info "Checking PostgreSQL server connection..."

    # Set PGPASSWORD for psql authentication
    export PGPASSWORD="$DATABASE_PASSWORD"

    # Connect to default 'postgres' database to check server availability
    if ! psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "postgres" -c "SELECT 1" > /dev/null 2>&1; then
        log_error "Cannot connect to PostgreSQL server!"
        log_error "Please ensure:"
        log_error "  1. PostgreSQL service is running (try: make dev)"
        log_error "  2. Database credentials in .env are correct"
        exit 1
    fi

    log_success "PostgreSQL server connection verified"
}

drop_database() {
    log_info "Dropping database '$DATABASE_NAME'..."

    # Terminate existing connections to the database
    psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "postgres" -c "
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '$DATABASE_NAME'
        AND pid <> pg_backend_pid();
    " > /dev/null 2>&1 || true

    # Drop database if it exists
    psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "postgres" -c "DROP DATABASE IF EXISTS $DATABASE_NAME;" > /dev/null 2>&1

    log_success "Database dropped"
}

create_database() {
    log_info "Creating database '$DATABASE_NAME'..."

    # Create database
    psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "postgres" -c "CREATE DATABASE $DATABASE_NAME;" > /dev/null 2>&1

    log_success "Database created"
}

run_schema_migration() {
    log_info "Running schema migration..."

    if [ ! -f "$INIT_SQL" ]; then
        log_error "Schema migration file not found: $INIT_SQL"
        exit 1
    fi

    # Execute init.sql to create schema
    if psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -f "$INIT_SQL" 2>&1 | grep -v "NOTICE\|HINT" > /dev/null; then
        log_success "Schema migration completed"
    else
        log_error "Schema migration failed"
        exit 1
    fi
}

run_seed_scripts() {
    if [ "$RUN_SEEDS" = true ]; then
        echo ""
        log_info "Running seed scripts..."

        if [ ! -f "$SEED_SCRIPT" ]; then
            log_error "Seed script not found: $SEED_SCRIPT"
            exit 1
        fi

        if bash "$SEED_SCRIPT"; then
            log_success "Seed scripts completed"
        else
            log_error "Seed scripts failed"
            exit 1
        fi
    else
        log_info "Skipping seed scripts (use --seed flag to enable)"
    fi
}

verify_database() {
    log_info "Verifying database state..."

    # Check if database exists and is accessible
    if ! psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        log_error "Database verification failed"
        exit 1
    fi

    # Count tables
    local table_count=$(psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -t -c "
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE';
    " 2>/dev/null | xargs)

    log_success "Database is healthy"
    log_info "Tables created: $table_count"

    if [ "$RUN_SEEDS" = true ]; then
        local user_count=$(psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs)
        log_info "Seed data: $user_count user(s) loaded"
    fi
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Parse command line arguments
    parse_arguments "$@"

    print_header

    # Load environment variables
    load_environment

    # Confirm destructive operation
    confirm_reset

    # Check PostgreSQL server connection
    check_postgres_connection

    echo ""
    log_info "Starting database reset process..."
    echo ""

    # Drop existing database
    drop_database

    # Create new database
    create_database

    # Run schema migration
    run_schema_migration

    # Optionally run seed scripts
    run_seed_scripts

    # Verify database state
    echo ""
    verify_database

    print_footer
    log_success "Database reset completed successfully!"
    echo ""

    if [ "$RUN_SEEDS" = true ]; then
        log_info "Database is ready with test data"
        log_info "Test users available with password: password123"
    else
        log_info "Database is ready (empty - no seed data)"
        log_info "Run 'make seed' to populate with test data"
    fi

    print_footer
    echo ""
}

# Run main function
main "$@"
