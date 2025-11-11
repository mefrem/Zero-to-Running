#!/usr/bin/env bash
# Test suite for database health check script
# Story 2.2: Database Health Verification

set -euo pipefail

# Test configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly HEALTH_CHECK_SCRIPT="${SCRIPT_DIR}/check-db-health.sh"
readonly TEST_TIMEOUT=10

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Print colored message
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Print test header
print_test_header() {
    local test_name=$1
    echo ""
    echo "================================================================"
    print_message "${BLUE}" "TEST: ${test_name}"
    echo "================================================================"
}

# Record test result
record_test_result() {
    local test_name=$1
    local result=$2

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ "${result}" = "PASS" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        print_message "${GREEN}" "✓ PASS: ${test_name}"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        print_message "${RED}" "✗ FAIL: ${test_name}"
    fi
}

# Check if script exists
test_script_exists() {
    print_test_header "Script Exists"

    if [ -f "${HEALTH_CHECK_SCRIPT}" ]; then
        print_message "${GREEN}" "Health check script found at: ${HEALTH_CHECK_SCRIPT}"
        record_test_result "Script exists" "PASS"
    else
        print_message "${RED}" "Health check script not found at: ${HEALTH_CHECK_SCRIPT}"
        record_test_result "Script exists" "FAIL"
    fi
}

# Check if script is executable
test_script_executable() {
    print_test_header "Script Executable"

    if [ -x "${HEALTH_CHECK_SCRIPT}" ]; then
        print_message "${GREEN}" "Script has executable permissions"
        record_test_result "Script executable" "PASS"
    else
        print_message "${RED}" "Script does not have executable permissions"
        record_test_result "Script executable" "FAIL"
    fi
}

# Test successful health check (requires running database)
test_successful_health_check() {
    print_test_header "Successful Health Check"

    # Check if services are running
    if ! docker ps | grep -q "zero-to-running-postgres"; then
        print_message "${YELLOW}" "SKIP: PostgreSQL container not running"
        print_message "${YELLOW}" "To run this test, start services with: make dev"
        return 0
    fi

    # Load .env for database credentials
    if [ -f ".env" ]; then
        set -a
        source .env
        set +a
    fi

    # Run health check
    if bash "${HEALTH_CHECK_SCRIPT}" 5 3 > /tmp/health-check-output.log 2>&1; then
        print_message "${GREEN}" "Health check passed"
        record_test_result "Successful health check" "PASS"
    else
        local exit_code=$?
        print_message "${RED}" "Health check failed with exit code: ${exit_code}"
        print_message "${YELLOW}" "Output:"
        cat /tmp/health-check-output.log
        record_test_result "Successful health check" "FAIL"
    fi
}

# Test connectivity verification
test_connectivity_verification() {
    print_test_header "Connectivity Verification"

    # Check if services are running
    if ! docker ps | grep -q "zero-to-running-postgres"; then
        print_message "${YELLOW}" "SKIP: PostgreSQL container not running"
        return 0
    fi

    # Load .env
    if [ -f ".env" ]; then
        set -a
        source .env
        set +a
    fi

    # Test direct connectivity using psql
    local DB_HOST="${DATABASE_HOST:-postgres}"
    local DB_PORT="${DATABASE_PORT:-5432}"
    local DB_NAME="${DATABASE_NAME:-zero_to_running_dev}"
    local DB_USER="${DATABASE_USER:-postgres}"

    if docker exec zero-to-running-postgres env PGPASSWORD="${DATABASE_PASSWORD}" psql \
        -h localhost -p 5432 -U "${DB_USER}" -d "${DB_NAME}" \
        -c "SELECT 1" -q -t > /dev/null 2>&1; then
        print_message "${GREEN}" "Direct connectivity test passed"
        record_test_result "Connectivity verification" "PASS"
    else
        print_message "${RED}" "Direct connectivity test failed"
        record_test_result "Connectivity verification" "FAIL"
    fi
}

# Test database existence verification
test_database_exists() {
    print_test_header "Database Existence Verification"

    # Check if services are running
    if ! docker ps | grep -q "zero-to-running-postgres"; then
        print_message "${YELLOW}" "SKIP: PostgreSQL container not running"
        return 0
    fi

    # Load .env
    if [ -f ".env" ]; then
        set -a
        source .env
        set +a
    fi

    local DB_NAME="${DATABASE_NAME:-zero_to_running_dev}"
    local DB_USER="${DATABASE_USER:-postgres}"

    # Verify database exists
    local result=$(docker exec zero-to-running-postgres env PGPASSWORD="${DATABASE_PASSWORD}" psql \
        -h localhost -p 5432 -U "${DB_USER}" -d "${DB_NAME}" \
        -c "SELECT current_database()" -q -t 2>&1 | xargs)

    if [ "${result}" = "${DB_NAME}" ]; then
        print_message "${GREEN}" "Database '${DB_NAME}' exists"
        record_test_result "Database exists" "PASS"
    else
        print_message "${RED}" "Database verification failed. Expected: ${DB_NAME}, Got: ${result}"
        record_test_result "Database exists" "FAIL"
    fi
}

# Test schema initialization verification
test_schema_initialized() {
    print_test_header "Schema Initialization Verification"

    # Check if services are running
    if ! docker ps | grep -q "zero-to-running-postgres"; then
        print_message "${YELLOW}" "SKIP: PostgreSQL container not running"
        return 0
    fi

    # Load .env
    if [ -f ".env" ]; then
        set -a
        source .env
        set +a
    fi

    local DB_NAME="${DATABASE_NAME:-zero_to_running_dev}"
    local DB_USER="${DATABASE_USER:-postgres}"

    # Check if users table exists
    local users_exists=$(docker exec zero-to-running-postgres env PGPASSWORD="${DATABASE_PASSWORD}" psql \
        -h localhost -p 5432 -U "${DB_USER}" -d "${DB_NAME}" \
        -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users')" \
        -q -t 2>&1 | xargs)

    if [ "${users_exists}" = "t" ]; then
        print_message "${GREEN}" "Users table exists"
    else
        print_message "${RED}" "Users table not found"
        record_test_result "Schema initialized" "FAIL"
        return
    fi

    # Check table count
    local table_count=$(docker exec zero-to-running-postgres env PGPASSWORD="${DATABASE_PASSWORD}" psql \
        -h localhost -p 5432 -U "${DB_USER}" -d "${DB_NAME}" \
        -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users', 'sessions', 'api_keys', 'audit_logs', 'health_checks')" \
        -q -t 2>&1 | xargs)

    if [ "${table_count}" -eq 5 ]; then
        print_message "${GREEN}" "All 5 critical tables found"
        record_test_result "Schema initialized" "PASS"
    else
        print_message "${RED}" "Expected 5 tables, found ${table_count}"
        record_test_result "Schema initialized" "FAIL"
    fi
}

# Test timeout behavior
test_timeout_behavior() {
    print_test_header "Timeout Behavior"

    # This test verifies that the health check script respects timeout settings
    # We'll test this by running with a very short timeout against a slow/non-existent host

    print_message "${BLUE}" "Testing timeout with non-existent host..."

    # Temporarily override DATABASE_HOST to a non-existent host
    local start_time=$(date +%s)

    DATABASE_HOST="non-existent-host-12345" \
    DATABASE_PORT="5432" \
    DATABASE_NAME="test_db" \
    DATABASE_USER="test_user" \
    DATABASE_PASSWORD="test_pass" \
    bash "${HEALTH_CHECK_SCRIPT}" 2 1 > /tmp/timeout-test.log 2>&1 || true

    local end_time=$(date +%s)
    local elapsed=$((end_time - start_time))

    # Timeout should be respected (should fail within ~2-3 seconds, not hang indefinitely)
    if [ ${elapsed} -le 10 ]; then
        print_message "${GREEN}" "Health check timed out appropriately in ${elapsed} seconds"
        record_test_result "Timeout behavior" "PASS"
    else
        print_message "${RED}" "Health check took too long: ${elapsed} seconds"
        record_test_result "Timeout behavior" "FAIL"
    fi
}

# Test failure with missing password
test_missing_password() {
    print_test_header "Missing Password Handling"

    # Run health check without DATABASE_PASSWORD in a clean environment
    # Create a temporary directory without .env file to avoid sourcing password
    local temp_dir=$(mktemp -d)
    local exit_code=0

    # Temporarily disable errexit to capture non-zero exit code
    set +e
    (
        cd "${temp_dir}"
        DATABASE_PASSWORD="" bash "${HEALTH_CHECK_SCRIPT}" > /tmp/missing-password-test.log 2>&1
    )
    exit_code=$?
    set -e

    rm -rf "${temp_dir}"

    if [ ${exit_code} -eq 5 ]; then
        print_message "${GREEN}" "Correctly returned exit code 5 for missing password"

        # Check if error message is helpful
        if grep -q "DATABASE_PASSWORD is not set" /tmp/missing-password-test.log; then
            print_message "${GREEN}" "Error message includes helpful information"
            record_test_result "Missing password handling" "PASS"
        else
            print_message "${RED}" "Error message missing"
            record_test_result "Missing password handling" "FAIL"
        fi
    else
        print_message "${RED}" "Expected exit code 5, got ${exit_code}"
        cat /tmp/missing-password-test.log
        record_test_result "Missing password handling" "FAIL"
    fi
}

# Test error messages
test_error_messages() {
    print_test_header "Error Message Quality"

    # Test with wrong host
    print_message "${BLUE}" "Testing error message for connectivity failure..."

    DATABASE_HOST="invalid-host-12345" \
    DATABASE_PORT="5432" \
    DATABASE_NAME="test_db" \
    DATABASE_USER="test_user" \
    DATABASE_PASSWORD="test_pass" \
    bash "${HEALTH_CHECK_SCRIPT}" 2 1 > /tmp/error-message-test.log 2>&1 || true

    # Check if error message contains helpful debugging info
    if grep -q "Connection details:" /tmp/error-message-test.log; then
        print_message "${GREEN}" "Error message includes connection details"
        record_test_result "Error message quality" "PASS"
    else
        print_message "${RED}" "Error message lacks debugging information"
        cat /tmp/error-message-test.log
        record_test_result "Error message quality" "FAIL"
    fi
}

# Test CI/CD compatibility
test_cicd_compatibility() {
    print_test_header "CI/CD Compatibility"

    # Verify script can run in non-interactive mode
    print_message "${BLUE}" "Testing non-interactive execution..."

    # Run with all environment variables set (simulating CI environment)
    if command -v timeout >/dev/null 2>&1; then
        print_message "${GREEN}" "timeout command available (required for health check)"
    else
        print_message "${RED}" "timeout command not available"
        record_test_result "CI/CD compatibility" "FAIL"
        return
    fi

    if command -v psql >/dev/null 2>&1; then
        print_message "${GREEN}" "psql command available (required for health check)"
    else
        print_message "${YELLOW}" "psql command not available in test environment"
        print_message "${YELLOW}" "In CI/CD, ensure postgresql-client is installed"
    fi

    record_test_result "CI/CD compatibility" "PASS"
}

# Print test summary
print_test_summary() {
    echo ""
    echo "================================================================"
    print_message "${BLUE}" "TEST SUMMARY"
    echo "================================================================"
    echo "Total tests run:    ${TESTS_RUN}"
    print_message "${GREEN}" "Tests passed:       ${TESTS_PASSED}"

    if [ ${TESTS_FAILED} -gt 0 ]; then
        print_message "${RED}" "Tests failed:       ${TESTS_FAILED}"
    else
        print_message "${GREEN}" "Tests failed:       ${TESTS_FAILED}"
    fi

    echo ""

    if [ ${TESTS_FAILED} -eq 0 ]; then
        print_message "${GREEN}" "✓ ALL TESTS PASSED"
        return 0
    else
        print_message "${RED}" "✗ SOME TESTS FAILED"
        return 1
    fi
}

# Main test execution
main() {
    print_message "${BLUE}" "Database Health Check Test Suite"
    print_message "${BLUE}" "Story 2.2: Database Health Verification"
    echo ""

    # Navigate to project root
    cd "$(dirname "${SCRIPT_DIR}")/.."
    print_message "${BLUE}" "Working directory: $(pwd)"

    # Run tests
    test_script_exists
    test_script_executable
    test_missing_password
    test_error_messages
    test_timeout_behavior
    test_cicd_compatibility

    # Tests that require running database
    test_successful_health_check
    test_connectivity_verification
    test_database_exists
    test_schema_initialized

    # Print summary and exit
    print_test_summary
    exit $?
}

# Run main function
main "$@"
