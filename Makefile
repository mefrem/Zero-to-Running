# Zero-to-Running Makefile
# GNU Make task automation for development workflows
# Compatible with macOS, Linux, and Windows (via WSL2)

# PHONY targets are not associated with files
.PHONY: help dev down logs status seed reset-db config clean profiles

# Default target when 'make' is run without arguments
.DEFAULT_GOAL := help

profile ?= full

##@ General

help: ## Display this help message with all available commands
	@echo "Zero-to-Running - Development Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""
	@echo "Examples:"
	@echo "  make dev                    # Start all services (full profile)"
	@echo "  make dev profile=minimal    # Start only backend + database"
	@echo "  make dev profile=full       # Start all services"
	@echo "  make profiles               # List available profiles"
	@echo ""

##@ Development

dev: ## Start services in development mode (use profile=minimal or profile=full)
	@bash infrastructure/scripts/startup.sh $(profile)

down: ## Stop all running services
	@echo "====================================="
	@echo "Stopping Zero-to-Running Services"
	@echo "====================================="
	@echo ""
	@if [ "$(profile)" = "minimal" ] || [ -z "$(profile)" ]; then \
		echo "Stopping core services (postgres, backend)"; \
		docker-compose down; \
	else \
		echo "Stopping profile: $(profile) (includes all core services)"; \
		COMPOSE_PROFILES=$(profile) docker-compose down; \
	fi
	@echo ""
	@echo "✓ All services stopped"
	@echo "✓ Data volumes preserved (postgres-data, redis-data)"
	@echo ""
	@echo "To start services again: make dev"
	@echo "====================================="

##@ Monitoring

logs: ## View logs from all services (use service=<name> to filter, follow=true to stream, lines=N for line count)
	@bash infrastructure/scripts/logs.sh $(service) $(follow) $(lines)

status: ## Check health status of all services with resource usage and port mappings
	@bash infrastructure/scripts/status.sh

##@ Database

seed: ## Seed database with development data
	@bash infrastructure/scripts/seed-database.sh

reset-db: ## Reset database (drop, recreate, run migrations) - add seed=true to also seed
	@if [ "$(seed)" = "true" ]; then \
		bash infrastructure/scripts/reset-database.sh --seed --force; \
	else \
		bash infrastructure/scripts/reset-database.sh --force; \
	fi

##@ Configuration

config: ## Validate environment configuration (use profile=<name> to validate specific profile)
	@bash infrastructure/scripts/validate-config.sh $(profile)

profiles: ## List all available profiles and their descriptions
	@bash infrastructure/scripts/validate-profile.sh --list

##@ Cleanup

clean: ## Remove all containers, volumes, and build artifacts
	@echo "Cleaning up Docker resources..."
	@echo "Note: This will remove all containers and volumes (data will be lost)"
	@echo "To implement: Run 'docker-compose -f infrastructure/docker/docker-compose.yml down -v'"
	@echo "and 'docker system prune -f'"
