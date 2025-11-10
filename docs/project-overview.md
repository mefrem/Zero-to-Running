# Zero-to-Running Developer Environment - Project Overview

**Organization:** Wander
**Last Updated:** 2025-11-10

## Project Mission

Enable developers to achieve a fully functional local development environment with a single command (`make dev`), eliminating setup friction and reducing onboarding time from hours/days to under 10 minutes.

## Tech Stack

- **Frontend**: TypeScript, React, Tailwind CSS (port 3000)
- **Backend API**: Node.js, Dora framework, TypeScript (port 3001)
- **Database**: PostgreSQL (port 5432)
- **Cache**: Redis (port 6379)
- **Orchestration**: Docker Compose (local), Kubernetes/GKE (production)
- **Build System**: GNU Make

## Core User Stories

1. Developer runs `make dev` → entire stack comes up healthy
2. Services communicate via Docker network (frontend→backend→database/cache)
3. Health checks verify all services are truly operational
4. Developer runs `make down` → clean teardown
5. Configuration via `.env` file (externalized, secure)

## Four Epics

1. **Foundation & Local Development Infrastructure** - Core containerization and service orchestration
2. **Service Health & Observability** - Health checks, logging, monitoring
3. **Configuration & Secret Management** - Environment variables, profiles, secret patterns
4. **Documentation & Developer Experience** - Comprehensive docs, error handling, troubleshooting

## Key Requirements

- **Single Command**: `make dev` brings up all services
- **Health Verification**: Automated health checks before marking services ready
- **Inter-Service Communication**: Custom Docker network with DNS resolution
- **Developer Friendly**: Hot reload, debug ports, clear error messages
- **Secure Patterns**: Mock secret management demonstrating production patterns
- **Complete Docs**: Getting started, architecture, troubleshooting, advanced customization

## Directory Structure

```
/frontend          - React/TS/Tailwind application
/backend           - Node/Dora/TS API service
/infrastructure    - Docker Compose, database migrations, seed data
/docs              - All documentation
/stories           - Story files for BMAD workflow
```

## Success Metrics

- Setup completes in < 10 minutes
- Developers spend 80%+ time coding vs. infrastructure management
- 90% reduction in environment-related support tickets

## Reference Documents

- Full PRD: `/docs/prd.md`
- Brief: `/docs/brief.md`
- Agent Configs: `/.claude/agents/`
