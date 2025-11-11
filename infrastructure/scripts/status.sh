#!/usr/bin/env bash
# Zero-to-Running Service Status Monitor
# Displays comprehensive status table for all Docker Compose services

set -euo pipefail

# Colors for output
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    RESET='\033[0m'
else
    GREEN=''
    YELLOW=''
    RED=''
    BLUE=''
    BOLD=''
    RESET=''
fi

# Get compose project name from .env or use default
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-zero-to-running}"

# Service names we expect
SERVICES=("frontend" "backend" "postgres" "redis")

# Function to check if Docker is running
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed or not in PATH${RESET}"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo -e "${RED}Error: Docker daemon is not running${RESET}"
        echo "Please start Docker and try again."
        exit 1
    fi
}

# Function to get container name for a service
get_container_name() {
    local service=$1
    echo "${COMPOSE_PROJECT_NAME}-${service}"
}

# Function to get container status
get_container_status() {
    local container=$1

    if ! docker ps -a --filter "name=^${container}$" --format "{{.Status}}" 2>/dev/null | head -1; then
        echo "not_found"
    fi
}

# Function to determine health status from container status
get_health_status() {
    local status=$1

    if [[ "$status" == "not_found" ]] || [[ -z "$status" ]]; then
        echo "Stopped"
    elif echo "$status" | grep -q "Up.*healthy"; then
        echo "Healthy"
    elif echo "$status" | grep -q "Up.*unhealthy"; then
        echo "Unhealthy"
    elif echo "$status" | grep -q "Up"; then
        echo "Running"
    else
        echo "Stopped"
    fi
}

# Function to get colored status
get_colored_status() {
    local health=$1

    case "$health" in
        "Healthy")
            echo -e "${GREEN}${health}${RESET}"
            ;;
        "Running")
            echo -e "${BLUE}${health}${RESET}"
            ;;
        "Unhealthy")
            echo -e "${RED}${health}${RESET}"
            ;;
        "Stopped")
            echo -e "${YELLOW}${health}${RESET}"
            ;;
        *)
            echo -e "${health}"
            ;;
    esac
}

# Function to get uptime
get_uptime() {
    local container=$1
    local status=$2

    if [[ "$status" != "Healthy" && "$status" != "Running" && "$status" != "Unhealthy" ]]; then
        echo "---"
        return
    fi

    local started=$(docker inspect --format='{{.State.StartedAt}}' "$container" 2>/dev/null || echo "")

    if [[ -z "$started" ]]; then
        echo "---"
        return
    fi

    local started_epoch=$(date -d "$started" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${started%.*}" +%s 2>/dev/null || echo "0")
    local now_epoch=$(date +%s)
    local uptime_seconds=$((now_epoch - started_epoch))

    if [[ $uptime_seconds -lt 60 ]]; then
        echo "${uptime_seconds}s"
    elif [[ $uptime_seconds -lt 3600 ]]; then
        local minutes=$((uptime_seconds / 60))
        local seconds=$((uptime_seconds % 60))
        echo "${minutes}m ${seconds}s"
    else
        local hours=$((uptime_seconds / 3600))
        local minutes=$(((uptime_seconds % 3600) / 60))
        echo "${hours}h ${minutes}m"
    fi
}

# Function to get CPU and memory stats
get_stats() {
    local container=$1
    local status=$2

    if [[ "$status" != "Healthy" && "$status" != "Running" && "$status" != "Unhealthy" ]]; then
        echo "--- ---"
        return
    fi

    # Get stats with 1 second no-stream
    local stats=$(docker stats "$container" --no-stream --format "{{.CPUPerc}} {{.MemUsage}}" 2>/dev/null || echo "--- ---")

    if [[ "$stats" == "--- ---" ]]; then
        echo "--- ---"
        return
    fi

    # Parse CPU and memory
    local cpu=$(echo "$stats" | awk '{print $1}')
    local mem=$(echo "$stats" | awk '{print $2}')

    echo "$cpu $mem"
}

# Function to get port mappings
get_ports() {
    local container=$1
    local status=$2

    if [[ "$status" != "Healthy" && "$status" != "Running" && "$status" != "Unhealthy" ]]; then
        echo "---"
        return
    fi

    local ports=$(docker port "$container" 2>/dev/null | awk -F'->' '{print $2}' | awk -F':' '{print $2}' | tr '\n' ',' | sed 's/,$//' || echo "---")

    if [[ -z "$ports" ]]; then
        echo "---"
    else
        echo "$ports"
    fi
}

# Main execution
main() {
    echo ""
    echo -e "${BOLD}Zero-to-Running Service Status${RESET}"
    echo ""

    # Check Docker availability
    check_docker

    # Check if any containers are running
    local container_count=$(docker ps -a --filter "name=${COMPOSE_PROJECT_NAME}-" --format "{{.Names}}" 2>/dev/null | wc -l)

    if [[ $container_count -eq 0 ]]; then
        echo -e "${YELLOW}No services are running.${RESET}"
        echo "Start services with: make dev"
        echo ""
        exit 0
    fi

    # Print table header
    printf "%-12s %-12s %-12s %-8s %-10s %-12s\n" "Service" "Status" "Uptime" "CPU" "Memory" "Ports"
    printf "%-12s %-12s %-12s %-8s %-10s %-12s\n" "--------" "------" "------" "---" "------" "-----"

    # Track if any service is unhealthy
    local has_unhealthy=false

    # Iterate through services
    for service in "${SERVICES[@]}"; do
        local container=$(get_container_name "$service")
        local status=$(get_container_status "$container")
        local health=$(get_health_status "$status")

        # Get uptime
        local uptime=$(get_uptime "$container" "$health")

        # Get stats (CPU and memory)
        local stats=$(get_stats "$container" "$health")
        local cpu=$(echo "$stats" | awk '{print $1}')
        local mem=$(echo "$stats" | awk '{print $2}')

        # Get ports
        local ports=$(get_ports "$container" "$health")

        # Check if unhealthy
        if [[ "$health" == "Unhealthy" || "$health" == "Stopped" ]]; then
            has_unhealthy=true
        fi

        # Print row without color for status (will add color in-line)
        printf "%-12s " "$service"
        printf "%-20s " "$(get_colored_status "$health")"
        printf "%-12s %-8s %-10s %-12s\n" "$uptime" "$cpu" "$mem" "$ports"
    done

    echo ""

    # Show recommendation if unhealthy services found
    if [[ "$has_unhealthy" == true ]]; then
        echo -e "${YELLOW}⚠  Some services are unhealthy or stopped.${RESET}"
        echo "Run 'make logs' to view logs and troubleshoot."
        echo ""
    else
        echo -e "${GREEN}✓ All services are healthy${RESET}"
        echo ""
    fi

    # Show help hint
    echo "Tips:"
    echo "  - Use 'make logs' to view service logs"
    echo "  - Use 'make logs service=<name>' to view specific service logs"
    echo "  - Use 'make dev' to start/restart services"
    echo "  - Use 'make down' to stop all services"
    echo ""
}

# Run main
main
