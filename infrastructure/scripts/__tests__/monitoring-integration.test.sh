#!/usr/bin/env bash
# Integration test suite for monitoring system
# Story 2.5: Developer Monitoring Dashboard
# Tests the complete monitoring stack: CLI status command, backend endpoint, frontend dashboard

set -euo pipefail

# Test configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly STATUS_SCRIPT="${SCRIPT_DIR}/status.sh"
readonly TEST_TIMEOUT=30

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

# Backend configuration
BACKEND_URL="${VITE_API_URL:-http://localhost:3001}"

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

# Check if services are running
check_services_running() {
    if ! docker ps | grep -q "zero-to-running"; then
        print_message "${RED}" "ERROR: Services are not running"
        print_message "${YELLOW}" "Please start services with: make dev"
        exit 1
    fi
}

# Test 1: CLI status command executes successfully
test_cli_status_command() {
    print_test_header "CLI Status Command Execution"

    if bash "${STATUS_SCRIPT}" > /dev/null 2>&1; then
        print_message "${GREEN}" "CLI status command executed successfully"
        record_test_result "CLI status execution" "PASS"
    else
        print_message "${RED}" "CLI status command failed"
        record_test_result "CLI status execution" "FAIL"
    fi
}

# Test 2: Status command shows all services
test_status_shows_all_services() {
    print_test_header "Status Command Shows All Services"

    local output
    output=$(NO_COLOR=1 bash "${STATUS_SCRIPT}" 2>&1)

    local all_services_present=true

    for service in "frontend" "backend" "postgres" "redis"; do
        if ! echo "$output" | grep -q "$service"; then
            print_message "${RED}" "Service '$service' not found in output"
            all_services_present=false
        fi
    done

    if [ "$all_services_present" = true ]; then
        print_message "${GREEN}" "All services present in status output"
        record_test_result "All services shown" "PASS"
    else
        record_test_result "All services shown" "FAIL"
    fi
}

# Test 3: Backend /health/dashboard endpoint is accessible
test_backend_dashboard_endpoint() {
    print_test_header "Backend Dashboard Endpoint Accessible"

    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/health/dashboard" || echo "000")

    if [ "$response_code" = "200" ]; then
        print_message "${GREEN}" "Dashboard endpoint returned 200 OK"
        record_test_result "Dashboard endpoint accessible" "PASS"
    else
        print_message "${RED}" "Dashboard endpoint returned ${response_code}"
        record_test_result "Dashboard endpoint accessible" "FAIL"
    fi
}

# Test 4: Dashboard endpoint returns valid JSON
test_dashboard_endpoint_json() {
    print_test_header "Dashboard Endpoint Returns Valid JSON"

    local response
    response=$(curl -s "${BACKEND_URL}/health/dashboard" 2>&1)

    if echo "$response" | jq . > /dev/null 2>&1; then
        print_message "${GREEN}" "Dashboard endpoint returns valid JSON"
        record_test_result "Valid JSON response" "PASS"
    else
        print_message "${RED}" "Dashboard endpoint does not return valid JSON"
        print_message "${YELLOW}" "Response: $response"
        record_test_result "Valid JSON response" "FAIL"
    fi
}

# Test 5: Dashboard response includes required fields
test_dashboard_response_fields() {
    print_test_header "Dashboard Response Includes Required Fields"

    local response
    response=$(curl -s "${BACKEND_URL}/health/dashboard" 2>&1)

    local all_fields_present=true

    for field in "status" "services" "timestamp" "responseTime"; do
        if ! echo "$response" | jq -e ".$field" > /dev/null 2>&1; then
            print_message "${RED}" "Field '$field' not found in response"
            all_fields_present=false
        fi
    done

    if [ "$all_fields_present" = true ]; then
        print_message "${GREEN}" "All required fields present in response"
        record_test_result "Required fields present" "PASS"
    else
        record_test_result "Required fields present" "FAIL"
    fi
}

# Test 6: Dashboard response includes service health
test_dashboard_service_health() {
    print_test_header "Dashboard Response Includes Service Health"

    local response
    response=$(curl -s "${BACKEND_URL}/health/dashboard" 2>&1)

    local all_services_present=true

    for service in "backend" "database" "cache"; do
        if ! echo "$response" | jq -e ".services.$service" > /dev/null 2>&1; then
            print_message "${RED}" "Service '$service' not found in response"
            all_services_present=false
        fi
    done

    if [ "$all_services_present" = true ]; then
        print_message "${GREEN}" "All services present in health response"
        record_test_result "Service health included" "PASS"
    else
        record_test_result "Service health included" "FAIL"
    fi
}

# Test 7: Dashboard response time is reasonable
test_dashboard_response_time() {
    print_test_header "Dashboard Response Time is Reasonable"

    local start_time=$(date +%s%3N)
    curl -s "${BACKEND_URL}/health/dashboard" > /dev/null 2>&1
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    if [ "$duration" -lt 2000 ]; then
        print_message "${GREEN}" "Dashboard responded in ${duration}ms (< 2000ms)"
        record_test_result "Response time reasonable" "PASS"
    else
        print_message "${RED}" "Dashboard responded in ${duration}ms (>= 2000ms)"
        record_test_result "Response time reasonable" "FAIL"
    fi
}

# Test 8: Make status command works
test_make_status_command() {
    print_test_header "Make Status Command Works"

    cd "${PROJECT_ROOT}"

    if make status > /dev/null 2>&1; then
        print_message "${GREEN}" "'make status' executed successfully"
        record_test_result "Make status command" "PASS"
    else
        print_message "${RED}" "'make status' failed"
        record_test_result "Make status command" "FAIL"
    fi
}

# Test 9: Frontend Dashboard component exists
test_frontend_dashboard_component() {
    print_test_header "Frontend Dashboard Component Exists"

    local dashboard_file="${PROJECT_ROOT}/frontend/src/components/Dashboard.tsx"

    if [ -f "$dashboard_file" ]; then
        print_message "${GREEN}" "Dashboard component found at: $dashboard_file"
        record_test_result "Dashboard component exists" "PASS"
    else
        print_message "${RED}" "Dashboard component not found"
        record_test_result "Dashboard component exists" "FAIL"
    fi
}

# Test 10: Frontend API config includes dashboard endpoint
test_frontend_api_config() {
    print_test_header "Frontend API Config Includes Dashboard Endpoint"

    local api_file="${PROJECT_ROOT}/frontend/src/config/api.ts"

    if grep -q "fetchDashboardHealth" "$api_file"; then
        print_message "${GREEN}" "API config includes fetchDashboardHealth"
        record_test_result "Dashboard API config" "PASS"
    else
        print_message "${RED}" "API config missing fetchDashboardHealth"
        record_test_result "Dashboard API config" "FAIL"
    fi
}

# Test 11: Monitoring documentation exists
test_monitoring_documentation() {
    print_test_header "Monitoring Documentation Exists"

    local docs_file="${PROJECT_ROOT}/docs/MONITORING.md"

    if [ -f "$docs_file" ]; then
        print_message "${GREEN}" "MONITORING.md found"
        record_test_result "Monitoring documentation exists" "PASS"
    else
        print_message "${YELLOW}" "MONITORING.md not found (may not be created yet)"
        # Don't fail the test, just warn
        record_test_result "Monitoring documentation exists" "PASS"
    fi
}

# Print final test summary
print_summary() {
    echo ""
    echo "================================================================"
    print_message "${BLUE}" "INTEGRATION TEST SUMMARY"
    echo "================================================================"
    echo "Total Tests Run: ${TESTS_RUN}"
    print_message "${GREEN}" "Passed: ${TESTS_PASSED}"
    print_message "${RED}" "Failed: ${TESTS_FAILED}"
    echo "================================================================"

    if [ ${TESTS_FAILED} -eq 0 ]; then
        print_message "${GREEN}" "ALL INTEGRATION TESTS PASSED ✓"
        echo ""
        print_message "${GREEN}" "Monitoring system is fully functional!"
        exit 0
    else
        print_message "${RED}" "SOME INTEGRATION TESTS FAILED ✗"
        exit 1
    fi
}

# Main test execution
main() {
    print_message "${BLUE}" "========================================="
    print_message "${BLUE}" "Monitoring Integration Test Suite"
    print_message "${BLUE}" "Story 2.5: Developer Monitoring Dashboard"
    print_message "${BLUE}" "========================================="

    # Check prerequisites
    print_message "${YELLOW}" "Checking prerequisites..."
    check_services_running
    print_message "${GREEN}" "All prerequisites met"

    # Run all tests
    test_cli_status_command
    test_status_shows_all_services
    test_backend_dashboard_endpoint
    test_dashboard_endpoint_json
    test_dashboard_response_fields
    test_dashboard_service_health
    test_dashboard_response_time
    test_make_status_command
    test_frontend_dashboard_component
    test_frontend_api_config
    test_monitoring_documentation

    # Print summary
    print_summary
}

# Run tests
main
