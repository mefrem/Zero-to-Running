#!/usr/bin/env bash
# ============================================================================
# Database Seeding Tests
# ============================================================================
# Tests for database seeding functionality (Story 3.5)
#
# Coverage:
# - AC1: Seed scripts exist in /infrastructure/database/seeds/
# - AC2: make seed command runs seed scripts
# - AC3: Seed scripts are idempotent
# - AC4: Seed data includes users, entities, and relationships
# - AC5: make reset-db command functionality
# - AC6: Documentation is comprehensive
# - AC7: AUTO_SEED_DATABASE environment variable controls seeding
#
# Usage: bash infrastructure/__tests__/seed-database.test.sh
# ============================================================================

set -e
set -o pipefail

# ============================================================================
# Test Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_ENV_FILE="$PROJECT_ROOT/.env.test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_test_header() {
    echo ""
    echo "=============================================="
    echo "  $1"
    echo "=============================================="
    echo ""
}

print_test_result() {
    local test_name="$1"
    local result="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ "$result" = "PASS" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        log_success "TEST PASSED: $test_name"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        log_error "TEST FAILED: $test_name"
    fi
}

# ============================================================================
# Database Helper Functions
# ============================================================================

setup_test_env() {
    log_info "Setting up test environment..."

    # Copy .env if doesn't exist
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    fi

    # Source environment
    set -a
    source "$PROJECT_ROOT/.env"
    set +a

    export PGPASSWORD="${DATABASE_PASSWORD}"
}

get_user_count() {
    psql -h "${DATABASE_HOST:-localhost}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-zero_to_running_dev}" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs || echo "0"
}

get_session_count() {
    psql -h "${DATABASE_HOST:-localhost}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-zero_to_running_dev}" -t -c "SELECT COUNT(*) FROM sessions;" 2>/dev/null | xargs || echo "0"
}

get_api_key_count() {
    psql -h "${DATABASE_HOST:-localhost}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-zero_to_running_dev}" -t -c "SELECT COUNT(*) FROM api_keys;" 2>/dev/null | xargs || echo "0"
}

clear_database() {
    log_info "Clearing database..."
    psql -h "${DATABASE_HOST:-localhost}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-zero_to_running_dev}" -c "
        TRUNCATE TABLE audit_logs CASCADE;
        TRUNCATE TABLE sessions CASCADE;
        TRUNCATE TABLE api_keys CASCADE;
        TRUNCATE TABLE users CASCADE;
        DELETE FROM health_checks WHERE service_name != 'database';
    " > /dev/null 2>&1 || true
}

check_database_connection() {
    if ! psql -h "${DATABASE_HOST:-localhost}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-zero_to_running_dev}" -c "SELECT 1" > /dev/null 2>&1; then
        log_error "Cannot connect to database. Please start services with: make dev"
        exit 1
    fi
}

# ============================================================================
# Test Cases
# ============================================================================

test_seed_directory_exists() {
    local test_name="Seed directory exists"

    if [ -d "$PROJECT_ROOT/infrastructure/database/seeds" ]; then
        print_test_result "$test_name" "PASS"
    else
        print_test_result "$test_name" "FAIL"
    fi
}

test_seed_scripts_exist() {
    local test_name="Seed scripts exist"

    local script_count=$(find "$PROJECT_ROOT/infrastructure/database/seeds" -name "*.sql" -type f | wc -l)

    if [ "$script_count" -gt 0 ]; then
        log_info "Found $script_count seed script(s)"
        print_test_result "$test_name" "PASS"
    else
        log_error "No seed scripts found"
        print_test_result "$test_name" "FAIL"
    fi
}

test_seed_readme_exists() {
    local test_name="Seed README documentation exists"

    if [ -f "$PROJECT_ROOT/infrastructure/database/seeds/README.md" ]; then
        print_test_result "$test_name" "PASS"
    else
        print_test_result "$test_name" "FAIL"
    fi
}

test_make_seed_fresh_database() {
    local test_name="make seed populates fresh database"

    log_info "Clearing database..."
    clear_database

    log_info "Running make seed..."
    if make -C "$PROJECT_ROOT" seed > /dev/null 2>&1; then
        local user_count=$(get_user_count)

        if [ "$user_count" -gt 0 ]; then
            log_info "Found $user_count users after seeding"
            print_test_result "$test_name" "PASS"
        else
            log_error "No users found after seeding"
            print_test_result "$test_name" "FAIL"
        fi
    else
        log_error "make seed command failed"
        print_test_result "$test_name" "FAIL"
    fi
}

test_seed_idempotency() {
    local test_name="Seed is idempotent (can run multiple times)"

    log_info "Running seed first time..."
    make -C "$PROJECT_ROOT" seed > /dev/null 2>&1
    local count_after_first=$(get_user_count)

    log_info "Running seed second time..."
    make -C "$PROJECT_ROOT" seed > /dev/null 2>&1
    local count_after_second=$(get_user_count)

    log_info "Running seed third time..."
    make -C "$PROJECT_ROOT" seed > /dev/null 2>&1
    local count_after_third=$(get_user_count)

    log_info "User counts: 1st=$count_after_first, 2nd=$count_after_second, 3rd=$count_after_third"

    if [ "$count_after_first" = "$count_after_second" ] && [ "$count_after_second" = "$count_after_third" ]; then
        log_success "User count consistent across multiple runs"
        print_test_result "$test_name" "PASS"
    else
        log_error "User count changed across runs (duplicates created?)"
        print_test_result "$test_name" "FAIL"
    fi
}

test_seed_data_content() {
    local test_name="Seed data contains expected entities"

    make -C "$PROJECT_ROOT" seed > /dev/null 2>&1

    local user_count=$(get_user_count)
    local session_count=$(get_session_count)
    local api_key_count=$(get_api_key_count)

    log_info "Seed data counts: Users=$user_count, Sessions=$session_count, API Keys=$api_key_count"

    # Check for expected minimum counts
    if [ "$user_count" -ge 5 ] && [ "$session_count" -ge 2 ] && [ "$api_key_count" -ge 3 ]; then
        log_success "All expected entities present"
        print_test_result "$test_name" "PASS"
    else
        log_error "Missing expected seed data"
        print_test_result "$test_name" "FAIL"
    fi
}

test_seed_referential_integrity() {
    local test_name="Seed data maintains referential integrity"

    make -C "$PROJECT_ROOT" seed > /dev/null 2>&1

    # Check that all sessions reference valid users
    local invalid_sessions=$(psql -h "${DATABASE_HOST:-localhost}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-zero_to_running_dev}" -t -c "
        SELECT COUNT(*) FROM sessions s
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id);
    " 2>/dev/null | xargs)

    # Check that all API keys reference valid users
    local invalid_api_keys=$(psql -h "${DATABASE_HOST:-localhost}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-zero_to_running_dev}" -t -c "
        SELECT COUNT(*) FROM api_keys a
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id);
    " 2>/dev/null | xargs)

    if [ "$invalid_sessions" = "0" ] && [ "$invalid_api_keys" = "0" ]; then
        log_success "All foreign keys are valid"
        print_test_result "$test_name" "PASS"
    else
        log_error "Found invalid foreign keys: sessions=$invalid_sessions, api_keys=$invalid_api_keys"
        print_test_result "$test_name" "FAIL"
    fi
}

test_seed_script_executable() {
    local test_name="Seed script is executable"

    if [ -x "$PROJECT_ROOT/infrastructure/scripts/seed-database.sh" ]; then
        print_test_result "$test_name" "PASS"
    else
        log_error "Seed script is not executable"
        print_test_result "$test_name" "FAIL"
    fi
}

test_reset_script_executable() {
    local test_name="Reset script is executable"

    if [ -x "$PROJECT_ROOT/infrastructure/scripts/reset-database.sh" ]; then
        print_test_result "$test_name" "PASS"
    else
        log_error "Reset script is not executable"
        print_test_result "$test_name" "FAIL"
    fi
}

test_database_seeding_documentation() {
    local test_name="DATABASE_SEEDING.md documentation exists"

    if [ -f "$PROJECT_ROOT/docs/DATABASE_SEEDING.md" ]; then
        local doc_size=$(wc -l < "$PROJECT_ROOT/docs/DATABASE_SEEDING.md")
        log_info "Documentation has $doc_size lines"

        if [ "$doc_size" -gt 50 ]; then
            log_success "Documentation is comprehensive"
            print_test_result "$test_name" "PASS"
        else
            log_warning "Documentation may be too short"
            print_test_result "$test_name" "FAIL"
        fi
    else
        log_error "Documentation not found"
        print_test_result "$test_name" "FAIL"
    fi
}

test_env_variable_exists() {
    local test_name="AUTO_SEED_DATABASE variable exists in .env.example"

    if grep -q "AUTO_SEED_DATABASE" "$PROJECT_ROOT/.env.example"; then
        log_success "AUTO_SEED_DATABASE found in .env.example"
        print_test_result "$test_name" "PASS"
    else
        log_error "AUTO_SEED_DATABASE not found in .env.example"
        print_test_result "$test_name" "FAIL"
    fi
}

test_readme_seeding_section() {
    local test_name="README contains seeding section"

    if grep -q "Database Seeding\|make seed" "$PROJECT_ROOT/README.md"; then
        log_success "README documents seeding"
        print_test_result "$test_name" "PASS"
    else
        log_error "README doesn't mention seeding"
        print_test_result "$test_name" "FAIL"
    fi
}

test_makefile_seed_command() {
    local test_name="Makefile has seed command"

    if grep -q "^seed:" "$PROJECT_ROOT/Makefile"; then
        log_success "seed target found in Makefile"
        print_test_result "$test_name" "PASS"
    else
        log_error "seed target not found in Makefile"
        print_test_result "$test_name" "FAIL"
    fi
}

test_makefile_reset_db_command() {
    local test_name="Makefile has reset-db command"

    if grep -q "^reset-db:" "$PROJECT_ROOT/Makefile"; then
        log_success "reset-db target found in Makefile"
        print_test_result "$test_name" "PASS"
    else
        log_error "reset-db target not found in Makefile"
        print_test_result "$test_name" "FAIL"
    fi
}

test_seed_with_existing_data() {
    local test_name="Seed works with existing data"

    # Seed once
    make -C "$PROJECT_ROOT" seed > /dev/null 2>&1
    local initial_count=$(get_user_count)

    # Add a custom user
    psql -h "${DATABASE_HOST:-localhost}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-zero_to_running_dev}" -c "
        INSERT INTO users (email, username, password_hash, first_name, last_name)
        VALUES ('custom@example.com', 'customuser', 'hash123', 'Custom', 'User')
        ON CONFLICT (email) DO NOTHING;
    " > /dev/null 2>&1

    local count_with_custom=$(get_user_count)

    # Seed again
    make -C "$PROJECT_ROOT" seed > /dev/null 2>&1
    local final_count=$(get_user_count)

    log_info "Counts: initial=$initial_count, with_custom=$count_with_custom, final=$final_count"

    # Should have at least the custom user plus seed users
    if [ "$final_count" -ge "$count_with_custom" ]; then
        log_success "Seed preserved custom data"
        print_test_result "$test_name" "PASS"
    else
        log_error "Custom data was lost"
        print_test_result "$test_name" "FAIL"
    fi
}

# ============================================================================
# Test Suite Execution
# ============================================================================

main() {
    print_test_header "Database Seeding Test Suite - Story 3.5"

    # Setup
    setup_test_env
    check_database_connection

    log_info "Starting tests..."
    echo ""

    # AC1: Seed scripts exist in /infrastructure/database/seeds/
    log_info "Testing AC1: Seed scripts directory structure"
    test_seed_directory_exists
    test_seed_scripts_exist
    test_seed_readme_exists

    echo ""

    # AC2: make seed command runs seed scripts
    log_info "Testing AC2: make seed command execution"
    test_makefile_seed_command
    test_seed_script_executable
    test_make_seed_fresh_database

    echo ""

    # AC3: Seed scripts are idempotent
    log_info "Testing AC3: Idempotency"
    test_seed_idempotency
    test_seed_with_existing_data

    echo ""

    # AC4: Seed data includes users, entities, and relationships
    log_info "Testing AC4: Seed data content and integrity"
    test_seed_data_content
    test_seed_referential_integrity

    echo ""

    # AC5: make reset-db command
    log_info "Testing AC5: make reset-db command"
    test_makefile_reset_db_command
    test_reset_script_executable

    echo ""

    # AC6: Documentation
    log_info "Testing AC6: Documentation"
    test_database_seeding_documentation
    test_readme_seeding_section

    echo ""

    # AC7: AUTO_SEED_DATABASE environment variable
    log_info "Testing AC7: Environment variable configuration"
    test_env_variable_exists

    echo ""

    # Print summary
    print_test_header "Test Summary"

    echo "Tests Run:    $TESTS_RUN"
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo ""

    if [ "$TESTS_FAILED" -eq 0 ]; then
        log_success "All tests passed!"
        echo ""
        return 0
    else
        log_error "Some tests failed"
        echo ""
        return 1
    fi
}

# Run main function
main "$@"
