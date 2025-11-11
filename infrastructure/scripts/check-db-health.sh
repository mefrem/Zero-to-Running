#!/usr/bin/env bash
# Database Health Check Script
# Verifies PostgreSQL connectivity, database existence, and schema initialization
# Story 2.2: Database Health Verification

set -euo pipefail

# Configuration
readonly TIMEOUT=${1:-5}
readonly MAX_RETRIES=${2:-5}
readonly RETRY_DELAY=1

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Load environment variables from .env if running from project root
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Database connection parameters
readonly DB_HOST="${DATABASE_HOST:-postgres}"
readonly DB_PORT="${DATABASE_PORT:-5432}"
readonly DB_NAME="${DATABASE_NAME:-zero_to_running_dev}"
readonly DB_USER="${DATABASE_USER:-postgres}"
readonly DB_PASSWORD="${DATABASE_PASSWORD:-}"

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_CONNECTIVITY_FAILURE=1
readonly EXIT_DATABASE_NOT_FOUND=2
readonly EXIT_SCHEMA_NOT_INITIALIZED=3
readonly EXIT_TIMEOUT=4
readonly EXIT_MISSING_PASSWORD=5

# Print colored message
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}" >&2
}

# Check if required tools are available
check_prerequisites() {
    if ! command -v psql >/dev/null 2>&1; then
        print_message "${RED}" "ERROR: psql command not found. Please install postgresql-client."
        exit ${EXIT_CONNECTIVITY_FAILURE}
    fi

    if [ -z "${DB_PASSWORD}" ]; then
        print_message "${RED}" "ERROR: DATABASE_PASSWORD is not set."
        print_message "${YELLOW}" "Please set DATABASE_PASSWORD environment variable or in .env file."
        exit ${EXIT_MISSING_PASSWORD}
    fi
}

# Execute psql command with timeout
execute_psql() {
    local sql_command=$1
    local result

    # Use timeout command and psql with connection timeout
    # PGPASSWORD allows password to be passed without prompting
    result=$(timeout ${TIMEOUT} env PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --no-password \
        --tuples-only \
        --no-align \
        --quiet \
        -c "${sql_command}" 2>&1) || return $?

    echo "${result}"
    return 0
}

# Test basic database connectivity
test_connectivity() {
    print_message "${BLUE}" "Checking database connectivity..."

    local result
    if result=$(execute_psql "SELECT 1"); then
        if [ "${result}" = "1" ]; then
            print_message "${GREEN}" "✓ Database connectivity verified"
            return 0
        else
            print_message "${RED}" "✗ Unexpected response from database: ${result}"
            return ${EXIT_CONNECTIVITY_FAILURE}
        fi
    else
        local exit_code=$?
        if [ ${exit_code} -eq 124 ]; then
            print_message "${RED}" "✗ Database connection timed out after ${TIMEOUT} seconds"
            return ${EXIT_TIMEOUT}
        else
            print_message "${RED}" "✗ Failed to connect to database"
            print_message "${YELLOW}" "Connection details: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
            return ${EXIT_CONNECTIVITY_FAILURE}
        fi
    fi
}

# Verify database exists
verify_database_exists() {
    print_message "${BLUE}" "Verifying database exists..."

    local result
    if result=$(execute_psql "SELECT current_database()"); then
        if [ "${result}" = "${DB_NAME}" ]; then
            print_message "${GREEN}" "✓ Database '${DB_NAME}' exists"
            return 0
        else
            print_message "${RED}" "✗ Connected to wrong database: ${result}"
            return ${EXIT_DATABASE_NOT_FOUND}
        fi
    else
        print_message "${RED}" "✗ Failed to verify database existence"
        return ${EXIT_DATABASE_NOT_FOUND}
    fi
}

# Verify schema is initialized (check for users table)
verify_schema_initialized() {
    print_message "${BLUE}" "Verifying schema initialization..."

    local result
    result=$(execute_psql "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users')") || {
        print_message "${RED}" "✗ Failed to query schema information"
        return ${EXIT_SCHEMA_NOT_INITIALIZED}
    }

    if [ "${result}" = "t" ]; then
        print_message "${GREEN}" "✓ Schema initialized (users table exists)"
    else
        print_message "${RED}" "✗ Schema not initialized (users table not found)"
        return ${EXIT_SCHEMA_NOT_INITIALIZED}
    fi

    # Also verify other critical tables
    result=$(execute_psql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users', 'sessions', 'api_keys', 'audit_logs', 'health_checks')") || {
        print_message "${RED}" "✗ Failed to query table count"
        return ${EXIT_SCHEMA_NOT_INITIALIZED}
    }

    local expected_tables=5
    if [ "${result}" -eq ${expected_tables} ]; then
        print_message "${GREEN}" "✓ All ${expected_tables} critical tables found"
        return 0
    else
        print_message "${YELLOW}" "⚠ Warning: Found ${result} of ${expected_tables} expected tables"
        print_message "${YELLOW}" "Expected tables: users, sessions, api_keys, audit_logs, health_checks"
        return ${EXIT_SCHEMA_NOT_INITIALIZED}
    fi
}

# Perform complete health check
perform_health_check() {
    print_message "${BLUE}" "Starting database health check..."
    print_message "${BLUE}" "Target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    print_message "${BLUE}" "Timeout: ${TIMEOUT} seconds"
    echo "" >&2

    # Run all checks
    test_connectivity || return $?
    verify_database_exists || return $?
    verify_schema_initialized || return $?

    echo "" >&2
    print_message "${GREEN}" "✓ Database health check PASSED"
    return ${EXIT_SUCCESS}
}

# Perform health check with retries
perform_health_check_with_retries() {
    local retry_count=0

    while [ ${retry_count} -lt ${MAX_RETRIES} ]; do
        if [ ${retry_count} -gt 0 ]; then
            print_message "${YELLOW}" "Retry ${retry_count}/${MAX_RETRIES} after ${RETRY_DELAY} second(s)..."
            sleep ${RETRY_DELAY}
        fi

        if perform_health_check; then
            return ${EXIT_SUCCESS}
        fi

        retry_count=$((retry_count + 1))

        if [ ${retry_count} -lt ${MAX_RETRIES} ]; then
            echo "" >&2
            print_message "${YELLOW}" "Health check failed, retrying..."
            echo "" >&2
        fi
    done

    echo "" >&2
    print_message "${RED}" "✗ Database health check FAILED after ${MAX_RETRIES} attempts"
    return ${EXIT_CONNECTIVITY_FAILURE}
}

# Main execution
main() {
    check_prerequisites
    perform_health_check_with_retries
    exit $?
}

# Run main function
main "$@"
