#!/usr/bin/env bash
# Health Check Startup Tests
# Story 2.3: Startup Health Verification Automation
# Tests for /infrastructure/scripts/startup.sh health verification functionality

set -euo pipefail

# Test configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
readonly STARTUP_SCRIPT="${PROJECT_ROOT}/infrastructure/scripts/startup.sh"

# Color codes for test output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Print test result
print_test_result() {
    local test_name=$1
    local result=$2

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ "${result}" = "PASS" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✓ PASS${NC} - ${test_name}"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}✗ FAIL${NC} - ${test_name}"
    fi
}

# Print test section header
print_section() {
    local section_name=$1
    echo ""
    echo -e "${BLUE}${section_name}${NC}"
    echo "========================================"
}

# Test: Startup script exists and is executable
test_startup_script_exists() {
    if [ -f "${STARTUP_SCRIPT}" ] && [ -x "${STARTUP_SCRIPT}" ]; then
        print_test_result "Startup script exists and is executable" "PASS"
    else
        print_test_result "Startup script exists and is executable" "FAIL"
    fi
}

# Test: Startup script contains health check functions
test_health_check_functions_exist() {
    local functions=("check_backend_health" "check_frontend_health" "check_redis_health" "wait_for_service_http")
    local all_found=true

    for func in "${functions[@]}"; do
        if ! grep -q "^${func}()" "${STARTUP_SCRIPT}"; then
            all_found=false
            echo "  Missing function: ${func}"
        fi
    done

    if [ "${all_found}" = true ]; then
        print_test_result "All required health check functions exist" "PASS"
    else
        print_test_result "All required health check functions exist" "FAIL"
    fi
}

# Test: Startup script uses correct timeout (120 seconds)
test_health_check_timeout() {
    if grep -q "HEALTH_CHECK_TIMEOUT=\${HEALTH_CHECK_TIMEOUT:-120}" "${STARTUP_SCRIPT}"; then
        print_test_result "Health check timeout is 120 seconds (2 minutes)" "PASS"
    else
        print_test_result "Health check timeout is 120 seconds (2 minutes)" "FAIL"
    fi
}

# Test: Startup script has progress display functions
test_progress_display_functions() {
    if grep -q "display_service_status" "${STARTUP_SCRIPT}"; then
        print_test_result "Progress display function exists" "PASS"
    else
        print_test_result "Progress display function exists" "FAIL"
    fi
}

# Test: Startup script has error handling with troubleshooting
test_troubleshooting_function() {
    if grep -q "display_troubleshooting" "${STARTUP_SCRIPT}"; then
        print_test_result "Troubleshooting function exists" "PASS"
    else
        print_test_result "Troubleshooting function exists" "FAIL"
    fi
}

# Test: Startup script has log viewing capability
test_log_viewing_function() {
    if grep -q "offer_logs_viewing" "${STARTUP_SCRIPT}"; then
        print_test_result "Log viewing function exists" "PASS"
    else
        print_test_result "Log viewing function exists" "FAIL"
    fi
}

# Test: Startup script has success message with connection strings
test_success_message_format() {
    local has_database_string=false
    local has_redis_string=false

    if grep -q "postgresql://" "${STARTUP_SCRIPT}"; then
        has_database_string=true
    fi

    if grep -q "redis://" "${STARTUP_SCRIPT}"; then
        has_redis_string=true
    fi

    if [ "${has_database_string}" = true ] && [ "${has_redis_string}" = true ]; then
        print_test_result "Success message includes connection strings" "PASS"
    else
        print_test_result "Success message includes connection strings" "FAIL"
    fi
}

# Test: Startup script has interrupt handler (Ctrl+C)
test_interrupt_handler() {
    if grep -q "handle_interrupt" "${STARTUP_SCRIPT}" && grep -q "trap handle_interrupt" "${STARTUP_SCRIPT}"; then
        print_test_result "Interrupt handler (Ctrl+C) exists" "PASS"
    else
        print_test_result "Interrupt handler (Ctrl+C) exists" "FAIL"
    fi
}

# Test: Environment variables are configurable
test_environment_variables() {
    local vars=("HEALTH_CHECK_TIMEOUT" "HEALTH_CHECK_INTERVAL" "SHOW_LOGS_ON_FAILURE")
    local all_found=true

    for var in "${vars[@]}"; do
        if ! grep -q "${var}" "${STARTUP_SCRIPT}"; then
            all_found=false
            echo "  Missing variable: ${var}"
        fi
    done

    if [ "${all_found}" = true ]; then
        print_test_result "Environment variables are configurable" "PASS"
    else
        print_test_result "Environment variables are configurable" "FAIL"
    fi
}

# Test: Health checks use HTTP endpoints
test_http_health_checks() {
    local uses_curl=false

    # Check if curl is used for health checks
    if grep -q "curl.*http://localhost.*health" "${STARTUP_SCRIPT}"; then
        uses_curl=true
    fi

    if [ "${uses_curl}" = true ]; then
        print_test_result "Health checks use HTTP endpoints" "PASS"
    else
        print_test_result "Health checks use HTTP endpoints" "FAIL"
    fi
}

# Test: Backend health check polls /health/ready endpoint
test_backend_health_endpoint() {
    if grep -q "/health/ready" "${STARTUP_SCRIPT}"; then
        print_test_result "Backend health check uses /health/ready endpoint" "PASS"
    else
        print_test_result "Backend health check uses /health/ready endpoint" "FAIL"
    fi
}

# Test: Redis health checked via backend endpoint
test_redis_via_backend() {
    if grep -q '"cache":"ok"' "${STARTUP_SCRIPT}" || grep -q 'cache.*ok' "${STARTUP_SCRIPT}"; then
        print_test_result "Redis health checked via backend /health/ready" "PASS"
    else
        print_test_result "Redis health checked via backend /health/ready" "FAIL"
    fi
}

# Test: Script exits with non-zero on failure
test_exit_codes() {
    local has_exit_1=false
    local has_exit_0=false

    if grep -q "exit 1" "${STARTUP_SCRIPT}"; then
        has_exit_1=true
    fi

    if grep -q "exit 0" "${STARTUP_SCRIPT}"; then
        has_exit_0=true
    fi

    if [ "${has_exit_1}" = true ] && [ "${has_exit_0}" = true ]; then
        print_test_result "Script uses appropriate exit codes" "PASS"
    else
        print_test_result "Script uses appropriate exit codes" "FAIL"
    fi
}

# Test: Troubleshooting suggestions are service-specific
test_service_specific_troubleshooting() {
    local services=("Database" "Backend" "Frontend" "Cache")
    local all_found=true

    for service in "${services[@]}"; do
        if ! grep -q "\"${service}\")" "${STARTUP_SCRIPT}"; then
            all_found=false
            echo "  Missing troubleshooting for: ${service}"
        fi
    done

    if [ "${all_found}" = true ]; then
        print_test_result "Service-specific troubleshooting exists for all services" "PASS"
    else
        print_test_result "Service-specific troubleshooting exists for all services" "FAIL"
    fi
}

# Test: Script references documentation
test_documentation_references() {
    if grep -q "HEALTH_VERIFICATION.md" "${STARTUP_SCRIPT}" || grep -q "README.md" "${STARTUP_SCRIPT}"; then
        print_test_result "Script references documentation" "PASS"
    else
        print_test_result "Script references documentation" "FAIL"
    fi
}

# Test: SHOW_LOGS_ON_FAILURE environment variable works
test_show_logs_flag() {
    if grep -q "SHOW_LOGS_ON_FAILURE" "${STARTUP_SCRIPT}"; then
        print_test_result "SHOW_LOGS_ON_FAILURE flag is implemented" "PASS"
    else
        print_test_result "SHOW_LOGS_ON_FAILURE flag is implemented" "FAIL"
    fi
}

# Test: Success message displays all four service URLs/connections
test_success_message_completeness() {
    local has_frontend=false
    local has_backend=false
    local has_database=false
    local has_redis=false

    # Check for Frontend URL
    if grep -q "Frontend.*http://localhost.*FRONTEND_PORT" "${STARTUP_SCRIPT}"; then
        has_frontend=true
    fi

    # Check for Backend URL
    if grep -q "Backend.*http://localhost.*BACKEND_PORT" "${STARTUP_SCRIPT}"; then
        has_backend=true
    fi

    # Check for Database connection string
    if grep -q "Database.*postgresql://" "${STARTUP_SCRIPT}"; then
        has_database=true
    fi

    # Check for Redis connection string
    if grep -q "Redis.*redis://" "${STARTUP_SCRIPT}"; then
        has_redis=true
    fi

    if [ "${has_frontend}" = true ] && [ "${has_backend}" = true ] && [ "${has_database}" = true ] && [ "${has_redis}" = true ]; then
        print_test_result "Success message includes all 4 services (Frontend, Backend, Database, Redis)" "PASS"
    else
        print_test_result "Success message includes all 4 services (Frontend, Backend, Database, Redis)" "FAIL"
        [ "${has_frontend}" = false ] && echo "  Missing: Frontend URL"
        [ "${has_backend}" = false ] && echo "  Missing: Backend URL"
        [ "${has_database}" = false ] && echo "  Missing: Database connection string"
        [ "${has_redis}" = false ] && echo "  Missing: Redis connection string"
    fi
}

# Test: Health check interval is configurable
test_health_check_interval() {
    if grep -q "HEALTH_CHECK_INTERVAL=\${HEALTH_CHECK_INTERVAL:-2}" "${STARTUP_SCRIPT}"; then
        print_test_result "Health check interval is configurable (default 2 seconds)" "PASS"
    else
        print_test_result "Health check interval is configurable (default 2 seconds)" "FAIL"
    fi
}

# Test: Script handles container not running scenario
test_container_check() {
    if grep -q "docker ps" "${STARTUP_SCRIPT}"; then
        print_test_result "Script checks for running containers" "PASS"
    else
        print_test_result "Script checks for running containers" "FAIL"
    fi
}

# Test: Log viewing uses docker-compose logs command
test_docker_compose_logs() {
    if grep -q "docker-compose.*logs" "${STARTUP_SCRIPT}"; then
        print_test_result "Log viewing uses docker-compose logs" "PASS"
    else
        print_test_result "Log viewing uses docker-compose logs" "FAIL"
    fi
}

# Test: Script displays service status with formatting
test_status_formatting() {
    if grep -q "printf" "${STARTUP_SCRIPT}" && grep -q "%-12s" "${STARTUP_SCRIPT}"; then
        print_test_result "Service status uses formatted output" "PASS"
    else
        print_test_result "Service status uses formatted output" "FAIL"
    fi
}

# Print final test summary
print_test_summary() {
    echo ""
    echo "========================================"
    echo -e "${BLUE}TEST SUMMARY${NC}"
    echo "========================================"
    echo "Total Tests Run:    ${TESTS_RUN}"
    echo -e "${GREEN}Tests Passed:       ${TESTS_PASSED}${NC}"
    if [ ${TESTS_FAILED} -gt 0 ]; then
        echo -e "${RED}Tests Failed:       ${TESTS_FAILED}${NC}"
    else
        echo "Tests Failed:       ${TESTS_FAILED}"
    fi
    echo ""

    if [ ${TESTS_FAILED} -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        return 1
    fi
}

# Main test execution
main() {
    echo "========================================"
    echo "Health Check Startup Tests"
    echo "Story 2.3: Startup Health Verification"
    echo "========================================"

    print_section "Basic Structure Tests"
    test_startup_script_exists
    test_health_check_functions_exist
    test_progress_display_functions

    print_section "Configuration Tests"
    test_health_check_timeout
    test_health_check_interval
    test_environment_variables

    print_section "Health Check Implementation Tests"
    test_http_health_checks
    test_backend_health_endpoint
    test_redis_via_backend
    test_container_check

    print_section "Error Handling Tests"
    test_troubleshooting_function
    test_service_specific_troubleshooting
    test_exit_codes
    test_interrupt_handler

    print_section "Log Viewing Tests"
    test_log_viewing_function
    test_show_logs_flag
    test_docker_compose_logs

    print_section "Success Message Tests"
    test_success_message_format
    test_success_message_completeness
    test_documentation_references

    print_section "Display Tests"
    test_status_formatting

    print_test_summary
}

# Run tests
main "$@"
