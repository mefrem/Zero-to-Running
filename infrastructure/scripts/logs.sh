#!/bin/bash

###############################################################################
# Log Retrieval and Aggregation Script
#
# Usage:
#   ./logs.sh [service] [follow] [lines]
#
# Arguments:
#   service - Service name to filter logs (backend, frontend, postgres, redis)
#   follow  - 'true' to stream logs in real-time (default: false)
#   lines   - Number of log lines to display (default: 100)
#
# Examples:
#   ./logs.sh                      # Show last 100 lines from all services
#   ./logs.sh backend              # Show last 100 lines from backend only
#   ./logs.sh backend true         # Follow backend logs in real-time
#   ./logs.sh backend false 200    # Show last 200 lines from backend
###############################################################################

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
COLOR_RESET="\033[0m"
COLOR_BACKEND="\033[36m"    # Cyan
COLOR_FRONTEND="\033[33m"   # Yellow
COLOR_POSTGRES="\033[35m"   # Magenta
COLOR_REDIS="\033[32m"      # Green
COLOR_ERROR="\033[31m"      # Red
COLOR_INFO="\033[34m"       # Blue

# Parse arguments
SERVICE="${1:-all}"
FOLLOW="${2:-false}"
LINES="${3:-100}"

# Validate service name
VALID_SERVICES=("all" "backend" "frontend" "postgres" "redis")
if [[ ! " ${VALID_SERVICES[@]} " =~ " ${SERVICE} " ]]; then
  echo -e "${COLOR_ERROR}Error: Invalid service name '${SERVICE}'${COLOR_RESET}"
  echo "Valid services: ${VALID_SERVICES[@]}"
  exit 1
fi

# Change to project root
cd "${PROJECT_ROOT}"

# Check if Docker Compose is running
if ! docker compose ps --services --filter "status=running" > /dev/null 2>&1; then
  echo -e "${COLOR_ERROR}Error: Docker Compose services are not running${COLOR_RESET}"
  echo "Please start services with: make dev"
  exit 1
fi

# Get color for service
get_service_color() {
  local service="$1"
  case "$service" in
    backend)
      echo -e "${COLOR_BACKEND}"
      ;;
    frontend)
      echo -e "${COLOR_FRONTEND}"
      ;;
    postgres)
      echo -e "${COLOR_POSTGRES}"
      ;;
    redis)
      echo -e "${COLOR_REDIS}"
      ;;
    *)
      echo -e "${COLOR_RESET}"
      ;;
  esac
}

# Display logs for a single service
show_service_logs() {
  local service="$1"
  local follow_mode="$2"
  local num_lines="$3"

  # Check if service exists and is running
  if ! docker compose ps --services --filter "status=running" | grep -q "^${service}$"; then
    echo -e "${COLOR_ERROR}Warning: Service '${service}' is not running${COLOR_RESET}"
    return
  fi

  local service_color
  service_color=$(get_service_color "$service")

  echo -e "${COLOR_INFO}=== Logs for ${service} ===${COLOR_RESET}"

  if [ "$follow_mode" = "true" ]; then
    # Follow mode - stream logs in real-time
    docker compose logs --follow --tail="$num_lines" "$service" 2>&1 | while IFS= read -r line; do
      echo -e "${service_color}[${service}]${COLOR_RESET} $line"
    done
  else
    # Static mode - show last N lines
    docker compose logs --tail="$num_lines" "$service" 2>&1 | while IFS= read -r line; do
      echo -e "${service_color}[${service}]${COLOR_RESET} $line"
    done
  fi
}

# Display logs for all services (aggregated)
show_all_logs() {
  local follow_mode="$1"
  local num_lines="$2"

  # Get list of running services
  local running_services
  running_services=$(docker compose ps --services --filter "status=running")

  if [ -z "$running_services" ]; then
    echo -e "${COLOR_ERROR}No services are running${COLOR_RESET}"
    exit 1
  fi

  echo -e "${COLOR_INFO}=== Aggregated logs from all services ===${COLOR_RESET}"
  echo -e "${COLOR_INFO}Services: ${running_services//$'\n'/, }${COLOR_RESET}"
  echo ""

  if [ "$follow_mode" = "true" ]; then
    # Follow mode - stream logs from all services
    docker compose logs --follow --tail="$num_lines" 2>&1 | while IFS= read -r line; do
      # Try to extract service name from docker-compose log format
      if [[ "$line" =~ ^([a-z-]+)-[0-9]+[[:space:]]*\| ]]; then
        local service="${BASH_REMATCH[1]}"
        local service_color
        service_color=$(get_service_color "$service")
        echo -e "${service_color}[${service}]${COLOR_RESET} $line"
      else
        echo "$line"
      fi
    done
  else
    # Static mode - show last N lines from all services, sorted by timestamp
    docker compose logs --tail="$num_lines" --timestamps 2>&1 | sort -t '|' -k 1,1 | while IFS= read -r line; do
      # Try to extract service name from docker-compose log format
      if [[ "$line" =~ ^([a-z-]+)-[0-9]+[[:space:]]*\| ]]; then
        local service="${BASH_REMATCH[1]}"
        local service_color
        service_color=$(get_service_color "$service")
        echo -e "${service_color}[${service}]${COLOR_RESET} $line"
      else
        echo "$line"
      fi
    done
  fi
}

# Main execution
main() {
  echo -e "${COLOR_INFO}Zero-to-Running Log Viewer${COLOR_RESET}"
  echo ""

  if [ "$SERVICE" = "all" ]; then
    show_all_logs "$FOLLOW" "$LINES"
  else
    show_service_logs "$SERVICE" "$FOLLOW" "$LINES"
  fi
}

# Run main function
main
