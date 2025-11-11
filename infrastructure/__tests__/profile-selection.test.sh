#!/usr/bin/env bash
# Profile Selection Tests
# Tests for Story 3.3: Multi-Profile Environment Support
#
# These tests verify:
# - Profile validation works correctly
# - Profile files exist and are valid
# - Invalid profiles show helpful error messages
# - Profile listing works correctly

set -euo pipefail

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly VALIDATE_SCRIPT="${PROJECT_ROOT}/infrastructure/scripts/validate-profile.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Print test result
print_test_result() {
    local test_name=$1
    local result=$2
    local message=${3:-}

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ "${result}" = "PASS" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✓ PASS${NC}: ${test_name}"
        if [ -n "${message}" ]; then
            echo -e "       ${message}"
        fi
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}✗ FAIL${NC}: ${test_name}"
        if [ -n "${message}" ]; then
            echo -e "       ${RED}${message}${NC}"
        fi
    fi
}

# Test: Minimal profile file exists
test_minimal_profile_exists() {
    local test_name="Minimal profile file exists"

    if [ -f "${PROJECT_ROOT}/.env.minimal" ]; then
        print_test_result "${test_name}" "PASS" "File: .env.minimal"
    else
        print_test_result "${test_name}" "FAIL" ".env.minimal file not found"
    fi
}

# Test: Full profile file exists
test_full_profile_exists() {
    local test_name="Full profile file exists"

    if [ -f "${PROJECT_ROOT}/.env.full" ]; then
        print_test_result "${test_name}" "PASS" "File: .env.full"
    else
        print_test_result "${test_name}" "FAIL" ".env.full file not found"
    fi
}

# Test: Validate script exists and is executable
test_validate_script_exists() {
    local test_name="Profile validation script exists and is executable"

    if [ -x "${VALIDATE_SCRIPT}" ]; then
        print_test_result "${test_name}" "PASS" "Script: ${VALIDATE_SCRIPT}"
    else
        print_test_result "${test_name}" "FAIL" "Script not found or not executable"
    fi
}

# Test: Minimal profile validates successfully
test_minimal_profile_validates() {
    local test_name="Minimal profile validation succeeds"

    if bash "${VALIDATE_SCRIPT}" minimal > /dev/null 2>&1; then
        print_test_result "${test_name}" "PASS"
    else
        print_test_result "${test_name}" "FAIL" "Validation failed for minimal profile"
    fi
}

# Test: Full profile validates successfully
test_full_profile_validates() {
    local test_name="Full profile validation succeeds"

    if bash "${VALIDATE_SCRIPT}" full > /dev/null 2>&1; then
        print_test_result "${test_name}" "PASS"
    else
        print_test_result "${test_name}" "FAIL" "Validation failed for full profile"
    fi
}

# Test: Invalid profile shows error
test_invalid_profile_shows_error() {
    local test_name="Invalid profile shows helpful error"

    # Should fail with exit code 1
    if ! bash "${VALIDATE_SCRIPT}" nonexistent > /dev/null 2>&1; then
        # Check if error message mentions available profiles
        local output=$(bash "${VALIDATE_SCRIPT}" nonexistent 2>&1 || true)
        if echo "${output}" | grep -q "Available Profiles"; then
            print_test_result "${test_name}" "PASS" "Error message includes available profiles"
        else
            print_test_result "${test_name}" "FAIL" "Error message doesn't list available profiles"
        fi
    else
        print_test_result "${test_name}" "FAIL" "Validation should fail for nonexistent profile"
    fi
}

# Test: Profile list command works
test_profile_list_command() {
    local test_name="Profile list command works"

    local output=$(bash "${VALIDATE_SCRIPT}" --list 2>&1)

    if echo "${output}" | grep -q "minimal" && echo "${output}" | grep -q "full"; then
        print_test_result "${test_name}" "PASS" "Both profiles listed"
    else
        print_test_result "${test_name}" "FAIL" "Profile list incomplete"
    fi
}

# Test: Minimal profile has required variables
test_minimal_profile_required_vars() {
    local test_name="Minimal profile has required variables"

    local required_vars=(
        "NODE_ENV"
        "DATABASE_HOST"
        "DATABASE_PORT"
        "DATABASE_NAME"
        "DATABASE_USER"
        "DATABASE_PASSWORD"
        "BACKEND_PORT"
        "PROFILE"
    )

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "${PROJECT_ROOT}/.env.minimal"; then
            missing_vars+=("${var}")
        fi
    done

    if [ ${#missing_vars[@]} -eq 0 ]; then
        print_test_result "${test_name}" "PASS" "All required variables present"
    else
        print_test_result "${test_name}" "FAIL" "Missing variables: ${missing_vars[*]}"
    fi
}

# Test: Full profile has required variables
test_full_profile_required_vars() {
    local test_name="Full profile has required variables"

    local required_vars=(
        "NODE_ENV"
        "DATABASE_HOST"
        "DATABASE_PORT"
        "DATABASE_NAME"
        "DATABASE_USER"
        "DATABASE_PASSWORD"
        "BACKEND_PORT"
        "FRONTEND_PORT"
        "REDIS_PORT"
        "PROFILE"
    )

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "${PROJECT_ROOT}/.env.full"; then
            missing_vars+=("${var}")
        fi
    done

    if [ ${#missing_vars[@]} -eq 0 ]; then
        print_test_result "${test_name}" "PASS" "All required variables present"
    else
        print_test_result "${test_name}" "FAIL" "Missing variables: ${missing_vars[*]}"
    fi
}

# Test: Profile identifier matches filename
test_profile_identifier_matches() {
    local test_name="Profile identifiers match filenames"

    local minimal_profile=$(grep "^PROFILE=" "${PROJECT_ROOT}/.env.minimal" | cut -d'=' -f2)
    local full_profile=$(grep "^PROFILE=" "${PROJECT_ROOT}/.env.full" | cut -d'=' -f2)

    if [ "${minimal_profile}" = "minimal" ] && [ "${full_profile}" = "full" ]; then
        print_test_result "${test_name}" "PASS" "minimal=${minimal_profile}, full=${full_profile}"
    else
        print_test_result "${test_name}" "FAIL" "Identifiers don't match: minimal=${minimal_profile}, full=${full_profile}"
    fi
}

# Test: Docker Compose has profile configuration
test_docker_compose_profiles() {
    local test_name="Docker Compose file has profile configuration"

    local compose_file="${PROJECT_ROOT}/docker-compose.yml"

    if grep -q "profiles:" "${compose_file}"; then
        # Check if redis and frontend have profiles (check more lines as profiles come later in config)
        if grep -A 15 "redis:" "${compose_file}" | grep -q "profiles:" && \
           grep -A 20 "frontend:" "${compose_file}" | grep -q "profiles:"; then
            print_test_result "${test_name}" "PASS" "Redis and Frontend have profile configuration"
        else
            print_test_result "${test_name}" "FAIL" "Not all services have profile configuration"
        fi
    else
        print_test_result "${test_name}" "FAIL" "No profile configuration in docker-compose.yml"
    fi
}

# Test: Makefile has profile support
test_makefile_profile_support() {
    local test_name="Makefile supports profile argument"

    local makefile="${PROJECT_ROOT}/Makefile"

    if grep -q "profile=" "${makefile}"; then
        print_test_result "${test_name}" "PASS" "Makefile has profile support"
    else
        print_test_result "${test_name}" "FAIL" "Makefile doesn't support profile argument"
    fi
}

# Test: Profiles command exists in Makefile
test_makefile_profiles_command() {
    local test_name="Makefile has 'profiles' command"

    local makefile="${PROJECT_ROOT}/Makefile"

    if grep -q "^profiles:" "${makefile}"; then
        print_test_result "${test_name}" "PASS" "'make profiles' command exists"
    else
        print_test_result "${test_name}" "FAIL" "profiles command not found in Makefile"
    fi
}

# Test: PROFILES.md documentation exists
test_profiles_documentation_exists() {
    local test_name="PROFILES.md documentation exists"

    if [ -f "${PROJECT_ROOT}/docs/PROFILES.md" ]; then
        # Check if it has key sections
        if grep -q "## Minimal Profile" "${PROJECT_ROOT}/docs/PROFILES.md" && \
           grep -q "## Full Profile" "${PROJECT_ROOT}/docs/PROFILES.md"; then
            print_test_result "${test_name}" "PASS" "Documentation complete with profile sections"
        else
            print_test_result "${test_name}" "FAIL" "Documentation missing profile sections"
        fi
    else
        print_test_result "${test_name}" "FAIL" "PROFILES.md not found"
    fi
}

# Test: README mentions profiles
test_readme_mentions_profiles() {
    local test_name="README.md mentions profiles"

    if grep -q "profile=" "${PROJECT_ROOT}/README.md"; then
        print_test_result "${test_name}" "PASS" "README includes profile information"
    else
        print_test_result "${test_name}" "FAIL" "README doesn't mention profiles"
    fi
}

# Print test summary
print_summary() {
    echo ""
    echo "========================================"
    echo "Test Summary"
    echo "========================================"
    echo "Total tests run:    ${TESTS_RUN}"
    echo -e "${GREEN}Tests passed:       ${TESTS_PASSED}${NC}"

    if [ ${TESTS_FAILED} -gt 0 ]; then
        echo -e "${RED}Tests failed:       ${TESTS_FAILED}${NC}"
        echo ""
        echo "========================================"
        echo -e "${RED}OVERALL RESULT: FAILED${NC}"
        echo "========================================"
        return 1
    else
        echo -e "${GREEN}Tests failed:       0${NC}"
        echo ""
        echo "========================================"
        echo -e "${GREEN}OVERALL RESULT: PASSED${NC}"
        echo "========================================"
        return 0
    fi
}

# Main test execution
main() {
    echo ""
    echo "========================================"
    echo "Profile Selection Tests"
    echo "Story 3.3: Multi-Profile Environment Support"
    echo "========================================"
    echo ""

    # Run all tests
    test_minimal_profile_exists
    test_full_profile_exists
    test_validate_script_exists
    test_minimal_profile_validates
    test_full_profile_validates
    test_invalid_profile_shows_error
    test_profile_list_command
    test_minimal_profile_required_vars
    test_full_profile_required_vars
    test_profile_identifier_matches
    test_docker_compose_profiles
    test_makefile_profile_support
    test_makefile_profiles_command
    test_profiles_documentation_exists
    test_readme_mentions_profiles

    # Print summary
    print_summary
}

# Run tests
main
