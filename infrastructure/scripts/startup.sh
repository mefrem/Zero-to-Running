#!/usr/bin/env bash
# Zero-to-Running Startup Script
# Orchestrates Docker Compose service startup with health check validation
# Story 1.6: Service Orchestration & Single Command Startup
# Story 2.3: Startup Health Verification Automation
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
readonly DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
readonly HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-120}  # 2 minutes (Story 2.3 AC1)
readonly HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-2}  # 2 seconds between checks
readonly SHOW_LOGS_ON_FAILURE=${SHOW_LOGS_ON_FAILURE:-false}

# Profile configuration (Story 3.3)
PROFILE="${1:-full}"  # Default to full profile if not specified

# Service list in startup order (will be filtered based on profile)
readonly ALL_SERVICES=("postgres" "redis" "backend" "frontend")

# Display banner
print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}=====================================${NC}"
    echo -e "${CYAN}${BOLD}  Zero-to-Running Development${NC}"
    echo -e "${CYAN}${BOLD}=====================================${NC}"
    echo -e "${BLUE}  Profile: ${BOLD}${PROFILE}${NC}"
    echo -e "${CYAN}${BOLD}=====================================${NC}"
    echo ""
}

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
    echo ""
    exit 1
}

# Check if Docker daemon is running
check_docker_daemon() {
    print_status "${BLUE}" "Checking Docker daemon..."
    if ! docker ps >/dev/null 2>&1; then
        error_exit "Docker daemon is not running. Please start Docker and try again."
    fi
    print_status "${GREEN}" "✓ Docker daemon is running"
}

# Check if Docker Compose is installed
check_docker_compose() {
    print_status "${BLUE}" "Checking Docker Compose installation..."
    if ! command -v docker-compose >/dev/null 2>&1; then
        error_exit "Docker Compose is not installed. Please install Docker Compose and try again."
    fi
    local version=$(docker-compose --version 2>/dev/null || echo "unknown")
    print_status "${GREEN}" "✓ Docker Compose installed: ${version}"
}

# Check for port conflicts
check_port_conflicts() {
    print_status "${BLUE}" "Checking for port conflicts..."

    # Load environment variables if .env exists
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        set -a
        source "${PROJECT_ROOT}/.env"
        set +a
    fi

    local FRONTEND_PORT=${FRONTEND_PORT:-3000}
    local BACKEND_PORT=${BACKEND_PORT:-3001}
    local DATABASE_PORT=${DATABASE_PORT:-5432}
    local REDIS_PORT=${REDIS_PORT:-6379}

    local ports=("${FRONTEND_PORT}" "${BACKEND_PORT}" "${DATABASE_PORT}" "${REDIS_PORT}")
    local port_names=("Frontend" "Backend" "PostgreSQL" "Redis")
    local conflicts=0

    for i in "${!ports[@]}"; do
        local port="${ports[$i]}"
        local name="${port_names[$i]}"

        # Check if port is in use (works on Linux and macOS)
        if command -v netstat >/dev/null 2>&1; then
            if netstat -tuln 2>/dev/null | grep -q ":${port} "; then
                print_status "${YELLOW}" "⚠ Port ${port} (${name}) is already in use"
                conflicts=$((conflicts + 1))
            fi
        elif command -v ss >/dev/null 2>&1; then
            if ss -tuln 2>/dev/null | grep -q ":${port} "; then
                print_status "${YELLOW}" "⚠ Port ${port} (${name}) is already in use"
                conflicts=$((conflicts + 1))
            fi
        fi
    done

    if [ $conflicts -gt 0 ]; then
        echo ""
        print_status "${YELLOW}" "Warning: ${conflicts} port(s) are already in use."
        print_status "${YELLOW}" "This may cause startup failures. You can:"
        print_status "${YELLOW}" "  1. Stop existing services using these ports"
        print_status "${YELLOW}" "  2. Change port numbers in .env file"
        print_status "${YELLOW}" "  3. Continue anyway (may fail)"
        echo ""
        read -p "Continue with startup? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    else
        print_status "${GREEN}" "✓ No port conflicts detected"
    fi
}

# Validate and load profile configuration
validate_and_load_profile() {
    print_status "${BLUE}" "Validating profile: ${PROFILE}..."

    # Validate profile using validation script
    if ! bash "${SCRIPT_DIR}/validate-profile.sh" "${PROFILE}" > /dev/null 2>&1; then
        echo ""
        print_status "${RED}" "Profile validation failed"
        bash "${SCRIPT_DIR}/validate-profile.sh" "${PROFILE}"
        exit 1
    fi

    print_status "${GREEN}" "✓ Profile '${PROFILE}' is valid"

    # Load profile-specific environment file
    local profile_env="${PROJECT_ROOT}/.env.${PROFILE}"

    if [ -f "${profile_env}" ]; then
        print_status "${BLUE}" "Loading profile configuration from .env.${PROFILE}..."

        # Copy profile to .env (with backup)
        if [ -f "${PROJECT_ROOT}/.env" ] && [ ! -f "${PROJECT_ROOT}/.env.backup" ]; then
            cp "${PROJECT_ROOT}/.env" "${PROJECT_ROOT}/.env.backup"
        fi

        cp "${profile_env}" "${PROJECT_ROOT}/.env"
        print_status "${GREEN}" "✓ Profile configuration loaded"
    else
        error_exit "Profile configuration file not found: ${profile_env}"
    fi
}

# Check for .env file
check_env_file() {
    print_status "${BLUE}" "Checking environment configuration..."

    # If no .env exists and no .env.{profile} exists, copy from .env.example
    if [ ! -f "${PROJECT_ROOT}/.env" ] && [ ! -f "${PROJECT_ROOT}/.env.${PROFILE}" ]; then
        print_status "${YELLOW}" "⚠ No environment configuration found"

        if [ -f "${PROJECT_ROOT}/.env.example" ]; then
            print_status "${YELLOW}" "Copying .env.example to .env.${PROFILE}..."
            cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env.${PROFILE}"
            print_status "${YELLOW}" "Please edit .env.${PROFILE} and set DATABASE_PASSWORD before running again"
            exit 1
        else
            error_exit ".env file not found and .env.example does not exist"
        fi
    fi

    # Validate and load profile configuration
    validate_and_load_profile

    # Run comprehensive configuration validation
    echo ""
    if ! bash "${SCRIPT_DIR}/validate-config.sh"; then
        error_exit "Configuration validation failed. Please fix the errors above and try again."
    fi

    print_status "${GREEN}" "✓ Environment configuration valid"
}

# Get services for current profile
get_profile_services() {
    case "${PROFILE}" in
        minimal)
            echo "postgres backend"
            ;;
        full)
            echo "postgres redis backend frontend"
            ;;
        *)
            echo "postgres redis backend frontend"
            ;;
    esac
}

# Start Docker Compose services
start_services() {
    print_status "${BLUE}" "Starting Docker Compose services for '${PROFILE}' profile..."
    echo ""

    # Display which services will be started
    local services=$(get_profile_services)
    print_status "${CYAN}" "Services to start: ${services}"
    echo ""

    cd "${PROJECT_ROOT}"

    # Set COMPOSE_PROFILES environment variable for docker-compose
    export COMPOSE_PROFILES="${PROFILE}"

    # Start services in detached mode with profile
    if ! docker-compose -f "${DOCKER_COMPOSE_FILE}" --profile "${PROFILE}" up -d 2>&1; then
        error_exit "Failed to start Docker Compose services. Check docker-compose logs for details."
    fi

    echo ""
    print_status "${GREEN}" "✓ Services started in detached mode (profile: ${PROFILE})"
}

# Check backend health via HTTP endpoint
check_backend_health() {
    # Load environment variables
    local BACKEND_PORT=${BACKEND_PORT:-3001}

    # Check if backend /health/ready endpoint is responding
    local response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${BACKEND_PORT}/health/ready" 2>/dev/null || echo "000")

    if [ "${response}" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# Check frontend health via HTTP endpoint
check_frontend_health() {
    # Load environment variables
    local FRONTEND_PORT=${FRONTEND_PORT:-3000}

    # Check if frontend is responding
    local response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}/" 2>/dev/null || echo "000")

    if [ "${response}" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# Check Redis health via backend /health/ready endpoint
check_redis_health() {
    # Load environment variables
    local BACKEND_PORT=${BACKEND_PORT:-3001}

    # Check if backend reports Redis as healthy
    local cache_status=$(curl -s "http://localhost:${BACKEND_PORT}/health/ready" 2>/dev/null | grep -o '"cache":"ok"' || echo "")

    if [ -n "${cache_status}" ]; then
        return 0
    else
        return 1
    fi
}

# Display service status with progress indicator
display_service_status() {
    local service=$1
    local status=$2

    # Format: "Service:     Status"
    printf "  %-12s %s\n" "${service}:" "${status}"
}

# Wait for service to become healthy with real-time progress
wait_for_service_http() {
    local service=$1
    local check_function=$2
    local elapsed=0
    local last_status=""

    while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
        if $check_function; then
            display_service_status "${service}" "${GREEN}Healthy ✓${NC}"
            return 0
        fi

        # Update status display
        local remaining=$((HEALTH_CHECK_TIMEOUT - elapsed))
        local status="${YELLOW}Checking...${NC} (${remaining}s remaining)"

        if [ "${status}" != "${last_status}" ]; then
            display_service_status "${service}" "${status}"
            last_status="${status}"
        fi

        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
    done

    display_service_status "${service}" "${RED}Failed ✗${NC}"
    return 1
}

# Get service health status (Docker health check)
get_service_health() {
    local service=$1
    local container_name="${COMPOSE_PROJECT_NAME:-zero-to-running}-${service}"

    # Get health status from docker inspect
    local health_status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "${container_name}" 2>/dev/null || echo "not-running")

    echo "${health_status}"
}

# Wait for Docker container to be running
wait_for_container() {
    local service=$1
    local container_name="${COMPOSE_PROJECT_NAME:-zero-to-running}-${service}"
    local elapsed=0

    while [ $elapsed -lt 30 ]; do
        if docker ps --filter "name=${container_name}" --filter "status=running" | grep -q "${container_name}"; then
            return 0
        fi

        sleep 1
        elapsed=$((elapsed + 1))
    done

    return 1
}

# Perform database health verification
verify_database_health() {
    print_status "${BLUE}" "Verifying database health and schema initialization..."
    echo ""

    # Call database health check script
    if bash "${SCRIPT_DIR}/check-db-health.sh" 5 5; then
        echo ""
        print_status "${GREEN}" "✓ Database health verification passed"
        return 0
    else
        echo ""
        print_status "${RED}" "✗ Database health verification failed"
        print_status "${YELLOW}" "Troubleshooting suggestions:"
        print_status "${YELLOW}" "  - Check database logs: docker-compose logs postgres"
        print_status "${YELLOW}" "  - Verify DATABASE_PASSWORD in .env"
        print_status "${YELLOW}" "  - Ensure database schema was initialized (check init.sql)"
        print_status "${YELLOW}" "  - Try manual connection: docker exec -it zero-to-running-postgres psql -U postgres -d zero_to_running_dev"
        echo ""
        return 1
    fi
}

# Offer to show logs for a failed service
offer_logs_viewing() {
    local service=$1

    if [ "${SHOW_LOGS_ON_FAILURE}" = "true" ]; then
        echo ""
        print_status "${BLUE}" "Displaying logs for ${service}..."
        echo ""
        docker-compose -f "${DOCKER_COMPOSE_FILE}" logs --tail=50 "${service}"
        return
    fi

    echo ""
    read -p "View logs for ${service}? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        print_status "${BLUE}" "Displaying last 50 lines of logs for ${service}..."
        echo ""
        docker-compose -f "${DOCKER_COMPOSE_FILE}" logs --tail=50 "${service}"
        echo ""
    fi
}

# Display troubleshooting suggestions for a failed service
display_troubleshooting() {
    local service=$1
    local reason=${2:-"unknown"}

    echo ""
    print_status "${YELLOW}" "Troubleshooting suggestions for ${service}:"

    case "${service}" in
        "Database")
            print_status "${YELLOW}" "  - Check database logs: docker-compose logs postgres"
            print_status "${YELLOW}" "  - Verify DATABASE_PASSWORD in .env file"
            print_status "${YELLOW}" "  - Check if database port ${DATABASE_PORT:-5432} is available"
            print_status "${YELLOW}" "  - Verify database schema was initialized (check init.sql)"
            print_status "${YELLOW}" "  - Try manual connection: docker exec -it zero-to-running-postgres psql -U postgres"
            ;;
        "Backend")
            print_status "${YELLOW}" "  - Check backend logs: docker-compose logs backend"
            print_status "${YELLOW}" "  - Verify backend can connect to database and Redis"
            print_status "${YELLOW}" "  - Check if backend port ${BACKEND_PORT:-3001} is available"
            print_status "${YELLOW}" "  - Ensure .env variables are set correctly"
            print_status "${YELLOW}" "  - Check backend health endpoint manually: curl http://localhost:${BACKEND_PORT:-3001}/health/ready"
            ;;
        "Frontend")
            print_status "${YELLOW}" "  - Check frontend logs: docker-compose logs frontend"
            print_status "${YELLOW}" "  - Verify frontend can reach backend API"
            print_status "${YELLOW}" "  - Check if frontend port ${FRONTEND_PORT:-3000} is available"
            print_status "${YELLOW}" "  - Ensure VITE_API_URL is set correctly in .env"
            print_status "${YELLOW}" "  - Check for build errors in logs"
            ;;
        "Cache")
            print_status "${YELLOW}" "  - Check Redis logs: docker-compose logs redis"
            print_status "${YELLOW}" "  - Verify Redis port ${REDIS_PORT:-6379} is available"
            print_status "${YELLOW}" "  - Check if backend can connect to Redis"
            print_status "${YELLOW}" "  - Verify REDIS_URL in .env file"
            ;;
    esac

    echo ""
    print_status "${YELLOW}" "General troubleshooting:"
    print_status "${YELLOW}" "  - Stop and restart: make down && make dev"
    print_status "${YELLOW}" "  - Check Docker resources: docker system df"
    print_status "${YELLOW}" "  - View all logs: docker-compose logs"
    print_status "${YELLOW}" "  - Check container status: docker-compose ps"
}

# Check if service is in current profile
is_service_in_profile() {
    local service=$1
    local profile_services=$(get_profile_services)

    if [[ " ${profile_services} " =~ " ${service} " ]]; then
        return 0
    else
        return 1
    fi
}

# Wait for all services to become healthy (profile-aware)
wait_for_all_services() {
    print_status "${BLUE}" "Verifying services are healthy (profile: ${PROFILE})..."
    echo ""

    local failed_services=()

    # Display initial status based on profile
    display_service_status "Database" "${YELLOW}Starting...${NC}"
    display_service_status "Backend" "${YELLOW}Starting...${NC}"

    if is_service_in_profile "redis"; then
        display_service_status "Cache" "${YELLOW}Starting...${NC}"
    else
        display_service_status "Cache" "${BLUE}Skipped (not in profile)${NC}"
    fi

    if is_service_in_profile "frontend"; then
        display_service_status "Frontend" "${YELLOW}Starting...${NC}"
    else
        display_service_status "Frontend" "${BLUE}Skipped (not in profile)${NC}"
    fi

    echo ""

    # Wait for containers to start
    print_status "${BLUE}" "Waiting for containers to start..."
    sleep 3

    # Check Database (always included)
    display_service_status "Database" "${YELLOW}Checking...${NC}"
    if ! verify_database_health > /dev/null 2>&1; then
        display_service_status "Database" "${RED}Failed ✗${NC}"
        failed_services+=("postgres")
        display_troubleshooting "Database"
        offer_logs_viewing "postgres"
    else
        display_service_status "Database" "${GREEN}Healthy ✓${NC}"
    fi

    # Check Backend (always included)
    if ! wait_for_service_http "Backend" check_backend_health; then
        failed_services+=("backend")
        display_troubleshooting "Backend"
        offer_logs_viewing "backend"
    fi

    # Check Cache/Redis (only if in profile)
    if is_service_in_profile "redis"; then
        if [ ${#failed_services[@]} -eq 0 ] || [[ ! " ${failed_services[@]} " =~ " backend " ]]; then
            display_service_status "Cache" "${YELLOW}Checking...${NC}"
            if ! check_redis_health; then
                display_service_status "Cache" "${RED}Failed ✗${NC}"
                failed_services+=("redis")
                display_troubleshooting "Cache"
                offer_logs_viewing "redis"
            else
                display_service_status "Cache" "${GREEN}Healthy ✓${NC}"
            fi
        fi
    fi

    # Check Frontend (only if in profile)
    if is_service_in_profile "frontend"; then
        if ! wait_for_service_http "Frontend" check_frontend_health; then
            failed_services+=("frontend")
            display_troubleshooting "Frontend"
            offer_logs_viewing "frontend"
        fi
    fi

    echo ""

    if [ ${#failed_services[@]} -gt 0 ]; then
        print_status "${RED}" "✗ Health verification failed for: ${failed_services[*]}"
        echo ""
        print_status "${YELLOW}" "For more help, see documentation:"
        print_status "${YELLOW}" "  - README.md - Quick start guide"
        print_status "${YELLOW}" "  - docs/PROFILES.md - Profile documentation"
        echo ""
        return 1
    fi

    print_status "${GREEN}" "✓ All services in profile are healthy"
    return 0
}

# Display service URLs and connection strings (Story 2.3 AC3, AC6)
display_service_info() {
    # Load environment variables
    set -a
    source "${PROJECT_ROOT}/.env" 2>/dev/null || true
    set +a

    local FRONTEND_PORT=${FRONTEND_PORT:-3000}
    local BACKEND_PORT=${BACKEND_PORT:-3001}
    local DATABASE_PORT=${DATABASE_PORT:-5432}
    local DATABASE_HOST=${DATABASE_HOST:-localhost}
    local DATABASE_NAME=${DATABASE_NAME:-zero_to_running_dev}
    local DATABASE_USER=${DATABASE_USER:-postgres}
    local DATABASE_PASSWORD=${DATABASE_PASSWORD:-}
    local REDIS_PORT=${REDIS_PORT:-6379}
    local REDIS_HOST=${REDIS_HOST:-localhost}
    local REDIS_PASSWORD=${REDIS_PASSWORD:-}

    echo ""
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}SUCCESS! Environment ready for development.${NC}"
    echo -e "${GREEN}${BOLD}Profile: ${PROFILE}${NC}"
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BOLD}Service Access:${NC}"
    echo ""

    if is_service_in_profile "frontend"; then
        echo -e "${CYAN}Frontend:${NC}   http://localhost:${FRONTEND_PORT}"
    else
        echo -e "${CYAN}Frontend:${NC}   ${BLUE}Not started (not in ${PROFILE} profile)${NC}"
    fi

    echo -e "${CYAN}Backend:${NC}    http://localhost:${BACKEND_PORT}"
    echo ""
    echo -e "${BOLD}Connection Strings:${NC}"
    echo ""

    # Database connection string (mask password if set)
    if [ -n "${DATABASE_PASSWORD}" ]; then
        echo -e "${CYAN}Database:${NC}   postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}"
    else
        echo -e "${CYAN}Database:${NC}   postgresql://${DATABASE_USER}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}"
    fi

    # Redis connection string
    if is_service_in_profile "redis"; then
        if [ -n "${REDIS_PASSWORD}" ]; then
            echo -e "${CYAN}Redis:${NC}      redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}"
        else
            echo -e "${CYAN}Redis:${NC}      redis://${REDIS_HOST}:${REDIS_PORT}"
        fi
    else
        echo -e "${CYAN}Redis:${NC}      ${BLUE}Not started (not in ${PROFILE} profile)${NC}"
    fi

    echo ""
    echo -e "${BOLD}Profile Commands:${NC}"
    echo ""
    echo -e "  ${CYAN}make profiles${NC}              - List all available profiles"
    echo -e "  ${CYAN}make dev profile=minimal${NC}   - Switch to minimal profile"
    echo -e "  ${CYAN}make dev profile=full${NC}      - Switch to full profile"
    echo ""
    echo -e "${BOLD}Useful Commands:${NC}"
    echo ""
    echo -e "  ${CYAN}make down${NC}    - Stop all services"
    echo -e "  ${CYAN}make logs${NC}    - View service logs"
    echo -e "  ${CYAN}make status${NC}  - Check service health"
    echo ""
    echo -e "${GREEN}Press Ctrl+C to stop monitoring (services will continue running)${NC}"
    echo ""
}

# Handle interrupt signal (Ctrl+C)
handle_interrupt() {
    echo ""
    echo ""
    print_status "${YELLOW}" "Interrupt received. Services will continue running in the background."
    print_status "${YELLOW}" "To stop services: make down"
    echo ""
    exit 130
}

# Main execution
main() {
    # Set up interrupt handler
    trap handle_interrupt SIGINT SIGTERM

    print_banner

    # Pre-flight checks
    check_docker_daemon
    check_docker_compose
    check_env_file
    check_port_conflicts

    echo ""

    # Start services
    start_services

    # Wait for health checks
    if ! wait_for_all_services; then
        echo ""
        print_status "${RED}" "Startup failed. Services may be partially running."
        print_status "${YELLOW}" "To clean up: make down"
        echo ""
        exit 1
    fi

    # Display service information
    display_service_info

    exit 0
}

# Run main function
main "$@"
