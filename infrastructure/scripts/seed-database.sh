#!/usr/bin/env bash
# ============================================================================
# Database Seeding Script
# ============================================================================
# Purpose: Populate database with test data from seed SQL scripts
# Usage: bash infrastructure/scripts/seed-database.sh
#        OR: make seed
#
# This script:
# - Loads database configuration from .env
# - Verifies database is running and accessible
# - Executes all seed scripts in /infrastructure/database/seeds/
# - Reports progress and completion status
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
SEEDS_DIR="$PROJECT_ROOT/infrastructure/database/seeds"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
    echo "  Database Seeding"
    echo "=============================================="
    echo ""
}

print_footer() {
    echo ""
    echo "=============================================="
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
# Database Health Check
# ============================================================================

check_database_connection() {
    log_info "Checking database connection..."

    # Set PGPASSWORD for psql authentication
    export PGPASSWORD="$DATABASE_PASSWORD"

    # Try to connect to database
    if ! psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        log_error "Cannot connect to database!"
        log_error "Please ensure:"
        log_error "  1. Database service is running (try: make dev)"
        log_error "  2. Database credentials in .env are correct"
        log_error "  3. Database '$DATABASE_NAME' exists"
        exit 1
    fi

    log_success "Database connection verified"
}

# ============================================================================
# Seed Script Discovery
# ============================================================================

find_seed_scripts() {
    if [ ! -d "$SEEDS_DIR" ]; then
        log_error "Seeds directory not found: $SEEDS_DIR"
        exit 1
    fi

    # Find all .sql files and sort them numerically
    SEED_SCRIPTS=$(find "$SEEDS_DIR" -maxdepth 1 -name "*.sql" -type f | sort)

    if [ -z "$SEED_SCRIPTS" ]; then
        log_warning "No seed scripts found in $SEEDS_DIR"
        log_info "Add .sql files to the seeds directory to populate test data"
        exit 0
    fi

    SCRIPT_COUNT=$(echo "$SEED_SCRIPTS" | wc -l | xargs)
    log_info "Found $SCRIPT_COUNT seed script(s)"
}

# ============================================================================
# Seed Script Execution
# ============================================================================

execute_seed_script() {
    local script_path="$1"
    local script_name=$(basename "$script_path")

    log_info "Executing: $script_name"

    # Execute SQL script with transaction support
    # Note: Individual scripts can define their own transaction boundaries
    if psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -f "$script_path" 2>&1 | grep -v "NOTICE\|HINT"; then
        log_success "Completed: $script_name"
        return 0
    else
        log_error "Failed: $script_name"
        return 1
    fi
}

execute_all_seeds() {
    log_info "Executing seed scripts..."
    echo ""

    local failed_scripts=0
    local success_count=0

    while IFS= read -r script; do
        if execute_seed_script "$script"; then
            ((success_count++))
        else
            ((failed_scripts++))
        fi
        echo ""
    done <<< "$SEED_SCRIPTS"

    if [ $failed_scripts -gt 0 ]; then
        log_error "$failed_scripts script(s) failed"
        exit 1
    fi

    log_success "All $success_count script(s) executed successfully"
}

# ============================================================================
# Data Verification
# ============================================================================

verify_seed_data() {
    log_info "Verifying seed data..."

    # Query to check if we have seed data
    local user_count=$(psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs)

    if [ -z "$user_count" ] || [ "$user_count" -eq 0 ]; then
        log_warning "No users found in database after seeding"
    else
        log_success "Found $user_count user(s) in database"
    fi

    # Check other tables
    local session_count=$(psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -t -c "SELECT COUNT(*) FROM sessions;" 2>/dev/null | xargs)
    local api_key_count=$(psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -t -c "SELECT COUNT(*) FROM api_keys;" 2>/dev/null | xargs)

    log_info "Seed data summary:"
    log_info "  - Users: $user_count"
    log_info "  - Sessions: $session_count"
    log_info "  - API Keys: $api_key_count"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    print_header

    # Load environment variables
    load_environment

    # Check database connection
    check_database_connection

    # Find seed scripts
    find_seed_scripts

    # Execute all seed scripts
    execute_all_seeds

    # Verify data was inserted
    verify_seed_data

    print_footer
    log_success "Database seeding completed!"
    echo ""
    log_info "Test user credentials (all users):"
    log_info "  Password: password123"
    echo ""
    log_info "Example test users:"
    log_info "  - admin@example.com (admin user)"
    log_info "  - john.doe@example.com (regular user)"
    log_info "  - developer@example.com (developer user)"
    echo ""
    log_info "Note: This script is idempotent - safe to run multiple times"
    print_footer
    echo ""
}

# Run main function
main "$@"
