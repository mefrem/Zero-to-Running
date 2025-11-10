# Zero-to-Running Makefile
# GNU Make task automation for development workflows
# Compatible with macOS, Linux, and Windows (via WSL2)

# PHONY targets are not associated with files
.PHONY: help dev down logs status seed reset-db config clean

# Default target when 'make' is run without arguments
.DEFAULT_GOAL := help

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
	@echo "Example: make dev"
	@echo ""

##@ Development

dev: ## Start all services in development mode
	@bash infrastructure/scripts/startup.sh

down: ## Stop all running services
	@echo "====================================="
	@echo "Stopping Zero-to-Running Services"
	@echo "====================================="
	@echo ""
	@docker-compose down
	@echo ""
	@echo "✓ All services stopped"
	@echo "✓ Data volumes preserved (postgres-data, redis-data)"
	@echo ""
	@echo "To start services again: make dev"
	@echo "====================================="

##@ Monitoring

logs: ## View logs from all services (Coming in Story 2.4)
	@echo "Logs command will be implemented in Story 2.4"
	@echo "Will display real-time logs from all running services"

status: ## Check health status of all services (Coming in Story 2.5)
	@echo "Status command will be implemented in Story 2.5"
	@echo "Will verify that all services are healthy and responding"

##@ Database

seed: ## Seed database with development data (Coming in Story 3.5)
	@echo "Seed command will be implemented in Story 3.5"
	@echo "Will populate database with sample data for development"

reset-db: ## Reset and reseed database (Coming in Story 3.5)
	@echo "Reset-db command will be implemented in Story 3.5"
	@echo "Will drop, recreate, and reseed the database"

##@ Configuration

config: ## Validate environment configuration (Coming in Story 3.1)
	@echo "Config command will be implemented in Story 3.1"
	@echo "Will validate .env file and check for missing required variables"

##@ Cleanup

clean: ## Remove all containers, volumes, and build artifacts
	@echo "Cleaning up Docker resources..."
	@echo "Note: This will remove all containers and volumes (data will be lost)"
	@echo "To implement: Run 'docker-compose -f infrastructure/docker/docker-compose.yml down -v'"
	@echo "and 'docker system prune -f'"
