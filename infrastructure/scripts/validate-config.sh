#!/bin/bash

###############################################################################
# Configuration Validation Script
#
# Validates .env file for required variables, valid values, and port conflicts
# Used by 'make config' command
###############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

# Counters for validation results
ERROR_COUNT=0
WARNING_COUNT=0
declare -a ERRORS
declare -a WARNINGS

###############################################################################
# Helper Functions
###############################################################################

# Print colored message
print_color() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Add error message
add_error() {
  ERRORS+=("$1")
  ((ERROR_COUNT++))
}

# Add warning message
add_warning() {
  WARNINGS+=("$1")
  ((WARNING_COUNT++))
}

# Check if variable is set in .env
is_set() {
  local var_name=$1
  grep -q "^${var_name}=" "$ENV_FILE" 2>/dev/null
}

# Get variable value from .env
get_value() {
  local var_name=$1
  grep "^${var_name}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d '=' -f2- | sed 's/^"//;s/"$//' | tr -d '\n\r'
}

# Validate port number
validate_port() {
  local port_name=$1
  local port_value=$2

  # Check if port is a number
  if ! [[ "$port_value" =~ ^[0-9]+$ ]]; then
    add_error "$port_name must be a number, got: $port_value"
    return 1
  fi

  # Check if port is in valid range
  if [ "$port_value" -lt 1 ] || [ "$port_value" -gt 65535 ]; then
    add_error "$port_name must be between 1 and 65535, got: $port_value"
    return 1
  fi

  # Warn about privileged ports
  if [ "$port_value" -lt 1024 ]; then
    add_warning "$port_name ($port_value) is a privileged port (< 1024) and may require elevated permissions"
  fi

  return 0
}

# Validate LOG_LEVEL
validate_log_level() {
  local log_level=$1
  local valid_levels=("ERROR" "WARN" "INFO" "DEBUG" "TRACE" "error" "warn" "info" "debug" "trace")

  local is_valid=0
  for level in "${valid_levels[@]}"; do
    if [ "$log_level" == "$level" ]; then
      is_valid=1
      break
    fi
  done

  if [ $is_valid -eq 0 ]; then
    add_error "LOG_LEVEL must be one of: ERROR, WARN, INFO, DEBUG, TRACE (got: $log_level)"
    return 1
  fi

  return 0
}

# Validate LOG_FORMAT
validate_log_format() {
  local log_format=$1

  if [ "$log_format" != "json" ] && [ "$log_format" != "pretty" ]; then
    add_error "LOG_FORMAT must be 'json' or 'pretty' (got: $log_format)"
    return 1
  fi

  return 0
}

# Check if value is a mock secret (starts with CHANGE_ME_)
is_mock_secret() {
  local value=$1
  [[ "$value" == CHANGE_ME_* ]]
}

# Check for weak/default passwords
validate_password() {
  local var_name=$1
  local password=$2
  local weak_passwords=("password" "postgres" "123456" "admin" "root" "test")

  # Check if password is empty
  if [ -z "$password" ]; then
    add_error "$var_name is required and cannot be empty"
    return 1
  fi

  # Check for mock secret (CHANGE_ME_ prefix) - warn but don't fail
  if is_mock_secret "$password"; then
    add_warning "$var_name is using a mock development value (${password:0:20}...). Safe for local development, replace in production."
    return 0
  fi

  # Check for truly weak passwords (not mock secrets)
  for weak in "${weak_passwords[@]}"; do
    if [ "$password" == "$weak" ]; then
      add_error "$var_name is using a weak password. Please set a strong password."
      return 1
    fi
  done

  # Check password length
  if [ ${#password} -lt 8 ]; then
    add_warning "$var_name should be at least 8 characters long (current: ${#password})"
  fi

  return 0
}

# Validate secret key
validate_secret() {
  local var_name=$1
  local secret=$2
  local weak_secrets=("secret" "session")

  # Check if secret is empty
  if [ -z "$secret" ]; then
    add_error "$var_name is required and cannot be empty"
    return 1
  fi

  # Check for mock secret (CHANGE_ME_ prefix) - warn but don't fail
  if is_mock_secret "$secret"; then
    add_warning "$var_name is using a mock development value (${secret:0:20}...). Safe for local development, replace in production."
    return 0
  fi

  # Check for truly weak secrets (not mock secrets)
  for weak in "${weak_secrets[@]}"; do
    if [ "$secret" == "$weak" ]; then
      add_error "$var_name is using a weak value. Please generate a strong random secret."
      return 1
    fi
  done

  # Check secret length
  if [ ${#secret} -lt 32 ]; then
    add_warning "$var_name should be at least 32 characters long for security (current: ${#secret})"
  fi

  return 0
}

###############################################################################
# Main Validation Logic
###############################################################################

print_color "$BLUE" "====================================="
print_color "$BLUE" "Environment Configuration Validator"
print_color "$BLUE" "====================================="
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  print_color "$RED" "Error: .env file not found at $ENV_FILE"
  echo ""
  print_color "$YELLOW" "To create one, run:"
  print_color "$YELLOW" "  cp .env.example .env"
  echo ""
  exit 1
fi

# Check if .env.example exists (for reference)
if [ ! -f "$ENV_EXAMPLE" ]; then
  add_warning ".env.example file not found. Cannot compare against reference."
fi

print_color "$GREEN" "✓ Found .env file at: $ENV_FILE"
echo ""

# Validate required variables
print_color "$BLUE" "Checking required variables..."

required_vars=(
  "DATABASE_PASSWORD"
  "SESSION_SECRET"
)

for var in "${required_vars[@]}"; do
  if ! is_set "$var"; then
    add_error "Required variable $var is not set"
  else
    value=$(get_value "$var")
    if [ -z "$value" ]; then
      add_error "Required variable $var is set but empty"
    fi
  fi
done

# Validate ports
print_color "$BLUE" "Validating port numbers..."

declare -A ports
ports["FRONTEND_PORT"]=$(get_value "FRONTEND_PORT")
ports["BACKEND_PORT"]=$(get_value "BACKEND_PORT")
ports["DATABASE_PORT"]=$(get_value "DATABASE_PORT")
ports["REDIS_PORT"]=$(get_value "REDIS_PORT")

# Validate each port
for port_name in "${!ports[@]}"; do
  port_value="${ports[$port_name]}"
  if [ -n "$port_value" ]; then
    validate_port "$port_name" "$port_value"
  fi
done

# Check for duplicate ports
declare -A port_counts
for port_name in "${!ports[@]}"; do
  port_value="${ports[$port_name]}"
  if [ -n "$port_value" ]; then
    if [ -n "${port_counts[$port_value]}" ]; then
      add_error "Duplicate port $port_value used by $port_name and ${port_counts[$port_value]}"
    else
      port_counts[$port_value]=$port_name
    fi
  fi
done

# Validate LOG_LEVEL
print_color "$BLUE" "Validating logging configuration..."

log_level=$(get_value "LOG_LEVEL")
if [ -n "$log_level" ]; then
  validate_log_level "$log_level"
fi

log_format=$(get_value "LOG_FORMAT")
if [ -n "$log_format" ]; then
  validate_log_format "$log_format"
fi

# Validate passwords and secrets
print_color "$BLUE" "Validating security settings..."

database_password=$(get_value "DATABASE_PASSWORD")
if [ -n "$database_password" ]; then
  validate_password "DATABASE_PASSWORD" "$database_password"
fi

session_secret=$(get_value "SESSION_SECRET")
if [ -n "$session_secret" ]; then
  validate_secret "SESSION_SECRET" "$session_secret"
fi

jwt_secret=$(get_value "JWT_SECRET")
if [ -n "$jwt_secret" ]; then
  validate_secret "JWT_SECRET" "$jwt_secret"
fi

# Validate database configuration
print_color "$BLUE" "Validating database configuration..."

database_host=$(get_value "DATABASE_HOST")
if [ -z "$database_host" ]; then
  add_warning "DATABASE_HOST is not set (will use default: postgres)"
fi

database_name=$(get_value "DATABASE_NAME")
if [ -z "$database_name" ]; then
  add_warning "DATABASE_NAME is not set (will use default: zero_to_running_dev)"
fi

database_user=$(get_value "DATABASE_USER")
if [ -z "$database_user" ]; then
  add_warning "DATABASE_USER is not set (will use default: postgres)"
fi

# Validate Redis configuration
print_color "$BLUE" "Validating Redis configuration..."

redis_host=$(get_value "REDIS_HOST")
if [ -z "$redis_host" ]; then
  add_warning "REDIS_HOST is not set (will use default: redis)"
fi

###############################################################################
# Display Results
###############################################################################

echo ""
print_color "$BLUE" "====================================="
print_color "$BLUE" "Validation Results"
print_color "$BLUE" "====================================="
echo ""

# Display errors
if [ $ERROR_COUNT -gt 0 ]; then
  print_color "$RED" "✗ Found $ERROR_COUNT error(s):"
  echo ""
  for i in "${!ERRORS[@]}"; do
    print_color "$RED" "  $((i+1)). ${ERRORS[$i]}"
  done
  echo ""
fi

# Display warnings
if [ $WARNING_COUNT -gt 0 ]; then
  print_color "$YELLOW" "⚠ Found $WARNING_COUNT warning(s):"
  echo ""
  for i in "${!WARNINGS[@]}"; do
    print_color "$YELLOW" "  $((i+1)). ${WARNINGS[$i]}"
  done
  echo ""
fi

# Check for mock secrets and display prominent warning
detect_mock_secrets() {
  local mock_secrets=()

  if is_mock_secret "$(get_value 'DATABASE_PASSWORD')"; then
    mock_secrets+=("DATABASE_PASSWORD")
  fi

  if is_mock_secret "$(get_value 'REDIS_PASSWORD')"; then
    mock_secrets+=("REDIS_PASSWORD")
  fi

  if is_mock_secret "$(get_value 'SESSION_SECRET')"; then
    mock_secrets+=("SESSION_SECRET")
  fi

  if is_mock_secret "$(get_value 'JWT_SECRET')"; then
    mock_secrets+=("JWT_SECRET")
  fi

  if [ ${#mock_secrets[@]} -gt 0 ]; then
    echo ""
    print_color "$YELLOW" "================================================================================"
    print_color "$YELLOW" "⚠️  WARNING: Mock secrets detected in use (development only!)"
    print_color "$YELLOW" "================================================================================"
    echo ""
    print_color "$YELLOW" "The following mock secrets are currently configured:"
    for secret in "${mock_secrets[@]}"; do
      print_color "$YELLOW" "  • $secret"
    done
    echo ""
    print_color "$YELLOW" "These are safe for local development, but should NEVER be used in production."
    echo ""
    print_color "$YELLOW" "For production deployment, see: /docs/SECRET_MANAGEMENT.md"
    print_color "$YELLOW" "Generate strong secrets with: openssl rand -base64 32"
    print_color "$YELLOW" "================================================================================"
    echo ""
  fi
}

# Display summary
if [ $ERROR_COUNT -eq 0 ] && [ $WARNING_COUNT -eq 0 ]; then
  print_color "$GREEN" "✓ Configuration is valid!"
  echo ""
  print_color "$GREEN" "Summary:"
  print_color "$GREEN" "  • Frontend Port: ${ports[FRONTEND_PORT]:-3000 (default)}"
  print_color "$GREEN" "  • Backend Port: ${ports[BACKEND_PORT]:-3001 (default)}"
  print_color "$GREEN" "  • Database Port: ${ports[DATABASE_PORT]:-5432 (default)}"
  print_color "$GREEN" "  • Redis Port: ${ports[REDIS_PORT]:-6379 (default)}"
  print_color "$GREEN" "  • Log Level: ${log_level:-INFO (default)}"
  print_color "$GREEN" "  • Log Format: ${log_format:-pretty (default)}"
  echo ""

  # Display mock secret warning if applicable
  detect_mock_secrets
elif [ $ERROR_COUNT -eq 0 ]; then
  print_color "$GREEN" "✓ Configuration is valid (with warnings)"
  echo ""
  print_color "$YELLOW" "Please review the warnings above."
  echo ""

  # Display mock secret warning if applicable
  detect_mock_secrets
else
  print_color "$RED" "✗ Configuration validation failed"
  echo ""
  print_color "$YELLOW" "Please fix the errors above and run 'make config' again."
  echo ""
  exit 1
fi

print_color "$BLUE" "====================================="
echo ""
