#!/usr/bin/env bash
# Zero-to-Running Profile Validation Script
# Validates that a requested profile exists and is properly configured
# Story 3.3: Multi-Profile Environment Support

set -euo pipefail

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color
readonly BOLD='\033[1m'

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Available profiles
readonly AVAILABLE_PROFILES=("minimal" "full")

# Print colored status message
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Print error and exit
error_exit() {
    local message=$1
    print_status "${RED}" "ERROR: ${message}"
    exit 1
}

# List available profiles
list_available_profiles() {
    echo ""
    print_status "${CYAN}" "${BOLD}Available Profiles:${NC}"
    echo ""

    for profile in "${AVAILABLE_PROFILES[@]}"; do
        local profile_file="${PROJECT_ROOT}/.env.${profile}"

        if [ -f "${profile_file}" ]; then
            # Extract profile description from file
            local description=$(grep -m 1 "^# Services:" "${profile_file}" | sed 's/^# Services: //' || echo "No description")
            printf "  ${GREEN}%-10s${NC} - %s\n" "${profile}" "${description}"

            # Show which services are included
            local services_line=$(grep -A 10 "^# Services Started:" "${profile_file}" | grep "^#   ✓" | sed 's/^#   ✓ //' | tr '\n' ', ' | sed 's/, $//' || echo "")
            if [ -n "${services_line}" ]; then
                printf "             ${BLUE}Includes:${NC} %s\n" "${services_line}"
            fi
        else
            printf "  ${YELLOW}%-10s${NC} - ${RED}Configuration file missing${NC}\n" "${profile}"
        fi
    done

    echo ""
    print_status "${CYAN}" "Usage:"
    echo "  make dev profile=minimal    # Start minimal profile"
    echo "  make dev profile=full       # Start full profile"
    echo "  make dev                    # Default (full profile)"
    echo ""
}

# Validate that profile file exists
validate_profile_exists() {
    local profile=$1
    local profile_file="${PROJECT_ROOT}/.env.${profile}"

    if [ ! -f "${profile_file}" ]; then
        print_status "${RED}" "Invalid profile: '${profile}'"
        echo ""
        print_status "${YELLOW}" "Profile configuration file not found: .env.${profile}"
        list_available_profiles
        return 1
    fi

    return 0
}

# Validate profile file has required variables
validate_profile_variables() {
    local profile=$1
    local profile_file="${PROJECT_ROOT}/.env.${profile}"

    # Required variables for all profiles
    local required_vars=(
        "NODE_ENV"
        "DATABASE_HOST"
        "DATABASE_PORT"
        "DATABASE_NAME"
        "DATABASE_USER"
        "DATABASE_PASSWORD"
        "BACKEND_PORT"
    )

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "${profile_file}"; then
            missing_vars+=("${var}")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_status "${RED}" "Profile '${profile}' is missing required variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - ${var}"
        done
        return 1
    fi

    return 0
}

# Validate profile-specific service configuration
validate_profile_services() {
    local profile=$1
    local profile_file="${PROJECT_ROOT}/.env.${profile}"

    # Check if PROFILE variable is set correctly
    local profile_var=$(grep "^PROFILE=" "${profile_file}" | cut -d'=' -f2)

    if [ "${profile_var}" != "${profile}" ]; then
        print_status "${YELLOW}" "Warning: PROFILE variable in ${profile_file} is set to '${profile_var}' but should be '${profile}'"
    fi

    return 0
}

# Check Docker Compose version for profile support
check_docker_compose_version() {
    if ! command -v docker-compose >/dev/null 2>&1; then
        print_status "${RED}" "Docker Compose is not installed"
        return 1
    fi

    # Get Docker Compose version
    local version=$(docker-compose version --short 2>/dev/null || echo "0.0.0")
    local major=$(echo "${version}" | cut -d'.' -f1)
    local minor=$(echo "${version}" | cut -d'.' -f2)

    # Profiles require Docker Compose 1.28 or later
    if [ "${major}" -eq 1 ] && [ "${minor}" -lt 28 ]; then
        print_status "${YELLOW}" "Warning: Docker Compose ${version} detected. Profiles require version 1.28 or later."
        print_status "${YELLOW}" "Profile selection may not work correctly. Please upgrade Docker Compose."
        echo ""
        return 1
    fi

    return 0
}

# Display profile information
display_profile_info() {
    local profile=$1
    local profile_file="${PROJECT_ROOT}/.env.${profile}"

    echo ""
    print_status "${GREEN}" "✓ Profile '${profile}' is valid"
    echo ""

    # Extract profile description
    print_status "${BOLD}" "Profile Information:"
    echo ""

    # Get services that will be started
    echo "Services:"
    grep -A 10 "^# Services Started:" "${profile_file}" | grep "^#   [✓✗]" | sed 's/^#   /  /' || echo "  (Service information not available)"

    echo ""

    # Get profile characteristics
    local startup_time=$(grep "^# Typical Startup Time:" "${profile_file}" | sed 's/^# Typical Startup Time: //' || echo "Unknown")
    local memory_usage=$(grep "^# Memory Usage:" "${profile_file}" | sed 's/^# Memory Usage: //' || echo "Unknown")

    if [ "${startup_time}" != "Unknown" ]; then
        echo "Startup Time: ${startup_time}"
    fi

    if [ "${memory_usage}" != "Unknown" ]; then
        echo "Memory Usage:  ${memory_usage}"
    fi

    echo ""
}

# Main validation function
validate_profile() {
    local profile=${1:-}

    # If no profile specified, default to "full"
    if [ -z "${profile}" ]; then
        profile="full"
        print_status "${BLUE}" "No profile specified, using default: ${profile}"
    fi

    # Convert to lowercase
    profile=$(echo "${profile}" | tr '[:upper:]' '[:lower:]')

    # Check if profile is in available list
    if [[ ! " ${AVAILABLE_PROFILES[@]} " =~ " ${profile} " ]]; then
        print_status "${RED}" "Unknown profile: '${profile}'"
        list_available_profiles
        return 1
    fi

    # Validate profile exists
    if ! validate_profile_exists "${profile}"; then
        return 1
    fi

    # Validate profile has required variables
    if ! validate_profile_variables "${profile}"; then
        return 1
    fi

    # Validate profile-specific configuration
    if ! validate_profile_services "${profile}"; then
        return 1
    fi

    # Check Docker Compose version (warning only, don't fail)
    check_docker_compose_version || true

    # Display profile information
    display_profile_info "${profile}"

    return 0
}

# Help message
show_help() {
    echo ""
    echo "Zero-to-Running Profile Validation"
    echo ""
    echo "Usage: $0 [profile]"
    echo ""
    echo "Validates that a profile configuration exists and is properly configured."
    echo ""
    echo "Arguments:"
    echo "  profile    Profile name to validate (minimal, full)"
    echo "             If not specified, validates the default profile (full)"
    echo ""
    echo "Examples:"
    echo "  $0 minimal              # Validate minimal profile"
    echo "  $0 full                 # Validate full profile"
    echo "  $0                      # Validate default profile"
    echo ""
    echo "Options:"
    echo "  --list, -l              # List all available profiles"
    echo "  --help, -h              # Show this help message"
    echo ""
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --list|-l)
        list_available_profiles
        exit 0
        ;;
    *)
        validate_profile "${1:-full}"
        exit $?
        ;;
esac
