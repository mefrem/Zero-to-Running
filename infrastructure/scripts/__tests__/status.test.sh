#!/usr/bin/env bash
# Test suite for status command script
# Story 2.5: Developer Monitoring Dashboard

set -euo pipefail

# Test configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly STATUS_SCRIPT="${SCRIPT_DIR}/status.sh"
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

    if [ -f "${STATUS_SCRIPT}" ]; then
        print_message "${GREEN}" "Status script found at: ${STATUS_SCRIPT}"
        record_test_result "Script exists" "PASS"
    else
        print_message "${RED}" "Status script not found at: ${STATUS_SCRIPT}"
        record_test_result "Script exists" "FAIL"
    fi
}

# Check if script is executable
test_script_executable() {
    print_test_header "Script Executable"

    if [ -x "${STATUS_SCRIPT}" ]; then
        print_message "${GREEN}" "Script has executable permissions"
        record_test_result "Script executable" "PASS"
    else
        print_message "${RED}" "Script does not have executable permissions"
        record_test_result "Script executable" "FAIL"
    fi
}

# Test status output with running services
test_status_with_running_services() {
    print_test_header "Status Output with Running Services"

    # Check if services are running
    if ! docker ps | grep -q "zero-to-running"; then
        print_message "${YELLOW}" "SKIP: Services not running"
        print_message "${YELLOW}" "To run this test, start services with: make dev"
        return 0
    fi

    # Run status script and capture output
    local output
    if output=$(NO_COLOR=1 bash "${STATUS_SCRIPT}" 2>&1); then
        print_message "${GREEN}" "Status script executed successfully"

        # Check if output contains expected service names
        if echo "$output" | grep -q "frontend" && \
           echo "$output" | grep -q "backend" && \
           echo "$output" | grep -q "postgres" && \
           echo "$output" | grep -q "redis"; then
            print_message "${GREEN}" "Output contains all expected services"
            record_test_result "Status shows all services" "PASS"
        else
            print_message "${RED}" "Output missing expected services"
            echo "$output"
            record_test_result "Status shows all services" "FAIL"
        fi
    else
        print_message "${RED}" "Status script failed to execute"
        echo "$output"
        record_test_result "Status execution" "FAIL"
    fi
}

# Test status output format (table structure)
test_status_table_format() {
    print_test_header "Status Table Format"

    # Check if services are running
    if ! docker ps | grep -q "zero-to-running"; then
        print_message "${YELLOW}" "SKIP: Services not running"
        return 0
    fi

    local output
    if output=$(NO_COLOR=1 bash "${STATUS_SCRIPT}" 2>&1); then
        # Check for table headers
        if echo "$output" | grep -q "Service.*Status.*Uptime.*CPU.*Memory.*Ports"; then
            print_message "${GREEN}" "Output contains table headers"
            record_test_result "Table headers present" "PASS"
        else
            print_message "${RED}" "Output missing table headers"
            record_test_result "Table headers present" "FAIL"
        fi
    else
        print_message "${RED}" "Status script failed"
        record_test_result "Table format check" "FAIL"
    fi
}

# Test status when no services are running
test_status_no_services() {
    print_test_header "Status with No Services Running"

    # Check if services are NOT running
    if docker ps | grep -q "zero-to-running"; then
        print_message "${YELLOW}" "SKIP: Services are running"
        print_message "${YELLOW}" "To run this test, stop services with: make down"
        return 0
    fi

    local output
    if output=$(NO_COLOR=1 bash "${STATUS_SCRIPT}" 2>&1); then
        if echo "$output" | grep -q "No services are running"; then
            print_message "${GREEN}" "Correctly reports no services running"
            record_test_result "No services message" "PASS"
        else
            print_message "${RED}" "Does not report no services correctly"
            record_test_result "No services message" "FAIL"
        fi
    else
        print_message "${RED}" "Script failed when no services running"
        record_test_result "No services handling" "FAIL"
    fi
}

# Test Docker daemon not running
test_docker_not_running() {
    print_test_header "Docker Daemon Not Running"

    # This test is difficult to automate since we need Docker to run tests
    # We'll check that the script has the error handling logic
    if grep -q "Docker daemon is not running" "${STATUS_SCRIPT}"; then
        print_message "${GREEN}" "Script has Docker daemon check"
        record_test_result "Docker check present" "PASS"
    else
        print_message "${RED}" "Script missing Docker daemon check"
        record_test_result "Docker check present" "FAIL"
    fi
}

# Test help tips are present
test_help_tips_present() {
    print_test_header "Help Tips Present"

    # Check if services are running
    if ! docker ps | grep -q "zero-to-running"; then
        print_message "${YELLOW}" "SKIP: Services not running"
        return 0
    fi

    local output
    if output=$(NO_COLOR=1 bash "${STATUS_SCRIPT}" 2>&1); then
        if echo "$output" | grep -q "make logs"; then
            print_message "${GREEN}" "Output contains help tips"
            record_test_result "Help tips present" "PASS"
        else
            print_message "${RED}" "Output missing help tips"
            record_test_result "Help tips present" "FAIL"
        fi
    fi
}

# Test script handles errors gracefully
test_error_handling() {
    print_test_header "Error Handling"

    # Test with invalid Docker commands by checking script has error handling
    if grep -q "set -euo pipefail" "${STATUS_SCRIPT}"; then
        print_message "${GREEN}" "Script uses proper error handling (set -euo pipefail)"
        record_test_result "Error handling present" "PASS"
    else
        print_message "${RED}" "Script missing error handling"
        record_test_result "Error handling present" "FAIL"
    fi
}

# Print final test summary
print_summary() {
    echo ""
    echo "================================================================"
    print_message "${BLUE}" "TEST SUMMARY"
    echo "================================================================"
    echo "Total Tests Run: ${TESTS_RUN}"
    print_message "${GREEN}" "Passed: ${TESTS_PASSED}"
    print_message "${RED}" "Failed: ${TESTS_FAILED}"
    echo "================================================================"

    if [ ${TESTS_FAILED} -eq 0 ]; then
        print_message "${GREEN}" "ALL TESTS PASSED ✓"
        exit 0
    else
        print_message "${RED}" "SOME TESTS FAILED ✗"
        exit 1
    fi
}

# Main test execution
main() {
    print_message "${BLUE}" "========================================="
    print_message "${BLUE}" "Status Script Test Suite"
    print_message "${BLUE}" "Story 2.5: Developer Monitoring Dashboard"
    print_message "${BLUE}" "========================================="

    # Run all tests
    test_script_exists
    test_script_executable
    test_status_with_running_services
    test_status_table_format
    test_status_no_services
    test_docker_not_running
    test_help_tips_present
    test_error_handling

    # Print summary
    print_summary
}

# Run tests
main
