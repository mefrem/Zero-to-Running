#!/usr/bin/env bash
# Zero-to-Running Startup Script
# Orchestrates Docker Compose service startup with health check validation
# Story 1.6: Service Orchestration & Single Command Startup

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
readonly HEALTH_CHECK_TIMEOUT=60
readonly HEALTH_CHECK_INTERVAL=2

# Service list in startup order
readonly SERVICES=("postgres" "redis" "backend" "frontend")

# Display banner
print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}=====================================${NC}"
    echo -e "${CYAN}${BOLD}  Zero-to-Running Development${NC}"
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

# Check for .env file
check_env_file() {
    print_status "${BLUE}" "Checking environment configuration..."

    if [ ! -f "${PROJECT_ROOT}/.env" ]; then
        print_status "${YELLOW}" "⚠ .env file not found"

        if [ -f "${PROJECT_ROOT}/.env.example" ]; then
            print_status "${YELLOW}" "Copying .env.example to .env..."
            cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
            print_status "${YELLOW}" "Please edit .env and set DATABASE_PASSWORD before running again"
            exit 1
        else
            error_exit ".env file not found and .env.example does not exist"
        fi
    fi

    # Check for required DATABASE_PASSWORD
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a

    if [ -z "${DATABASE_PASSWORD:-}" ]; then
        error_exit "DATABASE_PASSWORD is not set in .env file. Please set it and try again."
    fi

    print_status "${GREEN}" "✓ Environment configuration valid"
}

# Start Docker Compose services
start_services() {
    print_status "${BLUE}" "Starting Docker Compose services..."
    echo ""

    cd "${PROJECT_ROOT}"

    # Start services in detached mode
    if ! docker-compose -f "${DOCKER_COMPOSE_FILE}" up -d 2>&1; then
        error_exit "Failed to start Docker Compose services. Check docker-compose logs for details."
    fi

    echo ""
    print_status "${GREEN}" "✓ Services started in detached mode"
}

# Get service health status
get_service_health() {
    local service=$1
    local container_name="${COMPOSE_PROJECT_NAME:-zero-to-running}-${service}"

    # Get health status from docker inspect
    local health_status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "${container_name}" 2>/dev/null || echo "not-running")

    echo "${health_status}"
}

# Wait for service to become healthy
wait_for_service() {
    local service=$1
    local container_name="${COMPOSE_PROJECT_NAME:-zero-to-running}-${service}"
    local elapsed=0

    print_status "${CYAN}" "Waiting for ${service} to become healthy..."

    while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
        local health=$(get_service_health "${service}")

        case "${health}" in
            "healthy")
                print_status "${GREEN}" "✓ ${service} is healthy"
                return 0
                ;;
            "unhealthy")
                print_status "${RED}" "✗ ${service} is unhealthy"
                print_status "${YELLOW}" "Check logs: docker-compose logs ${service}"
                return 1
                ;;
            "starting")
                echo -n "."
                ;;
            "no-healthcheck")
                # Service has no health check, just verify it's running
                if docker ps --filter "name=${container_name}" --filter "status=running" | grep -q "${container_name}"; then
                    print_status "${GREEN}" "✓ ${service} is running"
                    return 0
                fi
                echo -n "."
                ;;
            "not-running")
                print_status "${RED}" "✗ ${service} is not running"
                return 1
                ;;
            *)
                echo -n "."
                ;;
        esac

        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
    done

    echo ""
    print_status "${RED}" "✗ ${service} did not become healthy within ${HEALTH_CHECK_TIMEOUT} seconds"
    print_status "${YELLOW}" "Check logs: docker-compose logs ${service}"
    return 1
}

# Wait for all services to become healthy
wait_for_all_services() {
    print_status "${BLUE}" "Waiting for services to become healthy..."
    echo ""

    local failed=0

    for service in "${SERVICES[@]}"; do
        if ! wait_for_service "${service}"; then
            failed=1
        fi
    done

    echo ""

    if [ $failed -eq 1 ]; then
        print_status "${RED}" "✗ One or more services failed to start"
        print_status "${YELLOW}" "Troubleshooting suggestions:"
        print_status "${YELLOW}" "  - Check service logs: docker-compose logs [service-name]"
        print_status "${YELLOW}" "  - Verify .env configuration"
        print_status "${YELLOW}" "  - Ensure no port conflicts"
        print_status "${YELLOW}" "  - Check Docker resources: docker system df"
        echo ""
        return 1
    fi

    print_status "${GREEN}" "✓ All services are healthy"
    return 0
}

# Display service URLs
display_service_info() {
    # Load environment variables
    set -a
    source "${PROJECT_ROOT}/.env" 2>/dev/null || true
    set +a

    local FRONTEND_PORT=${FRONTEND_PORT:-3000}
    local BACKEND_PORT=${BACKEND_PORT:-3001}
    local DATABASE_PORT=${DATABASE_PORT:-5432}
    local REDIS_PORT=${REDIS_PORT:-6379}

    echo ""
    echo -e "${CYAN}${BOLD}=====================================${NC}"
    echo -e "${GREEN}${BOLD}All Services Running Successfully!${NC}"
    echo -e "${CYAN}${BOLD}=====================================${NC}"
    echo ""
    echo -e "${BOLD}Service URLs:${NC}"
    echo -e "  ${CYAN}Frontend:${NC}    http://localhost:${FRONTEND_PORT}"
    echo -e "  ${CYAN}Backend API:${NC} http://localhost:${BACKEND_PORT}"
    echo -e "  ${CYAN}PostgreSQL:${NC}  localhost:${DATABASE_PORT}"
    echo -e "  ${CYAN}Redis:${NC}       localhost:${REDIS_PORT}"
    echo ""
    echo -e "${BOLD}Useful Commands:${NC}"
    echo -e "  ${CYAN}make down${NC}   - Stop all services"
    echo -e "  ${CYAN}make logs${NC}   - View service logs (coming soon)"
    echo -e "  ${CYAN}make status${NC} - Check service health (coming soon)"
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
    echo ""
}

# Main execution
main() {
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
        exit 1
    fi

    # Display service information
    display_service_info

    exit 0
}

# Run main function
main "$@"
